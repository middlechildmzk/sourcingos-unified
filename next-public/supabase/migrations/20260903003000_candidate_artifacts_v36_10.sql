-- SourcingOS V36.10 — first-class candidate artifacts.
-- Documents remain independent provenance objects even after their source
-- observation is recruiter-confirmed onto a canonical candidate.

create table if not exists public.candidate_artifacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  candidate_id uuid null references public.candidates(id) on delete cascade,
  source_profile_id uuid null references public.source_profiles(id) on delete set null,
  artifact_type text not null check (artifact_type in ('resume','portfolio','profile_export','document','other')),
  data_origin text not null check (data_origin in ('public_web','recruiter_upload','provider','ats_crm','linkedin_connection_import','csv_import','manual')),
  file_name text null,
  mime_type text null,
  source_url text null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  extraction_version text not null default 'v36.10',
  raw_text_length integer not null default 0 check (raw_text_length >= 0),
  identity_anchors jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidate_artifacts_owner_candidate_idx
  on public.candidate_artifacts(owner_id, candidate_id, created_at desc);
create index if not exists candidate_artifacts_owner_hash_idx
  on public.candidate_artifacts(owner_id, content_sha256);
create index if not exists candidate_artifacts_source_profile_idx
  on public.candidate_artifacts(owner_id, source_profile_id)
  where source_profile_id is not null;

alter table public.candidate_artifacts enable row level security;

drop policy if exists candidate_artifacts_owner_select on public.candidate_artifacts;
create policy candidate_artifacts_owner_select on public.candidate_artifacts
  for select using (auth.uid() = owner_id);

drop policy if exists candidate_artifacts_owner_insert on public.candidate_artifacts;
create policy candidate_artifacts_owner_insert on public.candidate_artifacts
  for insert with check (auth.uid() = owner_id);

drop policy if exists candidate_artifacts_owner_update on public.candidate_artifacts;
create policy candidate_artifacts_owner_update on public.candidate_artifacts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists candidate_artifacts_owner_delete on public.candidate_artifacts;
create policy candidate_artifacts_owner_delete on public.candidate_artifacts
  for delete using (auth.uid() = owner_id);

-- Identity fusion moves the explicitly reviewed source profile onto the selected
-- canonical candidate. Keep any document provenance linked to that source
-- profile synchronized automatically so a resume can never point at the old
-- temporary candidate after the observation itself has moved.
create or replace function public.sync_candidate_artifact_identity_v36_10()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.candidate_id is distinct from old.candidate_id then
    update public.candidate_artifacts
       set candidate_id = new.candidate_id,
           updated_at = now()
     where owner_id = new.owner_id
       and source_profile_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_candidate_artifact_identity_v36_10() from public, anon, authenticated;

drop trigger if exists sync_candidate_artifact_identity_v36_10 on public.source_profiles;
create trigger sync_candidate_artifact_identity_v36_10
  after update of candidate_id on public.source_profiles
  for each row
  when (old.candidate_id is distinct from new.candidate_id)
  execute function public.sync_candidate_artifact_identity_v36_10();

comment on table public.candidate_artifacts is
  'V36.10 provenance-preserving candidate documents/artifacts. Artifacts are never merge authority by themselves; extracted identity anchors feed recruiter-reviewed identity resolution.';

comment on function public.sync_candidate_artifact_identity_v36_10() is
  'Keeps candidate artifact provenance attached to the same canonical person when a recruiter-confirmed identity review moves its source profile.';
