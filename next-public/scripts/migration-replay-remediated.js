/**
 * V29.3A0.1 reconciled migration replay gate.
 *
 * This script never connects to production. It uses disposable PostgreSQL 17
 * databases supplied through PG* environment variables.
 *
 * It proves four separate facts:
 * 1. the reconstructed eight-file production sequence still builds from empty;
 * 2. the raw historical sequence still exhibits the five documented hazards;
 * 3. the explicit reconstruction guard makes the same sequence replay 8/8
 *    without changing the resulting schema contract; and
 * 4. no unapplied SQL remains in the active Supabase migration directory.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = process.env.MIGRATION_REPLAY_REPORT || '/tmp/sourcingos-migration-replay-report.json'
const HOST = process.env.PGHOST || '127.0.0.1'
const PORT = process.env.PGPORT || '5432'
const USER = process.env.PGUSER || 'postgres'
const RUN_ID = `${process.pid}_${Date.now()}`
const PREFIX = `sourcingos_replay_safe_${RUN_ID}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()

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

const RAW_REPLAY_UNSAFE = new Set([
  'sql/complete-schema-v19.sql',
  'sql/rls-policies-v19.sql',
  'sql/candidate-acquisition-v21.sql',
  'sql/autosource-v22.sql',
  'sql/agent-os-v23-v25.sql',
])

const REPLAY_GUARD = 'sql/replay-safety-guards-v29-3a0.sql'

const HELD_MIGRATIONS = [
  'supabase/held-migrations/20260701173000_jobs_v2_foundation.sql',
  'supabase/held-migrations/20260721173000_role_workspace_owner_safety.sql',
  'supabase/held-migrations/20260722160000_role_calibration_state.sql',
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

function requireCommand(bin) {
  const result = run('bash', ['-lc', `command -v ${bin}`])
  assert(result.ok, `required command is available: ${bin}`)
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

function execute(database, sql) {
  const result = run('psql', [...connectionArgs(database), '--command', sql])
  if (!result.ok) throw new Error(`SQL failed in ${database}: ${result.stderr || result.error}`)
}

function applyFile(database, relativePath) {
  const absolutePath = path.join(ROOT, relativePath)
  if (!fs.existsSync(absolutePath)) {
    return { ok: false, error: `missing file: ${relativePath}`, stdout: '', stderr: '' }
  }
  const result = run('psql', [...connectionArgs(database), '--file', absolutePath])
  const details = [result.error, result.stderr].filter(Boolean).join('\n').trim()
  return {
    ok: result.ok,
    error: result.ok ? null : details.split('\n').find(Boolean)?.slice(0, 500) || 'unknown failure',
    stdout: result.stdout.slice(-2000),
    stderr: result.stderr.slice(-2000),
  }
}

function bootstrap(database) {
  execute(database, BOOTSTRAP)
}

function applySequence(database, label) {
  const rows = []
  for (const file of PRODUCTION_SEQUENCE) {
    const result = applyFile(database, file)
    rows.push({ file, ...result })
    assert(result.ok, `${label}: ${file} applies`)
  }
  return rows
}

function schemaFingerprint(database) {
  return query(database, `
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
  where n.nspname in ('public', 'auth') and not t.tgisinternal
)
select md5(coalesce(string_agg(item, E'\\n' order by item), '')) from objects;
`)
}

function activeMigrationFiles() {
  const directory = path.join(ROOT, 'supabase', 'migrations')
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory).filter(file => file.endsWith('.sql')).sort()
}

async function main() {
  requireCommand('psql')
  requireCommand('createdb')
  requireCommand('dropdb')

  const report = {
    version: null,
    activeMigrations: activeMigrationFiles(),
    clean: [],
    rawReplay: [],
    guardedReplay: [],
    heldMigrations: [],
    fingerprints: {},
    assertions,
  }

  assert(report.activeMigrations.length === 0, 'active supabase/migrations directory contains no SQL files')
  for (const file of HELD_MIGRATIONS) {
    assert(fs.existsSync(path.join(ROOT, file)), `held migration is preserved: ${file}`)
  }

  const rawDb = `${PREFIX}_raw`
  createDatabase(rawDb)
  bootstrap(rawDb)
  report.version = query(rawDb, 'select version();').split(',')[0]
  assert(/^PostgreSQL 17\./.test(report.version), `expected PostgreSQL 17, received ${report.version}`)

  console.log(`=== ${report.version} ===`)
  console.log('\n=== CLEAN RECONSTRUCTION ===')
  report.clean = applySequence(rawDb, 'clean reconstruction')
  for (const row of report.clean) console.log(`  PASS  ${row.file}`)

  console.log('\n=== RAW HISTORICAL REPLAY PROFILE ===')
  for (const file of PRODUCTION_SEQUENCE) {
    const result = applyFile(rawDb, file)
    report.rawReplay.push({ file, ...result })
    const expectedFailure = RAW_REPLAY_UNSAFE.has(file)
    assert(expectedFailure ? !result.ok : result.ok, `raw replay outcome remains documented: ${file}`)
    console.log(`  ${result.ok ? 'PASS' : 'EXPECTED FAIL'}  ${file}`)
  }

  const safeDb = `${PREFIX}_safe`
  createDatabase(safeDb)
  bootstrap(safeDb)
  applySequence(safeDb, 'guarded reconstruction initial pass')
  report.fingerprints.beforeGuardedReplay = schemaFingerprint(safeDb)

  console.log('\n=== GUARDED REPLAY ===')
  const guard = applyFile(safeDb, REPLAY_GUARD)
  assert(guard.ok, 'reconstruction replay guard applies')
  report.guardedReplay = applySequence(safeDb, 'guarded reconstruction replay')
  for (const row of report.guardedReplay) console.log(`  PASS  ${row.file}`)
  report.fingerprints.afterGuardedReplay = schemaFingerprint(safeDb)
  assert(
    report.fingerprints.beforeGuardedReplay === report.fingerprints.afterGuardedReplay,
    'guarded replay preserves the complete public/auth schema fingerprint',
  )

  const heldDb = `${PREFIX}_held`
  createDatabase(heldDb)
  bootstrap(heldDb)
  applySequence(heldDb, 'held-migration rehearsal base')

  console.log('\n=== HELD MIGRATION REHEARSAL ===')
  for (const file of HELD_MIGRATIONS) {
    const result = applyFile(heldDb, file)
    report.heldMigrations.push({ file, ...result })
    assert(result.ok, `held migration still rehearses successfully: ${file}`)
    console.log(`  PASS  ${file}`)
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`\nreport written to ${REPORT_PATH}`)
  console.log(`assertions: ${assertions.filter(item => item.ok).length}/${assertions.length} passed`)
}

main()
  .catch(error => {
    console.error(`HARNESS ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => {
    for (const database of [...createdDatabases]) dropDatabase(database)
  })
