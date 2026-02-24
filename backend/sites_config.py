# Sites configuration
# Map of site names to their URLs for filtering

SITES = {
    "all": {
        "name": "All Sites",
        "url": None,  # None means all sites
        "description": "Analytics from all tracked sites"
    },
    "localhost": {
        "name": "Localhost",
        "url": "http://localhost:5000",
        "description": "Local development site"
    },
    "localhost_3000": {
        "name": "Localhost (Port 3000)",
        "url": "http://localhost:3000",
        "description": "Frontend dev server"
    }
}

def get_sites_list():
    """Return list of available sites for dropdown"""
    return [
        {"id": key, "name": site["name"], "description": site["description"]}
        for key, site in SITES.items()
    ]

def get_site_url(site_id):
    """Get the URL pattern for a site"""
    if site_id in SITES:
        return SITES[site_id]["url"]
    return None
