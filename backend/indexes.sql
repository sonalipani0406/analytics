-- Add indexes to improve query performance for common filters
CREATE INDEX IF NOT EXISTS visitors_created_at_idx ON public.visitors (created_at);
CREATE INDEX IF NOT EXISTS visitors_country_idx ON public.visitors (country);
CREATE INDEX IF NOT EXISTS visitors_device_type_idx ON public.visitors (device_type);
CREATE INDEX IF NOT EXISTS visitors_public_ip_idx ON public.visitors (public_ip);
CREATE INDEX IF NOT EXISTS visitors_browser_idx ON public.visitors (browser);
