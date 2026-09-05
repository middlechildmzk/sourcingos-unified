#!/usr/bin/env bash
# Prepares a scratch database for the V40.5i canary admission proofs:
# the Supabase-specific objects the migration references, a stand-in
# candidate_enrichment_tasks table, the migration itself, and the shared
# fixtures. Idempotent, and safe to call from each proof script so every
# script is independently runnable.
#
# Requires a THROWAWAY database. Never point this at production: it drops and
# recreates public.candidate_enrichment_tasks.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION="$HERE/../../supabase/migrations/20260905030000_v40_5i_provider_agnostic_resume_discovery.sql"
PSQL="${PSQL:-psql}"

$PSQL -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;

-- Stand-in for the columns the claim functions touch. Dropped with CASCADE so
-- each run starts clean; the claim functions return
-- setof candidate_enrichment_tasks and are recreated by the migration below.
drop table if exists public.candidate_enrichment_tasks cascade;
create table public.candidate_enrichment_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default gen_random_uuid(),
  candidate_id uuid not null,
  task_kind text not null,
  agent_id text not null default 'resume-query-general',
  priority integer not null default 82,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  not_before timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  payload jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
SQL

# The migration under test, applied verbatim.
$PSQL -v ON_ERROR_STOP=1 -q -f "$MIGRATION"
$PSQL -v ON_ERROR_STOP=1 -q -f "$HERE/v40-5i-helpers.sql"
