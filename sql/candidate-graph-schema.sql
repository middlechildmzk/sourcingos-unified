-- SourcingOS V17.2 persistent Candidate Graph schema.
-- Designed for Supabase/Postgres. The Next preview uses an in-memory adapter with the same concepts.

create table if not exists candidates (
  id text primary key,
  canonical_name text not null,
  headline text,
  location text,
  status text not null default 'needs_review',
  match_score integer not null default 0,
  evidence_count integer not null default 0,
  contact_signal_count integer not null default 0,
  refresh_policy jsonb not null default '{}'::jsonb,
  next_refresh_at timestamptz,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists source_profiles (
  id text primary key,
  candidate_id text references candidates(id) on delete set null,
  source text not null,
  source_profile_id text not null,
  display_name text not null,
  headline text,
  location text,
  organization text,
  profile_url text,
  skills jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  contact_signals jsonb not null default '[]'::jsonb,
  identity_signals jsonb not null default '[]'::jsonb,
  raw jsonb,
  refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_profile_id)
);

create table if not exists identity_match_reviews (
  id text primary key,
  candidate_id text references candidates(id) on delete cascade,
  source_profile_ids jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  decision text not null default 'pending',
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists candidate_refresh_events (
  id text primary key,
  candidate_id text references candidates(id) on delete cascade,
  event_type text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_candidates_next_refresh on candidates(next_refresh_at);
create index if not exists idx_source_profiles_candidate on source_profiles(candidate_id);
create index if not exists idx_source_profiles_source on source_profiles(source, source_profile_id);
