-- V40.5i: provider-agnostic Resume/CV discovery.
-- Bright Data is no longer the required primary lane for discovery (Serper
-- and Exa are); Bright Data stays available as an optional, bounded fallback
-- and continues to serve the already-existing public-page fetch/parse step.
--
-- This migration adds:
--   1) resume_sprint_provider_events -- durable per-provider telemetry so
--      SourcingOS can measure which provider actually yields Resume/CV
--      evidence over time (verified_resume_yield = documents / requests).
--   2) claim_resume_sprint_tasks_v40_5i -- a NEW, distinctly-named claim
--      function that enforces the canary ceiling ATOMICALLY, in the database,
--      at claim time.
--   3) a FAIL-CLOSED rewrite of the legacy 3-argument claim function so the
--      currently-deployed application keeps running during rollout without
--      being able to admit new Resume/CV searches.
--
-- ROLLOUT SAFETY. The legacy signature is deliberately NOT dropped, so there
-- is no window in which the running production code errors:
--   before new code deploys: old cron calls the legacy 3-arg function, which
--     now drains resume_fetch_parse only and can never start a new search.
--   after new code deploys:  new cron calls ..._v40_5i and is governed by the
--     atomic canary gate below.
--   at no point does the held 4,676-candidate queue become eligible.
-- The legacy wrapper is removed in a LATER cleanup migration, only after
-- production is proven.
--
-- FUNCTION RESOLUTION. The new function has a DIFFERENT NAME rather than an
-- extra argument on the old one. PostgREST/Supabase resolves RPC by name plus
-- named arguments, and adding an overload to an existing name can make that
-- resolution ambiguous. Distinct names remove the ambiguity entirely: there is
-- exactly one claim_resume_sprint_tasks_v40_5 (3 args) and exactly one
-- claim_resume_sprint_tasks_v40_5i (5 args), neither overloaded.

create table if not exists public.resume_sprint_provider_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_tag text not null,
  task_id uuid,
  provider text not null check (provider in ('serper','exa','brightdata')),
  status text not null check (status in ('completed','unavailable','failed')),
  requests integer not null default 0 check (requests >= 0),
  errors integer not null default 0 check (errors >= 0),
  urls_returned integer not null default 0 check (urls_returned >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  message text,
  created_at timestamptz not null default now()
);
create index if not exists resume_sprint_provider_events_provider_idx
  on public.resume_sprint_provider_events(batch_tag, provider, created_at desc);
create index if not exists resume_sprint_provider_events_owner_idx
  on public.resume_sprint_provider_events(owner_id, created_at desc);

alter table public.resume_sprint_provider_events enable row level security;
drop policy if exists resume_sprint_provider_events_select_own on public.resume_sprint_provider_events;
create policy resume_sprint_provider_events_select_own on public.resume_sprint_provider_events
  for select to authenticated using (owner_id = auth.uid());
grant select on public.resume_sprint_provider_events to authenticated;

-- Supports the canary admission count. Admission is recorded in payload at
-- CLAIM time (not in result_summary at completion), which is what makes the
-- ceiling enforceable against tasks that are still running.
create index if not exists candidate_enrichment_tasks_v40_5i_admitted_idx
  on public.candidate_enrichment_tasks(candidate_id)
  where task_kind = 'resume_search'
    and payload->>'v40_5i_admitted' = 'true';

/*
 * ATOMIC CANARY ADMISSION.
 *
 * The invariant this function enforces: in canary mode, no more than
 * p_canary_ceiling DISTINCT candidates can ever enter the V40.5i search
 * strategy, no matter how many cron ticks overlap or how many workers run.
 *
 * Two properties make that true, and both are required:
 *   1. Admission is stamped on the task row at CLAIM time, in this same
 *      transaction, BEFORE any provider call happens. Counting completions
 *      would be racy: a candidate that is claimed-but-still-running is
 *      invisible to a completion-based count, so an overlapping tick would
 *      re-spend the same headroom.
 *   2. A transaction-scoped advisory lock serializes competing claim calls,
 *      so two invocations cannot both read the same remaining headroom and
 *      each admit a full canary. FOR UPDATE SKIP LOCKED alone is NOT
 *      sufficient here -- it stops two workers taking the SAME row, but
 *      happily lets them take DIFFERENT rows, which is exactly the overshoot
 *      we are preventing.
 *
 * Already-admitted searches stay claimable without consuming new headroom, so
 * a retry of an in-flight canary candidate is never starved. Conversely a
 * FAILED admitted candidate does not release its slot: admission is per
 * distinct candidate and permanent, so failure cannot manufacture unlimited
 * retry/admission capacity.
 *
 * resume_fetch_parse is never subject to the search ceiling: in-flight canary
 * work must always be able to finish.
 */
create or replace function public.claim_resume_sprint_tasks_v40_5i(
  p_limit integer default 36,
  p_worker text default 'resume-sprint',
  p_now timestamptz default now(),
  p_canary_ceiling integer default 6,
  p_scaled boolean default false
) returns setof public.candidate_enrichment_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 36), 48));
  v_admitted integer := 0;
  v_headroom integer := 0;
