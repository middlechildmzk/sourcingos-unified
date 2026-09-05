-- V40.7b — durable work-item state for the governed 50-seat improvement fleet.
-- This table is intentionally separate from candidate_enrichment_tasks and the
-- V40.5 Resume/CV claim functions. It has no foreign key or trigger into that
-- queue, so an Inngest retry cannot release or claim Resume/CV work.

create table if not exists public.fleet_improvement_work_items (
  id text primary key,
  owner_id text not null,
  batch_id text not null,
  agent_id text not null,
  pod text not null check (pod in ('search_intelligence','candidate_intelligence','recruiter_ux','product_engineering','qa_red_team')),
  seat integer not null check (seat between 1 and 10),
  workstream text not null,
  mode text not null check (mode in ('research','review','implementation','qa')),
  target text not null,
  context_refs jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','completed','blocked','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_event_id text,
  result jsonb,
  error text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists fleet_improvement_work_items_owner_batch_idx
  on public.fleet_improvement_work_items(owner_id, batch_id, requested_at);

create index if not exists fleet_improvement_work_items_status_idx
  on public.fleet_improvement_work_items(status, requested_at);

create unique index if not exists fleet_improvement_work_items_batch_agent_uq
  on public.fleet_improvement_work_items(owner_id, batch_id, agent_id);

alter table public.fleet_improvement_work_items enable row level security;

-- Service-role server code owns this internal runtime table. There are no
-- browser policies by design; authenticated clients reach it only via reviewed
-- server routes.
revoke all on table public.fleet_improvement_work_items from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.fleet_improvement_work_items from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.fleet_improvement_work_items from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on table public.fleet_improvement_work_items to service_role';
  end if;
end $$;

create or replace function public.claim_fleet_improvement_work_item_v40_7b(
  p_id text,
  p_event_id text,
  p_stale_after_minutes integer default 30
)
returns table(claimed boolean, item_status text, attempts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_started_at timestamptz;
  v_attempts integer;
  v_stale_minutes integer := greatest(1, least(coalesce(p_stale_after_minutes, 30), 240));
begin
  if p_id is null or btrim(p_id) = '' then
    return query select false, 'missing'::text, 0;
    return;
  end if;

  -- Serializes duplicate deliveries for one logical work item. This is not the
  -- Resume/CV advisory lock and cannot influence Resume/CV canary headroom.
  perform pg_advisory_xact_lock(hashtextextended('fleet-v40.7b:' || p_id, 407));

  select status, started_at, attempt_count
    into v_status, v_started_at, v_attempts
  from public.fleet_improvement_work_items
  where id = p_id
  for update;

  if not found then
    return query select false, 'missing'::text, 0;
    return;
  end if;

  if v_status in ('completed', 'blocked') then
    return query select false, v_status, v_attempts;
    return;
  end if;

  if v_status = 'running'
     and v_started_at is not null
     and v_started_at > now() - make_interval(mins => v_stale_minutes) then
    return query select false, v_status, v_attempts;
    return;
  end if;

  update public.fleet_improvement_work_items
     set status = 'running',
         attempt_count = attempt_count + 1,
         last_event_id = nullif(btrim(coalesce(p_event_id, '')), ''),
         started_at = now(),
         finished_at = null,
         error = null,
         updated_at = now()
   where id = p_id
   returning status, attempt_count into v_status, v_attempts;

  return query select true, v_status, v_attempts;
end;
$$;

revoke all on function public.claim_fleet_improvement_work_item_v40_7b(text,text,integer) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_fleet_improvement_work_item_v40_7b(text,text,integer) to service_role';
  end if;
end $$;

comment on table public.fleet_improvement_work_items is
  'V40.7b internal improvement-agent work queue. Deliberately isolated from Resume/CV task claiming.';
