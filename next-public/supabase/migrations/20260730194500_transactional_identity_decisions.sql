-- SourcingOS V29.3A3 transactional identity decisions
--
-- Adds service-role-only RPCs for recruiter identity decisions and rollback.
-- Applying this migration creates schema and functions only. It performs no
-- proposal decision, source-profile move, candidate merge, deletion, or backfill.

-- Fail closed unless the durable identity foundation exists.
do $$
begin
  if to_regclass('public.identity_match_proposals') is null
    or to_regclass('public.source_profile_snapshots') is null
    or to_regclass('public.evidence_claims') is null then
    raise exception 'V29.3A3 requires the durable identity foundation';
  end if;
end $$;

alter table public.identity_match_proposals
  add column if not exists decision_reason text;
alter table public.identity_match_proposals
  add column if not exists decision_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.identity_decision_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null,
  action text not null check (action in ('approve', 'keep_separate', 'reject')),
  event_status text not null default 'applied' check (event_status in ('applied', 'reverted')),
  source_profile_id uuid not null,
  previous_candidate_id uuid,
  target_candidate_id uuid not null,
  previous_source_status text not null,
  before_state jsonb not null default '{}'::jsonb check (jsonb_typeof(before_state) = 'object'),
  after_state jsonb not null default '{}'::jsonb check (jsonb_typeof(after_state) = 'object'),
  reason text,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users(id) on delete restrict,
  revert_reason text,
  unique (owner_id, id),
  constraint identity_decision_events_owner_proposal_fk
    foreign key (owner_id, proposal_id)
    references public.identity_match_proposals(owner_id, id)
    on delete restrict,
  constraint identity_decision_events_owner_profile_fk
    foreign key (owner_id, source_profile_id)
    references public.source_profiles(owner_id, id)
    on delete restrict,
  constraint identity_decision_events_owner_previous_candidate_fk
    foreign key (owner_id, previous_candidate_id)
    references public.candidates(owner_id, id)
    on delete restrict,
  constraint identity_decision_events_owner_target_candidate_fk
    foreign key (owner_id, target_candidate_id)
    references public.candidates(owner_id, id)
    on delete restrict,
  check (
    (event_status = 'applied' and reverted_at is null and reverted_by is null)
    or (event_status = 'reverted' and reverted_at is not null and reverted_by is not null)
  )
);

create unique index if not exists idx_identity_decision_events_one_active_per_proposal
  on public.identity_decision_events(owner_id, proposal_id)
  where event_status = 'applied';
create index if not exists idx_identity_decision_events_owner_profile
  on public.identity_decision_events(owner_id, source_profile_id, created_at desc);
create index if not exists idx_identity_decision_events_owner_candidates
  on public.identity_decision_events(owner_id, previous_candidate_id, target_candidate_id, created_at desc);

alter table public.identity_decision_events enable row level security;
revoke all on public.identity_decision_events from anon, authenticated;
grant select on public.identity_decision_events to authenticated;

