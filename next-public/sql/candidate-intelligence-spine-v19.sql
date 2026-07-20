-- SourcingOS V19 Candidate Intelligence Spine
-- Additive Supabase/Postgres migration. Review in Preview before Production.
-- This migration does not backfill legacy evidence_items automatically.

create table if not exists public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete cascade,
  source_profile_id uuid references public.source_profiles(id) on delete set null,
  field_name text not null,
  claimed_value text not null,
  detail text not null default '',
  evidence_class text not null default 'weak_signal'
    check (evidence_class in ('verified_fact', 'supported_inference', 'weak_signal', 'unknown', 'stale', 'conflicting')),
  base_evidence_class text not null default 'weak_signal'
    check (base_evidence_class in ('verified_fact', 'supported_inference', 'weak_signal', 'unknown', 'conflicting')),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  source text not null,
  source_url text,
  source_type text not null default 'unknown'
    check (source_type in ('authoritative_registry', 'public_profile', 'public_artifact', 'uploaded_document', 'imported_data', 'review_event', 'unknown')),
  retrieved_at timestamptz not null default now(),
  observed_at timestamptz,
  freshness_window_days integer not null default 90 check (freshness_window_days between 1 and 3650),
  conflict_group uuid,
  reviewer_status text not null default 'unreviewed'
    check (reviewer_status in ('unreviewed', 'requires_review', 'accepted', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  permitted_use text not null default 'research_only'
    check (permitted_use in ('research_only', 'review_only', 'outreach_draft', 'blocked')),
  contains_pii boolean not null default false,
  notes jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((reviewer_status in ('accepted', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    or reviewer_status in ('unreviewed', 'requires_review'))
);

create table if not exists public.evidence_claim_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null references public.evidence_claims(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'classified', 'reviewed', 'conflict_added', 'freshness_changed', 'permitted_use_changed', 'exported')),
  previous_value jsonb,
  next_value jsonb,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.action_approval_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('identity_merge', 'outreach_send', 'crm_write', 'bulk_update', 'candidate_export', 'delete', 'permission_change', 'candidate_disposition')),
  target_type text not null,
  target_id text not null,
  proposed_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  idempotency_key text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key),
  check ((status in ('approved', 'rejected') and decided_by is not null and decided_at is not null)
    or status in ('pending', 'expired', 'cancelled'))
);

create index if not exists idx_evidence_claims_owner_candidate on public.evidence_claims(owner_id, candidate_id);
create index if not exists idx_evidence_claims_owner_class on public.evidence_claims(owner_id, evidence_class);
create index if not exists idx_evidence_claims_owner_review on public.evidence_claims(owner_id, reviewer_status);
create index if not exists idx_evidence_claims_retrieved_at on public.evidence_claims(retrieved_at desc);
create index if not exists idx_evidence_claim_events_owner_claim on public.evidence_claim_events(owner_id, claim_id, created_at desc);
create index if not exists idx_action_approvals_owner_status on public.action_approval_requests(owner_id, status, requested_at desc);

alter table public.evidence_claims enable row level security;
alter table public.evidence_claim_events enable row level security;
alter table public.action_approval_requests enable row level security;

revoke all on public.evidence_claims from anon;
revoke all on public.evidence_claim_events from anon;
revoke all on public.action_approval_requests from anon;

grant select, insert, update on public.evidence_claims to authenticated;
grant select, insert on public.evidence_claim_events to authenticated;
grant select, insert, update on public.action_approval_requests to authenticated;

create policy "evidence claims owner select"
  on public.evidence_claims for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "evidence claims owner insert"
  on public.evidence_claims for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "evidence claims owner update"
  on public.evidence_claims for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "evidence events owner select"
  on public.evidence_claim_events for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "evidence events owner insert"
  on public.evidence_claim_events for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "approval requests owner select"
  on public.action_approval_requests for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "approval requests owner insert"
  on public.action_approval_requests for insert to authenticated
  with check ((select auth.uid()) = owner_id and (select auth.uid()) = requested_by);
create policy "approval requests owner update"
  on public.action_approval_requests for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

comment on table public.evidence_claims is 'Field-level candidate evidence with provenance, freshness, uncertainty, review state, and permitted use.';
comment on table public.evidence_claim_events is 'Append-only audit history for evidence classification and review changes.';
comment on table public.action_approval_requests is 'Human approval gate for consequential SourcingOS actions.';