begin
  -- Serialize competing canary claims for this batch. Transaction-scoped:
  -- released automatically on commit or rollback.
  perform pg_advisory_xact_lock(hashtext('v40_5_resume_sprint_5000_canary_admission'));

  if coalesce(p_scaled, false) then
    v_headroom := v_limit;
  else
    select count(distinct t.candidate_id) into v_admitted
      from public.candidate_enrichment_tasks t
     where t.task_kind = 'resume_search'
       and coalesce(t.payload->>'batchTag','') = 'v40_5_resume_sprint_5000'
       and coalesce(t.payload->>'v40_5i_admitted','') = 'true';
    v_headroom := greatest(0, coalesce(p_canary_ceiling, 6) - v_admitted);
  end if;

  return query
  with parse_due as (
    -- Never ceiling-limited: finish what the canary already started.
    select t.id, false as admit
      from public.candidate_enrichment_tasks t
     where t.status = 'queued'
       and t.not_before <= p_now
       and t.attempts < t.max_attempts
       and t.task_kind = 'resume_fetch_parse'
       and coalesce(t.payload->>'batchTag','') = 'v40_5_resume_sprint_5000'
     order by t.priority desc, t.not_before asc, t.created_at asc
     for update skip locked
     limit v_limit
  ),
  readmit_due as (
    -- Already inside the canary: claimable without spending new headroom.
    select t.id, false as admit
      from public.candidate_enrichment_tasks t
     where t.status = 'queued'
       and t.not_before <= p_now
       and t.attempts < t.max_attempts
       and t.task_kind = 'resume_search'
       and coalesce(t.payload->>'batchTag','') = 'v40_5_resume_sprint_5000'
       and coalesce(t.payload->>'v40_5i_admitted','') = 'true'
     order by t.priority desc, t.not_before asc, t.created_at asc
     for update skip locked
     limit v_limit
  ),
  new_due as (
    -- The only path that consumes canary budget. limit v_headroom is the cap.
    select t.id, true as admit
      from public.candidate_enrichment_tasks t
     where t.status = 'queued'
       and t.not_before <= p_now
       and t.attempts < t.max_attempts
       and t.task_kind = 'resume_search'
       and coalesce(t.payload->>'batchTag','') = 'v40_5_resume_sprint_5000'
       and coalesce(t.payload->>'v40_5i_admitted','') <> 'true'
     order by t.priority desc, t.not_before asc, t.created_at asc
     for update skip locked
     limit v_headroom
  ),
  due as (
    select id, admit from parse_due
    union all
    select id, admit from readmit_due
    union all
    select id, admit from new_due
    limit v_limit
  )
  update public.candidate_enrichment_tasks t
     set status = 'running',
         attempts = t.attempts + 1,
         locked_at = p_now,
         locked_by = left(coalesce(p_worker, 'resume-sprint'), 120),
         payload = case
           when due.admit then jsonb_set(
             jsonb_set(coalesce(t.payload, '{}'::jsonb), '{v40_5i_admitted}', 'true'::jsonb, true),
             '{providerStrategyVersion}', '"v40_5i_provider_agnostic"'::jsonb, true)
           else t.payload
         end,
         updated_at = p_now
    from due
   where t.id = due.id
  returning t.*;
end;
$$;
revoke all on function public.claim_resume_sprint_tasks_v40_5i(integer,text,timestamptz,integer,boolean) from public, anon, authenticated;
grant execute on function public.claim_resume_sprint_tasks_v40_5i(integer,text,timestamptz,integer,boolean) to service_role;

/*
 * FAIL-CLOSED LEGACY COMPATIBILITY SHIM.
 *
 * Same 3-argument signature the currently-deployed code already calls, so the
 * running production cron neither errors nor needs to be redeployed in lockstep
 * with this migration. Its behavior is deliberately reduced: it drains
 * resume_fetch_parse only and can no longer admit ANY resume_search row.
 *
 * This is what closes the migration-ordering hole. Applying this migration
 * before the new code is live cannot release the held cohort, because the only
 * function the old code can call refuses to start searches at all.
 *
 * Removed in a later cleanup migration once V40.5i is proven in production.
 */
create or replace function public.claim_resume_sprint_tasks_v40_5(
  p_limit integer default 36,
  p_worker text default 'resume-sprint',
  p_now timestamptz default now()
) returns setof public.candidate_enrichment_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with due as (
    select t.id
      from public.candidate_enrichment_tasks t
     where t.status = 'queued'
       and t.not_before <= p_now
       and t.attempts < t.max_attempts
       and t.task_kind = 'resume_fetch_parse'
       and coalesce(t.payload->>'batchTag','') = 'v40_5_resume_sprint_5000'
     order by t.priority desc, t.not_before asc, t.created_at asc
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 36), 48))
  )
  update public.candidate_enrichment_tasks t
     set status = 'running',
         attempts = t.attempts + 1,
         locked_at = p_now,
         locked_by = left(coalesce(p_worker, 'resume-sprint'), 120),
         updated_at = p_now
    from due
   where t.id = due.id
  returning t.*;
end;
$$;
revoke all on function public.claim_resume_sprint_tasks_v40_5(integer,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_resume_sprint_tasks_v40_5(integer,text,timestamptz) to service_role;