drop policy if exists identity_decision_events_owner_select on public.identity_decision_events;
create policy identity_decision_events_owner_select on public.identity_decision_events
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.decide_identity_match_proposal(
  p_owner_id uuid,
  p_proposal_id uuid,
  p_action text,
  p_actor_id uuid,
  p_reason text default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_proposal public.identity_match_proposals%rowtype;
  v_profile public.source_profiles%rowtype;
  v_target public.candidates%rowtype;
  v_previous public.candidates%rowtype;
  v_event_id uuid;
  v_now timestamptz := clock_timestamp();
  v_evidence_count integer := 0;
  v_contact_count integer := 0;
  v_signal_count integer := 0;
  v_claim_count integer := 0;
  v_has_role_state boolean := false;
begin
  if p_owner_id is null or p_actor_id is null or p_actor_id <> p_owner_id then
    return jsonb_build_object('ok', false, 'code', 'identity_actor_not_authorized');
  end if;

  if p_action not in ('approve', 'keep_separate', 'reject') then
    return jsonb_build_object('ok', false, 'code', 'identity_action_invalid');
  end if;

  select * into v_proposal
  from public.identity_match_proposals
  where owner_id = p_owner_id and id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_proposal_not_found');
  end if;

  if v_proposal.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'code', 'identity_proposal_not_pending',
      'status', v_proposal.status
    );
  end if;

  if p_expected_updated_at is not null and v_proposal.updated_at <> p_expected_updated_at then
    return jsonb_build_object(
      'ok', false,
      'code', 'identity_proposal_stale',
      'currentUpdatedAt', v_proposal.updated_at
    );
  end if;

  select * into v_profile
  from public.source_profiles
  where owner_id = p_owner_id and id = v_proposal.source_profile_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_source_profile_not_found');
  end if;

  select * into v_target
  from public.candidates
  where owner_id = p_owner_id and id = v_proposal.candidate_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_target_candidate_not_found');
  end if;

  if v_profile.candidate_id is not null then
    select * into v_previous
    from public.candidates
    where owner_id = p_owner_id and id = v_profile.candidate_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'code', 'identity_previous_candidate_not_found');
    end if;
  end if;

  if p_action = 'approve' then
    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_proposal.conflicts, '[]'::jsonb)) conflict
      where conflict->>'severity' = 'blocking'
    ) then
      return jsonb_build_object('ok', false, 'code', 'identity_blocking_conflict');
    end if;

    if v_profile.candidate_id = v_proposal.candidate_id then
      return jsonb_build_object('ok', false, 'code', 'identity_source_already_attached');
    end if;

    if v_profile.candidate_id is not null then
      select exists (
        select 1 from public.project_candidates
        where owner_id = p_owner_id and candidate_id = v_profile.candidate_id
      ) or exists (
        select 1 from public.pipeline_entries
        where owner_id = p_owner_id and candidate_id = v_profile.candidate_id
      ) into v_has_role_state;

      if v_has_role_state then
        return jsonb_build_object(
          'ok', false,
          'code', 'identity_provisional_candidate_has_role_state',
          'candidateId', v_profile.candidate_id
        );
      end if;
    end if;

    select count(*) into v_evidence_count
    from public.evidence_items
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    select count(*) into v_contact_count
    from public.candidate_contacts
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    select count(*) into v_signal_count
    from public.open_to_work_signals
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    select count(*) into v_claim_count
    from public.evidence_claims
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.source_profiles
    set candidate_id = v_proposal.candidate_id,
        status = 'confirmed'
    where owner_id = p_owner_id and id = v_profile.id;

    update public.evidence_items
    set candidate_id = v_proposal.candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.candidate_contacts
    set candidate_id = v_proposal.candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.open_to_work_signals
    set candidate_id = v_proposal.candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.evidence_claims
    set candidate_id = v_proposal.candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.identity_match_proposals
    set status = 'approved',
        decision_reason = nullif(trim(coalesce(p_reason, '')), ''),
        decision_metadata = jsonb_build_object(
          'action', p_action,
          'previousCandidateId', v_profile.candidate_id,
          'targetCandidateId', v_proposal.candidate_id,
          'movedEvidenceItems', v_evidence_count,
          'movedContactSignals', v_contact_count,
          'movedAvailabilitySignals', v_signal_count,
          'movedEvidenceClaims', v_claim_count
        ),
        decided_at = v_now,
        decided_by = p_actor_id,
        review_required = false
    where owner_id = p_owner_id and id = v_proposal.id;

    insert into public.identity_decision_events (
      owner_id, proposal_id, action, source_profile_id,
      previous_candidate_id, target_candidate_id, previous_source_status,
      before_state, after_state, reason, actor_id
    ) values (
      p_owner_id, v_proposal.id, p_action, v_profile.id,
      v_profile.candidate_id, v_proposal.candidate_id, v_profile.status,
      jsonb_build_object(
        'sourceCandidateId', v_profile.candidate_id,
        'sourceStatus', v_profile.status,
        'proposalStatus', v_proposal.status
      ),
      jsonb_build_object(
        'sourceCandidateId', v_proposal.candidate_id,
        'sourceStatus', 'confirmed',
        'proposalStatus', 'approved',
        'movedEvidenceItems', v_evidence_count,
        'movedContactSignals', v_contact_count,
        'movedAvailabilitySignals', v_signal_count,
        'movedEvidenceClaims', v_claim_count
      ),
      nullif(trim(coalesce(p_reason, '')), ''),
      p_actor_id
    ) returning id into v_event_id;

    return jsonb_build_object(
      'ok', true,
      'code', 'identity_proposal_approved',
      'eventId', v_event_id,
      'proposalId', v_proposal.id,
      'sourceProfileId', v_profile.id,
      'previousCandidateId', v_profile.candidate_id,
      'targetCandidateId', v_proposal.candidate_id
    );
  end if;

  update public.identity_match_proposals
  set status = 'rejected',
      decision_reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), p_action),
      decision_metadata = jsonb_build_object('action', p_action),
      decided_at = v_now,
      decided_by = p_actor_id,
      review_required = false
  where owner_id = p_owner_id and id = v_proposal.id;

  insert into public.identity_decision_events (
    owner_id, proposal_id, action, source_profile_id,
    previous_candidate_id, target_candidate_id, previous_source_status,
    before_state, after_state, reason, actor_id
  ) values (
    p_owner_id, v_proposal.id, p_action, v_profile.id,
    v_profile.candidate_id, v_proposal.candidate_id, v_profile.status,
    jsonb_build_object(
      'sourceCandidateId', v_profile.candidate_id,
      'sourceStatus', v_profile.status,
      'proposalStatus', v_proposal.status
    ),
    jsonb_build_object(
      'sourceCandidateId', v_profile.candidate_id,
      'sourceStatus', v_profile.status,
      'proposalStatus', 'rejected',
      'action', p_action
    ),
    nullif(trim(coalesce(p_reason, '')), ''),
    p_actor_id
  ) returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'code', case when p_action = 'keep_separate' then 'identity_profiles_kept_separate' else 'identity_proposal_rejected' end,
    'eventId', v_event_id,
    'proposalId', v_proposal.id,
    'sourceProfileId', v_profile.id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'identity_decision_conflict');
