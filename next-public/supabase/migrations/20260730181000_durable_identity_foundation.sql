-- SourcingOS V29.3A1 durable identity foundation
--
-- Additive, owner-scoped, read-only for browser clients.
-- No backfill, candidate merge, canonical-field rewrite, or production data
-- mutation is performed by this migration.

-- Fail closed unless the canonical baseline already exists.
do $$
begin
  if to_regclass('public.candidates') is null
    or to_regclass('public.source_profiles') is null
    or to_regclass('public.evidence_items') is null then
    raise exception 'V29.3A1 requires the reconciled canonical candidate graph';
  end if;
end $$;

-- Composite owner keys are required for owner-safe foreign keys in new tables.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.candidates'::regclass
      and conname = 'candidates_owner_id_id_key'
  ) then
    alter table public.candidates
      add constraint candidates_owner_id_id_key unique (owner_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.source_profiles'::regclass
      and conname = 'source_profiles_owner_id_id_key'
  ) then
    alter table public.source_profiles
      add constraint source_profiles_owner_id_id_key unique (owner_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.evidence_items'::regclass
      and conname = 'evidence_items_owner_id_id_key'
  ) then
    alter table public.evidence_items
      add constraint evidence_items_owner_id_id_key unique (owner_id, id);
  end if;
end $$;

create table if not exists public.source_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_profile_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint source_profile_snapshots_owner_profile_fk
    foreign key (owner_id, source_profile_id)
    references public.source_profiles(owner_id, id)
    on delete cascade,
  unique (owner_id, source_profile_id, payload_hash)
);

create table if not exists public.source_profile_identifiers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_profile_id uuid not null,
  identifier_type text not null check (identifier_type in (
    'platform_id', 'profile_url', 'handle', 'public_email_hash',
    'website_domain', 'orcid', 'phone_hash', 'linkedin_url',
    'github_url', 'stackoverflow_url'
  )),
  normalized_value_hash text not null check (normalized_value_hash ~ '^[0-9a-f]{64}$'),
  display_value text,
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  observed_at timestamptz not null,
  source_evidence_id uuid,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  constraint source_profile_identifiers_owner_profile_fk
    foreign key (owner_id, source_profile_id)
    references public.source_profiles(owner_id, id)
    on delete cascade,
  constraint source_profile_identifiers_owner_evidence_fk
    foreign key (owner_id, source_evidence_id)
    references public.evidence_items(owner_id, id)
    on delete restrict,
  unique (owner_id, source_profile_id, identifier_type, normalized_value_hash)
);

create table if not exists public.identity_block_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_profile_id uuid not null,
  block_type text not null check (block_type in (
    'platform_identifier', 'profile_url', 'public_email_hash', 'orcid',
    'personal_domain', 'uncommon_handle', 'name_location', 'name_organization'
  )),
  block_hash text not null check (block_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint identity_block_keys_owner_profile_fk
    foreign key (owner_id, source_profile_id)
    references public.source_profiles(owner_id, id)
    on delete cascade,
  unique (owner_id, source_profile_id, block_type, block_hash)
);

create table if not exists public.identity_match_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_profile_id uuid not null,
  candidate_id uuid not null,
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'rejected', 'auto_attached_deterministic', 'superseded'
  )),
  decision_class text not null check (decision_class in (
    'exact_source_reuse', 'deterministic_attach', 'high_priority_review',
    'standard_review', 'create_new_candidate', 'do_not_link'
  )),
  score numeric(6,5) check (score is null or score between 0 and 1),
  deterministic_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(deterministic_rules) = 'array'),
  similarity_components jsonb not null default '{}'::jsonb check (jsonb_typeof(similarity_components) = 'object'),
  supporting_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(supporting_evidence) = 'array'),
  conflicts jsonb not null default '[]'::jsonb check (jsonb_typeof(conflicts) = 'array'),
  resolver_version text not null,
  review_required boolean not null default true,
  supersedes_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  unique (owner_id, id),
  constraint identity_match_proposals_owner_profile_fk
    foreign key (owner_id, source_profile_id)
    references public.source_profiles(owner_id, id)
    on delete cascade,
  constraint identity_match_proposals_owner_candidate_fk
    foreign key (owner_id, candidate_id)
    references public.candidates(owner_id, id)
    on delete cascade,
  constraint identity_match_proposals_owner_supersedes_fk
    foreign key (owner_id, supersedes_id)
    references public.identity_match_proposals(owner_id, id)
    on delete restrict,
  check (
    (status = 'pending' and decided_at is null and decided_by is null)
    or (status in ('approved', 'rejected') and decided_at is not null and decided_by is not null)
    or (status in ('auto_attached_deterministic', 'superseded') and decided_at is not null)
  )
);

