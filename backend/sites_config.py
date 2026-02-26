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
        # base path only; trailing slash is removed by ``get_site_url`` for matching
        "url": "https://rbg.iitm.ac.in/sanjaya",
        "description": "Sanjaya application"
    },
    "fps": {
        "name": "FPS",
        # hash‑route based application; keep the ``#/`` portion but drop final slash
        "url": "https://rbg.iitm.ac.in/fps/#",
        "description": "FPS application"
    },
    "tpl": {
        "name": "TPL",
        "url": "https://rbg.iitm.ac.in/tpl",
        "description": "TPL application"
    },
    "rath": {
        "name": "RATH",
        "url": "https://rbg.iitm.ac.in/RATH",
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
    """Get the normalized URL prefix for a site.

    The stored URL is usually the base address where the application lives.  When
    used in the analytics filter we append ``%`` in SQL to match anything that
    starts with this prefix.  To avoid missing pages due to a trailing slash or
    case differences we perform a small normalization here:

    * Strip any trailing ``/`` so that both ``https://.../tpl`` and
      ``https://.../tpl/anything`` are covered by the ``LIKE`` pattern.
    * Return ``None`` for unknown site ids or the special ``all`` entry.
    """
    site = SITES.get(site_id)
    if not site:
        return None

    url = site.get("url")
    if url:
        # trim trailing slash so the SQL pattern becomes
        #    url_filter || '%'
        # which matches the base path and all sub‑paths uniformly
        return url.rstrip("/")
    return None
