# Sites configuration
# Map of site names to their URLs for filtering

SITES = {
    "all": {
        "name": "All Sites",
        "url": None,  # None means all sites
        "description": "Analytics from all tracked sites"
    },
    
    "sanjaya": {
        "name": "Sanjaya",
        "url": "https://rbg.iitm.ac.in/sanjaya/",
        "description": "Sanjaya application"
    },
    "fps": {
        "name": "FPS",
        "url": "https://rbg.iitm.ac.in/fps/#/",
        "description": "FPS application"
    },
    "tpl": {
        "name": "TPL",
        "url": "https://rbg.iitm.ac.in/tpl/",
        "description": "TPL application"
    },
    "rath": {
        "name": "RATH",
        "url": "https://rbg.iitm.ac.in/RATH/",
        "description": "RATH application"
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
