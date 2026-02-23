import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from datetime import datetime
from dateutil.parser import parse as date_parse
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from user_agents import parse
import pycountry

load_dotenv()

# Serve static files from 'static_frontend' folder (which will contain the Next.js export)
app = Flask(__name__, static_folder='static_frontend', static_url_path='')
CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"], methods=["GET", "POST", "OPTIONS"])

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# Catch-all for SPA routing
@app.route('/<path:path>')
def serve_static(path):
    # If file exists, serve it
    full_path = os.path.join(app.root_path, app.static_folder, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    
    # Otherwise fallback to index.html for SPA
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



@app.route('/api/analytics', methods=['GET', 'OPTIONS'])
def get_analytics():
    if request.method == 'OPTIONS':
        return '', 200

    conn = None
    try:
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

        # Helper for dynamic period logic
        period = request.args.get('period', 'day')
        now = datetime.now()
        
        # Defaults
        granularity = 'day'
        
        # ONLY apply default period logic if explicit dates are NOT provided
        if not params['start_date_filter'] and not params['end_date_filter']:
            if period == 'day':
                granularity = 'hour'
                from datetime import timedelta
                # Default "24h" view
                start_date_filter = (now - timedelta(days=1)).isoformat()
                end_date_filter = None 
                params['start_date_filter'] = start_date_filter
                params['end_date_filter'] = end_date_filter
                
            elif period == 'week':
                granularity = 'day'
                from datetime import timedelta
                start_date_filter = (now - timedelta(days=7)).isoformat()
                end_date_filter = None
                params['start_date_filter'] = start_date_filter
                params['end_date_filter'] = end_date_filter
                
            elif period == 'month':
                granularity = 'day'
                from datetime import timedelta
                start_date_filter = (now - timedelta(days=30)).isoformat()
                end_date_filter = None
                params['start_date_filter'] = start_date_filter
                params['end_date_filter'] = end_date_filter

        # If custom or explicit dates provided, determine granularity
        # If period is 'day' but start/end provided (e.g. specific day selected), use 'hour' granularity if range is small
        if params['start_date_filter']:
             # Basic granularity heuristic
             try:
                 s = params['start_date_filter']
                 e = params['end_date_filter']
                 # If we have dates, let's just default to 'day' unless range is small
                 granularity = 'day'
                 
                 # If period is explicitly 'day' (even with custom dates, like picking Yesterday), force hour
                 if period == 'day':
                     granularity = 'hour'
                 elif period == 'custom':
                     # Existing logic copy for safety if needed, or simple check
                     pass 
             except:
                 pass

        # Convert empty strings to None and parse dates appropriately
        for k, v in params.items():
            if not v:
                params[k] = None
            else:
                if k == 'start_date_filter':
                    try:
                        dt = date_parse(v)
                        params[k] = dt.isoformat()
                    except Exception:
                        params[k] = None
                elif k == 'end_date_filter':
                    try:
                        dt = date_parse(v)
                        # If date-only string (len 10) or midnight time, assume end of day is desired
                        # Checking string length is safest if strictly YYYY-MM-DD
                        if len(str(v).strip()) <= 10 or (dt.hour == 0 and dt.minute == 0):
                            dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
                        params[k] = dt.isoformat()
                    except Exception:
                        params[k] = None

        params['granularity'] = granularity
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
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
                    ts = int(first_seen_raw)
                    if ts > 10**12: ts = ts // 1000
                    if ts > 10**10: ts = ts // 1000
                    first_seen = datetime.fromtimestamp(ts / 1000 if ts > 10**9 else ts, datetime.timezone.utc).isoformat()
                else:
                    first_seen = date_parse(str(first_seen_raw)).isoformat()
            except Exception:
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