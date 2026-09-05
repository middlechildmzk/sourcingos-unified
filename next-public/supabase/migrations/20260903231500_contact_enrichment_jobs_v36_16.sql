-- V36.16 async contact-enrichment job plane.
-- Provider callbacks write only through reviewed service-role routes. Recruiter
-- clients read job state through owner-scoped authenticated API routes.

create table if not exists public.contact_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  candidate_id text,
  source_profile_id text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'exhausted', 'failed', 'canceled')),
  requested_goals text[] not null default '{}'::text[],
  satisfied_goals text[] not null default '{}'::text[],
  missing_goals text[] not null default '{}'::text[],
  provider_chain text[] not null default '{}'::text[],
  provider_index integer not null default 0 check (provider_index >= 0),
  current_provider text,
  current_provider_request_id text,
  request_payload jsonb not null default '{}'::jsonb,
  accumulated_signals jsonb not null default '[]'::jsonb,
  attempts jsonb not null default '[]'::jsonb,
  callback_token_hash text not null,
  estimated_credits numeric not null default 0 check (estimated_credits >= 0),
  actual_credits numeric not null default 0 check (actual_credits >= 0),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists contact_enrichment_jobs_owner_created_idx
  on public.contact_enrichment_jobs(owner_id, created_at desc);
create index if not exists contact_enrichment_jobs_owner_status_idx
  on public.contact_enrichment_jobs(owner_id, status, created_at desc);
create index if not exists contact_enrichment_jobs_provider_request_idx
  on public.contact_enrichment_jobs(current_provider, current_provider_request_id)
  where current_provider_request_id is not null;

alter table public.contact_enrichment_jobs enable row level security;
revoke all on table public.contact_enrichment_jobs from anon, authenticated;

comment on table public.contact_enrichment_jobs is
  'Server-owned async enrichment state for provider webhook jobs. Stores normalized recruiter request context, per-provider telemetry, and contact observations; callback capability tokens are stored only as hashes.';
