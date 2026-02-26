import urllib.request
import urllib.parse
import itertools
import json
import datetime
import os
import sys

BASE_URL = "http://localhost:5000/api/analytics"
OUTPUT_CURL_FILE = "test_curls.sh"
OUTPUT_RESULTS_FILE = "test_results.txt"

def make_request(url, params=None):
    try:
        if params:
            # Filter out None values
            clean_params = {k: v for k, v in params.items() if v is not None}
            query_string = urllib.parse.urlencode(clean_params)
            full_url = f"{url}?{query_string}"
        else:
            full_url = url
            
        with urllib.request.urlopen(full_url) as response:
            if response.status == 200:
                return json.loads(response.read().decode())
    except Exception as e:
        # print(f"Request failed: {e}")
        return None
    return None

def get_meta():
    res = make_request(BASE_URL, {"period": "month"})
    return res.get('meta', {}) if res else {}


def get_sites():
    # helper to exercise the new /api/sites endpoint
    res = make_request("http://localhost:5000/api/sites")
    return res.get('sites', []) if res else []

def generate_combinations(meta):
    # dynamic values from DB
    countries = [""] + [c for c in meta.get('distinct_countries', []) if c]
    browsers = [""] + [b for b in meta.get('distinct_browsers', []) if b]
    devices = [""] + [d for d in meta.get('distinct_devices', []) if d]
    
    # static values
    visitor_types = ["", "unique", "repeated"]
    periods = ["day", "week", "month"] # standard periods
    
    # Custom date ranges
    today = datetime.date.today().isoformat()
    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
    last_week_day = (datetime.date.today() - datetime.timedelta(days=4)).isoformat() 
    
    custom_dates = [
        (None, None), 
        (today, today), 
        (yesterday, yesterday),
        (last_week_day, last_week_day),
    ]
    
    combinations = []
    
    def clean(x): return x if x else None

    # Group 1: Standard Periods
    for p, c, b, d, vt in itertools.product(periods, countries, browsers, devices, visitor_types):
        combinations.append({
            "period": p,
            "country_filter": clean(c),
            "browser_filter": clean(b),
            "device_filter": clean(d),
            "visitor_type_filter": clean(vt)
        })

    # Group 2: Custom Dates
    for ((s, e), c, b, d, vt) in itertools.product(custom_dates, countries, browsers, devices, visitor_types):
        if not s: continue
        combinations.append({
            "start_date_filter": s,
            "end_date_filter": e,
            "period": "custom",
            "country_filter": clean(c),
            "browser_filter": clean(b),
            "device_filter": clean(d),
            "visitor_type_filter": clean(vt)
        })
        
    return combinations

def to_curl(url, params):
    clean_params = {k: v for k, v in params.items() if v is not None}
    query_string = urllib.parse.urlencode(clean_params)
    full_url = f"{url}?{query_string}"
    return f"curl -X GET '{full_url}'"

def run_tests():
    print("Fetching metadata...")
    meta = get_meta()
    if not meta and not meta.get('distinct_countries'):
        # Fallback if meta fetch fails (e.g. empty DB or error), though unexpected
        print("Warning: Could not fetch meta or DB empty. Using defaults.")
        meta = {
            'distinct_countries': ['US', 'IN'],
            'distinct_browsers': ['Chrome'],
            'distinct_devices': ['Desktop']
        }

    print(f"Meta retrieved: {len(meta.get('distinct_countries', []))} countries, {len(meta.get('distinct_devices', []))} devices.")
    
    combos = generate_combinations(meta)
    print(f"Generated {len(combos)} test combinations.")
    
    # additional sanity check: hit analytics with each site id
    sites = get_sites()
    if sites:
        print("Checking site filters:")
        for site in sites:
            params = {"site_filter": site.get('id')}
            result = make_request(BASE_URL, params)
            count = result.get('stats', {}).get('total_visitors', 0) if result else None
            print(f"  site={site.get('id')} visitors={count}")
    else:
        print("No sites returned from /api/sites; skipping site filter check")

    passed = 0
    failed = 0
    empty_results = 0
    
    with open(OUTPUT_CURL_FILE, "w") as curl_f, open(OUTPUT_RESULTS_FILE, "w") as res_f:
        curl_f.write("#!/bin/bash\n# Extreme Test Suite Curls\n\n")
        
        for i, params in enumerate(combos):
            # Construct CURL
            curl_cmd = to_curl(BASE_URL, params)
            curl_f.write(curl_cmd + "\n")
            
            # Execute
            try:
                data = make_request(BASE_URL, params)
                if data is not None:
                    visitor_count = data.get('stats', {}).get('total_visitors', 0)
                    
                    status = "PASS"
                    if visitor_count == 0:
                        status = "PASS (EMPTY)"
                        empty_results += 1
                    
                    res_f.write(f"[{i+1}/{len(combos)}] {status} | Params: {params} | Visitors: {visitor_count}\n")
                    passed += 1
                else:
                    res_f.write(f"[{i+1}/{len(combos)}] FAIL | Params: {params} | Error: Request Failed\n")
                    failed += 1
            except Exception as e:
                res_f.write(f"[{i+1}/{len(combos)}] ERROR | Params: {params} | Exception: {e}\n")
                failed += 1
                
            if i > 0 and i % 200 == 0:
                print(f"Processed {i}/{len(combos)}...")

    print(f"\nTest Complete.")
    print(f"Total: {len(combos)}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Empty Results: {empty_results}")
    print(f"CURL commands saved to: {os.path.abspath(OUTPUT_CURL_FILE)}")
    print(f"Results saved to: {os.path.abspath(OUTPUT_RESULTS_FILE)}")

if __name__ == "__main__":
    run_tests()
