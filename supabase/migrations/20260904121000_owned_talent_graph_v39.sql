-- SourcingOS V39 — Owned Talent Graph + hybrid search index.
--
-- This migration does not claim a new external dataset. It indexes only durable
-- Candidate Graph records already owned by the recruiter, and adds explicit
-- rights/retention metadata to each stored source observation so future graph
-- growth can remain provenance-aware.

alter table public.source_profiles
  add column if not exists acquisition_basis text not null default 'legacy_unclassified',
  add column if not exists usage_scope text[] not null default array['recruiting_search']::text[],
  add column if not exists search_allowed boolean not null default true,
  add column if not exists raw_export_allowed boolean not null default false,
  add column if not exists retention_until timestamptz,
  add column if not exists refresh_after timestamptz,
  add column if not exists rights_metadata jsonb not null default '{}'::jsonb;

comment on column public.source_profiles.acquisition_basis is
  'How SourcingOS obtained this observation (for example user_upload, provider_api, public_web, legacy_unclassified). This is provenance metadata, not identity evidence.';
comment on column public.source_profiles.usage_scope is
  'Permitted product uses attached to this source observation. Existing records default to recruiting_search until more specific provider/user rights are recorded.';
comment on column public.source_profiles.search_allowed is
  'Whether this source observation may contribute to the owned talent search index. False excludes its source/evidence text without deleting audit provenance.';
comment on column public.source_profiles.raw_export_allowed is
  'Whether raw source payload export is permitted. False by default; normalized candidate summaries are governed separately.';
comment on column public.source_profiles.retention_until is
  'Optional retention deadline for search use. Expired observations remain auditable but no longer contribute source/evidence text to search.';

create table if not exists public.candidate_search_documents_v39 (
  owner_id uuid not null,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  canonical_name text not null default '',
  current_title text,
  current_company text,
  location text,
  skills text[] not null default '{}'::text[],
  clearance_terms text[] not null default '{}'::text[],
  certification_terms text[] not null default '{}'::text[],
  document tsvector not null default ''::tsvector,
  raw_document text not null default '',
  source_count integer not null default 0,
  evidence_count integer not null default 0,
  rights_filtered_source_count integer not null default 0,
  last_observed_at timestamptz,
  indexed_at timestamptz not null default now(),
  primary key (owner_id, candidate_id)
);

alter table public.candidate_search_documents_v39 enable row level security;
revoke all on table public.candidate_search_documents_v39 from public, anon, authenticated;
grant select, insert, update, delete on table public.candidate_search_documents_v39 to service_role;

create index if not exists candidate_search_documents_v39_document_gin
  on public.candidate_search_documents_v39 using gin(document);
create index if not exists candidate_search_documents_v39_owner_title
  on public.candidate_search_documents_v39(owner_id, lower(current_title));
create index if not exists candidate_search_documents_v39_owner_company
  on public.candidate_search_documents_v39(owner_id, lower(current_company));
create index if not exists candidate_search_documents_v39_owner_location
  on public.candidate_search_documents_v39(owner_id, lower(location));
create index if not exists candidate_search_documents_v39_skills_gin
  on public.candidate_search_documents_v39 using gin(skills);
create index if not exists candidate_search_documents_v39_clearance_gin
  on public.candidate_search_documents_v39 using gin(clearance_terms);
create index if not exists candidate_search_documents_v39_certification_gin
  on public.candidate_search_documents_v39 using gin(certification_terms);

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
  -- Absorbed identity aliases are audit references, not separately searchable
  -- people. The canonical target is refreshed by source/evidence reassignment.
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
    coalesce(string_agg(concat_ws(' ', sp.source, sp.display_name, sp.headline, sp.organization, sp.location, sp.profile_url, sp.raw_text), ' '), ''),
    count(*) filter (
      where sp.status <> 'rejected'
        and sp.search_allowed
        and (sp.retention_until is null or sp.retention_until > now())
    )::integer,
    count(*) filter (
      where sp.status <> 'rejected'
        and (not sp.search_allowed or (sp.retention_until is not null and sp.retention_until <= now()))
    )::integer,
    max(coalesce(sp.last_seen_at, sp.updated_at, sp.created_at)) filter (
      where sp.status <> 'rejected'
        and sp.search_allowed
        and (sp.retention_until is null or sp.retention_until > now())
    )
  into v_source_text, v_source_count, v_rights_filtered, v_last_observed
  from public.source_profiles sp
  where sp.owner_id = p_owner_id
    and sp.candidate_id = p_candidate_id
    and sp.status <> 'rejected'
    and sp.search_allowed
    and (sp.retention_until is null or sp.retention_until > now());

  -- Evidence attached to a rights-restricted source profile is omitted from the
  -- search index. Candidate-level evidence with no source_profile_id remains
  -- eligible because its provenance is directly attached to the candidate.
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

