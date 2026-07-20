begin;

create table if not exists public.acquisition_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid,
  name text not null,
  query text not null,
  connectors jsonb not null default '[]'::jsonb,
  target_companies jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  daily_limit integer not null default 250 check (daily_limit between 1 and 5000),
  auto_promote_threshold integer not null default 92 check (auto_promote_threshold between 70 and 100),
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acquisition_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.acquisition_campaigns(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','completed','partial','failed','cancelled')),
  connector_status jsonb not null default '{}'::jsonb,
  discovered_count integer not null default 0,
  promoted_count integer not null default 0,
  review_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.acquisition_discoveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.acquisition_campaigns(id) on delete cascade,
  run_id uuid references public.acquisition_runs(id) on delete set null,
  candidate_id uuid references public.candidates(id) on delete set null,
  source_profile_id uuid references public.source_profiles(id) on delete set null,
  source_key text not null,
  source_id text not null,
  source_url text,
  display_name text not null,
  headline text,
  organization text,
  location text,
  summary text,
  skills jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  identity_confidence integer not null default 0 check (identity_confidence between 0 and 100),
  profile_quality integer not null default 0 check (profile_quality between 0 and 100),
  campaign_score integer not null default 0 check (campaign_score between 0 and 100),
  disposition text not null default 'new' check (disposition in ('new','auto_promoted','needs_review','duplicate','rejected','accepted','error')),
  review_reason text,
  raw jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(owner_id, source_key, source_id)
);

create table if not exists public.acquisition_source_cursors (
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.acquisition_campaigns(id) on delete cascade,
  source_key text not null,
  cursor text,
  consecutive_errors integer not null default 0,
  last_error text,
  last_run_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(owner_id, campaign_id, source_key)
);

create table if not exists public.candidate_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  completeness integer not null check (completeness between 0 and 100),
  identity_confidence integer not null check (identity_confidence between 0 and 100),
  evidence_count integer not null default 0,
  source_count integer not null default 0,
  freshness_days integer,
  missing_fields jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists public.autosource_inbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.acquisition_campaigns(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  role_id uuid,
  priority integer not null default 50 check(priority between 0 and 100),
  reason text not null,
  status text not null default 'unreviewed' check(status in ('unreviewed','reviewing','shortlisted','hold','rejected','sent_to_role')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, campaign_id, candidate_id)
);

create index if not exists acquisition_campaigns_owner_status_idx on public.acquisition_campaigns(owner_id,status,next_run_at);
create index if not exists acquisition_runs_campaign_idx on public.acquisition_runs(campaign_id,created_at desc);
create index if not exists acquisition_discoveries_review_idx on public.acquisition_discoveries(owner_id,disposition,campaign_score desc);
create index if not exists acquisition_discoveries_campaign_idx on public.acquisition_discoveries(campaign_id,last_seen_at desc);
create index if not exists quality_candidate_idx on public.candidate_quality_snapshots(candidate_id,captured_at desc);
create index if not exists autosource_inbox_owner_status_idx on public.autosource_inbox(owner_id,status,priority desc,created_at desc);

alter table public.acquisition_campaigns enable row level security;
alter table public.acquisition_runs enable row level security;
alter table public.acquisition_discoveries enable row level security;
alter table public.acquisition_source_cursors enable row level security;
alter table public.candidate_quality_snapshots enable row level security;
alter table public.autosource_inbox enable row level security;

revoke all on public.acquisition_campaigns, public.acquisition_runs, public.acquisition_discoveries, public.acquisition_source_cursors, public.candidate_quality_snapshots, public.autosource_inbox from anon, authenticated;
grant select on public.acquisition_campaigns, public.acquisition_runs, public.acquisition_discoveries, public.acquisition_source_cursors, public.candidate_quality_snapshots, public.autosource_inbox to authenticated;

create policy acquisition_campaigns_owner_select on public.acquisition_campaigns for select to authenticated using (owner_id = auth.uid());
create policy acquisition_runs_owner_select on public.acquisition_runs for select to authenticated using (owner_id = auth.uid());
create policy acquisition_discoveries_owner_select on public.acquisition_discoveries for select to authenticated using (owner_id = auth.uid());
create policy acquisition_source_cursors_owner_select on public.acquisition_source_cursors for select to authenticated using (owner_id = auth.uid());
create policy candidate_quality_owner_select on public.candidate_quality_snapshots for select to authenticated using (owner_id = auth.uid());
create policy autosource_inbox_owner_select on public.autosource_inbox for select to authenticated using (owner_id = auth.uid());

commit;
