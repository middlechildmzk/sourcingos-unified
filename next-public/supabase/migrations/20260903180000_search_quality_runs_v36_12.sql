-- V36.12 search-quality / Provider Lift run ledger.
-- Records recruiter-owned search telemetry only. Provider observations remain in
-- their existing review/admission paths; this table is not a candidate store.

create table if not exists public.search_quality_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  canonical_role_key text,
  query text not null,
  requirements jsonb not null default '[]'::jsonb,
  structured_request jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  provider_telemetry jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_quality_runs_owner_created_idx
  on public.search_quality_runs(owner_id, created_at desc);
create index if not exists search_quality_runs_owner_role_created_idx
  on public.search_quality_runs(owner_id, canonical_role_key, created_at desc)
  where canonical_role_key is not null;

alter table public.search_quality_runs enable row level security;

drop policy if exists search_quality_runs_select_own on public.search_quality_runs;
create policy search_quality_runs_select_own
  on public.search_quality_runs for select
  using (auth.uid() = owner_id);

drop policy if exists search_quality_runs_insert_own on public.search_quality_runs;
create policy search_quality_runs_insert_own
  on public.search_quality_runs for insert
  with check (auth.uid() = owner_id);

drop policy if exists search_quality_runs_delete_own on public.search_quality_runs;
create policy search_quality_runs_delete_own
  on public.search_quality_runs for delete
  using (auth.uid() = owner_id);

comment on table public.search_quality_runs is
  'Recruiter-owned search-quality telemetry used for Provider Lift before/after evaluation. Counts are observations until Candidate Graph identity comparison supplies canonical novelty.';
