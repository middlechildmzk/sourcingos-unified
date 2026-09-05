-- SourcingOS V36.10 — canonical identity-family lookup.
--
-- Identity redirects preserve absorbed candidate IDs for audit/history. This RPC
-- returns the requested canonical person plus every historical candidate ID that
-- redirects to that person, including multi-hop redirect chains. It does not
-- create redirects, decide identity, or authorize a merge.

create or replace function public.candidate_identity_families_v36_10(
  p_owner_id uuid,
  p_candidate_ids uuid[]
)
returns table (
  canonical_candidate_id uuid,
  family_candidate_id uuid,
  redirect_depth integer
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive requested as (
    select distinct public.resolve_candidate_identity_v36_10(p_owner_id, candidate_id) as canonical_candidate_id
      from unnest(coalesce(p_candidate_ids, '{}'::uuid[])) as candidate_id
     where candidate_id is not null
  ),
  family as (
    select
      r.canonical_candidate_id,
      r.canonical_candidate_id as family_candidate_id,
      0 as redirect_depth,
      array[r.canonical_candidate_id]::uuid[] as path
    from requested r
    where r.canonical_candidate_id is not null

    union all

    select
      f.canonical_candidate_id,
      cir.from_candidate_id,
      f.redirect_depth + 1,
      f.path || cir.from_candidate_id
    from family f
    join public.candidate_identity_redirects cir
      on cir.owner_id = p_owner_id
     and cir.to_candidate_id = f.family_candidate_id
    where f.redirect_depth < 20
      and not cir.from_candidate_id = any(f.path)
  )
  select distinct on (canonical_candidate_id, family_candidate_id)
    canonical_candidate_id,
    family_candidate_id,
    redirect_depth
  from family
  order by canonical_candidate_id, family_candidate_id, redirect_depth;
$$;

revoke all on function public.candidate_identity_families_v36_10(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.candidate_identity_families_v36_10(uuid, uuid[]) to service_role;

comment on function public.candidate_identity_families_v36_10(uuid, uuid[]) is
  'V36.10 service-role read helper returning canonical candidate IDs and all absorbed audit/history aliases. It never creates identity links or authorizes merging.';
