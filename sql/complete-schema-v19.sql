-- ══════════════════════════════════════════════════════════════════════════════
-- SourcingOS V19 — Complete schema
-- Run in a fresh Supabase project. V18 was never deployed to production.
-- Run rls-policies-v19.sql immediately after this file.
-- ══════════════════════════════════════════════════════════════════════════════
-- GUARDRAILS enforced at schema level:
--   candidate_contacts.verified is ALWAYS false (CHECK constraint)
--   open_to_work_signals.requires_review defaults true
--   No auto-merge path exists in this schema
--   Candidate identity is global; fit score lives on project_candidates only
-- ══════════════════════════════════════════════════════════════════════════════

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── profiles (extends auth.users) ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'beta_user'
                check (role in ('beta_user','admin','employer')),
  plan        text not null default 'free'
                check (plan in ('free','beta','pro')),
  focus       text,    -- e.g. 'technical','healthcare','cleared','ai'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on Supabase auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects ──────────────────────────────────────────────────────────────────
-- Candidate identity is GLOBAL. Fit score is PROJECT-SPECIFIC (see project_candidates).
create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  role_title      text,
  jd              text,
  must_haves      jsonb not null default '[]',
  nice_to_haves   jsonb not null default '[]',
  disqualifiers   jsonb not null default '[]',
  target_companies text[] not null default '{}',
  search_lanes    jsonb not null default '[]',
  status          text not null default 'active'
                    check (status in ('active','archived','closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger set_updated_at_projects
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ── candidates (GLOBAL identity) ──────────────────────────────────────────────
create table if not exists public.candidates (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  canonical_name      text not null,
  headline            text,
  location            text,
  current_company     text,
  current_title       text,
  summary             text,
  skills              text[] not null default '{}',
  merge_status        text not null default 'pending'
                        check (merge_status in ('pending','confirmed','rejected')),
  last_refreshed_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger set_updated_at_candidates
  before update on public.candidates
  for each row execute function public.set_updated_at();

-- ── project_candidates (FIT IS HERE, not on candidates) ───────────────────────
create table if not exists public.project_candidates (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  candidate_id    uuid not null references public.candidates(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  stage           text not null default 'sourced'
                    check (stage in ('sourced','contacted','responded',
                                     'interviewing','offered','closed','passed')),
  fit_score       numeric(5,2),   -- project-specific; AI-generated, recruiter-editable
  fit_evidence    jsonb not null default '[]',
  fit_missing     jsonb not null default '[]',
  fit_confidence  text check (fit_confidence in ('high','medium','low')),
  added_by        uuid references auth.users(id),
  added_at        timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (project_id, candidate_id)
);
create trigger set_updated_at_project_candidates
  before update on public.project_candidates
  for each row execute function public.set_updated_at();

-- ── pipeline_entries (optional finer-grained pipeline state per project) ──────
create table if not exists public.pipeline_entries (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  stage         text not null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger set_updated_at_pipeline_entries
  before update on public.pipeline_entries
  for each row execute function public.set_updated_at();

-- ── source_profiles ───────────────────────────────────────────────────────────
create table if not exists public.source_profiles (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  candidate_id      uuid references public.candidates(id) on delete set null,
  source            text not null,
  source_profile_id text not null,
  profile_url       text,
  display_name      text not null,
  headline          text,
  location          text,
  organization      text,
  raw_text          text,
  raw               jsonb,
  status            text not null default 'pending'
                      check (status in ('pending','confirmed','rejected')),
  match_score       integer not null default 0,
  match_reasons     text[] not null default '{}',
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id, source, source_profile_id)
);
create trigger set_updated_at_source_profiles
  before update on public.source_profiles
  for each row execute function public.set_updated_at();

-- ── evidence_items ────────────────────────────────────────────────────────────
create table if not exists public.evidence_items (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  candidate_id      uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete cascade,
  source            text not null,
  label             text not null,
  detail            text not null,
  confidence        text not null default 'medium'
                      check (confidence in ('low','medium','high')),
  url               text,
  created_at        timestamptz not null default now()
);

-- ── candidate_contacts ────────────────────────────────────────────────────────
-- GUARDRAIL: verified is always false. CHECK constraint enforces this.
-- Do not remove the check. Contact verification requires explicit consent management
-- outside this schema and is out of scope for SourcingOS.
create table if not exists public.candidate_contacts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  candidate_id      uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete cascade,
  type              text not null,
  value             text not null,
  source            text not null,
  confidence        text not null default 'medium'
                      check (confidence in ('low','medium','high')),
  verified          boolean not null default false check (verified = false), -- enforced
  permission_status text not null default 'unknown'
                      check (permission_status in (
                        'unknown','candidate_provided','company_owned','do_not_contact'
                      )),
  created_at        timestamptz not null default now()
);

-- ── open_to_work_signals ──────────────────────────────────────────────────────
-- GUARDRAIL: requires_review defaults true. This is a SIGNAL, not a verified claim.
create table if not exists public.open_to_work_signals (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  candidate_id      uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete cascade,
  source            text not null,
  label             text not null,
  detail            text not null,
  confidence        text not null default 'medium'
                      check (confidence in ('low','medium','high')),
  requires_review   boolean not null default true, -- always require recruiter review
  created_at        timestamptz not null default now()
);

-- ── identity_match_reviews ────────────────────────────────────────────────────
-- No auto-merge. decision='confirmed' requires a human action recorded here.
create table if not exists public.identity_match_reviews (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  candidate_id        uuid references public.candidates(id) on delete set null,
  source_profile_ids  uuid[] not null,
  match_score         integer not null default 0,
  match_reasons       text[] not null default '{}',
  conflicts           text[] not null default '{}',
  decision            text not null default 'pending'
                        check (decision in ('pending','confirmed','rejected')),
  decided_by          text,     -- recruiter identifier, never null when confirmed
  decided_at          timestamptz,
  created_at          timestamptz not null default now()
);

-- ── candidate_refresh_events ──────────────────────────────────────────────────
create table if not exists public.candidate_refresh_events (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  candidate_id  uuid references public.candidates(id) on delete cascade,
  event_type    text not null,
  detail        text,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

-- ── candidate_import_batches ──────────────────────────────────────────────────
create table if not exists public.candidate_import_batches (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  import_type     text not null,
  file_name       text,
  rows_seen       integer not null default 0,
  records_created integer not null default 0,
  warnings        text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- ── job_submissions (raw submissions; not public) ──────────────────────────────
create table if not exists public.job_submissions (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  company_name  text not null,
  job_title     text not null,
  job_url       text not null,  -- must be real external URL, validated before insert
  salary_range  text,
  location      text,
  remote_type   text,
  notes         text,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id)
);

-- ── approved_jobs (public-readable; only JobPosting schema for this table) ────
create table if not exists public.approved_jobs (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid references public.job_submissions(id),
  company_name    text not null,
  job_title       text not null,
  job_url         text not null,   -- verified real URL
  salary_range    text,
  location        text,
  remote_type     text,
  categories      text[] not null default '{}',
  approved_at     timestamptz not null default now(),
  expires_at      timestamptz,
  is_active       boolean not null default true
);

-- ── waitlist ──────────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        text,
  focus       text,
  intent      text,
  source_page text,
  created_at  timestamptz not null default now(),
  unique (email)   -- upsert-safe: duplicate signup re-joins without error
);
