-- V40.5 governed overnight Resume/CV sprint.
-- Seeds 5,000 recruiter-uploaded LinkedIn connection identities for PUBLIC-web
-- resume/CV discovery. This does not authorize LinkedIn scraping, contact-value
-- harvesting, login/paywall bypass, or automatic cross-source identity merge.

create index if not exists candidate_enrichment_tasks_sprint_due_idx
  on public.candidate_enrichment_tasks(status, priority desc, not_before, created_at)
  where task_kind in ('resume_search','resume_fetch_parse');

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
       and t.task_kind in ('resume_search','resume_fetch_parse')
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

with ranked as (
  select
    c.owner_id,
    c.id as candidate_id,
    row_number() over (
      order by coalesce(sp.raw->>'connectedOn','') desc, c.created_at desc, c.id
    ) as rn
  from public.source_profiles sp
  join public.candidates c
    on c.id = sp.candidate_id
   and c.owner_id = sp.owner_id
  where sp.source = 'resume_xray'
    and coalesce(sp.raw->>'importSource','') = 'linkedin_export'
    and coalesce(sp.raw->>'importType','') = 'linkedin_connections'
    and c.canonical_name is not null
    and array_length(regexp_split_to_array(btrim(c.canonical_name), '\s+'), 1) >= 2
    and not exists (
      select 1
      from public.candidate_artifacts a
      where a.owner_id = c.owner_id
        and a.candidate_id = c.id
        and a.artifact_type = 'resume'
    )
    and not exists (
      select 1
      from public.candidate_enrichment_tasks t
      where t.owner_id = c.owner_id
        and t.candidate_id = c.id
        and t.task_kind = 'resume_search'
        and t.status in ('queued','running')
    )
  limit 5000
)
insert into public.candidate_enrichment_tasks(
  owner_id, candidate_id, task_kind, agent_id, priority, status, payload
)
select
  r.owner_id,
  r.candidate_id,
  'resume_search',
  case (r.rn - 1) % 7
    when 0 then 'resume-query-general'
    when 1 then 'resume-query-pdf'
    when 2 then 'resume-query-drive'
    when 3 then 'resume-query-s3'
    when 4 then 'resume-query-portfolio'
    when 5 then 'resume-query-academic'
    else 'resume-query-github'
  end,
  82,
  'queued',
  jsonb_build_object(
    'batchTag', 'v40_5_resume_sprint_5000',
    'queryOffset', ((r.rn - 1) % 10),
    'publicOnly', true,
    'noAuthBypass', true,
    'contactValuesCaptured', false,
    'sourceSeed', 'recruiter_uploaded_linkedin_connections'
  )
from ranked r
on conflict do nothing;
