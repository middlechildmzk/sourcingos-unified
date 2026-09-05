-- Owner-scoped Candidate Graph hard delete.
--
-- Candidate data spans canonical candidates, source profiles, evidence, role
-- state, acquisition records, graph edges, memory, and agent traces. Several
-- foreign keys intentionally SET NULL, so deleting only public.candidates would
-- leave personal/provenance data behind. This service-role-only RPC removes the
-- known active-product bundle and clears affected role calibration so derived
-- candidate judgments are not retained after deletion.

create or replace function public.delete_candidate_bundle(
  p_owner_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_name text;
  v_source_profile_ids uuid[] := '{}'::uuid[];
  v_role_candidate_ids uuid[] := '{}'::uuid[];
  v_role_ids uuid[] := '{}'::uuid[];
  v_count integer := 0;
  v_total integer := 0;
begin
  if p_owner_id is null or p_candidate_id is null then
    raise exception 'owner_id and candidate_id are required';
  end if;

  select canonical_name
    into v_candidate_name
    from public.candidates
   where id = p_candidate_id
     and owner_id = p_owner_id;

  if not found then
    return jsonb_build_object('ok', true, 'deleted', false, 'reason', 'not_found');
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
    into v_source_profile_ids
    from public.source_profiles
   where owner_id = p_owner_id
     and candidate_id = p_candidate_id;

  select coalesce(array_agg(id), '{}'::uuid[]),
         coalesce(array_agg(distinct role_id), '{}'::uuid[])
    into v_role_candidate_ids, v_role_ids
    from public.role_candidates
   where owner_id = p_owner_id
     and (
       candidate_id = p_candidate_id
       or source_profile_id = any(v_source_profile_ids)
     );

  -- Acquisition records can retain raw source payloads even after their foreign
  -- keys are nulled, so remove the linked discoveries explicitly.
  delete from public.acquisition_discoveries
   where owner_id = p_owner_id
     and (
       candidate_id = p_candidate_id
       or source_profile_id = any(v_source_profile_ids)
     );
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Identity review rows otherwise retain source-profile arrays and scoring
  -- context after a candidate/source record is removed.
  delete from public.identity_match_reviews
   where owner_id = p_owner_id
     and (
       candidate_id = p_candidate_id
       or source_profile_ids && v_source_profile_ids
     );
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Remove role-specific candidate state before source/canonical deletion. The
  -- role workspace remains, but candidate-derived calibration is reset below.
  delete from public.role_candidates
   where owner_id = p_owner_id
     and id = any(v_role_candidate_ids);
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Recruiter memory stores supporting role-candidate ids in JSON evidence.
  -- Delete any signal that depended on the removed candidate rather than
  -- retaining an opaque derived judgment with no supporting record.
  delete from public.recruiter_memory_signals rms
   where rms.owner_id = p_owner_id
     and exists (
       select 1
         from jsonb_array_elements_text(coalesce(rms.evidence, '[]'::jsonb)) as e(value)
        where e.value = any(v_role_candidate_ids::text[])
     );
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Role calibration can contain derived candidate references. Reset only the
  -- roles touched by this candidate; the next recruiter review rebuilds it from
  -- the remaining slate.
  update public.role_workspaces
     set calibration = '{}'::jsonb,
         updated_at = now()
   where owner_id = p_owner_id
     and id = any(v_role_ids);

  -- Candidate-specific role activity frequently contains candidate names in
  -- human-readable messages. Remove candidate-action activity for affected roles
  -- rather than preserving a textual shadow record after deletion.
  delete from public.role_activity
   where owner_id = p_owner_id
     and role_id = any(v_role_ids)
     and event_type in ('candidate_added', 'candidate_reviewed', 'stage_changed');
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Agent workflow inputs/outputs can contain candidate ids or copied evidence.
  -- Remove workflows whose serialized state references this candidate id.
  delete from public.agent_workflows
   where owner_id = p_owner_id
     and (
       input::text like '%' || p_candidate_id::text || '%'
       or output::text like '%' || p_candidate_id::text || '%'
     );
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Talent graph edges are intentionally polymorphic and have no candidate FK.
  delete from public.talent_graph_edges
   where owner_id = p_owner_id
     and (
       (from_type = 'candidate' and from_id = p_candidate_id::text)
       or (to_type = 'candidate' and to_id = p_candidate_id::text)
     );
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Deleting source profiles cascades their evidence/contact/availability rows.
  delete from public.source_profiles
   where owner_id = p_owner_id
     and id = any(v_source_profile_ids);
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  -- Deleting the canonical candidate cascades contacts, evidence, pipeline,
  -- project links, quality snapshots, refresh/enrichment state and AutoSource.
  delete from public.candidates
   where owner_id = p_owner_id
     and id = p_candidate_id;
  get diagnostics v_count = row_count;
  v_total := v_total + v_count;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'candidateId', p_candidate_id,
    'sourceProfilesRemoved', cardinality(v_source_profile_ids),
    'rolesAffected', cardinality(v_role_ids),
    'explicitRowsRemoved', v_total
  );
end;
$$;

revoke all on function public.delete_candidate_bundle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_candidate_bundle(uuid, uuid) to service_role;

comment on function public.delete_candidate_bundle(uuid, uuid) is
  'Service-role-only owner-scoped Candidate Graph hard delete. Removes known linked personal/provenance records and resets affected role calibration.';
