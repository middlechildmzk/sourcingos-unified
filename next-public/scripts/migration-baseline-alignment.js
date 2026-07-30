/**
 * V29.3A0.2 canonical baseline alignment gate.
 *
 * This script never connects to production. It uses disposable PostgreSQL 17
 * databases supplied through PG* environment variables and proves that the
 * baseline anchor fails closed, is zero-change, and remains first in the exact
 * active migration sequence.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = process.env.BASELINE_ALIGNMENT_REPORT || '/tmp/sourcingos-baseline-alignment-report.json'
const HOST = process.env.PGHOST || '127.0.0.1'
const PORT = process.env.PGPORT || '5432'
const USER = process.env.PGUSER || 'postgres'
const RUN_ID = `${process.pid}_${Date.now()}`
const PREFIX = `sourcingos_baseline_${RUN_ID}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()

const BASELINE = 'supabase/migrations/20260730172500_canonical_baseline_anchor.sql'
const EXPECTED_ACTIVE = [
  '20260730172500_canonical_baseline_anchor.sql',
  '20260730181000_durable_identity_foundation.sql',
]
const PRODUCTION_SEQUENCE = [
  'sql/complete-schema-v19.sql',
  'sql/rls-policies-v19.sql',
  'sql/role-workspace-v20-1.sql',
  'sql/security-hardening-v20-3.sql',
  'sql/role-workspace-v20-3-indexes.sql',
  'sql/candidate-acquisition-v21.sql',
  'sql/autosource-v22.sql',
  'sql/agent-os-v23-v25.sql',
]

const BOOTSTRAP = `
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`

const createdDatabases = new Set()
const assertions = []

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    ...options,
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  }
}

function assert(condition, message) {
  assertions.push({ ok: Boolean(condition), message })
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function connectionArgs(database) {
  return [
    '--host', HOST,
    '--port', PORT,
    '--username', USER,
    '--dbname', database,
    '--no-psqlrc',
    '--set', 'ON_ERROR_STOP=1',
    '--set', 'VERBOSITY=verbose',
  ]
}

function createDatabase(name) {
  const result = run('createdb', ['--host', HOST, '--port', PORT, '--username', USER, name])
  if (!result.ok) throw new Error(`Could not create ${name}: ${result.stderr || result.error}`)
  createdDatabases.add(name)
}

function dropDatabase(name) {
  run('dropdb', ['--if-exists', '--force', '--host', HOST, '--port', PORT, '--username', USER, name])
  createdDatabases.delete(name)
}

function execute(database, sql) {
  const result = run('psql', [...connectionArgs(database), '--command', sql])
  if (!result.ok) throw new Error(`SQL failed in ${database}: ${result.stderr || result.error}`)
}

function query(database, sql) {
  const result = run('psql', [...connectionArgs(database), '--tuples-only', '--no-align', '--command', sql])
  if (!result.ok) throw new Error(`Query failed in ${database}: ${result.stderr || result.error}`)
  return result.stdout.trim()
}

function applyFile(database, relativePath) {
  const absolutePath = path.join(ROOT, relativePath)
  if (!fs.existsSync(absolutePath)) return { ok: false, stderr: `missing file: ${relativePath}` }
  return run('psql', [...connectionArgs(database), '--file', absolutePath])
}

function schemaFingerprint(database) {
  return query(database, `
with objects as (
  select 'column|' || table_schema || '|' || table_name || '|' || ordinal_position || '|' ||
         column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '') as item
  from information_schema.columns
  where table_schema = 'public'
  union all
  select 'constraint|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
  union all
  select 'index|' || schemaname || '|' || tablename || '|' || indexname || '|' || indexdef
  from pg_indexes
  where schemaname = 'public'
  union all
  select 'policy|' || schemaname || '|' || tablename || '|' || policyname || '|' || cmd || '|' ||
         coalesce(qual, '') || '|' || coalesce(with_check, '')
  from pg_policies
  where schemaname = 'public'
  union all
  select 'trigger|' || n.nspname || '|' || c.relname || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'auth') and not t.tgisinternal
)
select md5(coalesce(string_agg(item, E'\n' order by item), '')) from objects;
`)
}

function rowFingerprint(database) {
  return query(database, `
select md5(concat_ws('|',
  (select count(*) from public.candidates),
  (select count(*) from public.source_profiles),
  (select count(*) from public.evidence_items),
  (select count(*) from public.candidate_contacts),
  (select count(*) from public.identity_match_reviews),
  (select count(*) from public.talent_graph_edges)
));
`)
}

function activeMigrationFiles() {
  const directory = path.join(ROOT, 'supabase', 'migrations')
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter(file => file.endsWith('.sql')).sort()
}

async function main() {
  for (const command of ['psql', 'createdb', 'dropdb']) {
    assert(run('bash', ['-lc', `command -v ${command}`]).ok, `required command is available: ${command}`)
  }

  const active = activeMigrationFiles()
  assert(JSON.stringify(active) === JSON.stringify(EXPECTED_ACTIVE), 'active Supabase migrations match the exact approved ordered pair')
  assert(active[0] === path.basename(BASELINE), 'the canonical baseline anchor remains first')

  const report = {
    baseline: BASELINE,
    activeMigrations: active,
    emptyDatabaseRejected: false,
    firstApply: null,
    secondApply: null,
    fingerprints: {},
    assertions,
  }

  const emptyDb = `${PREFIX}_empty`
  createDatabase(emptyDb)
  const emptyResult = applyFile(emptyDb, BASELINE)
  report.emptyDatabaseRejected = !emptyResult.ok
  assert(!emptyResult.ok, 'baseline anchor fails closed on an empty database')
  assert(
    `${emptyResult.stderr || ''}`.includes('canonical baseline mismatch'),
    'empty-database rejection reports a canonical baseline mismatch',
  )

  const alignedDb = `${PREFIX}_aligned`
  createDatabase(alignedDb)
  execute(alignedDb, BOOTSTRAP)
  for (const file of PRODUCTION_SEQUENCE) {
    const result = applyFile(alignedDb, file)
    assert(result.ok, `reconstructed production applies before baseline: ${file}`)
  }

  report.fingerprints.schemaBefore = schemaFingerprint(alignedDb)
  report.fingerprints.rowsBefore = rowFingerprint(alignedDb)

  report.firstApply = applyFile(alignedDb, BASELINE)
  assert(report.firstApply.ok, 'baseline anchor applies to the reconciled production contract')
  report.fingerprints.schemaAfterFirst = schemaFingerprint(alignedDb)
  report.fingerprints.rowsAfterFirst = rowFingerprint(alignedDb)
  assert(report.fingerprints.schemaBefore === report.fingerprints.schemaAfterFirst, 'first baseline application changes no schema object')
  assert(report.fingerprints.rowsBefore === report.fingerprints.rowsAfterFirst, 'first baseline application changes no canonical row count')

  report.secondApply = applyFile(alignedDb, BASELINE)
  assert(report.secondApply.ok, 'baseline anchor is idempotent')
  report.fingerprints.schemaAfterSecond = schemaFingerprint(alignedDb)
  report.fingerprints.rowsAfterSecond = rowFingerprint(alignedDb)
  assert(report.fingerprints.schemaBefore === report.fingerprints.schemaAfterSecond, 'second baseline application changes no schema object')
  assert(report.fingerprints.rowsBefore === report.fingerprints.rowsAfterSecond, 'second baseline application changes no canonical row count')

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`baseline report written to ${REPORT_PATH}`)
  console.log(`assertions: ${assertions.filter(item => item.ok).length}/${assertions.length} passed`)
}

main()
  .catch(error => {
    console.error(`BASELINE HARNESS ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => {
    for (const database of [...createdDatabases]) dropDatabase(database)
  })
