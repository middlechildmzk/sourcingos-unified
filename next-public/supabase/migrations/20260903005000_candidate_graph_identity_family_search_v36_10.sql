-- SourcingOS V36.10 — identity-family-aware canonical talent search.
-- Replaces the initial graph-search function after the identity-family RPC is
-- available. A canonical person can be discovered by evidence/contact text that
-- still belongs to an absorbed historical candidate ID, while the absorbed ID
-- itself never returns as a second person.

create or replace function public.search_candidate_graph_v36_10(
  p_owner_id uuid,
  p_query text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  candidate_id uuid,
  rank real,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with search_input as (
    select
      nullif(trim(coalesce(p_query, '')), '') as raw_query,
      websearch_to_tsquery('simple', trim(coalesce(p_query, ''))) as ts_query
  ),
  documents as (
    select
      c.id as candidate_id,
      (
        setweight(to_tsvector('simple', concat_ws(' ',
          c.canonical_name,
          c.headline,
          c.current_title,
          c.current_company,
          c.location,
          array_to_string(coalesce(c.skills, '{}'::text[]), ' ')
        )), 'A')
        || setweight(to_tsvector('simple', coalesce(sp.source_text, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(ev.evidence_text, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(ct.contact_text, '')), 'C')
      ) as document,
      lower(concat_ws(' ',
        c.canonical_name,
        c.headline,
        c.current_title,
        c.current_company,
        c.location,
        array_to_string(coalesce(c.skills, '{}'::text[]), ' '),
        sp.source_text,
        ev.evidence_text,
        ct.contact_text
      )) as raw_document
    from public.candidates c
    left join lateral (
      select coalesce(array_agg(f.family_candidate_id), array[c.id]::uuid[]) as ids
      from public.candidate_identity_families_v36_10(p_owner_id, array[c.id]::uuid[]) f
    ) family on true
    left join lateral (
      select string_agg(concat_ws(' ',
        source,
        source_profile_id,
        display_name,
        headline,
        organization,
        location,
        profile_url
      ), ' ') as source_text
      from public.source_profiles
      where owner_id = p_owner_id
        and candidate_id = any(family.ids)
        and status <> 'rejected'
    ) sp on true
    left join lateral (
      select string_agg(concat_ws(' ', source, label, detail, url), ' ') as evidence_text
      from public.evidence_items
      where owner_id = p_owner_id
        and candidate_id = any(family.ids)
    ) ev on true
    left join lateral (
      select string_agg(concat_ws(' ', type, value, source), ' ') as contact_text
      from public.candidate_contacts
      where owner_id = p_owner_id
        and candidate_id = any(family.ids)
        and permission_status <> 'do_not_contact'
    ) ct on true
    where c.owner_id = p_owner_id
      and not exists (
        select 1
          from public.candidate_identity_redirects cir
         where cir.owner_id = p_owner_id
           and cir.from_candidate_id = c.id
      )
  ),
  matched as (
    select
      d.candidate_id,
      greatest(
        ts_rank_cd(d.document, s.ts_query),
        case when d.raw_document like '%' || lower(s.raw_query) || '%' then 0.25 else 0 end
      )::real as rank
    from documents d
    cross join search_input s
    where s.raw_query is not null
      and (
        d.document @@ s.ts_query
        or d.raw_document like '%' || lower(s.raw_query) || '%'
      )
  )
  select
    m.candidate_id,
    m.rank,
    count(*) over() as total_count
  from matched m
  order by m.rank desc, m.candidate_id
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.search_candidate_graph_v36_10(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_candidate_graph_v36_10(uuid, text, integer, integer) to service_role;

comment on function public.search_candidate_graph_v36_10(uuid, text, integer, integer) is
  'V36.10 canonical talent database search across canonical fields plus confirmed identity-family source profiles, evidence and allowed contact signals. Absorbed aliases never return as separate people and identity is never created by search.';
