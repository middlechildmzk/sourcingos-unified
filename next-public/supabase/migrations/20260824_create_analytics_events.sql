-- SourcingOS public analytics event sink.
-- Server-only writes through the service-role Supabase client.
-- No anon/authenticated Data API access; no raw IP or user-agent storage.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null check (char_length(event) between 1 and 64),
  label text,
  page text,
  source text,
  variant text,
  session_hash text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_occurred_at_idx
  on public.analytics_events (event, occurred_at desc);

create index if not exists analytics_events_page_occurred_at_idx
  on public.analytics_events (page, occurred_at desc);

alter table public.analytics_events enable row level security;

-- Explicit Data API grants are required by current Supabase defaults.
-- Keep this table inaccessible to browser roles; only the server-side
-- service-role client may write/read it.
revoke all on table public.analytics_events from anon, authenticated;
grant select, insert, delete on table public.analytics_events to service_role;

comment on table public.analytics_events is
  'Server-side SourcingOS product analytics. Stores bounded event metadata and a one-way session hash; never raw IP or user agent.';
