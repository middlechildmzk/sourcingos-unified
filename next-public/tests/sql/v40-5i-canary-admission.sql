-- Executable proof of the V40.5i atomic canary admission invariant.
--
-- Run by tests/v40-5i-canary-admission.test.ts against a real PostgreSQL
-- instance, so the ceiling is verified by the database itself rather than by
-- string-matching the migration. The harness creates a stand-in
-- candidate_enrichment_tasks table and applies the V40.5i migration first;
-- this script must NOT drop that table (the claim functions return
-- setof candidate_enrichment_tasks and would be dropped with it).
--
-- Emits one final result set: label | actual | expected | verdict.

\set ON_ERROR_STOP on

-- Fixtures (seed_sprint / admitted_count / mark_admitted) come from
-- v40-5i-helpers.sql, applied by setup-v40-5i-db.sh.

drop table if exists public.v40_5i_results;
create table public.v40_5i_results(label text, actual integer, expected integer);

-- 1. ceiling 6, nothing admitted -> at most 6 distinct candidates admitted.
select public.seed_sprint(40, 0);
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w1',now(),6,false);
insert into public.v40_5i_results values ('ceiling6_from_zero', public.admitted_count(), 6);

-- 2. Repeated ticks (rows released back to queued, as a retry would) hold at 6.
update public.candidate_enrichment_tasks set status='queued', locked_at=null, locked_by=null, attempts=0;
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w2',now(),6,false);
update public.candidate_enrichment_tasks set status='queued', locked_at=null, locked_by=null, attempts=0;
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w3',now(),6,false);
insert into public.v40_5i_results values ('repeated_ticks_hold_at_6', public.admitted_count(), 6);

-- 3. ceiling 6 with 4 already admitted and still running -> only 2 more.
select public.seed_sprint(40, 0);
select public.mark_admitted(4, 'running');
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w4',now(),6,false);
insert into public.v40_5i_results values ('four_running_admits_two_more', public.admitted_count(), 6);

-- 4. Ceiling full across running/complete/failed -> zero further admissions.
select public.seed_sprint(40, 0);
select public.mark_admitted(2, 'running');
select public.mark_admitted(2, 'complete');
select public.mark_admitted(2, 'failed');
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w5',now(),6,false);
insert into public.v40_5i_results values ('ceiling_full_admits_zero', public.admitted_count(), 6);

-- 5. A FAILED admitted candidate must not free its slot, even once requeued.
select public.seed_sprint(40, 0);
select public.mark_admitted(6, 'failed');
update public.candidate_enrichment_tasks set status='queued', attempts=0 where status='failed';
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w6',now(),6,false);
insert into public.v40_5i_results values ('failed_admissions_do_not_free_slots', public.admitted_count(), 6);

-- 6. Parse tasks still drain while the search ceiling is full.
select public.seed_sprint(40, 5);
select public.mark_admitted(6, 'running');
insert into public.v40_5i_results
select 'parse_drains_when_search_ceiling_full',
       count(*) filter (where task_kind='resume_fetch_parse')::int, 5
  from public.claim_resume_sprint_tasks_v40_5i(36,'w7',now(),6,false);

-- 7. Legacy 3-arg shim is fail-closed: parse only, never a search.
select public.seed_sprint(40, 3);
insert into public.v40_5i_results
select 'legacy_shim_admits_zero_searches',
       count(*) filter (where task_kind='resume_search')::int, 0
  from public.claim_resume_sprint_tasks_v40_5(36,'legacy',now());
insert into public.v40_5i_results values ('legacy_shim_admits_nothing_into_canary', public.admitted_count(), 0);
select public.seed_sprint(40, 3);
insert into public.v40_5i_results
select 'legacy_shim_still_drains_parse',
       count(*) filter (where task_kind='resume_fetch_parse')::int, 3
  from public.claim_resume_sprint_tasks_v40_5(36,'legacy',now());

-- 8. Legacy V40.5b-h attempts (result_summary strategy, no admission marker)
--    must not consume V40.5i admission slots.
select public.seed_sprint(40, 0);
update public.candidate_enrichment_tasks
   set status='complete', attempts=1,
       result_summary=jsonb_build_object('strategyVersion','v40_5b_general_pdf_first','found',0)
 where id in (select id from public.candidate_enrichment_tasks where task_kind='resume_search' limit 20);
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'w8',now(),6,false);
insert into public.v40_5i_results values ('legacy_attempts_do_not_consume_slots', public.admitted_count(), 6);

-- 9. Scaled mode bypasses the ceiling, but only when explicitly enabled.
select public.seed_sprint(40, 0);
insert into public.v40_5i_results
select 'scaled_mode_bypasses_ceiling',
       count(*) filter (where task_kind='resume_search')::int, 36
  from public.claim_resume_sprint_tasks_v40_5i(36,'w9',now(),6,true);

select label, actual, expected,
       case when actual = expected then 'PASS' else 'FAIL' end as verdict
  from public.v40_5i_results order by label;
