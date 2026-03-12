import os
import threading
import httpx
import json
import ssl
import urllib.request
import re
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from datetime import datetime, timezone, timedelta
from dateutil.parser import parse as date_parse
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from user_agents import parse
import pycountry
import jwt
import time
from functools import wraps
from sites_config import get_sites_list, get_site_url
from auth_config import verify_gcp_token, extract_user_info, GCP_CLIENT_ID, JWT_SECRET_KEY

load_dotenv()

# Serve static files from 'static_frontend' folder (which will contain the Next.js export)
app = Flask(__name__, static_folder='static_frontend', static_url_path='')
CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "OPTIONS"])

# ensure SQL definitions are applied once the app starts handling
# requests.  this keeps the Docker init script from being the only place
# the function gets updated.
# NOTE: @app.before_first_request was removed in Flask 3.x – use a flag instead.
_db_init_done = threading.Event()
_app_users_cache_lock = threading.Lock()
_app_users_cache = {}

# App-user proxy networking defaults. Read timeout is intentionally generous
# because upstream endpoints can return large payloads.
APP_USERS_CONNECT_TIMEOUT_SEC = float(os.environ.get('APP_USERS_CONNECT_TIMEOUT_SEC', '20'))
APP_USERS_READ_TIMEOUT_SEC = float(os.environ.get('APP_USERS_READ_TIMEOUT_SEC', '120'))
APP_USERS_RETRIES = int(os.environ.get('APP_USERS_RETRIES', '1'))
APP_USERS_CHUNK_DAYS = int(os.environ.get('APP_USERS_CHUNK_DAYS', '7'))
APP_USERS_CHUNK_LOOKBACK_DAYS = int(os.environ.get('APP_USERS_CHUNK_LOOKBACK_DAYS', '90'))
APP_USERS_TRUST_ENV = os.environ.get('APP_USERS_TRUST_ENV', 'true').lower() == 'true'
APP_USERS_TOTAL_TIMEOUT_SEC = float(os.environ.get('APP_USERS_TOTAL_TIMEOUT_SEC', '25'))
APP_USERS_ENABLE_URLLIB_FALLBACK = os.environ.get('APP_USERS_ENABLE_URLLIB_FALLBACK', 'false').lower() == 'true'
APP_USERS_FORCE_IPV4 = os.environ.get('APP_USERS_FORCE_IPV4', 'true').lower() == 'true'


def _post_upstream_json_with_urllib(url, body_data, max_seconds=None):
    """Fallback HTTP client for environments where httpx networking is unstable."""
    payload = json.dumps(body_data).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/144.0.0.0 Safari/537.36'
            ),
        },
        method='POST',
    )
    # Match existing behavior: allow non-standard cert chains used by institutional hosts.
    context = ssl._create_unverified_context()
    timeout = APP_USERS_CONNECT_TIMEOUT_SEC + APP_USERS_READ_TIMEOUT_SEC
    if max_seconds is not None:
        timeout = max(1.0, min(timeout, float(max_seconds)))
    if APP_USERS_TRUST_ENV:
        with urllib.request.urlopen(req, timeout=timeout, context=context) as response:
            raw = response.read().decode('utf-8', errors='replace')
    else:
        # Optional direct mode for environments where proxies break upstream routing.
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({}),
            urllib.request.HTTPSHandler(context=context),
        )
        with opener.open(req, timeout=timeout) as response:
            raw = response.read().decode('utf-8', errors='replace')
    return json.loads(raw)

@app.before_request
def _init_db_once():
    if not _db_init_done.is_set():
        ensure_db_functions()
        _db_init_done.set()

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/login')
def serve_login():
    """Serve login page"""
    return send_from_directory(app.static_folder, 'index.html')