create or replace function public.candidate_search_refresh_trigger_v39()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_candidate_search_document_v39(old.owner_id, old.candidate_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.candidate_id is distinct from new.candidate_id then
    perform public.refresh_candidate_search_document_v39(old.owner_id, old.candidate_id);
  end if;
  perform public.refresh_candidate_search_document_v39(new.owner_id, new.candidate_id);
  return new;
end;
$$;

revoke all on function public.candidate_search_refresh_trigger_v39() from public, anon, authenticated;
grant execute on function public.candidate_search_refresh_trigger_v39() to service_role;

create or replace function public.candidate_row_search_refresh_trigger_v39()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.candidate_search_documents_v39
      where owner_id = old.owner_id and candidate_id = old.id;
    return old;
  end if;
  perform public.refresh_candidate_search_document_v39(new.owner_id, new.id);
  return new;
end;
$$;

revoke all on function public.candidate_row_search_refresh_trigger_v39() from public, anon, authenticated;
grant execute on function public.candidate_row_search_refresh_trigger_v39() to service_role;

drop trigger if exists candidates_search_refresh_v39 on public.candidates;
create trigger candidates_search_refresh_v39
  after insert or update of canonical_name, headline, current_title, current_company, location, summary, skills
  on public.candidates
  for each row execute function public.candidate_row_search_refresh_trigger_v39();

drop trigger if exists source_profiles_search_refresh_v39 on public.source_profiles;
create trigger source_profiles_search_refresh_v39
  after insert or update or delete on public.source_profiles
  for each row execute function public.candidate_search_refresh_trigger_v39();

drop trigger if exists evidence_items_search_refresh_v39 on public.evidence_items;
create trigger evidence_items_search_refresh_v39
  after insert or update or delete on public.evidence_items
  for each row execute function public.candidate_search_refresh_trigger_v39();

create or replace function public.candidate_redirect_search_refresh_trigger_v39()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_candidate_search_document_v39(old.owner_id, old.from_candidate_id);
    perform public.refresh_candidate_search_document_v39(old.owner_id, old.to_candidate_id);
    return old;
  end if;
  perform public.refresh_candidate_search_document_v39(new.owner_id, new.from_candidate_id);
  perform public.refresh_candidate_search_document_v39(new.owner_id, new.to_candidate_id);
  return new;
end;
$$;

revoke all on function public.candidate_redirect_search_refresh_trigger_v39() from public, anon, authenticated;
grant execute on function public.candidate_redirect_search_refresh_trigger_v39() to service_role;

drop trigger if exists candidate_redirect_search_refresh_v39 on public.candidate_identity_redirects;
create trigger candidate_redirect_search_refresh_v39
  after insert or update or delete on public.candidate_identity_redirects
  for each row execute function public.candidate_redirect_search_refresh_trigger_v39();

create or replace function public.search_owned_talent_v39(
  p_owner_id uuid,
  p_query text default null,
  p_titles text[] default '{}'::text[],
  p_skills text[] default '{}'::text[],
  p_companies text[] default '{}'::text[],
  p_locations text[] default '{}'::text[],
  p_clearances text[] default '{}'::text[],
  p_certifications text[] default '{}'::text[],
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  candidate_id uuid,
  rank real,
  total_count bigint,
  source_count integer,
  evidence_count integer,
  last_observed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with input as (
    select
      nullif(trim(coalesce(p_query, '')), '') as raw_query,
      case when nullif(trim(coalesce(p_query, '')), '') is null
        then null::tsquery
        else websearch_to_tsquery('simple', trim(p_query))
      end as ts_query
  ),
  matched as (
    select
      d.*,
      case
        when i.ts_query is null then 0.10
        else greatest(
          ts_rank_cd(d.document, i.ts_query),
          case when d.raw_document like '%' || lower(i.raw_query) || '%' then 0.25 else 0 end
        )
      end::real as retrieval_rank
    from public.candidate_search_documents_v39 d
    cross join input i
    where d.owner_id = p_owner_id
      and (i.ts_query is null or d.document @@ i.ts_query or d.raw_document like '%' || lower(i.raw_query) || '%')
      and (
        coalesce(cardinality(p_titles), 0) = 0
        or exists (select 1 from unnest(p_titles) t where lower(coalesce(d.current_title, '')) like '%' || lower(t) || '%')
      )
      and (
        coalesce(cardinality(p_companies), 0) = 0
        or exists (select 1 from unnest(p_companies) c where lower(coalesce(d.current_company, '')) like '%' || lower(c) || '%')
      )
      and (
        coalesce(cardinality(p_locations), 0) = 0
        or exists (select 1 from unnest(p_locations) l where lower(coalesce(d.location, '')) like '%' || lower(l) || '%')
      )
      and (
        coalesce(cardinality(p_skills), 0) = 0
        or exists (
          select 1 from unnest(p_skills) s
          where exists (select 1 from unnest(d.skills) ds where lower(ds) = lower(s))
             or d.raw_document like '%' || lower(s) || '%'
        )
      )
      and (
        coalesce(cardinality(p_clearances), 0) = 0
        or exists (select 1 from unnest(p_clearances) cl where d.raw_document like '%' || lower(cl) || '%')
      )
      and (
        coalesce(cardinality(p_certifications), 0) = 0
        or exists (select 1 from unnest(p_certifications) cert where d.raw_document like '%' || lower(cert) || '%')
      )
  )
  select
    m.candidate_id,
    m.retrieval_rank as rank,
    count(*) over() as total_count,
    m.source_count,
    m.evidence_count,
    m.last_observed_at
  from matched m
  order by m.retrieval_rank desc, m.last_observed_at desc nulls last, m.candidate_id
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.search_owned_talent_v39(uuid, text, text[], text[], text[], text[], text[], text[], integer, integer) from public, anon, authenticated;
grant execute on function public.search_owned_talent_v39(uuid, text, text[], text[], text[], text[], text[], text[], integer, integer) to service_role;

comment on function public.search_owned_talent_v39(uuid, text, text[], text[], text[], text[], text[], text[], integer, integer) is
  'V39 rights-aware hybrid lexical + structured retrieval over the recruiter-owned canonical Candidate Graph. Ranking is retrieval relevance only; it is not qualification or a hiring score.';

-- Backfill the owned graph once. Subsequent candidate/source/evidence writes are
-- maintained incrementally by triggers above.
do $$
declare r record;
begin
  for r in select owner_id, id from public.candidates loop
    perform public.refresh_candidate_search_document_v39(r.owner_id, r.id);
  end loop;
end $$;
