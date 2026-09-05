-- SourcingOS V36.10 — canonical candidate redirects after authorized identity fusion.
--
-- Candidate rows are durable audit/history identifiers. When an already-authorized
-- source-profile reassignment empties a temporary candidate, keep the old candidate
-- ID as a redirect rather than deleting it. Active candidate search/database views
-- can then return the canonical person once while historical links remain resolvable.

create table if not exists public.candidate_identity_redirects (
  owner_id uuid not null,
  from_candidate_id uuid not null references public.candidates(id) on delete cascade,
  to_candidate_id uuid not null references public.candidates(id) on delete cascade,
  reason text not null default 'authorized_source_profile_reassignment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, from_candidate_id),
  check (from_candidate_id <> to_candidate_id)
);

create index if not exists candidate_identity_redirects_owner_target_idx
  on public.candidate_identity_redirects(owner_id, to_candidate_id);

alter table public.candidate_identity_redirects enable row level security;

drop policy if exists candidate_identity_redirects_owner_select on public.candidate_identity_redirects;
create policy candidate_identity_redirects_owner_select on public.candidate_identity_redirects
  for select using (auth.uid() = owner_id);

drop policy if exists candidate_identity_redirects_owner_insert on public.candidate_identity_redirects;
create policy candidate_identity_redirects_owner_insert on public.candidate_identity_redirects
  for insert with check (auth.uid() = owner_id);

drop policy if exists candidate_identity_redirects_owner_update on public.candidate_identity_redirects;
create policy candidate_identity_redirects_owner_update on public.candidate_identity_redirects
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists candidate_identity_redirects_owner_delete on public.candidate_identity_redirects;
create policy candidate_identity_redirects_owner_delete on public.candidate_identity_redirects
  for delete using (auth.uid() = owner_id);

-- This trigger does NOT decide identity. It reacts only after some other trusted
-- workflow has already changed source_profiles.candidate_id. If that authorized
-- change leaves the old candidate with no source profiles, record a canonical
-- redirect so it can no longer surface as a second active person.
create or replace function public.capture_candidate_identity_redirect_v36_10()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if old.candidate_id is null
     or new.candidate_id is null
     or old.candidate_id = new.candidate_id then
    return new;
  end if;

  if exists (
    select 1
      from public.source_profiles sp
     where sp.owner_id = new.owner_id
       and sp.candidate_id = old.candidate_id
  ) then
    return new;
  end if;

  -- Avoid redirect chains where possible. If the new candidate is itself a
  -- redirect source, point directly at its current target.
  select cir.to_candidate_id
    into v_target
    from public.candidate_identity_redirects cir
   where cir.owner_id = new.owner_id
     and cir.from_candidate_id = new.candidate_id;
  v_target := coalesce(v_target, new.candidate_id);

  if old.candidate_id = v_target then return new; end if;

  insert into public.candidate_identity_redirects (
    owner_id,
    from_candidate_id,
    to_candidate_id,
    reason,
    created_at,
    updated_at
  ) values (
    new.owner_id,
    old.candidate_id,
    v_target,
    'authorized_source_profile_reassignment',
    now(),
    now()
  )
  on conflict (owner_id, from_candidate_id)
  do update set
    to_candidate_id = excluded.to_candidate_id,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.capture_candidate_identity_redirect_v36_10() from public, anon, authenticated;

drop trigger if exists capture_candidate_identity_redirect_v36_10 on public.source_profiles;
create trigger capture_candidate_identity_redirect_v36_10
  after update of candidate_id on public.source_profiles
  for each row
  when (old.candidate_id is distinct from new.candidate_id)
  execute function public.capture_candidate_identity_redirect_v36_10();

create or replace function public.resolve_candidate_identity_v36_10(
  p_owner_id uuid,
  p_candidate_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain(candidate_id, depth) as (
    select p_candidate_id, 0
    union all
    select cir.to_candidate_id, chain.depth + 1
      from chain
      join public.candidate_identity_redirects cir
        on cir.owner_id = p_owner_id
       and cir.from_candidate_id = chain.candidate_id
     where chain.depth < 20
  )
  select candidate_id
    from chain
   order by depth desc
   limit 1;
$$;

revoke all on function public.resolve_candidate_identity_v36_10(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_candidate_identity_v36_10(uuid, uuid) to service_role;

comment on table public.candidate_identity_redirects is
  'V36.10 audit-preserving redirects from absorbed temporary candidate IDs to the canonical candidate selected by an already-authorized source-profile reassignment.';

comment on function public.capture_candidate_identity_redirect_v36_10() is
  'Creates a canonical redirect only after an authorized source-profile move leaves the prior candidate with no remaining source observations. It does not perform or authorize identity matching.';
