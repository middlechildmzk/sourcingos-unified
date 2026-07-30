/**
 * V29.3A1 durable identity migration gate.
 *
 * Uses disposable PostgreSQL 17 databases only. Never connects to production.
 */
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = process.env.IDENTITY_MIGRATION_REPORT || '/tmp/sourcingos-identity-migration-report.json'
const HOST = process.env.PGHOST || '127.0.0.1'
const PORT = process.env.PGPORT || '5432'
const USER = process.env.PGUSER || 'postgres'
const PREFIX = `sourcingos_identity_${process.pid}_${Date.now()}`.toLowerCase()

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
const BASELINE = 'supabase/migrations/20260730172500_canonical_baseline_anchor.sql'
const IDENTITY = 'supabase/migrations/20260730181000_durable_identity_foundation.sql'
const NEW_TABLES = [
  'source_profile_snapshots',
  'source_profile_identifiers',
  'identity_block_keys',
  'identity_match_proposals',
  'evidence_claims',
  'evidence_claim_events',
  'candidate_merge_events',
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

function run(bin, args) {
  const result = spawnSync(bin, args, {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  })
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  }
}

function assert(condition, message) {
  assertions.push({ ok: Boolean(condition), message })
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

function args(database) {
  return ['--host', HOST, '--port', PORT, '--username', USER, '--dbname', database, '--no-psqlrc', '--set', 'ON_ERROR_STOP=1']
}

function createDatabase(name) {
  const result = run('createdb', ['--host', HOST, '--port', PORT, '--username', USER, name])
  if (!result.ok) throw new Error(result.stderr || result.error || `cannot create ${name}`)
  createdDatabases.add(name)
}

function dropDatabase(name) {
  run('dropdb', ['--if-exists', '--force', '--host', HOST, '--port', PORT, '--username', USER, name])
  createdDatabases.delete(name)
}

function execute(database, sql) {
  const result = run('psql', [...args(database), '--command', sql])
  if (!result.ok) throw new Error(result.stderr || result.error || 'SQL execution failed')
}

function query(database, sql) {
  const result = run('psql', [...args(database), '--tuples-only', '--no-align', '--command', sql])
  if (!result.ok) throw new Error(result.stderr || result.error || 'query failed')
  return result.stdout.trim()
}

function apply(database, relativePath) {
  const absolute = path.join(ROOT, relativePath)
  if (!fs.existsSync(absolute)) return { ok: false, stderr: `missing ${relativePath}` }
  return run('psql', [...args(database), '--file', absolute])
}

function fingerprint(database) {
  return query(database, `
with objects as (
  select 'column|' || table_schema || '|' || table_name || '|' || ordinal_position || '|' || column_name || '|' || data_type || '|' || is_nullable || '|' || coalesce(column_default, '') item
  from information_schema.columns where table_schema = 'public'
  union all
  select 'constraint|' || n.nspname || '|' || c.relname || '|' || con.conname || '|' || pg_get_constraintdef(con.oid)
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
  union all
  select 'index|' || schemaname || '|' || tablename || '|' || indexname || '|' || indexdef from pg_indexes where schemaname = 'public'
  union all
  select 'policy|' || schemaname || '|' || tablename || '|' || policyname || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') from pg_policies where schemaname = 'public'
  union all
  select 'trigger|' || n.nspname || '|' || c.relname || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','auth') and not t.tgisinternal
)
select md5(coalesce(string_agg(item, E'\\n' order by item), '')) from objects;
`)
}

function canonicalCounts(database) {
  return query(database, `select concat_ws('|',
    (select count(*) from public.candidates),
    (select count(*) from public.source_profiles),
    (select count(*) from public.evidence_items),
    (select count(*) from public.candidate_contacts),
    (select count(*) from public.identity_match_reviews),
    (select count(*) from public.talent_graph_edges)
  );`)
}

async function main() {
  for (const command of ['psql', 'createdb', 'dropdb']) {
    assert(run('bash', ['-lc', `command -v ${command}`]).ok, `required command is available: ${command}`)
  }

  const report = { emptyRejected: false, tables: {}, assertions, fingerprints: {}, canonicalCounts: {} }

  const emptyDb = `${PREFIX}_empty`
  createDatabase(emptyDb)
  const empty = apply(emptyDb, IDENTITY)
  report.emptyRejected = !empty.ok
  assert(!empty.ok, 'identity migration fails closed without canonical baseline')

  const db = `${PREFIX}_apply`
  createDatabase(db)
  execute(db, BOOTSTRAP)
  for (const file of PRODUCTION_SEQUENCE) assert(apply(db, file).ok, `production reconstruction applies: ${file}`)
  assert(apply(db, BASELINE).ok, 'canonical baseline anchor applies before identity foundation')

  report.canonicalCounts.before = canonicalCounts(db)
  assert(apply(db, IDENTITY).ok, 'durable identity migration applies')
  report.canonicalCounts.afterFirst = canonicalCounts(db)
  assert(report.canonicalCounts.before === report.canonicalCounts.afterFirst, 'identity migration does not change canonical row counts')

  for (const table of NEW_TABLES) {
    const exists = query(db, `select to_regclass('public.${table}') is not null;`) === 't'
    const rows = exists ? Number(query(db, `select count(*) from public.${table};`)) : -1
    const rls = exists ? query(db, `select relrowsecurity from pg_class where oid = 'public.${table}'::regclass;`) === 't' : false
    report.tables[table] = { exists, rows, rls }
    assert(exists, `identity table exists: ${table}`)
    assert(rows === 0, `identity table starts empty: ${table}`)
    assert(rls, `identity table has RLS enabled: ${table}`)
    const directWrites = query(db, `
      select count(*) from information_schema.role_table_grants
      where table_schema = 'public' and table_name = '${table}'
        and grantee in ('anon','authenticated')
        and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
    `)
    assert(directWrites === '0', `browser roles have no direct writes: ${table}`)
  }

  report.fingerprints.afterFirst = fingerprint(db)
  assert(apply(db, IDENTITY).ok, 'durable identity migration replays idempotently')
  report.fingerprints.afterSecond = fingerprint(db)
  report.canonicalCounts.afterSecond = canonicalCounts(db)
  assert(report.fingerprints.afterFirst === report.fingerprints.afterSecond, 'identity replay preserves schema fingerprint')
  assert(report.canonicalCounts.before === report.canonicalCounts.afterSecond, 'identity replay preserves canonical row counts')

  execute(db, `
    insert into auth.users(id, email) values
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.test');
    insert into public.candidates(id, owner_id, canonical_name)
      values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Candidate A');
    insert into public.source_profiles(id, owner_id, source, source_profile_id, display_name)
      values ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'github', 'b-user', 'Candidate B');
  `)
  const crossOwner = run('psql', [...args(db), '--command', `
    insert into public.source_profile_snapshots(owner_id, source_profile_id, payload_hash, observed_at)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', repeat('a',64), now());
  `])
  assert(!crossOwner.ok, 'composite foreign key rejects cross-owner source-profile attachment')

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`identity report written to ${REPORT_PATH}`)
  console.log(`assertions: ${assertions.filter(item => item.ok).length}/${assertions.length} passed`)
}

main()
  .catch(error => {
    console.error(`IDENTITY HARNESS ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => {
    for (const database of [...createdDatabases]) dropDatabase(database)
  })
