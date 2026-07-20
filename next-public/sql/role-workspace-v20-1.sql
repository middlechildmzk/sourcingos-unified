-- SourcingOS V20.1 — Durable Role Workspace contract
-- Additive migration. Review against the active Supabase schema in a preview branch first.
-- Direct authenticated writes are intentionally not granted. Server APIs perform owner-scoped writes.

create extension if not exists pgcrypto;

create table if not exists public.role_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','calibrating','active','paused','closed')),
  title text not null,
  location text not null default '',
  work_mode text not null default 'unknown' check (work_mode in ('remote','hybrid','onsite','flexible','unknown')),
  compensation text not null default '',
  clearance text not null default '',
  intake jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists role_workspaces_owner_updated_idx
  on public.role_workspaces(owner_id, updated_at desc);

create table if not exists public.role_search_lanes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.role_workspaces(id) on delete cascade,
  lane_key text not null,
  label text not null,
  purpose text not null default '',
  query text not null default '',
  source text not null,
  status text not null default 'proposed' check (status in ('proposed','approved','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role_id, lane_key)
);

create index if not exists role_search_lanes_owner_role_idx
  on public.role_search_lanes(owner_id, role_id);

create table if not exists public.role_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.role_workspaces(id) on delete cascade,
  candidate_id uuid null,
  source_profile_id uuid null,
  identity_key text not null,
  name text not null,
  headline text not null default '',
  company text not null default '',
  location text not null default '',
  source text not null,
  source_url text null,
  stage text not null default 'needs_review' check (stage in (
    'discovered','needs_review','shortlisted','contact_research','ready_for_outreach',
    'outreach_drafted','contacted','responded','interested','submitted','interviewing',
    'offer','closed','archived'
  )),
  fit_decision text not null default 'unreviewed' check (fit_decision in ('unreviewed','strong_fit','possible_fit','not_fit')),
  fit_reasons jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  contact_status text not null default 'unknown' check (contact_status in ('unknown','signals_found','verified','blocked')),
  evidence_status text not null default 'unreviewed' check (evidence_status in ('unreviewed','reviewed','conflicting','stale')),
  snapshot jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role_id, identity_key)
);

create index if not exists role_candidates_owner_role_stage_idx
  on public.role_candidates(owner_id, role_id, stage);

create index if not exists role_candidates_candidate_idx
  on public.role_candidates(candidate_id)
  where candidate_id is not null;

create table if not exists public.role_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.role_workspaces(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(role_id, event_key)
);

create index if not exists role_activity_owner_role_created_idx
  on public.role_activity(owner_id, role_id, created_at desc);

alter table public.role_workspaces enable row level security;
alter table public.role_search_lanes enable row level security;
alter table public.role_candidates enable row level security;
alter table public.role_activity enable row level security;

revoke all on public.role_workspaces from anon, authenticated;
revoke all on public.role_search_lanes from anon, authenticated;
revoke all on public.role_candidates from anon, authenticated;
revoke all on public.role_activity from anon, authenticated;

grant select on public.role_workspaces to authenticated;
grant select on public.role_search_lanes to authenticated;
grant select on public.role_candidates to authenticated;
grant select on public.role_activity to authenticated;

drop policy if exists role_workspaces_owner_select on public.role_workspaces;
create policy role_workspaces_owner_select on public.role_workspaces
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists role_search_lanes_owner_select on public.role_search_lanes;
create policy role_search_lanes_owner_select on public.role_search_lanes
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists role_candidates_owner_select on public.role_candidates;
create policy role_candidates_owner_select on public.role_candidates
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists role_activity_owner_select on public.role_activity;
create policy role_activity_owner_select on public.role_activity
  for select to authenticated
  using (owner_id = auth.uid());

comment on table public.role_workspaces is 'Owner-scoped role workspaces. Writes occur only through reviewed server APIs.';
comment on table public.role_candidates is 'Role-specific candidate state. Fit decisions are not global candidate ratings.';
comment on column public.role_candidates.identity_key is 'Idempotency key derived from candidate id, source URL, or normalized profile identity.';
