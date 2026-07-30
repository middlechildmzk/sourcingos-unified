-- V27 calibration intelligence state for role workspaces.
--
-- Additive and backwards compatible:
-- - Adds a single jsonb column with a safe default. Existing rows and older
--   clients that omit calibration keep '{}' and lose nothing.
-- - Recreates public.save_role_workspace_snapshot with the identical signature,
--   ownership checks, version checks, fail-closed behavior, and grants; the only
--   change is persisting p_role->'calibration' alongside intake.
-- - Browser-authenticated users keep SELECT-only access. No new write paths.
--
-- This file has NOT been applied to Supabase production.

alter table public.role_workspaces
  add column if not exists calibration jsonb not null default '{}'::jsonb;

comment on column public.role_workspaces.calibration is
  'Recruiter-reviewed calibration insights and events. Derived patterns are not verified facts; only recruiter-approved insights influence ranking.';

create or replace function public.save_role_workspace_snapshot(
  p_owner_id uuid,
  p_role_id uuid,
  p_expected_version integer,
  p_role jsonb,
  p_lanes jsonb default '[]'::jsonb,
  p_candidates jsonb default '[]'::jsonb,
  p_activity jsonb default '[]'::jsonb,
  p_updated_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_existing_owner uuid;
  v_current_version integer;
  v_next_version integer;
  v_updated_rows integer;
  v_updated_at timestamptz := coalesce(p_updated_at, now());
  v_lanes jsonb := coalesce(p_lanes, '[]'::jsonb);
  v_candidates jsonb := coalesce(p_candidates, '[]'::jsonb);
  v_activity jsonb := coalesce(p_activity, '[]'::jsonb);
begin
  if p_owner_id is null or p_role_id is null or p_role is null or jsonb_typeof(p_role) <> 'object' then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'role_snapshot_invalid',
      'error', 'A valid owner, role id, and role payload are required.'
    );
  end if;

  if coalesce(p_role->>'title', '') = '' or coalesce(p_role->>'status', '') = '' then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'role_snapshot_invalid',
      'error', 'Role title and status are required.'
    );
  end if;

  if jsonb_typeof(v_lanes) <> 'array'
    or jsonb_typeof(v_candidates) <> 'array'
    or jsonb_typeof(v_activity) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'status', 400,
      'code', 'role_snapshot_invalid',
      'error', 'Role lanes, candidates, and activity must be arrays.'
    );
  end if;

  select rw.owner_id, rw.version
    into v_existing_owner, v_current_version
  from public.role_workspaces rw
  where rw.id = p_role_id
  for update;

  if found then
    if v_existing_owner <> p_owner_id then
      return jsonb_build_object(
        'ok', false,
        'status', 403,
        'code', 'role_owned_by_another',
        'error', 'This role belongs to another account.'
      );
    end if;

    if p_expected_version is null then
      return jsonb_build_object(
        'ok', false,
        'status', 409,
        'code', 'role_version_required',
        'error', 'Refresh this role before saving again.',
        'currentVersion', v_current_version
      );
    end if;

    if p_expected_version <> v_current_version then
      return jsonb_build_object(
        'ok', false,
        'status', 409,
        'code', 'role_version_conflict',
        'error', 'This role changed in another session. Refresh before saving.',
        'currentVersion', v_current_version
      );
    end if;

    v_next_version := v_current_version + 1;

    update public.role_workspaces
    set
      status = p_role->>'status',
      title = p_role->>'title',
      location = coalesce(p_role->>'location', ''),
      work_mode = coalesce(nullif(p_role->>'work_mode', ''), 'unknown'),
      compensation = coalesce(p_role->>'compensation', ''),
      clearance = coalesce(p_role->>'clearance', ''),
      intake = case when jsonb_typeof(p_role->'intake') = 'object' then p_role->'intake' else '{}'::jsonb end,
      calibration = case when jsonb_typeof(p_role->'calibration') = 'object' then p_role->'calibration' else '{}'::jsonb end,
      version = v_next_version,
      updated_at = v_updated_at
    where id = p_role_id
      and owner_id = p_owner_id
      and version = v_current_version;

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows <> 1 then
      return jsonb_build_object(
        'ok', false,
        'status', 409,
        'code', 'role_write_conflict',
        'error', 'The role changed before this save completed.',
        'currentVersion', v_current_version
      );
    end if;
  else
    if p_expected_version is not null then
      return jsonb_build_object(
        'ok', false,
        'status', 409,
        'code', 'role_missing_on_server',
        'error', 'This role was removed from the account. Refresh before recreating it.'
      );
    end if;

    v_next_version := 1;

    begin
      insert into public.role_workspaces (
        id,
        owner_id,
        status,
        title,
        location,
        work_mode,
        compensation,
        clearance,
        intake,
        calibration,
        version,
        updated_at
      )
      values (
        p_role_id,
        p_owner_id,
        p_role->>'status',
        p_role->>'title',
        coalesce(p_role->>'location', ''),
        coalesce(nullif(p_role->>'work_mode', ''), 'unknown'),
        coalesce(p_role->>'compensation', ''),
        coalesce(p_role->>'clearance', ''),
        case when jsonb_typeof(p_role->'intake') = 'object' then p_role->'intake' else '{}'::jsonb end,
        case when jsonb_typeof(p_role->'calibration') = 'object' then p_role->'calibration' else '{}'::jsonb end,
        v_next_version,
        v_updated_at
      );
    exception
      when unique_violation then
        return jsonb_build_object(
          'ok', false,
          'status', 409,
          'code', 'role_create_conflict',
          'error', 'A role with this identifier already exists.'
        );
    end;
  end if;

  insert into public.role_search_lanes (
    owner_id,
    role_id,
    lane_key,
    label,
    purpose,
    query,
    source,
    status,
    updated_at
  )
  select
    p_owner_id,
    p_role_id,
    lane.lane_key,
    lane.label,
    coalesce(lane.purpose, ''),
    coalesce(lane.query, ''),
    lane.source,
    coalesce(lane.status, 'proposed'),
    coalesce(lane.updated_at, v_updated_at)
  from jsonb_to_recordset(v_lanes) as lane(
    lane_key text,
    label text,
    purpose text,
    query text,
    source text,
    status text,
    updated_at timestamptz
  )
  on conflict (role_id, lane_key) do update
  set
    owner_id = excluded.owner_id,
    label = excluded.label,
    purpose = excluded.purpose,
    query = excluded.query,
    source = excluded.source,
    status = excluded.status,
    updated_at = excluded.updated_at;

  insert into public.role_candidates (
    id,
    owner_id,
    role_id,
    candidate_id,
    source_profile_id,
    identity_key,
    name,
    headline,
    company,
    location,
    source,
    source_url,
    stage,
    fit_decision,
    fit_reasons,
    concerns,
    tags,
    contact_status,
    evidence_status,
    snapshot,
    added_at,
    updated_at
  )
  select
    candidate.id,
    p_owner_id,
    p_role_id,
    candidate.candidate_id,
    candidate.source_profile_id,
    candidate.identity_key,
    candidate.name,
    coalesce(candidate.headline, ''),
    coalesce(candidate.company, ''),
    coalesce(candidate.location, ''),
    candidate.source,
    candidate.source_url,
    coalesce(candidate.stage, 'needs_review'),
    coalesce(candidate.fit_decision, 'unreviewed'),
    coalesce(candidate.fit_reasons, '[]'::jsonb),
    coalesce(candidate.concerns, '[]'::jsonb),
    coalesce(candidate.tags, '[]'::jsonb),
    coalesce(candidate.contact_status, 'unknown'),
    coalesce(candidate.evidence_status, 'unreviewed'),
    coalesce(candidate.snapshot, '{}'::jsonb),
    coalesce(candidate.added_at, v_updated_at),
    coalesce(candidate.updated_at, v_updated_at)
  from jsonb_to_recordset(v_candidates) as candidate(
    id uuid,
    candidate_id uuid,
    source_profile_id uuid,
    identity_key text,
    name text,
    headline text,
    company text,
    location text,
    source text,
    source_url text,
    stage text,
    fit_decision text,
    fit_reasons jsonb,
    concerns jsonb,
    tags jsonb,
    contact_status text,
    evidence_status text,
    snapshot jsonb,
    added_at timestamptz,
    updated_at timestamptz
  )
  on conflict (role_id, identity_key) do update
  set
    owner_id = excluded.owner_id,
    candidate_id = excluded.candidate_id,
    source_profile_id = excluded.source_profile_id,
    name = excluded.name,
    headline = excluded.headline,
    company = excluded.company,
    location = excluded.location,
    source = excluded.source,
    source_url = excluded.source_url,
    stage = excluded.stage,
    fit_decision = excluded.fit_decision,
    fit_reasons = excluded.fit_reasons,
    concerns = excluded.concerns,
    tags = excluded.tags,
    contact_status = excluded.contact_status,
    evidence_status = excluded.evidence_status,
    snapshot = excluded.snapshot,
    added_at = least(role_candidates.added_at, excluded.added_at),
    updated_at = excluded.updated_at;

  insert into public.role_activity (
    owner_id,
    role_id,
    event_key,
    event_type,
    message,
    payload,
    created_at
  )
  select
    p_owner_id,
    p_role_id,
    activity.event_key,
    activity.event_type,
    activity.message,
    coalesce(activity.payload, '{}'::jsonb),
    coalesce(activity.created_at, v_updated_at)
  from jsonb_to_recordset(v_activity) as activity(
    event_key text,
    event_type text,
    message text,
    payload jsonb,
    created_at timestamptz
  )
  on conflict (role_id, event_key) do update
  set
    owner_id = excluded.owner_id,
    event_type = excluded.event_type,
    message = excluded.message,
    payload = excluded.payload,
    created_at = excluded.created_at;

  return jsonb_build_object(
    'ok', true,
    'version', v_next_version,
    'updatedAt', v_updated_at,
    'counts', jsonb_build_object(
      'lanes', jsonb_array_length(v_lanes),
      'candidates', jsonb_array_length(v_candidates),
      'activity', jsonb_array_length(v_activity)
    )
  );
end;
$function$;

-- PostgreSQL grants function execution to PUBLIC by default. Keep this RPC
-- callable only by the service-role client used in reviewed server routes.
revoke all on function public.save_role_workspace_snapshot(
  uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, timestamptz
) from PUBLIC, anon, authenticated;

grant execute on function public.save_role_workspace_snapshot(
  uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, timestamptz
) to service_role;

comment on function public.save_role_workspace_snapshot(
  uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, timestamptz
) is 'Atomically creates or version-updates one owner-scoped role workspace and upserts the supplied child snapshot without deleting server-only additions.';

comment on table public.role_workspaces is
  'Owner-scoped role workspaces. Authenticated clients may read their rows; writes occur only through reviewed server APIs.';
comment on table public.role_candidates is
  'Role-specific candidate state. Direct authenticated writes are intentionally not granted.';

commit;


-- Keep the execution surface locked to the service role, exactly as before.
revoke all on function public.save_role_workspace_snapshot(
  uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, timestamptz
) from public, anon, authenticated;

grant execute on function public.save_role_workspace_snapshot(
  uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, timestamptz
) to service_role;
