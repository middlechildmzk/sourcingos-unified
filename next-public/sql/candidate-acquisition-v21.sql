-- SourcingOS V21 Candidate Acquisition Hub
create table if not exists public.candidate_source_registry (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  label text not null,
  category text not null check (category in ('owned_export','official_api','public_professional','public_government','manual')),
  status text not null default 'available' check (status in ('available','connected','paused','blocked')),
  profile_count bigint not null default 0,
  last_synced_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source_key)
);

create table if not exists public.candidate_enrichment_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','needs_review','complete','failed','paused')),
  priority integer not null default 50 check (priority between 0 and 100),
  requested_sources jsonb not null default '[]'::jsonb,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, candidate_id)
);

create table if not exists public.candidate_growth_targets (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  target_profiles bigint not null default 100000 check (target_profiles > 0),
  target_date date not null,
  daily_import_target bigint not null default 10000 check (daily_import_target >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_source_registry_owner_status_idx on public.candidate_source_registry(owner_id, status);
create index if not exists candidate_enrichment_queue_owner_status_priority_idx on public.candidate_enrichment_queue(owner_id, status, priority desc, created_at);

alter table public.candidate_source_registry enable row level security;
alter table public.candidate_enrichment_queue enable row level security;
alter table public.candidate_growth_targets enable row level security;

revoke all on public.candidate_source_registry from anon, authenticated;
revoke all on public.candidate_enrichment_queue from anon, authenticated;
revoke all on public.candidate_growth_targets from anon, authenticated;
grant select on public.candidate_source_registry, public.candidate_enrichment_queue, public.candidate_growth_targets to authenticated;

create policy candidate_source_registry_owner_select on public.candidate_source_registry for select to authenticated using (owner_id = (select auth.uid()));
create policy candidate_enrichment_queue_owner_select on public.candidate_enrichment_queue for select to authenticated using (owner_id = (select auth.uid()));
create policy candidate_growth_targets_owner_select on public.candidate_growth_targets for select to authenticated using (owner_id = (select auth.uid()));

comment on table public.candidate_enrichment_queue is 'Recruiter-controlled queue for public evidence enrichment. No automated outreach or silent identity merges.';
