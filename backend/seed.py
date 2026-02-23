import os
import random
import uuid
import datetime
import psycopg2
from psycopg2.extras import execute_values

# Database connection parameters
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_NAME = os.environ.get("DB_NAME", "trac_db")
DB_USER = os.environ.get("DB_USER", "trac_user")
DB_PASS = os.environ.get("DB_PASS", "trac_password")
DB_PORT = os.environ.get("DB_PORT", "5432")

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

# Mock Data Arrays
COUNTRIES = [
    ("United States", "US"), ("United Kingdom", "GB"), ("Canada", "CA"), 
    ("Germany", "DE"), ("France", "FR"), ("India", "IN"), 
    ("Australia", "AU"), ("Japan", "JP"), ("Brazil", "BR")
]

CITIES = {
    "US": ["New York", "San Francisco", "Austin", "Boston", "Seattle"],
    "GB": ["London", "Manchester", "Liverpool"],
    "CA": ["Toronto", "Vancouver", "Montreal"],
    "DE": ["Berlin", "Munich", "Hamburg"],
    "FR": ["Paris", "Lyon", "Marseille"],
    "IN": ["Mumbai", "Bangalore", "Delhi"],
    "AU": ["Sydney", "Melbourne"],
    "JP": ["Tokyo", "Osaka"],
    "BR": ["Sao Paulo", "Rio de Janeiro"]
}

ISPS = ["Comcast", "Verizon", "AT&T", "Vodafone", "Deutsche Telekom", "Jio", "Bell", "NTT"]
PAGES = ["/", "/pricing", "/features", "/blog", "/contact", "/blog/docker-guide", "/docs"]
BROWSERS = ["Chrome", "Firefox", "Safari", "Edge"]
OS_TYPES = ["Windows", "Mac OS X", "Linux", "iOS", "Android"]
DEVICES = ["Desktop", "Mobile", "Tablet"]

def generate_random_ip():
    return f"{random.randint(1, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}"

def create_record(base_date=None, country_data=None, browser=None, os_type=None, device=None, page=None):
    """
    Helper to create a single record with optional overrides.
    If an override is None, a random choice is made.
    """
    session_id = str(uuid.uuid4())
    
    # Country/City
    if country_data:
        c_name, c_code = country_data
    else:
        c_name, c_code = random.choice(COUNTRIES)
    
    city = random.choice(CITIES.get(c_code, ["Unknown"]))
    
    # Other fields
    isp = random.choice(ISPS)
    p = page if page else random.choice(PAGES)
    ua = "Mozilla/5.0 (Mock)" # Simplified User Agent
    dev = device if device else random.choice(DEVICES)
    br = browser if browser else random.choice(BROWSERS)
    ops = os_type if os_type else random.choice(OS_TYPES)
    ip = generate_random_ip()
    
    # Time
    if base_date:
        # Add random jitter within the day/hour provided or just a few minutes if exact time needed
        # defaulting to random time within that 'day' context usually
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        first_seen = base_date - datetime.timedelta(hours=hours_ago, minutes=minutes_ago)
    else:
        # Default fallback (should likely not be hit if we manage calls well)
        first_seen = datetime.datetime.now(datetime.timezone.utc)

    time_spent = random.randint(5, 600) # seconds

    return (
        session_id, ip, c_name, c_code, city, isp,
        p, ua, dev, br, ops,
        first_seen, time_spent
    )

def generate_diverse_data():
    data = []
    now = datetime.datetime.now(datetime.timezone.utc)
    
    print("Generating diverse mock data...")

    # 1. TIME RANGES (Guarantee 5 records for each window)
    # Today
    print("- Generating Today's data...")
    for _ in range(5):
        data.append(create_record(base_date=now))
        
    # Yesterday
    print("- Generating Yesterday's data...")
    yesterday = now - datetime.timedelta(days=1)
    for _ in range(5):
        data.append(create_record(base_date=yesterday))
        
    # This Week (2-7 days ago)
    print("- Generating This Week's data...")
    for _ in range(5):
        days_ago = random.randint(2, 6)
        d = now - datetime.timedelta(days=days_ago)
        data.append(create_record(base_date=d))
        
    # This Month (8-29 days ago)
    print("- Generating This Month's data...")
    for _ in range(5):
        days_ago = random.randint(8, 29)
        d = now - datetime.timedelta(days=days_ago)
        data.append(create_record(base_date=d))
        
    # This Year (30-364 days ago)
    print("- Generating This Year's data...")
    for _ in range(5):
        days_ago = random.randint(30, 364)
        d = now - datetime.timedelta(days=days_ago)
        data.append(create_record(base_date=d))

    # 2. FEATURE COVERAGE (Guarantee 5 records for each specific option)
    # We use random recent dates (last 7 days) for these to ensure they show up in default views often
    
    # Countries
    print("- Generating per-Country data...")
    for c_data in COUNTRIES:
        for _ in range(5):
             days_ago = random.randint(0, 7)
             d = now - datetime.timedelta(days=days_ago)
             data.append(create_record(base_date=d, country_data=c_data))

    # Browsers
    print("- Generating per-Browser data...")
    for br in BROWSERS:
        for _ in range(5):
             days_ago = random.randint(0, 7)
             d = now - datetime.timedelta(days=days_ago)
             data.append(create_record(base_date=d, browser=br))

    # OS
    print("- Generating per-OS data...")
    for os_t in OS_TYPES:
        for _ in range(5):
             days_ago = random.randint(0, 7)
             d = now - datetime.timedelta(days=days_ago)
             data.append(create_record(base_date=d, os_type=os_t))
             
    # Devices
    print("- Generating per-Device data...")
    for dev in DEVICES:
        for _ in range(5):
             days_ago = random.randint(0, 7)
             d = now - datetime.timedelta(days=days_ago)
             data.append(create_record(base_date=d, device=dev))
             
    # Pages
    print("- Generating per-Page data...")
    for p in PAGES:
        for _ in range(5):
             days_ago = random.randint(0, 7)
             d = now - datetime.timedelta(days=days_ago)
             data.append(create_record(base_date=d, page=p))

    return data

def seed_database():
    conn = get_db_connection()
    if not conn:
        return

    cur = conn.cursor()
    
    records = generate_diverse_data()
    print(f"Total records generated: {len(records)}")
    
    insert_query = """
    INSERT INTO public.visitors (
        session_id, public_ip, country, country_code, city, isp, 
        page_visited, user_agent, device_type, browser, operating_system, 
        first_seen, time_spent_seconds
    ) VALUES %s
    ON CONFLICT (session_id) DO NOTHING
    """
    
    try:
        execute_values(cur, insert_query, records)
        conn.commit()
        print(f"Successfully inserted {len(records)} diverse records.")
    except Exception as e:
        print(f"Error executing insert: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_database()
