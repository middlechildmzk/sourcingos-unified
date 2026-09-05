-- V40.5b Resume/CV yield correction.
-- Early production telemetry showed 540 completed sprint searches and zero
-- qualifying public-document leads. The sprint runtime chooses two adjacent
-- queries from a ten-query registry based on payload.queryOffset, so most
-- candidates were never receiving the two highest-yield general PDF queries.
--
-- Keep the 5,000-candidate cohort bounded: do not create additional tasks.
-- Instead, make every not-yet-completed sprint search start at queryOffset=0,
-- and give prior zero-yield completions one corrected pass through the same task.
-- Existing positive-yield completions, parse tasks, review states, and failures
-- are left untouched.

update public.candidate_enrichment_tasks
set payload = jsonb_set(
      jsonb_set(coalesce(payload, '{}'::jsonb), '{queryOffset}', '0'::jsonb, true),
      '{strategyVersion}', '"v40_5b_general_pdf_first"'::jsonb, true
    ),
    updated_at = now()
where task_kind = 'resume_search'
  and payload->>'batchTag' = 'v40_5_resume_sprint_5000'
  and status = 'queued';

update public.candidate_enrichment_tasks
set status = 'queued',
    payload = jsonb_set(
      jsonb_set(coalesce(payload, '{}'::jsonb), '{queryOffset}', '0'::jsonb, true),
      '{strategyVersion}', '"v40_5b_general_pdf_first"'::jsonb, true
    ),
    result_summary = jsonb_build_object(
      'requeuedForStrategy', 'v40_5b_general_pdf_first',
      'priorFound', coalesce((result_summary->>'found')::int, 0)
    ),
    completed_at = null,
    not_before = now(),
    locked_at = null,
    locked_by = null,
    updated_at = now()
where task_kind = 'resume_search'
  and payload->>'batchTag' = 'v40_5_resume_sprint_5000'
  and status = 'complete'
  and coalesce((result_summary->>'found')::int, 0) = 0;