# Catch-all for SPA routing - must be last
@app.route('/<path:path>')
def serve_static(path):
    # Skip API routes and auth routes - let them be handled by their specific handlers
    if path.startswith('api/') or path.startswith('track') or path.startswith('log/'):
        return '', 404
    
    # If file exists as a static file, serve it
    full_path = os.path.join(app.root_path, app.static_folder, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    
    # Otherwise fallback to index.html for SPA routing (Next.js handles client-side routing)
    return send_from_directory(app.static_folder, 'index.html')

# Database connection parameters
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_NAME = os.environ.get("DB_NAME", "trac_db")
DB_USER = os.environ.get("DB_USER", "trac_user")
DB_PASS = os.environ.get("DB_PASS", "trac_password")
DB_PORT = os.environ.get("DB_PORT", "5432")

def get_db_connection():
    """Return a new connection to the analytics database.

    We don't automatically load the SQL schema here because the Flask
    application may be started in environments where the database is
    already initialised.  The helper below (``ensure_db_functions``) takes
    care of applying the latest version of the stored procedure on first
    request, which means deployments don't have to remember to re‑run the
    SQL file manually every time it changes.
    """
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        port=DB_PORT
    )
    return conn

def get_country_code(country_name):
    if not country_name or country_name.lower() == 'unknown':
        return None
    try:
        country = pycountry.countries.get(name=country_name)
        if country:
            return country.alpha_2
        fuzzy = pycountry.countries.search_fuzzy(country_name)
        if fuzzy:
            return fuzzy[0].alpha_2
    except Exception:
        return None
    return None


