\set ON_ERROR_STOP on

-- Ephemeral PostgreSQL contract test for the unapplied role durability migration.
-- This creates only the minimal dependencies needed to execute the real SQL files.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;

create table if not exists public.projects (
  id uuid primary key
);

create table if not exists public.candidates (
  id uuid primary key
);

create table if not exists public.source_profiles (
  id uuid primary key
);

\ir ../../sql/role-workspace-v20-1.sql
\ir ../../supabase/migrations/20260721173000_role_workspace_owner_safety.sql

do $$
declare
  v_function_oid regprocedure := 'public.save_role_workspace_snapshot(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,timestamptz)'::regprocedure;
begin
  if (select prosecdef from pg_proc where oid = v_function_oid) then
    raise exception 'snapshot function must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('authenticated', v_function_oid, 'EXECUTE') then
    raise exception 'authenticated must not execute the snapshot function';
  end if;

  if has_function_privilege('anon', v_function_oid, 'EXECUTE') then
    raise exception 'anon must not execute the snapshot function';
  end if;

  if not has_function_privilege('service_role', v_function_oid, 'EXECUTE') then
    raise exception 'service_role must execute the snapshot function';
  end if;
end $$;

insert into auth.users(id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

do $$
declare
  v_result jsonb;
  v_owner_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_role constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  v_result := public.save_role_workspace_snapshot(
    v_owner_a,
    v_role,
    null,
    jsonb_build_object(
      'status', 'active',
      'title', 'Senior Sourcer',
      'location', 'Minneapolis',
      'work_mode', 'remote',
      'compensation', '',
      'clearance', '',
      'intake', jsonb_build_object('title', 'Senior Sourcer')
    ),
    jsonb_build_array(jsonb_build_object(
      'lane_key', 'core',
      'label', 'Core search',
      'purpose', 'Primary lane',
      'query', 'sourcer',
      'source', 'candidate_graph',
      'status', 'approved'
    )),
    jsonb_build_array(jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222222',
      'candidate_id', null,
      'source_profile_id', null,
      'identity_key', 'profile:one',
      'name', 'Candidate One',
      'headline', 'Recruiter',
      'company', 'Example',
      'location', 'Minnesota',
      'source', 'manual',
      'source_url', null,
      'stage', 'needs_review',
      'fit_decision', 'unreviewed',
      'fit_reasons', '[]'::jsonb,
      'concerns', '[]'::jsonb,
      'tags', '[]'::jsonb,
      'contact_status', 'unknown',
      'evidence_status', 'unreviewed',
      'snapshot', '{}'::jsonb
    )),
    jsonb_build_array(jsonb_build_object(
      'event_key', 'created',
      'event_type', 'role_created',
      'message', 'Role created',
      'payload', '{}'::jsonb
    )),
    '2026-07-21T18:00:00Z'
  );

  if not coalesce((v_result->>'ok')::boolean, false) or (v_result->>'version')::integer <> 1 then
    raise exception 'initial atomic snapshot failed: %', v_result;
  end if;

  if (select count(*) from public.role_workspaces where id = v_role and owner_id = v_owner_a) <> 1
    or (select count(*) from public.role_search_lanes where role_id = v_role and owner_id = v_owner_a) <> 1
    or (select count(*) from public.role_candidates where role_id = v_role and owner_id = v_owner_a) <> 1
    or (select count(*) from public.role_activity where role_id = v_role and owner_id = v_owner_a) <> 1 then
    raise exception 'initial snapshot did not commit all parent and child rows';
  end if;
end $$;

-- Simulate an AutoSource server-side addition that is not yet present in a browser tab.
insert into public.role_candidates (
  id, owner_id, role_id, identity_key, name, source, stage, fit_decision,
  contact_status, evidence_status, snapshot
) values (
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'candidate:server-only',
  'Server Added Candidate',
  'autosource',
  'needs_review',
  'unreviewed',
  'unknown',
  'unreviewed',
  '{}'::jsonb
);

do $$
declare
  v_result jsonb;
  v_owner_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_owner_b constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_role constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  v_result := public.save_role_workspace_snapshot(
    v_owner_a,
    v_role,
    1,
    jsonb_build_object(
      'status', 'active',
      'title', 'Senior Sourcer Updated',
      'location', 'Minneapolis',
      'work_mode', 'remote',
      'compensation', '',
      'clearance', '',
      'intake', jsonb_build_object('title', 'Senior Sourcer Updated')
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '2026-07-21T18:05:00Z'
  );

  if not coalesce((v_result->>'ok')::boolean, false) or (v_result->>'version')::integer <> 2 then
    raise exception 'versioned update failed: %', v_result;
  end if;

  if not exists (
    select 1 from public.role_candidates
    where role_id = v_role and identity_key = 'candidate:server-only'
  ) then
    raise exception 'browser snapshot erased a server-only candidate';
  end if;

  v_result := public.save_role_workspace_snapshot(
    v_owner_a,
    v_role,
    1,
    jsonb_build_object('status', 'active', 'title', 'Stale', 'intake', '{}'::jsonb),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    now()
  );

  if v_result->>'code' <> 'role_version_conflict'
    or (v_result->>'currentVersion')::integer <> 2 then
    raise exception 'stale version was not rejected correctly: %', v_result;
  end if;

  v_result := public.save_role_workspace_snapshot(
    v_owner_b,
    v_role,
    2,
    jsonb_build_object('status', 'active', 'title', 'Wrong owner', 'intake', '{}'::jsonb),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    now()
  );

  if v_result->>'code' <> 'role_owned_by_another' then
    raise exception 'cross-owner write was not rejected: %', v_result;
  end if;
end $$;

-- A failing child row must roll back the parent version increment and every child write.
do $$
declare
  v_before_version integer;
  v_after_version integer;
  v_role constant uuid := '11111111-1111-4111-8111-111111111111';
begin
  select version into v_before_version from public.role_workspaces where id = v_role;

  begin
    perform public.save_role_workspace_snapshot(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      v_role,
      v_before_version,
      jsonb_build_object(
        'status', 'active',
        'title', 'Must Roll Back',
        'location', '',
        'work_mode', 'remote',
        'compensation', '',
        'clearance', '',
        'intake', '{}'::jsonb
      ),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object(
        'id', '44444444-4444-4444-8444-444444444444',
        'identity_key', 'profile:invalid',
        'name', 'Invalid Candidate',
        'source', 'manual',
        'stage', 'invalid_stage'
      )),
      '[]'::jsonb,
      now()
    );
    raise exception 'invalid child unexpectedly committed';
  exception
    when check_violation then
      null;
  end;

  select version into v_after_version from public.role_workspaces where id = v_role;
  if v_after_version <> v_before_version then
    raise exception 'parent version changed despite child failure: % -> %', v_before_version, v_after_version;
  end if;

  if exists (
    select 1 from public.role_candidates
    where role_id = v_role and identity_key = 'profile:invalid'
  ) then
    raise exception 'invalid child survived rollback';
  end if;
end $$;

-- Composite ownership must reject a child whose owner differs from its parent.
do $$
begin
  begin
    insert into public.role_activity(owner_id, role_id, event_key, event_type, message)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '11111111-1111-4111-8111-111111111111',
      'wrong-owner',
      'test',
      'Must fail'
    );
    raise exception 'owner-mismatched child unexpectedly inserted';
  exception
    when foreign_key_violation then
      null;
  end;
end $$;

select
  (select version from public.role_workspaces where id = '11111111-1111-4111-8111-111111111111') as final_version,
  (select count(*) from public.role_candidates where role_id = '11111111-1111-4111-8111-111111111111') as preserved_candidates;
