-- SourcingOS V29.3A0.2 canonical baseline anchor
--
-- Zero-change migration-history alignment marker.
-- This file must not create, alter, drop, insert, update, delete, or backfill.
-- It only verifies that the database already matches the reconciled production
-- contract before the migration ledger may advance.
--
-- Production application requires separate explicit approval.

do $$
declare
  required_table text;
  rls_table text;
begin
  foreach required_table in array array[
    'candidates',
    'source_profiles',
    'evidence_items',
    'candidate_contacts',
    'identity_match_reviews',
    'talent_graph_edges'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'canonical baseline mismatch: missing public.%', required_table;
    end if;
  end loop;

  if to_regclass('public.evidence_claims') is not null then
    raise exception 'canonical baseline mismatch: public.evidence_claims must remain absent before V29.3A1';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidates'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    raise exception 'canonical baseline mismatch: candidates.id must be uuid';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidates'
      and column_name = 'owner_id'
      and data_type = 'uuid'
  ) then
    raise exception 'canonical baseline mismatch: candidates.owner_id must be uuid';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'source_profiles'
      and column_name = 'candidate_id'
      and data_type = 'uuid'
  ) then
    raise exception 'canonical baseline mismatch: source_profiles.candidate_id must be uuid';
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'source_profiles'
      and con.contype = 'u'
      and regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g') ilike '%UNIQUE (owner_id, source, source_profile_id)%'
  ) then
    raise exception 'canonical baseline mismatch: source_profiles exact-source uniqueness is missing';
  end if;

  foreach rls_table in array array[
    'candidates',
    'source_profiles',
    'evidence_items',
    'candidate_contacts',
    'identity_match_reviews'
  ] loop
    if not exists (
      select 1
      from pg_class rel
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and rel.relname = rls_table
        and rel.relrowsecurity
    ) then
      raise exception 'canonical baseline mismatch: RLS is not enabled on public.%', rls_table;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'candidate_contacts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%verified = false%'
  ) then
    raise exception 'canonical baseline mismatch: candidate contact verification guard is missing';
  end if;
end $$;