end;
$$;

create or replace function public.revert_identity_decision(
  p_owner_id uuid,
  p_event_id uuid,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.identity_decision_events%rowtype;
  v_proposal public.identity_match_proposals%rowtype;
  v_profile public.source_profiles%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_owner_id is null or p_actor_id is null or p_actor_id <> p_owner_id then
    return jsonb_build_object('ok', false, 'code', 'identity_actor_not_authorized');
  end if;

  select * into v_event
  from public.identity_decision_events
  where owner_id = p_owner_id and id = p_event_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_decision_event_not_found');
  end if;

  if v_event.event_status <> 'applied' then
    return jsonb_build_object('ok', false, 'code', 'identity_decision_already_reverted');
  end if;

  select * into v_proposal
  from public.identity_match_proposals
  where owner_id = p_owner_id and id = v_event.proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_proposal_not_found');
  end if;

  select * into v_profile
  from public.source_profiles
  where owner_id = p_owner_id and id = v_event.source_profile_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_source_profile_not_found');
  end if;

  if exists (
    select 1 from public.identity_decision_events later
    where later.owner_id = p_owner_id
      and later.source_profile_id = v_event.source_profile_id
      and later.event_status = 'applied'
      and later.id <> v_event.id
      and later.created_at > v_event.created_at
  ) then
    return jsonb_build_object('ok', false, 'code', 'identity_decision_superseded_by_later_event');
  end if;

  if v_event.action = 'approve' then
    if v_profile.candidate_id is distinct from v_event.target_candidate_id then
      return jsonb_build_object('ok', false, 'code', 'identity_source_profile_changed_after_decision');
    end if;

    update public.source_profiles
    set candidate_id = v_event.previous_candidate_id,
        status = v_event.previous_source_status
    where owner_id = p_owner_id and id = v_profile.id;

    update public.evidence_items
    set candidate_id = v_event.previous_candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.candidate_contacts
    set candidate_id = v_event.previous_candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.open_to_work_signals
    set candidate_id = v_event.previous_candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.evidence_claims
    set candidate_id = v_event.previous_candidate_id
    where owner_id = p_owner_id and source_profile_id = v_profile.id;

    update public.identity_match_proposals
    set status = 'superseded',
        decision_reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'approved decision reverted'),
        decision_metadata = coalesce(decision_metadata, '{}'::jsonb) || jsonb_build_object(
          'reverted', true,
          'revertedEventId', v_event.id,
          'revertedAt', v_now
        ),
        decided_at = v_now,
        decided_by = p_actor_id,
        review_required = true
    where owner_id = p_owner_id and id = v_proposal.id;
  else
    update public.identity_match_proposals
    set status = 'pending',
        decision_reason = null,
        decision_metadata = '{}'::jsonb,
        decided_at = null,
        decided_by = null,
        review_required = true
    where owner_id = p_owner_id and id = v_proposal.id;
  end if;

  update public.identity_decision_events
  set event_status = 'reverted',
      reverted_at = v_now,
      reverted_by = p_actor_id,
      revert_reason = nullif(trim(coalesce(p_reason, '')), '')
  where owner_id = p_owner_id and id = v_event.id;

  return jsonb_build_object(
    'ok', true,
    'code', 'identity_decision_reverted',
    'eventId', v_event.id,
    'proposalId', v_event.proposal_id,
    'sourceProfileId', v_event.source_profile_id,
    'restoredCandidateId', v_event.previous_candidate_id
  );
end;
$$;

revoke all on function public.decide_identity_match_proposal(uuid, uuid, text, uuid, text, timestamptz)
  from PUBLIC, anon, authenticated;
grant execute on function public.decide_identity_match_proposal(uuid, uuid, text, uuid, text, timestamptz)
  to service_role;

revoke all on function public.revert_identity_decision(uuid, uuid, uuid, text)
  from PUBLIC, anon, authenticated;
grant execute on function public.revert_identity_decision(uuid, uuid, uuid, text)
  to service_role;

comment on table public.identity_decision_events is
  'Auditable and reversible recruiter decisions for source-profile identity proposals. No event deletes a candidate.';
comment on function public.decide_identity_match_proposal(uuid, uuid, text, uuid, text, timestamptz) is
  'Service-role-only transactional identity decision. Approval moves only records tied to the source profile and never deletes the provisional candidate.';
comment on function public.revert_identity_decision(uuid, uuid, uuid, text) is
  'Service-role-only rollback for an applied identity decision. Approved profile moves are restored and require a fresh resolver proposal.';
