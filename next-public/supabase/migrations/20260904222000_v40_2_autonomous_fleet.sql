-- V40.2: owner-scoped autonomous public-source fleet runtime.
-- Supabase remains canonical. This migration adds scheduling, raw-source replay,
-- credit metering, and telemetry only. Identity review continues to use the
-- existing identity_match_reviews + recruiter-confirmed atomic merge flow.

create table if not exists public.fleet_credit_reservations (
  reservation_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id text not null,
  operation text not null check (operation in ('source_discovery','source_enrichment','model_inference','embedding')),
  source text not null,
  reserved_credits integer not null check (reserved_credits >= 0),
  settled_credits integer check (settled_credits >= 0),
  succeeded boolean,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists fleet_credit_reservations_owner_month_idx
  on public.fleet_credit_reservations(owner_id, created_at desc);
create index if not exists fleet_credit_reservations_unsettled_idx
  on public.fleet_credit_reservations(owner_id, created_at)
  where settled_credits is null;

create table if not exists public.fleet_raw_discoveries (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_profile_id text not null,
  source_url text,
  raw_data jsonb not null default '{}'::jsonb,
  retrieval_terms jsonb not null default '[]'::jsonb,
  discovered_at timestamptz not null,
  run_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists fleet_raw_discoveries_owner_source_idx
  on public.fleet_raw_discoveries(owner_id, source, discovered_at desc);
create index if not exists fleet_raw_discoveries_run_idx
  on public.fleet_raw_discoveries(owner_id, run_id);

create table if not exists public.fleet_run_telemetry (
  id bigserial primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id text not null,
  stage text not null check (stage in ('scout','normalize','resolve','promote')),
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null default 0,
  count_found integer not null default 0,
  count_persisted integer not null default 0,
  count_awaiting_review integer not null default 0,
  count_auto_promoted integer not null default 0 check (count_auto_promoted = 0),
  credits_spent integer not null default 0,
  api_errors integer not null default 0,
  warnings jsonb not null default '[]'::jsonb
);
create index if not exists fleet_run_telemetry_owner_run_idx
  on public.fleet_run_telemetry(owner_id, run_id, started_at);

create table if not exists public.fleet_standing_intents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  hypothesis text not null,
  capability_terms jsonb not null default '[]'::jsonb,
  location text,
  sources jsonb not null default '[]'::jsonb,
  cadence_minutes integer not null check (cadence_minutes between 30 and 10080),
  people_limit integer not null check (people_limit between 1 and 25),
  credits_per_run integer not null check (credits_per_run between 1 and 200),
  enabled boolean not null default true,
  last_run_at timestamptz,
  last_run_id text,
  paused_reason text,
  consecutive_empty_runs integer not null default 0,
  consecutive_error_runs integer not null default 0,
  last_result_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fleet_standing_intents_due_idx
  on public.fleet_standing_intents(last_run_at nulls first)
  where enabled and paused_reason is null;
create index if not exists fleet_standing_intents_owner_idx
  on public.fleet_standing_intents(owner_id, created_at desc);

alter table public.fleet_credit_reservations enable row level security;
alter table public.fleet_raw_discoveries enable row level security;
alter table public.fleet_run_telemetry enable row level security;
alter table public.fleet_standing_intents enable row level security;

-- Recruiters may read/manage only their standing lanes. Runtime tables remain
-- service-role only because raw source replay and metering are server concerns.
drop policy if exists fleet_standing_intents_select_own on public.fleet_standing_intents;
create policy fleet_standing_intents_select_own on public.fleet_standing_intents
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists fleet_standing_intents_insert_own on public.fleet_standing_intents;
create policy fleet_standing_intents_insert_own on public.fleet_standing_intents
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists fleet_standing_intents_update_own on public.fleet_standing_intents;
create policy fleet_standing_intents_update_own on public.fleet_standing_intents
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.fleet_credit_reservations from anon, authenticated;
revoke all on public.fleet_raw_discoveries from anon, authenticated;
revoke all on public.fleet_run_telemetry from anon, authenticated;
grant select, insert, update on public.fleet_standing_intents to authenticated;

-- Serialize monthly reservation admission per owner. A select-then-insert ledger
-- races under concurrent scouts; this RPC closes that gap inside one transaction.
create or replace function public.reserve_fleet_credits_v40(
  p_owner_id uuid,
  p_reservation_id text,
  p_run_id text,
  p_operation text,
  p_source text,
  p_reserved_credits integer,
  p_monthly_grant integer
) returns table(granted boolean, balance_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_consumed integer;
  v_available integer;
begin
  if p_reserved_credits < 0 or p_monthly_grant < 0 then
    raise exception 'credits must be non-negative';
  end if;
  if p_operation not in ('source_discovery','source_enrichment','model_inference','embedding') then
    raise exception 'invalid fleet credit operation';
  end if;

  perform pg_advisory_xact_lock(hashtext('fleet-credit:' || p_owner_id::text));

  select coalesce(sum(coalesce(settled_credits, reserved_credits)), 0)::integer
    into v_consumed
    from public.fleet_credit_reservations
   where owner_id = p_owner_id
     and created_at >= date_trunc('month', now());

  v_available := greatest(0, p_monthly_grant - v_consumed);
  if p_reserved_credits > v_available then
    return query select false, v_available;
    return;
  end if;

  insert into public.fleet_credit_reservations(
    reservation_id, owner_id, run_id, operation, source, reserved_credits
  ) values (
    p_reservation_id, p_owner_id, p_run_id, p_operation, p_source, p_reserved_credits
  );

  return query select true, greatest(0, v_available - p_reserved_credits);
end;
$$;
revoke all on function public.reserve_fleet_credits_v40(uuid,text,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.reserve_fleet_credits_v40(uuid,text,text,text,text,integer,integer) to service_role;

-- Atomically claim at most four due lanes. Stamping happens before execution so
-- a hung run is not redispatched on every 30-minute tick.
create or replace function public.claim_due_fleet_lanes_v40(
  p_limit integer default 4,
  p_now timestamptz default now()
) returns table(
  id uuid,
  owner_id uuid,
  label text,
  hypothesis text,
  capability_terms jsonb,
  location text,
  sources jsonb,
  people_limit integer,
  credits_per_run integer,
  run_id text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select f.id
      from public.fleet_standing_intents f
     where f.enabled = true
       and f.paused_reason is null
       and (f.last_run_at is null or f.last_run_at <= p_now - make_interval(mins => f.cadence_minutes))
     order by f.last_run_at nulls first, f.created_at asc
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 4), 4))
  ), claimed as (
    update public.fleet_standing_intents f
       set last_run_at = p_now,
           last_run_id = 'fleet_' || replace(f.id::text, '-', '') || '_' || to_char(p_now at time zone 'utc', 'YYYYMMDDHH24MISS'),
           updated_at = p_now
      from due
     where f.id = due.id
     returning f.*
  )
  select c.id, c.owner_id, c.label, c.hypothesis, c.capability_terms,
         c.location, c.sources, c.people_limit, c.credits_per_run,
         c.last_run_id as run_id
    from claimed c;
end;
$$;
revoke all on function public.claim_due_fleet_lanes_v40(integer,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_fleet_lanes_v40(integer,timestamptz) to service_role;
