-- Shared fixtures for the V40.5i canary admission proofs. Applied by
-- setup-v40-5i-db.sh so each proof script is independently runnable.

\set ON_ERROR_STOP on

-- Seeds a clean sprint backlog: p_searches queued resume_search rows and
-- p_parses queued resume_fetch_parse rows, all carrying the sprint batch tag.
create or replace function public.seed_sprint(p_searches integer, p_parses integer)
returns void language plpgsql as $$
begin
  delete from public.candidate_enrichment_tasks;
  insert into public.candidate_enrichment_tasks(candidate_id, task_kind, payload)
  select gen_random_uuid(), 'resume_search',
         jsonb_build_object('batchTag','v40_5_resume_sprint_5000','queryOffset',0)
    from generate_series(1, p_searches);
  insert into public.candidate_enrichment_tasks(candidate_id, task_kind, priority, payload)
  select gen_random_uuid(), 'resume_fetch_parse', 90,
         jsonb_build_object('batchTag','v40_5_resume_sprint_5000','leadIds', jsonb_build_array('x'))
    from generate_series(1, p_parses);
end $$;

-- Distinct candidates that have ever been admitted into the V40.5i strategy.
-- This is the quantity the ceiling bounds.
create or replace function public.admitted_count() returns integer
language sql as $$
  select count(distinct candidate_id)::int from public.candidate_enrichment_tasks
   where task_kind='resume_search' and coalesce(payload->>'v40_5i_admitted','')='true';
$$;

-- Marks p_n not-yet-admitted searches as admitted in a given status, standing
-- in for candidates a previous tick already let into the canary.
create or replace function public.mark_admitted(p_n integer, p_status text) returns void
language sql as $$
  update public.candidate_enrichment_tasks
     set payload = jsonb_set(payload,'{v40_5i_admitted}','true'::jsonb,true), status = p_status
   where id in (select id from public.candidate_enrichment_tasks
                 where task_kind='resume_search' and coalesce(payload->>'v40_5i_admitted','')<>'true'
                 limit p_n);
$$;
