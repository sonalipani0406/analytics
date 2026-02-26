import os
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

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))