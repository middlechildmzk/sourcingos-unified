-- SourcingOS V20.4 — role workspace owner safety
-- Defense in depth for user-scoped role writes. This migration is additive and
-- is not applied automatically by the application build.

begin;

-- A composite parent key lets child tables enforce that role_id and owner_id
-- always identify the same role owner, even outside RLS.
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

revoke all on public.role_workspaces from anon, authenticated;
revoke all on public.role_search_lanes from anon, authenticated;
revoke all on public.role_candidates from anon, authenticated;
revoke all on public.role_activity from anon, authenticated;

grant select, insert, update, delete on public.role_workspaces to authenticated;
grant select, insert, update, delete on public.role_search_lanes to authenticated;
grant select, insert, update, delete on public.role_candidates to authenticated;
grant select, insert, update, delete on public.role_activity to authenticated;

-- Parent role policies.
drop policy if exists role_workspaces_owner_select on public.role_workspaces;
drop policy if exists role_workspaces_owner_insert on public.role_workspaces;
drop policy if exists role_workspaces_owner_update on public.role_workspaces;
drop policy if exists role_workspaces_owner_delete on public.role_workspaces;

create policy role_workspaces_owner_select on public.role_workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy role_workspaces_owner_insert on public.role_workspaces
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy role_workspaces_owner_update on public.role_workspaces
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy role_workspaces_owner_delete on public.role_workspaces
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Every child policy checks both the row owner and the referenced parent owner.
drop policy if exists role_search_lanes_owner_select on public.role_search_lanes;
drop policy if exists role_search_lanes_owner_insert on public.role_search_lanes;
drop policy if exists role_search_lanes_owner_update on public.role_search_lanes;
drop policy if exists role_search_lanes_owner_delete on public.role_search_lanes;

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

create policy role_search_lanes_owner_insert on public.role_search_lanes
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_search_lanes.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

create policy role_search_lanes_owner_update on public.role_search_lanes
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_search_lanes.role_id
        and rw.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_search_lanes.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

create policy role_search_lanes_owner_delete on public.role_search_lanes
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_search_lanes.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

drop policy if exists role_candidates_owner_select on public.role_candidates;
drop policy if exists role_candidates_owner_insert on public.role_candidates;
drop policy if exists role_candidates_owner_update on public.role_candidates;
drop policy if exists role_candidates_owner_delete on public.role_candidates;

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

create policy role_candidates_owner_insert on public.role_candidates
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_candidates.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

create policy role_candidates_owner_update on public.role_candidates
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_candidates.role_id
        and rw.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_candidates.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

create policy role_candidates_owner_delete on public.role_candidates
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_candidates.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

drop policy if exists role_activity_owner_select on public.role_activity;
drop policy if exists role_activity_owner_insert on public.role_activity;
drop policy if exists role_activity_owner_update on public.role_activity;
drop policy if exists role_activity_owner_delete on public.role_activity;

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

create policy role_activity_owner_insert on public.role_activity
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_activity.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

create policy role_activity_owner_update on public.role_activity
  for update to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_activity.role_id
        and rw.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_activity.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

create policy role_activity_owner_delete on public.role_activity
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.role_workspaces rw
      where rw.id = role_activity.role_id
        and rw.owner_id = (select auth.uid())
    )
  );

commit;
