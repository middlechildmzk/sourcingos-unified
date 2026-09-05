-- Keep the high-throughput V40.5 Resume/CV sprint isolated from the normal
-- enrichment queue. The ordinary V40.4 cron continues to claim only non-sprint
-- tasks; the dedicated sprint cron claims the batch with its own bounded pool.

create or replace function public.claim_candidate_enrichment_tasks_v40_4(
  p_limit integer default 8,
  p_worker text default 'enrichment-cron',
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
       and coalesce(t.payload->>'batchTag','') <> 'v40_5_resume_sprint_5000'
     order by t.priority desc, t.not_before asc, t.created_at asc
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 8), 12))
  )
  update public.candidate_enrichment_tasks t
     set status = 'running',
         attempts = t.attempts + 1,
         locked_at = p_now,
         locked_by = left(coalesce(p_worker, 'enrichment-cron'), 120),
         updated_at = p_now
    from due
   where t.id = due.id
  returning t.*;
end;
$$;
revoke all on function public.claim_candidate_enrichment_tasks_v40_4(integer,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_candidate_enrichment_tasks_v40_4(integer,text,timestamptz) to service_role;
