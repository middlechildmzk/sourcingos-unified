-- SourcingOS V20.4 — role workspace owner safety and atomic snapshots
-- Defense in depth for user-scoped role writes. This migration is additive and
-- is not applied automatically by the application build.
--
-- Trust boundary: authenticated clients may read only their own role data.
-- All writes continue to flow through reviewed, owner-scoped server APIs using
-- the service-role client. This migration intentionally grants no direct
-- authenticated INSERT, UPDATE, DELETE, or RPC execution privileges.

begin;

-- A composite parent key lets child tables enforce that role_id and owner_id
-- always identify the same role owner, even when a service-role client bypasses
-- RLS in a server route.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'role_workspaces_id_owner_key'
      and conrelid = 'public.role_workspaces'::regclass
  ) then
    alter table public.role_workspaces
      add constraint role_workspaces_id_owner_key unique (id, owner_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'role_search_lanes_role_owner_fkey'
      and conrelid = 'public.role_search_lanes'::regclass
  ) then
    alter table public.role_search_lanes
      add constraint role_search_lanes_role_owner_fkey
      foreign key (role_id, owner_id)
      references public.role_workspaces(id, owner_id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'role_candidates_role_owner_fkey'
      and conrelid = 'public.role_candidates'::regclass
  ) then
    alter table public.role_candidates
      add constraint role_candidates_role_owner_fkey
      foreign key (role_id, owner_id)
      references public.role_workspaces(id, owner_id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'role_activity_role_owner_fkey'
      and conrelid = 'public.role_activity'::regclass
  ) then
    alter table public.role_activity
      add constraint role_activity_role_owner_fkey
      foreign key (role_id, owner_id)
      references public.role_workspaces(id, owner_id)
      on delete cascade;
  end if;
end $$;

alter table public.role_workspaces enable row level security;
alter table public.role_search_lanes enable row level security;
alter table public.role_candidates enable row level security;
alter table public.role_activity enable row level security;

-- Keep the browser surface read-only. Explicit grants are required because
-- Supabase is moving projects toward tables not being exposed automatically.
revoke all on public.role_workspaces from anon, authenticated;
revoke all on public.role_search_lanes from anon, authenticated;
revoke all on public.role_candidates from anon, authenticated;
revoke all on public.role_activity from anon, authenticated;

grant select on public.role_workspaces to authenticated;
grant select on public.role_search_lanes to authenticated;
grant select on public.role_candidates to authenticated;
grant select on public.role_activity to authenticated;

-- Remove any historical mutation policies so a future accidental grant does
-- not silently create a direct-write API. Server writes use service role and
-- are constrained by the composite foreign keys above.
drop policy if exists role_workspaces_owner_insert on public.role_workspaces;
drop policy if exists role_workspaces_owner_update on public.role_workspaces;
drop policy if exists role_workspaces_owner_delete on public.role_workspaces;
drop policy if exists role_search_lanes_owner_insert on public.role_search_lanes;
drop policy if exists role_search_lanes_owner_update on public.role_search_lanes;
drop policy if exists role_search_lanes_owner_delete on public.role_search_lanes;
drop policy if exists role_candidates_owner_insert on public.role_candidates;
drop policy if exists role_candidates_owner_update on public.role_candidates;
drop policy if exists role_candidates_owner_delete on public.role_candidates;
drop policy if exists role_activity_owner_insert on public.role_activity;
drop policy if exists role_activity_owner_update on public.role_activity;
drop policy if exists role_activity_owner_delete on public.role_activity;

-- Parent role read policy.
drop policy if exists role_workspaces_owner_select on public.role_workspaces;
create policy role_workspaces_owner_select on public.role_workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Child read policies verify both the row owner and the referenced parent owner.
drop policy if exists role_search_lanes_owner_select on public.role_search_lanes;
create policy role_search_lanes_owner_select on public.role_search_lanes
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_search_lanes.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

drop policy if exists role_candidates_owner_select on public.role_candidates;
create policy role_candidates_owner_select on public.role_candidates
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_candidates.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

drop policy if exists role_activity_owner_select on public.role_activity;
create policy role_activity_owner_select on public.role_activity
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_activity.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

-- One server-only transaction replaces the former parent-then-children write
-- sequence. Row locking and expected-version checks prevent stale overwrites.
-- Supplied child upserts are committed only if the entire snapshot succeeds.
-- Server-only additions omitted by a stale browser payload are intentionally preserved.
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
