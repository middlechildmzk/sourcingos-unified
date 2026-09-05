-- SourcingOS V18 Candidate Graph schema
-- Production target for persistent recruiter-owned candidate intelligence.
-- Source profiles remain separate. No auto-merge at any confidence level.

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  headline text,
  location text,
  current_company text,
  current_title text,
  summary text,
  skills text[] default '{}',
  merge_status text default 'pending' check (merge_status in ('pending','confirmed','rejected')),
  last_refreshed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.source_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete set null,
  source text not null,
  source_profile_id text not null,
  profile_url text,
  display_name text not null,
  headline text,
  location text,
  organization text,
  raw_text text,
  raw jsonb,
  status text default 'pending' check (status in ('pending','confirmed','rejected')),
  match_score integer default 0,
  match_reasons text[] default '{}',
  last_seen_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(source, source_profile_id)
);

create table if not exists public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete cascade,
  source text not null,
  label text not null,
  detail text not null,
  confidence text default 'medium' check (confidence in ('low','medium','high')),
  url text,
  created_at timestamptz default now()
);

create table if not exists public.candidate_contacts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete cascade,
  type text not null,
  value text not null,
  source text not null,
  confidence text default 'medium' check (confidence in ('low','medium','high')),
  verified boolean default false,
  permission_status text default 'unknown' check (permission_status in ('unknown','candidate_provided','company_owned','do_not_contact')),
  created_at timestamptz default now()
);

create table if not exists public.open_to_work_signals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete cascade,
  source text not null,
  label text not null,
  detail text not null,
  confidence text default 'medium' check (confidence in ('low','medium','high')),
  requires_review boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.identity_match_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete set null,
  source_profile_ids uuid[] not null,
  proposed_canonical_name text not null,
  score integer default 0,
  reasons text[] default '{}',
  conflicts text[] default '{}',
  decision text default 'pending' check (decision in ('pending','confirmed','rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.candidate_import_batches (
  id uuid primary key default gen_random_uuid(),
  import_type text not null check (import_type in ('resume_text','csv','manual_source_profile')),
  file_name text,
  rows_seen integer default 0,
  records_created integer default 0,
  warnings text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists public.candidate_refresh_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete set null,
  source text,
  event_type text not null,
  detail text,
  created_at timestamptz default now()
);

create index if not exists idx_source_profiles_candidate on public.source_profiles(candidate_id);
create index if not exists idx_source_profiles_source on public.source_profiles(source, source_profile_id);
create index if not exists idx_evidence_candidate on public.evidence_items(candidate_id);
create index if not exists idx_contacts_candidate on public.candidate_contacts(candidate_id);
create index if not exists idx_open_to_work_candidate on public.open_to_work_signals(candidate_id);
create index if not exists idx_match_reviews_decision on public.identity_match_reviews(decision);
