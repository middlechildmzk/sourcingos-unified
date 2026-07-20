-- SourcingOS V23-V25: durable agent orchestration, candidate graph, recruiter memory, and autonomous recruiting.

create table if not exists public.agent_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid null references public.role_workspaces(id) on delete set null,
  campaign_id uuid null references public.acquisition_campaigns(id) on delete set null,
  workflow_type text not null check (workflow_type in ('role_launch','daily_refresh','candidate_enrichment','calibration','outreach_readiness')),
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','paused','completed','failed','cancelled')),
  current_step text not null default 'intake',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  next_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.agent_workflows(id) on delete cascade,
  step_key text not null,
  agent_key text not null,
  status text not null default 'queued' check (status in ('queued','running','waiting_approval','completed','failed','skipped')),
  attempt integer not null default 0,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workflow_id, step_key)
);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.agent_workflows(id) on delete cascade,
  step_id uuid null references public.agent_steps(id) on delete cascade,
  approval_type text not null,
  title text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  decision_note text not null default '',
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruiter_memory_signals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid null references public.role_workspaces(id) on delete cascade,
  signal_scope text not null default 'global' check (signal_scope in ('global','role','role_family','company')),
  signal_type text not null check (signal_type in ('preference','avoidance','requirement','pattern','correction')),
  key text not null,
  value text not null,
  weight numeric(6,3) not null default 1,
  supporting_events integer not null default 1,
  confidence integer not null default 50 check (confidence between 0 and 100),
  evidence jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, signal_scope, coalesce(role_id, '00000000-0000-0000-0000-000000000000'::uuid), signal_type, key, value)
);

create table if not exists public.talent_graph_edges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_type text not null,
  from_id text not null,
  edge_type text not null,
  to_type text not null,
  to_id text not null,
  label text not null default '',
  confidence integer not null default 50 check (confidence between 0 and 100),
  source text not null,
  source_url text null,
  observed_at timestamptz null,
  valid_from date null,
  valid_to date null,
  metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','confirmed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, from_type, from_id, edge_type, to_type, to_id, source)
);

create table if not exists public.recruiter_daily_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null default current_date,
  title text not null,
  summary text not null,
  metrics jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  status text not null default 'unread' check (status in ('unread','read','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, brief_date)
);

create index if not exists agent_workflows_owner_status_idx on public.agent_workflows(owner_id,status,next_run_at);
create index if not exists agent_steps_workflow_idx on public.agent_steps(workflow_id,status);
create index if not exists agent_approvals_owner_status_idx on public.agent_approvals(owner_id,status,created_at desc);
create index if not exists recruiter_memory_owner_idx on public.recruiter_memory_signals(owner_id,active,confidence desc);
create index if not exists talent_graph_from_idx on public.talent_graph_edges(owner_id,from_type,from_id);
create index if not exists talent_graph_to_idx on public.talent_graph_edges(owner_id,to_type,to_id);
create index if not exists recruiter_briefs_owner_date_idx on public.recruiter_daily_briefs(owner_id,brief_date desc);

alter table public.agent_workflows enable row level security;
alter table public.agent_steps enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.recruiter_memory_signals enable row level security;
alter table public.talent_graph_edges enable row level security;
alter table public.recruiter_daily_briefs enable row level security;

revoke all on public.agent_workflows, public.agent_steps, public.agent_approvals, public.recruiter_memory_signals, public.talent_graph_edges, public.recruiter_daily_briefs from anon, authenticated;
grant select on public.agent_workflows, public.agent_steps, public.agent_approvals, public.recruiter_memory_signals, public.talent_graph_edges, public.recruiter_daily_briefs to authenticated;

create policy agent_workflows_owner_select on public.agent_workflows for select to authenticated using (owner_id = auth.uid());
create policy agent_steps_owner_select on public.agent_steps for select to authenticated using (owner_id = auth.uid());
create policy agent_approvals_owner_select on public.agent_approvals for select to authenticated using (owner_id = auth.uid());
create policy recruiter_memory_owner_select on public.recruiter_memory_signals for select to authenticated using (owner_id = auth.uid());
create policy talent_graph_owner_select on public.talent_graph_edges for select to authenticated using (owner_id = auth.uid());
create policy recruiter_briefs_owner_select on public.recruiter_daily_briefs for select to authenticated using (owner_id = auth.uid());
