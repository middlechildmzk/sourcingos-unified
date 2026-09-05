-- SourcingOS V34 — atomic recruiter-confirmed identity fusion.
--
-- A cross-source similarity/proposal is NEVER merge authority. This RPC is
-- called only after a recruiter explicitly confirms an existing pending
-- identity_match_reviews row. It moves the reviewed source-profile provenance
-- bundle onto the already-selected canonical candidate in one PostgreSQL
-- transaction so Candidate 360 cannot lose evidence/contact/availability rows
-- between partial writes.

create or replace function public.confirm_identity_match_atomic_v34(
  p_owner_id uuid,
  p_review_id uuid,
  p_decision text,
  p_decided_by text default 'recruiter'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.identity_match_reviews%rowtype;
  v_profile_ids uuid[] := '{}'::uuid[];
  v_profile_count integer := 0;
  v_expected_profile_count integer := 0;
  v_updated integer := 0;
  v_source_profiles_moved integer := 0;
  v_evidence_moved integer := 0;
  v_contacts_moved integer := 0;
  v_availability_moved integer := 0;
  v_role_candidates_moved integer := 0;
  v_acquisition_moved integer := 0;
begin
  if p_owner_id is null or p_review_id is null then
    raise exception 'owner_id and review_id are required';
  end if;

  if p_decision not in ('confirmed', 'rejected') then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'identity_decision_invalid',
      'error', 'Decision must be confirmed or rejected.'
    );
  end if;

  select *
    into v_review
    from public.identity_match_reviews
   where id = p_review_id
     and owner_id = p_owner_id
   for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'status', 404,
      'code', 'identity_review_not_found',
      'error', 'Identity review not found.'
    );
  end if;

  if v_review.decision <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'identity_review_already_decided',
      'error', 'Identity review has already been decided.',
      'decision', v_review.decision
    );
  end if;

  if v_review.candidate_id is null then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'identity_target_missing',
      'error', 'Identity review has no canonical candidate target.'
    );
  end if;

  if not exists (
    select 1
      from public.candidates
     where id = v_review.candidate_id
       and owner_id = p_owner_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'identity_target_unavailable',
      'error', 'Canonical candidate target is unavailable for this account.'
    );
  end if;

  v_profile_ids := coalesce(v_review.source_profile_ids, '{}'::uuid[]);
  v_expected_profile_count := cardinality(v_profile_ids);
  if v_expected_profile_count < 2 then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'identity_review_profiles_invalid',
      'error', 'Identity review must reference at least two source profiles.'
    );
  end if;

  select count(*)::integer
    into v_profile_count
    from public.source_profiles
   where owner_id = p_owner_id
     and id = any(v_profile_ids);

  if v_profile_count <> v_expected_profile_count then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'identity_review_profiles_unavailable',
      'error', 'One or more reviewed source profiles are unavailable for this account.'
    );
  end if;

  update public.identity_match_reviews
     set decision = p_decision,
         decided_by = coalesce(nullif(p_decided_by, ''), 'recruiter'),
         decided_at = now()
   where id = p_review_id
     and owner_id = p_owner_id
     and decision = 'pending';
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    return jsonb_build_object(
      'ok', false,
      'status', 409,
      'code', 'identity_review_write_conflict',
      'error', 'Identity review changed before this decision completed.'
    );
  end if;

  if p_decision = 'rejected' then
    return jsonb_build_object(
      'ok', true,
      'decision', 'rejected',
      'reviewId', p_review_id,
      'candidateId', v_review.candidate_id,
      'sourceProfilesMoved', 0
    );
  end if;

  -- Source profiles are the reviewed identity anchors. Move only the profiles
  -- explicitly named in the recruiter-confirmed review; resemblance never pulls
  -- additional profiles into the canonical person automatically.
  update public.source_profiles
     set status = 'confirmed',
         candidate_id = v_review.candidate_id,
         updated_at = now()
   where owner_id = p_owner_id
     and id = any(v_profile_ids);
  get diagnostics v_source_profiles_moved = row_count;

  -- Keep every source-profile-backed fact attached to the same canonical person.
  -- These updates are intentionally scoped by both owner and reviewed profile id.
  update public.evidence_items
     set candidate_id = v_review.candidate_id
   where owner_id = p_owner_id
     and source_profile_id = any(v_profile_ids);
  get diagnostics v_evidence_moved = row_count;

  update public.candidate_contacts
     set candidate_id = v_review.candidate_id
   where owner_id = p_owner_id
     and source_profile_id = any(v_profile_ids);
  get diagnostics v_contacts_moved = row_count;

  update public.open_to_work_signals
     set candidate_id = v_review.candidate_id
   where owner_id = p_owner_id
     and source_profile_id = any(v_profile_ids);
  get diagnostics v_availability_moved = row_count;

  -- Role and acquisition rows reference source profiles as well as candidates;
  -- keep their canonical candidate pointer synchronized after confirmation.
  update public.role_candidates
     set candidate_id = v_review.candidate_id,
         updated_at = now()
   where owner_id = p_owner_id
     and source_profile_id = any(v_profile_ids);
  get diagnostics v_role_candidates_moved = row_count;

  update public.acquisition_discoveries
     set candidate_id = v_review.candidate_id
   where owner_id = p_owner_id
     and source_profile_id = any(v_profile_ids);
  get diagnostics v_acquisition_moved = row_count;

  update public.candidates
     set merge_status = 'confirmed',
         updated_at = now()
   where id = v_review.candidate_id
     and owner_id = p_owner_id;

  return jsonb_build_object(
    'ok', true,
    'decision', 'confirmed',
    'reviewId', p_review_id,
    'candidateId', v_review.candidate_id,
    'sourceProfilesMoved', v_source_profiles_moved,
    'evidenceMoved', v_evidence_moved,
    'contactsMoved', v_contacts_moved,
    'availabilityMoved', v_availability_moved,
    'roleCandidatesMoved', v_role_candidates_moved,
    'acquisitionRowsMoved', v_acquisition_moved
  );
end;
$$;

revoke all on function public.confirm_identity_match_atomic_v34(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_identity_match_atomic_v34(uuid, uuid, text, text) to service_role;

comment on function public.confirm_identity_match_atomic_v34(uuid, uuid, text, text) is
  'Service-role-only atomic recruiter-confirmed Candidate Graph fusion. Moves only explicitly reviewed source profiles and their linked provenance to the selected canonical candidate.';