create unique index if not exists idx_identity_match_proposals_one_pending
  on public.identity_match_proposals(owner_id, source_profile_id, candidate_id)
  where status = 'pending';

-- Canonical field-claim model promoted from the V19 intelligence-spine design.
create table if not exists public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null,
  source_profile_id uuid,
  field_name text not null,
  claimed_value text not null default '',
  value_json jsonb not null default 'null'::jsonb,
  normalized_value text,
  detail text not null default '',
  evidence_class text not null default 'weak_signal' check (evidence_class in (
    'verified_fact', 'supported_inference', 'weak_signal', 'unknown', 'stale', 'conflicting'
  )),
  base_evidence_class text not null default 'weak_signal' check (base_evidence_class in (
    'verified_fact', 'supported_inference', 'weak_signal', 'unknown', 'conflicting'
  )),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  source_reliability numeric(5,4) not null default 0.5 check (source_reliability between 0 and 1),
  freshness_score numeric(5,4) not null default 0.5 check (freshness_score between 0 and 1),
  corroboration_count integer not null default 1 check (corroboration_count >= 0),
  lifecycle_status text not null default 'active' check (lifecycle_status in (
    'active', 'superseded', 'conflicting', 'rejected', 'unresolved'
  )),
  source text not null,
  source_url text,
  source_type text not null default 'unknown' check (source_type in (
    'authoritative_registry', 'public_profile', 'public_artifact',
    'uploaded_document', 'imported_data', 'review_event', 'unknown'
  )),
  retrieved_at timestamptz not null default now(),
  observed_at timestamptz,
  freshness_window_days integer not null default 90 check (freshness_window_days between 1 and 3650),
  conflict_group uuid,
  reviewer_status text not null default 'unreviewed' check (reviewer_status in (
    'unreviewed', 'requires_review', 'accepted', 'rejected'
  )),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  permitted_use text not null default 'research_only' check (permitted_use in (
    'research_only', 'review_only', 'outreach_draft', 'blocked'
  )),
  contains_pii boolean not null default false,
  notes jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  constraint evidence_claims_owner_candidate_fk
    foreign key (owner_id, candidate_id)
    references public.candidates(owner_id, id)
    on delete cascade,
  constraint evidence_claims_owner_profile_fk
    foreign key (owner_id, source_profile_id)
    references public.source_profiles(owner_id, id)
    on delete restrict,
  check (
    (reviewer_status in ('accepted', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    or reviewer_status in ('unreviewed', 'requires_review')
  )
);

create table if not exists public.evidence_claim_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  claim_id uuid not null,
  event_type text not null check (event_type in (
    'created', 'classified', 'reviewed', 'conflict_added',
    'freshness_changed', 'permitted_use_changed', 'superseded', 'exported'
  )),
  previous_value jsonb,
  next_value jsonb,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  constraint evidence_claim_events_owner_claim_fk
    foreign key (owner_id, claim_id)
    references public.evidence_claims(owner_id, id)
    on delete cascade
);

create table if not exists public.candidate_merge_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  surviving_candidate_id uuid not null,
  duplicate_candidate_id uuid not null,
  event_status text not null default 'planned' check (event_status in ('planned', 'applied', 'reverted')),
  reason text not null,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  constraint candidate_merge_events_owner_survivor_fk
    foreign key (owner_id, surviving_candidate_id)
    references public.candidates(owner_id, id)
    on delete restrict,
  constraint candidate_merge_events_owner_duplicate_fk
    foreign key (owner_id, duplicate_candidate_id)
    references public.candidates(owner_id, id)
    on delete restrict,
  check (surviving_candidate_id <> duplicate_candidate_id),
  check ((event_status = 'reverted' and reverted_at is not null) or event_status <> 'reverted')
);

create index if not exists idx_source_profile_snapshots_owner_profile_observed
  on public.source_profile_snapshots(owner_id, source_profile_id, observed_at desc);
