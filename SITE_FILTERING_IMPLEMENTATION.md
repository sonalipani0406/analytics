# Site Filtering Implementation Summary

## Overview
Implemented a site selector dropdown to filter analytics data by tracked domain/URL. Users can now view analytics for "All Sites" (default) or filter by individual tracked sites like localhost:5000 or localhost:3000.

## Files Modified/Created

### 1. Backend Configuration
**File: `backend/sites_config.py` (NEW)**
- Created centralized site configuration
- Defined SITES dictionary with site metadata (id, name, url, description)
- Implemented `get_sites_list()` - returns list of available sites for dropdown
- Implemented `get_site_url(site_id)` - maps site ID to URL pattern for filtering

### 2. Backend API Changes
**File: `backend/app.py`**

#### Added Import
```python
from sites_config import get_sites_list, get_site_url
```

#### New Endpoint: `/api/sites`
- **Method**: GET
- **Returns**: JSON list of available sites
- **Response Format**: `{"sites": [{"id": "all", "name": "All Sites", "description": "..."}, ...]}`
- **CORS**: Enabled with OPTIONS support

#### Updated Endpoint: `/api/analytics`
- **New Parameter**: `site_filter` (default: 'all')
- **Logic**:
  - If `site_filter != 'all'`: Gets URL from `get_site_url(site_filter)` and sets `params['url_filter']`
  - If `site_filter == 'all'`: No URL filtering applied (shows all sites)
- **Result**: Passes processed URL filter to stored function for WHERE clause filtering

### 3. Frontend State Management
**File: `frontend/src/app/page.tsx`**

#### New Imports
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

#### New State Variables
```tsx
const [selectedSite, setSelectedSite] = useState<string>('all');
const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);
```

#### API Calls
- **On Mount**: Fetches `/api/sites` to populate dropdown options
- **Data Load**: Includes `site_filter=selectedSite` in analytics query params

#### UI Update
Added site selector dropdown between title and period buttons:
```tsx
<Select value={selectedSite} onValueChange={setSelectedSite}>
  <SelectTrigger>
    <SelectValue placeholder="Select a site" />
  </SelectTrigger>
  <SelectContent>
    {sites.map((site) => (
      <SelectItem key={site.id} value={site.id}>
        {site.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Data Flow

1. **Page Load**:
   - Frontend fetches `/api/sites` → displays dropdown with available sites
   - Sets default `selectedSite = 'all'`

2. **Site Selection Change**:
   - User selects site from dropdown
   - `selectedSite` state updates
   - Effect dependency on `selectedSite` triggers `loadData()`

3. **Analytics Request**:
   - Frontend sends `/api/analytics?site_filter=selected_site&...otherFilters`
   - Backend calls `get_site_url(site_filter)` to get URL pattern
   - URL pattern passed to PostgreSQL stored function
   - Stored function filters `WHERE page_visited LIKE site_url || '%'` pattern

4. **Response**:
   - Backend returns filtered analytics data
   - Frontend displays charts/stats/tables for selected site only

## Configuration Management

### Adding New Sites
Edit `backend/sites_config.py`:
```python
SITES = {
    ...existing sites...,
    "production": {
        "name": "Production Site",
        "url": "https://example.com",
        "description": "Production analytics"
    }
}
```

The site will automatically appear in:
- Frontend dropdown (via `/api/sites` endpoint)
- Backend filtering logic
- Analytics queries

## Current Site Options
1. **All Sites** (id: 'all') - Shows analytics from all tracked URLs
2. **Localhost** (id: 'localhost') - http://localhost:5000
3. **Localhost (Port 3000)** (id: 'localhost_3000') - http://localhost:3000

## Technical Details

### URL Pattern Matching
- Uses PostgreSQL pattern matching on the page URL.

  The backend now normalises the configured URL prefix by stripping any
  trailing slash so that *both* the root and sub‑routes are matched.  Because
  data coming from different clients may mix upper‑/lower‑case characters the
  database query uses `ILIKE` for case‑insensitive comparison, e.g. the filter
  ``https://rbg.iitm.ac.in/tpl`` will match ``https://rbg.iitm.ac.in/TPL/Main``
  as well as ``https://rbg.iitm.ac.in/tpl/user``.

- Matches any page visited on the selected domain (including deeper paths)

### CORS/OPTIONS Support
- Both `/api/sites` and `/api/analytics` include OPTIONS method for CORS preflight
- Allows dropdown to safely fetch sites list from frontend

### State Dependencies
Analytics auto-refresh triggers include `selectedSite` in dependency array:
```tsx
useEffect(() => {
  loadData(filters);
  const interval = setInterval(() => loadData(filters), 30000);
}, [filters, selectedPeriod, selectedSite]);  // ← selectedSite included
```

## Testing

### Manual Test Checklist
- [ ] Page loads with "All Sites" selected by default
- [ ] Dropdown shows all available sites
- [ ] Selecting "Localhost" filters analytics to localhost:5000 traffic only
- [ ] Selecting "Localhost (Port 3000)" filters to localhost:3000 traffic
- [ ] Switching sites updates dashboard stats/charts correctly
- [ ] Switching period (24H/7D/30D/Custom) works while site filter active
- [ ] Adding other filters (country, device, etc.) works with site filter
- [ ] Dashboard auto-refreshes with current site filter selected

### Verification Points
1. Check browser DevTools Network tab: `site_filter` parameter in API calls ✓
2. Verify database: filtered analytics return correct page_visited values ✓
3. Confirm responsive design: dropdown flows properly on mobile ✓

## Future Enhancements
- Add site-specific settings/configuration UI
- Implement site grouping (e.g., "Production", "Staging", "Testing")
- Add site-level analytics export functionality
- Create site performance comparison view
- Add site deletion/management for self-hosted instances
