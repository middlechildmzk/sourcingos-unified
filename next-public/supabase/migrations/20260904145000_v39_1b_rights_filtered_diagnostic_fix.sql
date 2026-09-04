-- SourcingOS V39.1B — repair rights-filter diagnostic accounting.
--
-- V39 correctly excluded restricted/expired source observations from retrieval,
-- but the aggregate query also removed those rows before calculating
-- rights_filtered_source_count. Keep retrieval behavior identical while making
-- the diagnostic counter truthful.

create or replace function public.refresh_candidate_search_document_v39(
  p_owner_id uuid,
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate record;
  v_source_text text := '';
  v_evidence_text text := '';
  v_source_count integer := 0;
  v_rights_filtered integer := 0;
  v_evidence_count integer := 0;
  v_last_observed timestamptz;
  v_clearances text[] := '{}'::text[];
  v_certifications text[] := '{}'::text[];
  v_raw text := '';
begin
  if exists (
    select 1 from public.candidate_identity_redirects r
    where r.owner_id = p_owner_id and r.from_candidate_id = p_candidate_id
  ) then
    delete from public.candidate_search_documents_v39
      where owner_id = p_owner_id and candidate_id = p_candidate_id;
    return;
  end if;

  select c.* into v_candidate
  from public.candidates c
  where c.owner_id = p_owner_id and c.id = p_candidate_id;

  if not found then
    delete from public.candidate_search_documents_v39
      where owner_id = p_owner_id and candidate_id = p_candidate_id;
    return;
  end if;

  select
    coalesce(string_agg(
      concat_ws(' ', sp.source, sp.display_name, sp.headline, sp.organization, sp.location, sp.profile_url, sp.raw_text),
      ' '
    ) filter (
      where sp.search_allowed
        and (sp.retention_until is null or sp.retention_until > now())
    ), ''),
    count(*) filter (
      where sp.search_allowed
        and (sp.retention_until is null or sp.retention_until > now())
    )::integer,
    count(*) filter (
      where not sp.search_allowed
         or (sp.retention_until is not null and sp.retention_until <= now())
    )::integer,
    max(coalesce(sp.last_seen_at, sp.updated_at, sp.created_at)) filter (
      where sp.search_allowed
        and (sp.retention_until is null or sp.retention_until > now())
    )
  into v_source_text, v_source_count, v_rights_filtered, v_last_observed
  from public.source_profiles sp
  where sp.owner_id = p_owner_id
    and sp.candidate_id = p_candidate_id
    and sp.status <> 'rejected';

  select
    coalesce(string_agg(concat_ws(' ', e.source, e.label, e.detail, e.url), ' '), ''),
    count(*)::integer,
    coalesce(array_agg(distinct e.detail) filter (
      where lower(coalesce(e.label, '')) like '%clearance%'
        and nullif(trim(coalesce(e.detail, '')), '') is not null
    ), '{}'::text[]),
    coalesce(array_agg(distinct e.detail) filter (
      where (lower(coalesce(e.label, '')) like '%certif%'
             or lower(coalesce(e.label, '')) like '%credential%')
        and nullif(trim(coalesce(e.detail, '')), '') is not null
    ), '{}'::text[])
  into v_evidence_text, v_evidence_count, v_clearances, v_certifications
  from public.evidence_items e
  left join public.source_profiles esp
    on esp.id = e.source_profile_id
   and esp.owner_id = p_owner_id
  where e.owner_id = p_owner_id
    and e.candidate_id = p_candidate_id
    and (
      e.source_profile_id is null
      or (
        esp.id is not null
        and esp.status <> 'rejected'
        and esp.search_allowed
        and (esp.retention_until is null or esp.retention_until > now())
      )
    );

  v_raw := lower(concat_ws(' ',
    v_candidate.canonical_name,
    v_candidate.headline,
    v_candidate.current_title,
    v_candidate.current_company,
    v_candidate.location,
    v_candidate.summary,
    array_to_string(coalesce(v_candidate.skills, '{}'::text[]), ' '),
    array_to_string(v_clearances, ' '),
    array_to_string(v_certifications, ' '),
    v_source_text,
    v_evidence_text
  ));

  insert into public.candidate_search_documents_v39 (
    owner_id, candidate_id, canonical_name, current_title, current_company,
    location, skills, clearance_terms, certification_terms, document,
    raw_document, source_count, evidence_count, rights_filtered_source_count,
    last_observed_at, indexed_at
  ) values (
    p_owner_id,
    p_candidate_id,
    coalesce(v_candidate.canonical_name, ''),
    v_candidate.current_title,
    v_candidate.current_company,
    v_candidate.location,
    coalesce(v_candidate.skills, '{}'::text[]),
    v_clearances,
    v_certifications,
    setweight(to_tsvector('simple', concat_ws(' ',
      v_candidate.canonical_name,
      v_candidate.headline,
      v_candidate.current_title,
      v_candidate.current_company,
      v_candidate.location,
      array_to_string(coalesce(v_candidate.skills, '{}'::text[]), ' ')
    )), 'A')
    || setweight(to_tsvector('simple', concat_ws(' ', array_to_string(v_clearances, ' '), array_to_string(v_certifications, ' '))), 'A')
    || setweight(to_tsvector('simple', coalesce(v_source_text, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(v_evidence_text, '')), 'B'),
    v_raw,
    coalesce(v_source_count, 0),
    coalesce(v_evidence_count, 0),
    coalesce(v_rights_filtered, 0),
    v_last_observed,
    now()
  )
  on conflict (owner_id, candidate_id) do update set
    canonical_name = excluded.canonical_name,
    current_title = excluded.current_title,
    current_company = excluded.current_company,
    location = excluded.location,
    skills = excluded.skills,
    clearance_terms = excluded.clearance_terms,
    certification_terms = excluded.certification_terms,
    document = excluded.document,
    raw_document = excluded.raw_document,
    source_count = excluded.source_count,
    evidence_count = excluded.evidence_count,
    rights_filtered_source_count = excluded.rights_filtered_source_count,
    last_observed_at = excluded.last_observed_at,
    indexed_at = excluded.indexed_at;
end;
$$;

revoke all on function public.refresh_candidate_search_document_v39(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_candidate_search_document_v39(uuid, uuid) to service_role;