create index if not exists idx_source_profile_identifiers_owner_hash
  on public.source_profile_identifiers(owner_id, identifier_type, normalized_value_hash);
create index if not exists idx_identity_block_keys_owner_hash
  on public.identity_block_keys(owner_id, block_type, block_hash);
create index if not exists idx_identity_match_proposals_owner_status
  on public.identity_match_proposals(owner_id, status, created_at desc);
create index if not exists idx_evidence_claims_owner_candidate_field
  on public.evidence_claims(owner_id, candidate_id, field_name, lifecycle_status);
create index if not exists idx_evidence_claims_owner_review
  on public.evidence_claims(owner_id, reviewer_status, updated_at desc);
create index if not exists idx_evidence_claim_events_owner_claim
  on public.evidence_claim_events(owner_id, claim_id, created_at desc);
create index if not exists idx_candidate_merge_events_owner_candidates
  on public.candidate_merge_events(owner_id, surviving_candidate_id, duplicate_candidate_id, created_at desc);

alter table public.source_profile_snapshots enable row level security;
alter table public.source_profile_identifiers enable row level security;
alter table public.identity_block_keys enable row level security;
alter table public.identity_match_proposals enable row level security;
alter table public.evidence_claims enable row level security;
alter table public.evidence_claim_events enable row level security;
alter table public.candidate_merge_events enable row level security;

revoke all on public.source_profile_snapshots from anon, authenticated;
revoke all on public.source_profile_identifiers from anon, authenticated;
revoke all on public.identity_block_keys from anon, authenticated;
revoke all on public.identity_match_proposals from anon, authenticated;
revoke all on public.evidence_claims from anon, authenticated;
revoke all on public.evidence_claim_events from anon, authenticated;
revoke all on public.candidate_merge_events from anon, authenticated;

grant select on public.source_profile_snapshots to authenticated;
grant select on public.source_profile_identifiers to authenticated;
grant select on public.identity_block_keys to authenticated;
grant select on public.identity_match_proposals to authenticated;
grant select on public.evidence_claims to authenticated;
grant select on public.evidence_claim_events to authenticated;
grant select on public.candidate_merge_events to authenticated;

-- Browser clients remain owner-scoped and read-only. Server writes must be
-- owner-scoped and separately authorized.
drop policy if exists source_profile_snapshots_owner_select on public.source_profile_snapshots;
create policy source_profile_snapshots_owner_select on public.source_profile_snapshots
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists source_profile_identifiers_owner_select on public.source_profile_identifiers;
create policy source_profile_identifiers_owner_select on public.source_profile_identifiers
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists identity_block_keys_owner_select on public.identity_block_keys;
create policy identity_block_keys_owner_select on public.identity_block_keys
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists identity_match_proposals_owner_select on public.identity_match_proposals;
create policy identity_match_proposals_owner_select on public.identity_match_proposals
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists evidence_claims_owner_select_v29_3a1 on public.evidence_claims;
create policy evidence_claims_owner_select_v29_3a1 on public.evidence_claims
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists evidence_claim_events_owner_select_v29_3a1 on public.evidence_claim_events;
create policy evidence_claim_events_owner_select_v29_3a1 on public.evidence_claim_events
  for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists candidate_merge_events_owner_select on public.candidate_merge_events;
create policy candidate_merge_events_owner_select on public.candidate_merge_events
  for select to authenticated using ((select auth.uid()) = owner_id);

drop trigger if exists set_updated_at_identity_match_proposals on public.identity_match_proposals;
create trigger set_updated_at_identity_match_proposals
  before update on public.identity_match_proposals
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_evidence_claims on public.evidence_claims;
create trigger set_updated_at_evidence_claims
  before update on public.evidence_claims
  for each row execute function public.set_updated_at();

comment on table public.identity_match_proposals is
  'Auditable source-profile-to-candidate identity proposals. Probabilistic scores rank recruiter review and never authorize silent attachment.';
comment on table public.source_profile_identifiers is
  'Owner-scoped normalized identity anchors. Sensitive values are stored as deterministic hashes, not avoidable plaintext.';
comment on table public.evidence_claims is
  'Field-level candidate claims with provenance, freshness, corroboration, conflicts, review state, and permitted use.';
comment on table public.candidate_merge_events is
  'Reversible candidate-consolidation audit contract. V29.3A1 creates no automatic or destructive merge behavior.';
