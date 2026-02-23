import os
import psycopg2
from datetime import datetime

# Database connection parameters
DB_HOST = os.environ.get("DB_HOST", "db")
DB_NAME = os.environ.get("DB_NAME", "postgres")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASS = os.environ.get("DB_PASS", "postgres")
DB_PORT = os.environ.get("DB_PORT", "5432")

# We are running this from HOST, so map 'db' to localhost if needed, 
# But python script running on host needs to connect to mapped port.
# If running inside docker, env vars work.
# If running on host:
DB_HOST = "localhost" 
DB_USER = "postgres"
DB_PASS = "postgres"
DB_NAME = "postgres"

def check_db():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        cur = conn.cursor()
        
        cur.execute("SELECT MIN(first_seen), MAX(first_seen), COUNT(*) FROM visitors;")
        min_ts, max_ts, count = cur.fetchone()
        
        print(f"Total rows: {count}")
        print(f"Min Timestamp: {min_ts} (Type: {type(min_ts)})")
        print(f"Max Timestamp: {max_ts}")
        
        # Check specific day
        target = '2026-01-28'
        cur.execute(f"SELECT COUNT(*) FROM visitors WHERE first_seen::text LIKE '{target}%'")
        day_count = cur.fetchone()[0]
        print(f"Rows for {target}: {day_count}")
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
