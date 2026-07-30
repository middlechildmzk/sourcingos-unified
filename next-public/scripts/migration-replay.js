/**
 * V29.3A0 migration replay harness.
 *
 * Replays the reconstructed production sequence against disposable databases
 * on a PostgreSQL 17 server, verifies the measured replay hazards, rehearses
 * the currently pending repository migrations, and classifies orphan SQL.
 *
 * This script never connects to production. It requires a disposable/local
 * PostgreSQL server supplied through standard PG* environment variables.
 * CI uses the postgres:17 service declared in next-public-ci.yml.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const REPO = path.resolve(__dirname, '..')
const REPORT_PATH = process.env.MIGRATION_REPLAY_REPORT || '/tmp/sourcingos-migration-replay-report.json'
const HOST = process.env.PGHOST || '127.0.0.1'
const PORT = process.env.PGPORT || '5432'
const USER = process.env.PGUSER || 'postgres'
const RUN_ID = `${process.pid}_${Date.now()}`
const DB_PREFIX = `sourcingos_replay_${RUN_ID}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()

const SEQUENCE_A = [
  { file: 'sql/complete-schema-v19.sql', ledger: null, how: 'manual SQL editor' },
  { file: 'sql/rls-policies-v19.sql', ledger: null, how: 'manual SQL editor' },
  { file: 'sql/role-workspace-v20-1.sql', ledger: 'v20_role_workspace_durable', how: 'ledger' },
  { file: 'sql/security-hardening-v20-3.sql', ledger: 'v20_3_security_performance_hardening', how: 'ledger' },
  { file: 'sql/role-workspace-v20-3-indexes.sql', ledger: 'role_workspace_v20_3_compatibility_index', how: 'ledger' },
  { file: 'sql/candidate-acquisition-v21.sql', ledger: 'candidate_acquisition_v21', how: 'ledger' },
  { file: 'sql/autosource-v22.sql', ledger: 'autosource_v22', how: 'ledger' },
  { file: 'sql/agent-os-v23-v25.sql', ledger: 'agent_os_v23_v25', how: 'ledger' },
]

const EXPECTED_REPLAY_UNSAFE = new Set([
  'sql/complete-schema-v19.sql',
  'sql/rls-policies-v19.sql',
  'sql/candidate-acquisition-v21.sql',
  'sql/autosource-v22.sql',
  'sql/agent-os-v23-v25.sql',
])

const SEQUENCE_B = [
  'supabase/migrations/20260701173000_jobs_v2_foundation.sql',
  'supabase/migrations/20260721173000_role_workspace_owner_safety.sql',
  'supabase/migrations/20260722160000_role_calibration_state.sql',
]

const ORPHAN_EXPECTATIONS = {
  'sql/candidate-graph-schema.sql': 'conflicts',
  'sql/candidate-graph-schema-v17-3.sql': 'conflicts',
  'sql/candidate-graph-v18.sql': 'table_shape_no_op_secondary_drift',
  'sql/candidate-intelligence-spine-v19.sql': 'applies',
  'sql/sourcingos-jobs-v17-6.sql': 'applies',
}

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

const TARGET_TABLES = [
  'candidates',
  'source_profiles',
  'evidence_items',
  'candidate_contacts',
  'identity_match_reviews',
  'evidence_claims',
  'talent_graph_edges',
]

const createdDatabases = new Set()
const assertions = []

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    cwd: REPO,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
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

function requireCommand(bin) {
  const result = run('bash', ['-lc', `command -v ${bin}`])
  if (!result.ok) throw new Error(`Required command not found: ${bin}`)
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

function query(database, sql) {
  const result = run('psql', [...connectionArgs(database), '--tuples-only', '--no-align', '--command', sql])
  if (!result.ok) throw new Error(`Query failed in ${database}: ${result.stderr || result.error}`)
  return result.stdout.trim()
}

function executeSql(database, sql) {
  return run('psql', [...connectionArgs(database), '--command', sql])
}

function applyFile(database, relPath) {
  const abs = path.join(REPO, relPath)
  if (!fs.existsSync(abs)) return { ok: false, error: 'file not found', stdout: '', stderr: '' }
  const result = run('psql', [...connectionArgs(database), '--file', abs])
  const detail = [result.error, result.stderr].filter(Boolean).join('\n').trim()
  return {
    ok: result.ok,
    error: result.ok ? null : detail.split('\n').find(Boolean)?.slice(0, 500) || 'unknown failure',
    stdout: result.stdout.slice(-2000),
    stderr: result.stderr.slice(-2000),
  }
}

function assert(condition, message) {
  assertions.push({ ok: Boolean(condition), message })
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function bootstrap(database) {
  const result = executeSql(database, BOOTSTRAP)
  if (!result.ok) throw new Error(`Bootstrap failed in ${database}: ${result.stderr || result.error}`)
}

function applyProductionSequence(database) {
  const rows = []
  for (const step of SEQUENCE_A) {
    const result = applyFile(database, step.file)
    rows.push({ ...step, ...result })
    assert(result.ok, `clean production sequence must apply: ${step.file}`)
  }
  return rows
}

function tableShapeFingerprint(database) {
  const sql = `
with objects as (
  select 'column|' || table_schema || '|' || table_name || '|' || ordinal_position || '|' ||
         column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '') as item
  from information_schema.columns
  where table_schema = 'public'
  union all
  select 'constraint|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' ||
         pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
)
select md5(coalesce(string_agg(item, E'\\n' order by item), '')) from objects;
`
  return query(database, sql)
}

function fullSchemaFingerprint(database) {
  const sql = `
with objects as (
  select 'column|' || table_schema || '|' || table_name || '|' || ordinal_position || '|' ||
         column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '') as item
  from information_schema.columns
  where table_schema = 'public'
  union all
  select 'constraint|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' ||
         pg_get_constraintdef(con.oid)
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
  select 'trigger|' || n.nspname || '|' || c.relname || '|' || t.tgname || '|' ||
         pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
)
select md5(coalesce(string_agg(item, E'\\n' order by item), '')) from objects;
`
  return query(database, sql)
}

function tableContract(database, table) {
  const present = query(database, `select to_regclass('public.${table}') is not null;`) === 't'
  if (!present) return null
  const row = query(database, `
select jsonb_build_object(
  'columnCount', (select count(*) from information_schema.columns where table_schema='public' and table_name='${table}'),
  'rlsEnabled', (select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='${table}'),
  'policyCount', (select count(*) from pg_policies where schemaname='public' and tablename='${table}'),
  'foreignKeyCount', (
    select count(*) from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='${table}' and con.contype='f'
  ),
  'uniqueCount', (
    select count(*) from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='${table}' and con.contype='u'
  ),
  'indexCount', (select count(*) from pg_indexes where schemaname='public' and tablename='${table}')
)::text;
`)
  return JSON.parse(row)
}

function classifyOrphan(database, file) {
  const beforeTableShape = tableShapeFingerprint(database)
  const beforeFullSchema = fullSchemaFingerprint(database)
  const result = applyFile(database, file)
  if (!result.ok) {
    return {
      classification: 'conflicts',
      beforeTableShape,
      afterTableShape: beforeTableShape,
      beforeFullSchema,
      afterFullSchema: beforeFullSchema,
      ...result,
    }
  }

  const afterTableShape = tableShapeFingerprint(database)
  const afterFullSchema = fullSchemaFingerprint(database)
  let classification = 'applies'
  if (beforeTableShape === afterTableShape && beforeFullSchema === afterFullSchema) {
    classification = 'silent_no_op'
  } else if (beforeTableShape === afterTableShape && beforeFullSchema !== afterFullSchema) {
    classification = 'table_shape_no_op_secondary_drift'
  }

  return {
    classification,
    beforeTableShape,
    afterTableShape,
    beforeFullSchema,
    afterFullSchema,
    ...result,
  }
}

async function main() {
  requireCommand('psql')
  requireCommand('createdb')
  requireCommand('dropdb')

  const report = {
    version: null,
    productionSequence: [],
    replay: [],
    pending: [],
    orphans: [],
    contracts: {},
    assertions,
  }

  const mainDb = `${DB_PREFIX}_main`
  createDatabase(mainDb)
  bootstrap(mainDb)

  report.version = query(mainDb, 'select version();').split(',')[0]
  console.log(`=== ${report.version} ===`)
  assert(/^PostgreSQL 17\./.test(report.version), `expected PostgreSQL 17, received ${report.version}`)

  console.log('\n=== CLEAN RECONSTRUCTED PRODUCTION SEQUENCE ===')
  report.productionSequence = applyProductionSequence(mainDb)
  for (const row of report.productionSequence) console.log(`  PASS  ${row.file}`)

  console.log('\n=== CANONICAL TABLE CONTRACTS ===')
  for (const table of TARGET_TABLES) {
    const contract = tableContract(mainDb, table)
    report.contracts[table] = contract
    console.log(`  ${table}: ${contract ? JSON.stringify(contract) : 'ABSENT'}`)
  }
  assert(report.contracts.evidence_claims === null, 'evidence_claims must be absent from reconstructed production')
  assert(report.contracts.talent_graph_edges !== null, 'talent_graph_edges must be present in reconstructed production')

  console.log('\n=== SECOND APPLICATION / REPLAY SAFETY ===')
  for (const step of SEQUENCE_A) {
    const result = applyFile(mainDb, step.file)
    report.replay.push({ file: step.file, ...result })
    const expectedUnsafe = EXPECTED_REPLAY_UNSAFE.has(step.file)
    assert(
      expectedUnsafe ? !result.ok : result.ok,
      `${step.file} replay result changed; update the SQL, manifest, tests, and document together`,
    )
    console.log(`  ${result.ok ? 'PASS' : 'EXPECTED FAIL'}  ${step.file}${result.error ? `\n        -> ${result.error}` : ''}`)
  }

  console.log('\n=== PENDING VERSIONED MIGRATIONS ===')
  const pendingDb = `${DB_PREFIX}_pending`
  createDatabase(pendingDb)
  bootstrap(pendingDb)
  applyProductionSequence(pendingDb)
  for (const file of SEQUENCE_B) {
    const result = applyFile(pendingDb, file)
    report.pending.push({ file, ...result })
    assert(result.ok, `pending migration must currently apply on reconstructed production: ${file}`)
    console.log(`  PASS  ${file}`)
  }

  console.log('\n=== ORPHAN CLASSIFICATION ===')
  for (const [file, expected] of Object.entries(ORPHAN_EXPECTATIONS)) {
    const db = `${DB_PREFIX}_orphan_${report.orphans.length}`
    createDatabase(db)
    bootstrap(db)
    applyProductionSequence(db)
    const result = classifyOrphan(db, file)
    report.orphans.push({ file, expected, ...result })
    assert(result.classification === expected, `${file} expected ${expected}, received ${result.classification}`)
    console.log(`  ${result.classification.toUpperCase()}  ${file}${result.error ? `\n        -> ${result.error}` : ''}`)
    dropDatabase(db)
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`\nreport written to ${REPORT_PATH}`)
  console.log(`assertions: ${assertions.filter(item => item.ok).length}/${assertions.length} passed`)
}

main()
  .catch(error => {
    console.error('HARNESS ERROR:', error.message)
    process.exitCode = 1
  })
  .finally(() => {
    for (const database of [...createdDatabases]) dropDatabase(database)
  })