def ensure_db_functions():
    """Load/refresh database-side SQL (visitors table & analytics function).

    This is safe to call multiple times because the SQL uses
    "CREATE OR REPLACE".  We invoke it from ``before_first_request`` so that
    the stored procedure is always up‑to‑date with whatever version is checked
    into source control.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        sql_path = os.path.join(os.path.dirname(__file__), 'supabase_analytics_function.sql')
        with open(sql_path, 'r', encoding='utf-8') as f:
            cur.execute(f.read())
        conn.commit()
        app.logger.info("Database functions ensured/up-to-date.")
    except Exception as e:
        app.logger.error(f"Error ensuring DB functions: {e}")
    finally:
        if conn:
            conn.close()


def token_required(f):
    """Decorator to verify JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        if not token:
            return jsonify({'message': 'Unauthorized: No token provided'}), 401
        
        try:
            data = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
            request.user = data  # Attach user info to request
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Unauthorized: Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Unauthorized: Invalid token'}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    """
    Exchange GCP ID token for JWT token
    Expects: {"token": "<gcp_id_token>"}
    """
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        data = request.get_json()
        gcp_token = data.get('token')
        
        if not gcp_token:
            return jsonify({'message': 'No token provided'}), 400
        
        # Verify GCP token
        idinfo = verify_gcp_token(gcp_token)
        if not idinfo:
            return jsonify({'message': 'Invalid GCP token'}), 401
        
        # Extract user info
        user_info = extract_user_info(idinfo)
        if not user_info:
            return jsonify({'message': 'Failed to extract user information'}), 400
        
        # Create JWT token
        payload = {
            'email': user_info['email'],
            'name': user_info['name'],
            'picture': user_info['picture'],
            'sub': user_info['sub'],
            'exp': time.time() + (24 * 60 * 60),  # 24 hour expiration
            'iat': time.time()
        }
        jwt_token = jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')
        
        return jsonify({
            'success': True,
            'token': jwt_token,
            'user': {
                'email': user_info['email'],
                'name': user_info['name'],
                'picture': user_info['picture']
            }
        }), 200
        
    except Exception as e:
        app.logger.error(f"Login error: {str(e)}")
        return jsonify({'message': f'Login failed: {str(e)}'}), 500


@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    """Logout endpoint (token invalidation on client side)"""
    if request.method == 'OPTIONS':
        return '', 200
    
    return jsonify({'message': 'Logged out successfully'}), 200


@app.route('/api/auth/verify', methods=['GET', 'OPTIONS'])
@token_required
def verify_token():
    """Verify current JWT token and return user info"""
    if request.method == 'OPTIONS':
        return '', 200
    
    return jsonify({
        'success': True,
        'user': request.user
    }), 200


@app.route('/api/sites', methods=['GET', 'OPTIONS'])
def get_sites():
    """Return list of available sites for the dropdown"""
    if request.method == 'OPTIONS':
        return '', 200
    
    sites = get_sites_list()
    return jsonify({'sites': sites})


@app.route('/api/analytics', methods=['GET', 'OPTIONS'])
def get_analytics():
    if request.method == 'OPTIONS':
        return '', 200

    conn = None
    try:
        app.logger.info("=== API ANALYTICS REQUEST ===")
        params = {
            'country_filter': request.args.get('country_filter'),
            'start_date_filter': request.args.get('start_date_filter'),
            'end_date_filter': request.args.get('end_date_filter'),
            'visitor_type_filter': request.args.get('visitor_type_filter'),
            'device_filter': request.args.get('device_filter'),
            'url_filter': request.args.get('url_filter'),
            'browser_filter': request.args.get('browser_filter'),
            'ip_filter': request.args.get('ip_filter'),
            'isp_filter': request.args.get('isp_filter'),
        }
        
        # Handle site filter
        site_filter = request.args.get('site_filter', 'all')
        site_url = get_site_url(site_filter) if site_filter else None
        app.logger.info(f"Resolved site_filter='{site_filter}' to site_url='{site_url}'")
        if site_url:
            # If a specific site is selected, filter by page_visited.  we lowercase
            # the pattern here to match the ILIKE used inside the stored function
            # and to avoid any accidental case sensitivity issues.
            params['url_filter'] = site_url.lower()
        else:
            # "All sites" - don't override url_filter (use custom filter if provided)
            if not request.args.get('url_filter'):
                params['url_filter'] = None

        # Helper for dynamic period logic
        period = request.args.get('period', 'day')
        app.logger.info(f"Period requested: {period}, Site filter: {site_filter}, URL filter: {params['url_filter']}")
        now = datetime.now(timezone.utc)  # Use UTC timezone-aware datetime
        
        # Defaults
        granularity = 'day'
        
        # ONLY apply default period logic if explicit dates are NOT provided
        if not params['start_date_filter'] and not params['end_date_filter']:
            app.logger.info(f"No custom dates provided, using period logic")
            if period == 'day':
                granularity = 'hour'
                # Default "24h" view - set end_date to end of today
                start_date_filter = (now - timedelta(days=1)).isoformat()
                end_date_filter = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
                params['start_date_filter'] = start_date_filter
                params['end_date_filter'] = end_date_filter
                app.logger.info(f"24H: {start_date_filter} to {end_date_filter}")
                
            elif period == 'week':
                granularity = 'day'
                # 7 days view - set end_date to end of today
                start_date_filter = (now - timedelta(days=7)).isoformat()
                end_date_filter = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
                params['start_date_filter'] = start_date_filter
                params['end_date_filter'] = end_date_filter
                app.logger.info(f"7D: {start_date_filter} to {end_date_filter}")
                
            elif period == 'month':
                granularity = 'day'
                # 30 days view - set end_date to end of today
                start_date_filter = (now - timedelta(days=30)).isoformat()
                end_date_filter = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
                params['start_date_filter'] = start_date_filter
                params['end_date_filter'] = end_date_filter
                app.logger.info(f"30D: {start_date_filter} to {end_date_filter}")
        else:
            app.logger.info(f"Custom dates provided")

        # Parse user-provided custom dates (only if they exist)
        if request.args.get('start_date_filter'):
            try:
                dt = date_parse(request.args.get('start_date_filter'))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                params['start_date_filter'] = dt.isoformat()
            except Exception as e:
                app.logger.error(f"Error parsing start_date: {e}")
                params['start_date_filter'] = None
                
        if request.args.get('end_date_filter'):
            try:
                dt = date_parse(request.args.get('end_date_filter'))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                # If date-only string, set to end of day
                if len(request.args.get('end_date_filter', '').strip()) <= 10:
                    dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
                params['end_date_filter'] = dt.isoformat()
            except Exception as e:
                app.logger.error(f"Error parsing end_date: {e}")
                params['end_date_filter'] = None
        
        # Clean up other filters - convert empty strings to None
        for k in ['country_filter', 'device_filter', 'browser_filter', 'visitor_type_filter', 'url_filter', 'ip_filter', 'isp_filter']:
            if not params.get(k):
                params[k] = None

        params['granularity'] = granularity
        
        # Debug logging
        app.logger.info(f"Final params - start: {params['start_date_filter']}, end: {params['end_date_filter']}, granularity: {granularity}")
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check raw visitor count
        cur.execute("SELECT COUNT(*) as cnt FROM public.visitors WHERE first_seen IS NOT NULL")
        visitor_check = cur.fetchone()
        app.logger.info(f"Total visitors with first_seen: {visitor_check['cnt'] if visitor_check else 0}")
        
        # Check visitors in the date range
        if params['start_date_filter'] and params['end_date_filter']:
            cur.execute(
                "SELECT COUNT(*) as cnt FROM public.visitors WHERE first_seen >= %s AND first_seen <= %s",
                (params['start_date_filter'], params['end_date_filter'])
            )
            range_check = cur.fetchone()
            app.logger.info(f"Visitors in date range ({params['start_date_filter']} to {params['end_date_filter']}): {range_check['cnt'] if range_check else 0}")
        
        # Call the stored function
        cur.execute("""
            SELECT get_filtered_analytics_visual(
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) as data
        """, (
            params['country_filter'],
            params['start_date_filter'],
            params['end_date_filter'],
            params['visitor_type_filter'],
            params['device_filter'],
            params['url_filter'],
            params['browser_filter'],
            params['ip_filter'],
            params['isp_filter'],
            params['granularity']
        ))
        
        result = cur.fetchone()
        data = result['data'] if result else {}
        
        app.logger.info(f"Result data keys: {list(data.keys()) if data else 'Empty'}")
        app.logger.info(f"Stats: {data.get('stats', {}) if data else 'No stats'}")

        if 'stats' in data:
            stats = data['stats']
            total = stats.get('total_visitors', 0)
            unique = stats.get('unique_visitors', 0)
            stats['repeated_visitors'] = max(0, total - unique)
            data['stats'] = stats

        return jsonify(data)

    except Exception as e:
        app.logger.error(f"Error in /api/analytics: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/track', methods=['POST', 'OPTIONS'])
def track():
    if request.method == 'OPTIONS':
        return '', 200

    conn = None
    try:
        data = request.get_json(force=True)
        session_id = data.get("sessionId")
        if not session_id:
            return jsonify({"error": "Missing sessionId"}), 400

        def norm(val):
            return None if not val or str(val).lower() == 'unknown' else val

        ua_string = data.get("userAgent", "")
        ua = parse(ua_string)

        if ua.is_mobile:
            device_type = "Mobile"
        elif ua.is_tablet:
            device_type = "Tablet"
        else:
            device_type = "Desktop"

        country = norm(data.get("country"))
        city = norm(data.get("city"))
        isp = norm(data.get("isp"))
        public_ip = norm(data.get("publicIp"))
        country_code = data.get("countryCode") or get_country_code(country)

        # Parse timestamp
        first_seen_raw = data.get("timestamp")
        first_seen = None
        if first_seen_raw is not None:
            try:
                if isinstance(first_seen_raw, (int, float)) or (isinstance(first_seen_raw, str) and first_seen_raw.isdigit()):
                    ts = int(float(first_seen_raw))
                    
                    # JavaScript Date.now() returns milliseconds
                    # Convert to seconds
                    if ts > 10**11:  # More than ~3000 years in seconds, likely milliseconds
                        ts = ts // 1000
                    
                    # Create timezone-aware datetime in UTC
                    first_seen = datetime.fromtimestamp(ts, timezone.utc).isoformat()
                else:
                    # Try parsing as string
                    dt = date_parse(str(first_seen_raw))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    first_seen = dt.isoformat()
            except Exception as e:
                app.logger.error(f"Error parsing timestamp {first_seen_raw}: {e}")
                first_seen = None

        time_spent_seconds = None
        if data.get("timeSpentSeconds") is not None:
            ts = int(data.get("timeSpentSeconds") or 0)
            ts = max(0, min(ts, 86400))
            time_spent_seconds = ts

        # SQL Upsert
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            INSERT INTO public.visitors (
                session_id, public_ip, country, country_code, city, isp, 
                page_visited, user_agent, device_type, browser, operating_system, 
                first_seen, time_spent_seconds
            ) VALUES (
                %s, %s, %s, %s, %s, %s, 
                %s, %s, %s, %s, %s, 
                %s, %s
            ) 
            ON CONFLICT (session_id) DO UPDATE SET
                public_ip = EXCLUDED.public_ip,
                country = EXCLUDED.country,
                country_code = EXCLUDED.country_code,
                city = EXCLUDED.city,
                isp = EXCLUDED.isp,
                page_visited = EXCLUDED.page_visited,
                user_agent = EXCLUDED.user_agent,
                device_type = EXCLUDED.device_type,
                browser = EXCLUDED.browser,
                operating_system = EXCLUDED.operating_system,
                first_seen = COALESCE(visitors.first_seen, EXCLUDED.first_seen),
                time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, visitors.time_spent_seconds)
        """
        
        cur.execute(query, (
            session_id, public_ip, country, country_code, city, isp,
            data.get("pageVisited"), ua_string, device_type, ua.browser.family, ua.os.family,
            first_seen, time_spent_seconds
        ))
        
        conn.commit()

        return jsonify({"success": True}), 201

    except Exception as e:
        app.logger.error(f"Error in /track: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/log/time', methods=['POST', 'OPTIONS'])
def log_time():
    if request.method == 'OPTIONS':
        return '', 200

    conn = None
    try:
        data = request.get_json(force=True)
        session_id = data.get("sessionId")
        if not session_id:
            return jsonify({"error": "Missing sessionId"}), 400

        time_spent_seconds = data.get("timeSpentSeconds", 0)
        if time_spent_seconds is not None:
            time_spent_seconds = max(0, min(int(time_spent_seconds), 86400))

        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE public.visitors 
            SET time_spent_seconds = %s 
            WHERE session_id = %s
        """, (time_spent_seconds, session_id))
        
        conn.commit()

        return jsonify({"success": True, "time_logged": time_spent_seconds}), 200

    except Exception as e:
        app.logger.error(f"Error in /log/time: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


# ---------------------------------------------------------------------------
# App-specific user-detail endpoints (proxied to external FSA service)
# ---------------------------------------------------------------------------

# Registry of app slugs -> upstream POST endpoint(s).
APP_USER_ENDPOINTS = {
    'fps': ['https://coers.iitm.ac.in/fsa/user_det'],
    'sanjaya': ['https://rbg.iitm.ac.in/get_details/export_all_data'],
    'tpl': ['https://rbg.iitm.ac.in/bs_ddhi/export_all_data'],
    # add more app entries here: 'myapp': ['https://...'],
}


def _normalize_upstream_users(upstream):
    """Normalize upstream payload to a users array, or None if shape is unknown."""
    if isinstance(upstream, dict):
        details = upstream.get('details')

        if isinstance(details, dict):
            merged = []
            if isinstance(details.get('users'), list):
                merged.extend([{**d, '_role': 'User'} for d in details['users']])
            if isinstance(details.get('admins'), list):
                merged.extend([{**d, '_role': 'Admin'} for d in details['admins']])
            if isinstance(details.get('surveys'), list):
                merged.extend([{**d, '_role': 'Survey'} for d in details['surveys']])
            if merged:
                return merged
            if isinstance(details.get('users'), list):
                return details['users']

        if isinstance(upstream.get('details'), list):
            users = []
            for d in upstream['details']:
                users.append({
                    'userid': d.get('userid'),
                    'user_name': d.get('rep_name') or d.get('name') or d.get('username') or '',
                    'user_role': d.get('user_role') or d.get('role'),
                    'district': d.get('district_name') or d.get('district'),
                    'police_station': d.get('police_station') or d.get('ps') or None,
                    'last_login': d.get('last_login'),
                    'phone': d.get('phone_no'),
                })
            return users

        for key in ('users', 'data', 'results'):
            if isinstance(upstream.get(key), list):
                return upstream[key]

    if isinstance(upstream, list):
        return upstream

    return None


def _bounded_date_window(days=30):
    """Return YYYY-MM-DD start/end strings for a bounded fallback window."""
    now = datetime.now(timezone.utc)
    end = now.strftime('%Y-%m-%d')
    start = (now - timedelta(days=days)).strftime('%Y-%m-%d')
    return {'start_date': start, 'end_date': end}


def _compact_error_message(error):
    """Return a short, HTML-free error string safe for API responses/log details."""
    text = str(error) if error is not None else 'Unknown upstream error'
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > 240:
        text = text[:240] + '...'
    return text


def _parse_ymd(value):
    """Parse YYYY-MM-DD string into datetime (UTC, date at midnight)."""
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').replace(tzinfo=timezone.utc)


def _iterate_windows(start_dt, end_dt, chunk_days):
    """Yield inclusive [start, end] windows as YYYY-MM-DD pairs."""
    cur = start_dt
    while cur <= end_dt:
        win_end = min(cur + timedelta(days=chunk_days - 1), end_dt)
        yield cur.strftime('%Y-%m-%d'), win_end.strftime('%Y-%m-%d')
        cur = win_end + timedelta(days=1)


def _user_dedupe_key(user):
    """Create a stable dedupe key across app payload shapes."""
    user_id = str(user.get('userid') or user.get('user_id') or '').strip().lower()
    if user_id:
        return f"id:{user_id}"
    name = str(user.get('user_name') or user.get('name') or '').strip().lower()
    role = str(user.get('user_role') or user.get('role') or '').strip().lower()
    district = str(user.get('district') or user.get('district_name') or '').strip().lower()
    return f"name:{name}|role:{role}|district:{district}"


def _merge_users_unique(user_lists):
    """Merge multiple user arrays and dedupe repeated rows."""
    merged = []
    seen = set()
    for users in user_lists:
        for user in users:
            key = _user_dedupe_key(user)
            if key in seen:
                continue
            seen.add(key)
            merged.append(user)
    return merged


def _fetch_chunked_users(upstream_url, start_date, end_date, deadline_monotonic=None):
    """Fetch users across date windows to avoid upstream gateway timeouts."""
    end_dt = _parse_ymd(end_date) if end_date else datetime.now(timezone.utc)
    start_dt = _parse_ymd(start_date) if start_date else (end_dt - timedelta(days=APP_USERS_CHUNK_LOOKBACK_DAYS))
    if start_dt > end_dt:
        start_dt, end_dt = end_dt, start_dt

    all_chunks = []
    chunk_errors = []
    for win_start, win_end in _iterate_windows(start_dt, end_dt, max(1, APP_USERS_CHUNK_DAYS)):
        if deadline_monotonic is not None and time.monotonic() >= deadline_monotonic:
            chunk_errors.append('deadline exceeded before completing chunk fetch')
            break
        try:
            remaining = None
            if deadline_monotonic is not None:
                remaining = deadline_monotonic - time.monotonic()
                if remaining <= 0:
                    chunk_errors.append('deadline exceeded before chunk request')
                    break
            upstream = _fetch_upstream_json(
                upstream_url,
                {'start_date': win_start, 'end_date': win_end},
                max_seconds=remaining,
            )
            users = _normalize_upstream_users(upstream)
            if isinstance(users, list) and users:
                all_chunks.append(users)
        except Exception as e:
            chunk_errors.append(f"{win_start}->{win_end}: {_compact_error_message(e)}")

    merged = _merge_users_unique(all_chunks)
    return merged, chunk_errors


def _fetch_upstream_with_httpx(url, body_data, max_seconds=None):
    connect_timeout = APP_USERS_CONNECT_TIMEOUT_SEC
    read_timeout = APP_USERS_READ_TIMEOUT_SEC
    if max_seconds is not None:
        max_seconds = float(max_seconds)
        if max_seconds <= 0:
            raise TimeoutError('deadline exceeded before httpx request')
        connect_timeout = max(1.0, min(connect_timeout, max_seconds / 2.0, max_seconds))
        read_timeout = max(1.0, min(read_timeout, max_seconds))

    timeout = httpx.Timeout(
        connect=connect_timeout,
        read=read_timeout,
        write=connect_timeout,
        pool=connect_timeout,
    )
    transport = None
    if APP_USERS_FORCE_IPV4:
        # Force IPv4 path from containers where IPv6 resolution/routing hangs.
        transport = httpx.HTTPTransport(local_address='0.0.0.0', retries=0)

    with httpx.Client(
        verify=False,
        timeout=timeout,
        follow_redirects=True,
        trust_env=APP_USERS_TRUST_ENV,
        transport=transport,
    ) as client:
        resp = None
        for attempt in range(APP_USERS_RETRIES + 1):
            try:
                resp = client.post(
                    url,
                    json=body_data,
                    headers={
                        'Content-Type': 'application/json',
                        'Accept': '*/*',
                        'User-Agent': (
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                            'AppleWebKit/537.36 (KHTML, like Gecko) '
                            'Chrome/144.0.0.0 Safari/537.36'
                        ),
                    },
                )
                break
            except (httpx.TimeoutException, httpx.ConnectError):
                if attempt >= APP_USERS_RETRIES:
                    raise
                app.logger.warning(f"Retrying app-users request to {url}: attempt {attempt + 2}")

    if resp is None:
        raise RuntimeError('No response from upstream')

    resp.raise_for_status()
    text = resp.text or ''
    content_type = (resp.headers.get('content-type') or '').lower()

    # Some 5xx paths return HTML error pages; treat that as a failed upstream.
    if 'json' not in content_type and '<html' in text[:2048].lower():
        raise ValueError('Upstream returned HTML instead of JSON')

    return resp.json()


def _fetch_upstream_json(url, body_data, max_seconds=None):
    """Fetch JSON from upstream using httpx, then urllib as fallback."""
    try:
        return _fetch_upstream_with_httpx(url, body_data, max_seconds=max_seconds)
    except Exception as first_error:
        app.logger.warning(f"httpx failed for {url}: {first_error}")
        if not APP_USERS_ENABLE_URLLIB_FALLBACK:
            raise
        return _post_upstream_json_with_urllib(url, body_data, max_seconds=max_seconds)


@app.route('/api/app-users', methods=['GET', 'POST', 'OPTIONS'])
def get_app_users():
    """Proxy request to the FSA user-detail endpoint.

    Can be called with either GET (query parameters) or POST (JSON body).

    Parameters (both methods)
    --------------------------------
    app        : app slug (default: fps)
    period     : day | week | month | all (default: day)
    start_date : ISO date string – overrides period-based calculation
    end_date   : ISO date string – overrides period-based calculation
    """
    request_deadline = time.monotonic() + APP_USERS_TOTAL_TIMEOUT_SEC

    if request.method == 'OPTIONS':
        return '', 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        app_slug = str(data.get('app', 'fps')).lower()
        start_date = data.get('start_date', '') or ''
        end_date = data.get('end_date', '') or ''
    else:
        # GET
        app_slug = request.args.get('app', 'fps').lower()
        # start_date and end_date may be supplied by the client; default to empty strings
        start_date = request.args.get('start_date', '') or ''
        end_date = request.args.get('end_date', '') or ''

    # We used to convert period into specific start/end dates, but the
    # upstream service handles empty strings itself.  Sending computed dates
    # caused "data/time field value out of range" errors when the range
    # included the current day.  Leaving the values empty avoids the problem
    # and keeps the behaviour consistent with the curl example.
    upstream_urls = APP_USER_ENDPOINTS.get(app_slug)
    if not upstream_urls:
        return jsonify({'error': f'Unknown app: {app_slug}', 'users': []}), 400

    if isinstance(upstream_urls, str):
        upstream_urls = [upstream_urls]

    primary_body = {'start_date': start_date, 'end_date': end_date}
    body_candidates = [primary_body]
    if not start_date and not end_date:
        # When "all" causes upstream 504, retry progressively smaller external windows.
        body_candidates.extend([
            _bounded_date_window(30),
            _bounded_date_window(7),
            _bounded_date_window(1),
        ])

    errors = []
    for upstream_url in upstream_urls:
        for body_data in body_candidates:
            remaining = request_deadline - time.monotonic()
            if remaining <= 0:
                errors.append('request deadline exceeded before upstream request')
                break
            app.logger.info(
                f"app-users -> {upstream_url} app={app_slug} start={body_data.get('start_date')!r} end={body_data.get('end_date')!r}"
            )
            try:
                upstream = _fetch_upstream_json(upstream_url, body_data, max_seconds=remaining)
                users = _normalize_upstream_users(upstream)
                if users is None:
                    errors.append(f"{upstream_url}: unsupported payload shape")
                    continue

                with _app_users_cache_lock:
                    _app_users_cache[app_slug] = {'users': users, 'cached_at': time.time()}

                response = {'users': users}
                if body_data is not primary_body:
                    response['warning'] = 'Loaded bounded 30-day external data due to upstream timeout/5xx on full range.'
                return jsonify(response), 200
            except Exception as e:
                safe_error = _compact_error_message(e)
                errors.append(f"{upstream_url}: {safe_error}")
                app.logger.error(f"App-users fetch failed for {app_slug} via {upstream_url}: {safe_error}")

    with _app_users_cache_lock:
        cached = _app_users_cache.get(app_slug)

    # Final external-only recovery: chunked date-window fetching.
    for upstream_url in upstream_urls:
        if time.monotonic() >= request_deadline:
            errors.append('request deadline exceeded before chunked recovery')
            break
        chunk_users, chunk_errors = _fetch_chunked_users(
            upstream_url,
            start_date,
            end_date,
            deadline_monotonic=request_deadline,
        )
        if chunk_users:
            with _app_users_cache_lock:
                _app_users_cache[app_slug] = {'users': chunk_users, 'cached_at': time.time()}
            return jsonify({
                'users': chunk_users,
                'warning': f'Loaded chunked external data ({len(chunk_users)} users).',
            }), 200
        if chunk_errors:
            errors.extend([f"{upstream_url} chunk: {e}" for e in chunk_errors[:5]])

    if cached and isinstance(cached.get('users'), list):
        age = int(time.time() - float(cached.get('cached_at', 0)))
        app.logger.warning(f"Serving cached app-users for {app_slug}; age={age}s")
        return jsonify({'users': cached['users'], 'warning': f'Served cached external data (age {age}s)'}), 200

    return jsonify({'error': 'Upstream unavailable', 'details': errors, 'users': []}), 200


if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))