-- V40.4: autonomous Talent enrichment + public Resume/CV intelligence.
-- Supabase remains canonical. Unattended workers may add provenance-backed
-- observations/facts to an already-known candidate, but may not auto-merge
-- identities, reveal contact values, send outreach, or make recruiter decisions.

create table if not exists public.candidate_enrichment_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  task_kind text not null check (task_kind in (
    'resume_search','resume_fetch_parse','employment_history','skills_evidence',
    'education','certification','professional_urls','portfolio_projects',
    'publication_patents','location_refresh','employer_refresh','profile_quality',
    'stale_refresh','identity_corroboration','evidence_conflict','dedupe_review'
  )),
  agent_id text not null,
  priority integer not null default 50 check (priority between 0 and 100),
  status text not null default 'queued' check (status in ('queued','running','needs_review','complete','failed','paused')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  not_before timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  payload jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists candidate_enrichment_tasks_due_idx
  on public.candidate_enrichment_tasks(status, not_before, priority desc, created_at)
  where status = 'queued';
create index if not exists candidate_enrichment_tasks_owner_candidate_idx
  on public.candidate_enrichment_tasks(owner_id, candidate_id, created_at desc);
create unique index if not exists candidate_enrichment_tasks_one_live_kind_idx
  on public.candidate_enrichment_tasks(owner_id, candidate_id, task_kind)
  where status in ('queued','running');

create table if not exists public.candidate_profile_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete set null,
  artifact_id uuid references public.candidate_artifacts(id) on delete set null,
  fact_type text not null check (fact_type in (
    'employment','education','certification','skill','project','publication',
    'patent','professional_url','location','headline','other'
  )),
  fact_key text not null,
  value jsonb not null default '{}'::jsonb,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  verification_status text not null default 'source_stated' check (verification_status in ('source_stated','observed','corroborated','verified','conflicting','needs_review')),
  source text not null,
  source_url text,
  fingerprint text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, candidate_id, fingerprint)
);
create index if not exists candidate_profile_facts_candidate_idx
  on public.candidate_profile_facts(owner_id, candidate_id, fact_type, observed_at desc);

create table if not exists public.public_document_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  url text not null,
  normalized_url text not null,
  host text not null,
  document_kind text not null default 'resume_cv' check (document_kind in ('resume_cv','portfolio','bio','other')),
  discovery_query text,
  discovery_provider text,
  title text,
  snippet text,
  status text not null default 'discovered' check (status in ('discovered','restricted_metadata_only','identity_review','parsed_attached','duplicate','rejected','fetch_failed')),
  identity_confidence text check (identity_confidence in ('low','medium','high')),
  identity_reason text,
  restricted_reason text,
  content_sha256 text,
  artifact_id uuid references public.candidate_artifacts(id) on delete set null,
  discovered_at timestamptz not null default now(),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, candidate_id, normalized_url)
);
create index if not exists public_document_leads_candidate_idx
  on public.public_document_leads(owner_id, candidate_id, status, discovered_at desc);

create table if not exists public.fleet_source_cursors (
  owner_id uuid not null references auth.users(id) on delete cascade,
  lane_id uuid not null references public.fleet_standing_intents(id) on delete cascade,
  source text not null,
  cursor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key(owner_id, lane_id, source)
);

create table if not exists public.fleet_seen_source_profiles (
  owner_id uuid not null references auth.users(id) on delete cascade,
  lane_id uuid not null references public.fleet_standing_intents(id) on delete cascade,
  source text not null,
  source_profile_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  times_seen integer not null default 1 check (times_seen >= 1),
  primary key(owner_id, lane_id, source, source_profile_id)
);
create index if not exists fleet_seen_source_profiles_recent_idx
  on public.fleet_seen_source_profiles(owner_id, lane_id, last_seen_at desc);

alter table public.candidate_enrichment_tasks enable row level security;
alter table public.candidate_profile_facts enable row level security;
alter table public.public_document_leads enable row level security;
alter table public.fleet_source_cursors enable row level security;
alter table public.fleet_seen_source_profiles enable row level security;

-- Recruiters can inspect their own enrichment state and provenance. Runtime
-- mutation remains service-role-only so a browser cannot impersonate a worker.
drop policy if exists candidate_enrichment_tasks_select_own on public.candidate_enrichment_tasks;
create policy candidate_enrichment_tasks_select_own on public.candidate_enrichment_tasks
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists candidate_profile_facts_select_own on public.candidate_profile_facts;
create policy candidate_profile_facts_select_own on public.candidate_profile_facts
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists public_document_leads_select_own on public.public_document_leads;
create policy public_document_leads_select_own on public.public_document_leads
  for select to authenticated using (owner_id = auth.uid());

grant select on public.candidate_enrichment_tasks to authenticated;
grant select on public.candidate_profile_facts to authenticated;
grant select on public.public_document_leads to authenticated;
revoke all on public.fleet_source_cursors from anon, authenticated;
revoke all on public.fleet_seen_source_profiles from anon, authenticated;

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

create or replace function public.note_fleet_source_profile_seen_v40_4(
  p_owner_id uuid,
  p_lane_id uuid,
  p_source text,
  p_source_profile_id text,
  p_seen_at timestamptz default now()
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted boolean := false;
begin
  insert into public.fleet_seen_source_profiles(owner_id,lane_id,source,source_profile_id,first_seen_at,last_seen_at,times_seen)
  values(p_owner_id,p_lane_id,p_source,p_source_profile_id,p_seen_at,p_seen_at,1)
  on conflict(owner_id,lane_id,source,source_profile_id) do update
    set last_seen_at = excluded.last_seen_at,
        times_seen = public.fleet_seen_source_profiles.times_seen + 1
  returning (xmax = 0) into v_inserted;
  return v_inserted;
end;
$$;
revoke all on function public.note_fleet_source_profile_seen_v40_4(uuid,uuid,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.note_fleet_source_profile_seen_v40_4(uuid,uuid,text,text,timestamptz) to service_role;
