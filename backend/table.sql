create table public.visitors (
  id bigserial not null,
  created_at timestamp with time zone not null default now(),
  public_ip text null,
  country text null,
  country_code text null,
  city text null,
  page_visited text null,
  user_agent text null,
  device_type text null,
  browser text null,
  operating_system text null,
  session_id uuid null,
  time_spent_seconds integer null,
  isp text null,
  first_seen timestamp with time zone null,
  constraint visitors_pkey primary key (id),
  constraint visitors_session_id_key unique (session_id),
  constraint visitors_time_spent_seconds_check check (
    (
      (time_spent_seconds >= 0)
      and (time_spent_seconds <= 86400)
    )
  )
) TABLESPACE pg_default;