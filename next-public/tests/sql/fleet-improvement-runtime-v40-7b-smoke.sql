\set ON_ERROR_STOP on

begin;

\ir ../../supabase/migrations/20260905181000_fleet_improvement_runtime_v40_7b.sql

insert into public.fleet_improvement_work_items (
  id, owner_id, batch_id, agent_id, pod, seat, workstream, mode, target, context_refs, constraints
) values (
  'test-batch:search_intelligence-01',
  'test-owner',
  'test-batch',
  'search_intelligence-01',
  'search_intelligence',
  1,
  'Query strategy and search-angle expansion',
  'research',
  'issue-171-provider-benchmark',
  '["issue:#171"]'::jsonb,
  '{"resumeSprintQueueAccess":false}'::jsonb
);

-- First delivery claims the item.
do $$
declare
  v_claimed boolean;
  v_status text;
  v_attempts integer;
begin
  select claimed, item_status, attempts
    into v_claimed, v_status, v_attempts
  from public.claim_fleet_improvement_work_item_v40_7b(
    'test-batch:search_intelligence-01', 'evt-1', 30
  );

  if not v_claimed or v_status <> 'running' or v_attempts <> 1 then
    raise exception 'expected first claim to run once; got claimed=%, status=%, attempts=%', v_claimed, v_status, v_attempts;
  end if;
end $$;

-- A duplicate/overlapping delivery cannot double-run a fresh running item.
do $$
declare
  v_claimed boolean;
  v_status text;
  v_attempts integer;
begin
  select claimed, item_status, attempts
    into v_claimed, v_status, v_attempts
  from public.claim_fleet_improvement_work_item_v40_7b(
    'test-batch:search_intelligence-01', 'evt-2', 30
  );

  if v_claimed or v_status <> 'running' or v_attempts <> 1 then
    raise exception 'expected duplicate claim to be refused; got claimed=%, status=%, attempts=%', v_claimed, v_status, v_attempts;
  end if;
end $$;

-- A stale running item is recoverable and increments the attempt count.
update public.fleet_improvement_work_items
set started_at = now() - interval '31 minutes'
where id = 'test-batch:search_intelligence-01';

do $$
declare
  v_claimed boolean;
  v_status text;
  v_attempts integer;
begin
  select claimed, item_status, attempts
    into v_claimed, v_status, v_attempts
  from public.claim_fleet_improvement_work_item_v40_7b(
    'test-batch:search_intelligence-01', 'evt-3', 30
  );

  if not v_claimed or v_status <> 'running' or v_attempts <> 2 then
    raise exception 'expected stale item recovery; got claimed=%, status=%, attempts=%', v_claimed, v_status, v_attempts;
  end if;
end $$;

-- Terminal completion prevents future duplicate work.
update public.fleet_improvement_work_items
set status = 'completed', finished_at = now(), updated_at = now()
where id = 'test-batch:search_intelligence-01';

do $$
declare
  v_claimed boolean;
  v_status text;
  v_attempts integer;
begin
  select claimed, item_status, attempts
    into v_claimed, v_status, v_attempts
  from public.claim_fleet_improvement_work_item_v40_7b(
    'test-batch:search_intelligence-01', 'evt-4', 30
  );

  if v_claimed or v_status <> 'completed' or v_attempts <> 2 then
    raise exception 'expected completed item to remain terminal; got claimed=%, status=%, attempts=%', v_claimed, v_status, v_attempts;
  end if;
end $$;

-- The migration/function must have no dependency on the Resume/CV queue.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.claim_fleet_improvement_work_item_v40_7b(text,text,integer)'::regprocedure)
  into v_definition;

  if lower(v_definition) like '%candidate_enrichment_tasks%'
     or lower(v_definition) like '%claim_resume_sprint_tasks%'
     or lower(v_definition) like '%resume_sprint_release_mode%' then
    raise exception 'V40.7b fleet claim function must stay isolated from Resume/CV runtime';
  end if;
end $$;

rollback;
