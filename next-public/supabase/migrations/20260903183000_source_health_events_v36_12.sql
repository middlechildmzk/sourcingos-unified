-- V36.12 per-provider source-health event ledger.
-- This stores operational telemetry, not candidate records or provider secrets.

create table if not exists public.source_health_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  search_quality_run_id uuid references public.search_quality_runs(id) on delete set null,
  canonical_role_key text,
  provider text not null,
  status text not null,
  outcome text not null,
  discovered integer not null default 0,
  retained integer not null default 0,
  latency_ms integer not null default 0,
  estimated_credits numeric not null default 0,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists source_health_events_owner_provider_created_idx
  on public.source_health_events(owner_id, provider, created_at desc);
create index if not exists source_health_events_owner_outcome_created_idx
  on public.source_health_events(owner_id, outcome, created_at desc);

alter table public.source_health_events enable row level security;

drop policy if exists source_health_events_select_own on public.source_health_events;
create policy source_health_events_select_own
  on public.source_health_events for select
  using (auth.uid() = owner_id);

drop policy if exists source_health_events_insert_own on public.source_health_events;
create policy source_health_events_insert_own
  on public.source_health_events for insert
  with check (auth.uid() = owner_id);

drop policy if exists source_health_events_delete_own on public.source_health_events;
create policy source_health_events_delete_own
  on public.source_health_events for delete
  using (auth.uid() = owner_id);

comment on table public.source_health_events is
  'Recruiter-owned provider operational telemetry. clean zero-yield is distinct from outage/auth/rate/schema failure.';
