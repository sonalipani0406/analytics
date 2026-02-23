CREATE OR REPLACE FUNCTION public.get_filtered_analytics_visual(
  country_filter TEXT DEFAULT NULL,
  start_date_filter TIMESTAMPTZ DEFAULT NULL,
  end_date_filter TIMESTAMPTZ DEFAULT NULL,
  visitor_type_filter TEXT DEFAULT NULL,
  device_filter TEXT DEFAULT NULL,
  url_filter TEXT DEFAULT NULL,
  browser_filter TEXT DEFAULT NULL,
  ip_filter TEXT DEFAULT NULL,
  isp_filter TEXT DEFAULT NULL,
  granularity TEXT DEFAULT 'day'
)
RETURNS JSON LANGUAGE plpgsql AS $$
DECLARE
  analytics_payload JSON;
BEGIN
  WITH ip_counts AS (
    SELECT public_ip, COUNT(*) AS visit_count
    FROM public.visitors
    GROUP BY public_ip
  ),
  filtered AS (
    SELECT v.*, ic.visit_count
    FROM public.visitors v
    LEFT JOIN ip_counts ic ON v.public_ip = ic.public_ip
    WHERE
      (country_filter IS NULL OR v.country = country_filter)
      AND (start_date_filter IS NULL OR v.first_seen >= start_date_filter)
      AND (end_date_filter IS NULL OR v.first_seen <= end_date_filter)
      AND (
        visitor_type_filter IS NULL
        OR visitor_type_filter = 'all'
        OR (visitor_type_filter = 'unique' AND ic.visit_count = 1)
        OR (visitor_type_filter = 'repeated' AND ic.visit_count > 1)
      )
      AND (device_filter IS NULL OR v.device_type = device_filter)
      AND (url_filter IS NULL OR v.page_visited = url_filter)
      AND (browser_filter IS NULL OR v.browser = browser_filter)
      AND (ip_filter IS NULL OR v.public_ip = ip_filter)
      AND (isp_filter IS NULL OR v.isp = isp_filter)
  ),
  recent AS (
    SELECT * FROM filtered
    ORDER BY first_seen DESC
    LIMIT 100
  )
  SELECT json_build_object(
    'stats', json_build_object(
      'total_visitors', (SELECT COUNT(*) FROM filtered),
      'unique_visitors', (SELECT COUNT(DISTINCT public_ip) FROM filtered),
      'avg_time_on_page', COALESCE((SELECT ROUND(AVG(time_spent_seconds)) FROM filtered WHERE time_spent_seconds IS NOT NULL), 0)
    ),
    'visitor_list', COALESCE((SELECT json_agg(r) FROM recent r), '[]'),
    'charts', json_build_object(
      'by_country', COALESCE((
        SELECT json_agg(row_to_json(t))
        FROM (
            SELECT
                country_code AS id,
                COUNT(*) AS value,
                COUNT(DISTINCT public_ip) AS unique_visitors,
                COUNT(*) - COUNT(DISTINCT public_ip) AS returning_visitors
            FROM filtered
            WHERE country_code IS NOT NULL
            GROUP BY country_code
            ORDER BY value DESC
        ) t
      ), '[]'),
      'by_isp', COALESCE((
        SELECT json_agg(row_to_json(t)) FROM (
          SELECT isp AS id, COUNT(*) AS value FROM filtered WHERE isp IS NOT NULL
          GROUP BY isp ORDER BY value DESC
        ) t
      ), '[]'),
      'by_date', COALESCE((
        SELECT json_agg(row_to_json(d)) FROM (
          SELECT
              date_trunc(granularity, first_seen) AS date,
              COUNT(*) AS count,
              COUNT(DISTINCT public_ip) AS unique_visitors,
              COUNT(*) - COUNT(DISTINCT public_ip) AS returning_visitors
          FROM filtered
          GROUP BY 1
          ORDER BY 1
        ) d
      ), '[]'),
      'by_week', COALESCE((
        SELECT json_agg(row_to_json(w)) FROM (
          SELECT
              date_trunc('week', first_seen)::date AS date,
              COUNT(*) AS count,
              COUNT(DISTINCT public_ip) AS unique_visitors,
              COUNT(*) - COUNT(DISTINCT public_ip) AS returning_visitors
          FROM filtered
          GROUP BY date
          ORDER BY date
        ) w
      ), '[]'),
      'by_month', COALESCE((
        SELECT json_agg(row_to_json(m)) FROM (
          SELECT
              date_trunc('month', first_seen)::date AS date,
              COUNT(*) AS count,
              COUNT(DISTINCT public_ip) AS unique_visitors,
              COUNT(*) - COUNT(DISTINCT public_ip) AS returning_visitors
          FROM filtered
          GROUP BY date
          ORDER BY date
        ) m
      ), '[]'),
      'by_device', COALESCE((
        SELECT json_agg(row_to_json(t)) FROM (
          SELECT device_type, COUNT(*) AS count FROM filtered WHERE device_type IS NOT NULL
          GROUP BY device_type ORDER BY count DESC
        ) t
      ), '[]'),
      'by_browser', COALESCE((
        SELECT json_agg(row_to_json(t)) FROM (
          SELECT browser, COUNT(*) AS count FROM filtered WHERE browser IS NOT NULL
          GROUP BY browser ORDER BY count DESC LIMIT 5
        ) t
      ), '[]'),
      'by_city', COALESCE((
        SELECT json_agg(row_to_json(t)) FROM (
          SELECT city, COUNT(*) AS count FROM filtered WHERE city IS NOT NULL
          GROUP BY city ORDER BY count DESC LIMIT 10
        ) t
      ), '[]'),
      'by_page', COALESCE((
        SELECT json_agg(row_to_json(t)) FROM (
          SELECT page_visited, COUNT(*) AS count FROM filtered WHERE page_visited IS NOT NULL
          GROUP BY page_visited ORDER BY count DESC LIMIT 10
        ) t
      ), '[]')
    ),
    'meta', json_build_object(
      'distinct_countries', (SELECT json_agg(DISTINCT country) FROM public.visitors WHERE country IS NOT NULL),
      'distinct_isps', (SELECT json_agg(DISTINCT isp) FROM public.visitors WHERE isp IS NOT NULL),
      'distinct_devices', (SELECT json_agg(DISTINCT device_type) FROM public.visitors WHERE device_type IS NOT NULL),
      'distinct_urls', (SELECT json_agg(DISTINCT page_visited) FROM public.visitors WHERE page_visited IS NOT NULL),
      'distinct_browsers', (SELECT json_agg(DISTINCT browser) FROM public.visitors WHERE browser IS NOT NULL),
      'distinct_ips', (SELECT json_agg(DISTINCT public_ip) FROM public.visitors WHERE public_ip IS NOT NULL)
    )
  )
  INTO analytics_payload;

  RETURN analytics_payload;
END;
$$;