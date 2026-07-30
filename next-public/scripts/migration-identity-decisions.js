/**
 * V29.3A3 transactional identity-decision gate.
 *
 * Uses disposable PostgreSQL 17 databases only. Never connects to production.
 */
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = process.env.IDENTITY_DECISION_REPORT || '/tmp/sourcingos-identity-decision-report.json'
const HOST = process.env.PGHOST || '127.0.0.1'
const PORT = process.env.PGPORT || '5432'
const USER = process.env.PGUSER || 'postgres'
const PREFIX = `sourcingos_decision_${process.pid}_${Date.now()}`.toLowerCase()

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
const DECISIONS = 'supabase/migrations/20260730194500_transactional_identity_decisions.sql'

const OWNER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ids = {
  previous: '10000000-0000-4000-8000-000000000001',
  target: '10000000-0000-4000-8000-000000000002',
  alternate: '10000000-0000-4000-8000-000000000003',
  rolePrevious: '10000000-0000-4000-8000-000000000004',
  roleTarget: '10000000-0000-4000-8000-000000000005',
  keepPrevious: '10000000-0000-4000-8000-000000000006',
  keepTarget: '10000000-0000-4000-8000-000000000007',
  rejectPrevious: '10000000-0000-4000-8000-000000000008',
  rejectTarget: '10000000-0000-4000-8000-000000000009',
  blockPrevious: '10000000-0000-4000-8000-000000000010',
  blockTarget: '10000000-0000-4000-8000-000000000011',
  stalePrevious: '10000000-0000-4000-8000-000000000012',
  staleTarget: '10000000-0000-4000-8000-000000000013',
  concurrencyPrevious: '10000000-0000-4000-8000-000000000014',
  concurrencyTargetA: '10000000-0000-4000-8000-000000000015',
  concurrencyTargetB: '10000000-0000-4000-8000-000000000016',
  profile: '20000000-0000-4000-8000-000000000001',
  roleProfile: '20000000-0000-4000-8000-000000000002',
  keepProfile: '20000000-0000-4000-8000-000000000003',
  rejectProfile: '20000000-0000-4000-8000-000000000004',
  blockProfile: '20000000-0000-4000-8000-000000000005',
  staleProfile: '20000000-0000-4000-8000-000000000006',
  concurrencyProfile: '20000000-0000-4000-8000-000000000007',
  proposal: '30000000-0000-4000-8000-000000000001',
  competingProposal: '30000000-0000-4000-8000-000000000002',
  roleProposal: '30000000-0000-4000-8000-000000000003',
  keepProposal: '30000000-0000-4000-8000-000000000004',
  rejectProposal: '30000000-0000-4000-8000-000000000005',
  blockProposal: '30000000-0000-4000-8000-000000000006',
  staleProposal: '30000000-0000-4000-8000-000000000007',
  concurrencyProposalA: '30000000-0000-4000-8000-000000000008',
  concurrencyProposalB: '30000000-0000-4000-8000-000000000009',
  project: '50000000-0000-4000-8000-000000000001',
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
  const result = run('psql', [...connectionArgs(database), '--command', sql])
  if (!result.ok) throw new Error(result.stderr || result.error || 'SQL execution failed')
}

function query(database, sql) {
  const result = run('psql', [...connectionArgs(database), '--tuples-only', '--no-align', '--command', sql])
  if (!result.ok) throw new Error(result.stderr || result.error || 'query failed')
  return result.stdout.trim()
}

function apply(database, relativePath) {
  const absolute = path.join(ROOT, relativePath)
  if (!fs.existsSync(absolute)) return { ok: false, stderr: `missing ${relativePath}` }
  return run('psql', [...connectionArgs(database), '--file', absolute])
}

function schemaFingerprint(database) {
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
  select 'function|' || n.nspname || '|' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|' || p.prosecdef || '|' || coalesce(array_to_string(p.proacl, ','), '') || '|' || pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
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
    (select count(*) from public.identity_match_proposals),
    (select count(*) from public.identity_decision_events)
  );`)
}

function decisionSql(proposalId, action, reason = 'rehearsal', overrides = {}) {
  const proposalTimestamp = overrides.proposalTimestamp || `(select updated_at from public.identity_match_proposals where id = '${proposalId}')`
  const sourceTimestamp = overrides.sourceTimestamp || `(select sp.updated_at from public.source_profiles sp join public.identity_match_proposals p on p.source_profile_id = sp.id where p.id = '${proposalId}')`
  return `select public.decide_identity_match_proposal(
    '${OWNER_A}', '${proposalId}', '${action}', '${OWNER_A}',
    ${proposalTimestamp}, ${sourceTimestamp}, '${reason.replaceAll("'", "''")}'
  )::text;`
}

function parseJsonOutput(output) {
  const line = output.split(/\r?\n/).map(value => value.trim()).filter(value => value.startsWith('{')).at(-1)
  if (!line) throw new Error(`No JSON result in psql output: ${output}`)
  return JSON.parse(line)
}

function callDecision(database, proposalId, action, reason, overrides) {
  return parseJsonOutput(query(database, decisionSql(proposalId, action, reason, overrides)))
}

function callRollback(database, eventId, reason = 'rollback rehearsal') {
  return parseJsonOutput(query(database, `select public.revert_identity_decision('${OWNER_A}', '${eventId}', '${OWNER_A}', '${reason.replaceAll("'", "''")}')::text;`))
}

function runAsyncPsql(database, sql) {
  return new Promise(resolve => {
    const child = spawn('psql', [...connectionArgs(database), '--tuples-only', '--no-align'], {
      cwd: ROOT,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', status => resolve({ ok: status === 0, status, stdout, stderr }))
    child.stdin.end(sql)
  })
}

async function concurrentApproval(database) {
  const sqlA = `begin; select 1 from public.identity_match_proposals where id = '${ids.concurrencyProposalA}' for update; select pg_sleep(1); ${decisionSql(ids.concurrencyProposalA, 'approve', 'concurrency A')} commit;`
  const sqlB = `begin; select 1 from public.identity_match_proposals where id = '${ids.concurrencyProposalB}' for update; select pg_sleep(1); ${decisionSql(ids.concurrencyProposalB, 'approve', 'concurrency B')} commit;`
  return Promise.all([runAsyncPsql(database, sqlA), runAsyncPsql(database, sqlB)])
}

function seed(database) {
  execute(database, `
insert into auth.users(id, email) values
  ('${OWNER_A}', 'owner-a@example.test'),
  ('${OWNER_B}', 'owner-b@example.test');

insert into public.candidates(id, owner_id, canonical_name) values
  ('${ids.previous}', '${OWNER_A}', 'Previous Candidate'),
  ('${ids.target}', '${OWNER_A}', 'Target Candidate'),
  ('${ids.alternate}', '${OWNER_A}', 'Alternate Candidate'),
  ('${ids.rolePrevious}', '${OWNER_A}', 'Role Previous'),
  ('${ids.roleTarget}', '${OWNER_A}', 'Role Target'),
  ('${ids.keepPrevious}', '${OWNER_A}', 'Keep Previous'),
  ('${ids.keepTarget}', '${OWNER_A}', 'Keep Target'),
  ('${ids.rejectPrevious}', '${OWNER_A}', 'Reject Previous'),
  ('${ids.rejectTarget}', '${OWNER_A}', 'Reject Target'),
  ('${ids.blockPrevious}', '${OWNER_A}', 'Block Previous'),
  ('${ids.blockTarget}', '${OWNER_A}', 'Block Target'),
  ('${ids.stalePrevious}', '${OWNER_A}', 'Stale Previous'),
  ('${ids.staleTarget}', '${OWNER_A}', 'Stale Target'),
  ('${ids.concurrencyPrevious}', '${OWNER_A}', 'Concurrency Previous'),
  ('${ids.concurrencyTargetA}', '${OWNER_A}', 'Concurrency Target A'),
  ('${ids.concurrencyTargetB}', '${OWNER_A}', 'Concurrency Target B'),
  ('10000000-0000-4000-8000-000000000099', '${OWNER_B}', 'Other Owner Candidate');

insert into public.source_profiles(id, owner_id, candidate_id, source, source_profile_id, display_name) values
  ('${ids.profile}', '${OWNER_A}', '${ids.previous}', 'github', 'happy-profile', 'Happy Profile'),
  ('${ids.roleProfile}', '${OWNER_A}', '${ids.rolePrevious}', 'github', 'role-profile', 'Role Profile'),
  ('${ids.keepProfile}', '${OWNER_A}', '${ids.keepPrevious}', 'github', 'keep-profile', 'Keep Profile'),
  ('${ids.rejectProfile}', '${OWNER_A}', '${ids.rejectPrevious}', 'github', 'reject-profile', 'Reject Profile'),
  ('${ids.blockProfile}', '${OWNER_A}', '${ids.blockPrevious}', 'github', 'block-profile', 'Block Profile'),
  ('${ids.staleProfile}', '${OWNER_A}', '${ids.stalePrevious}', 'github', 'stale-profile', 'Stale Profile'),
  ('${ids.concurrencyProfile}', '${OWNER_A}', '${ids.concurrencyPrevious}', 'github', 'concurrency-profile', 'Concurrency Profile');

insert into public.identity_match_proposals(id, owner_id, source_profile_id, candidate_id, decision_class, score, resolver_version, conflicts) values
  ('${ids.proposal}', '${OWNER_A}', '${ids.profile}', '${ids.target}', 'high_priority_review', 0.91, 'v29.3a3-test', '[]'),
  ('${ids.competingProposal}', '${OWNER_A}', '${ids.profile}', '${ids.alternate}', 'standard_review', 0.72, 'v29.3a3-test', '[]'),
  ('${ids.roleProposal}', '${OWNER_A}', '${ids.roleProfile}', '${ids.roleTarget}', 'high_priority_review', 0.90, 'v29.3a3-test', '[]'),
  ('${ids.keepProposal}', '${OWNER_A}', '${ids.keepProfile}', '${ids.keepTarget}', 'standard_review', 0.60, 'v29.3a3-test', '[]'),
  ('${ids.rejectProposal}', '${OWNER_A}', '${ids.rejectProfile}', '${ids.rejectTarget}', 'standard_review', 0.55, 'v29.3a3-test', '[]'),
  ('${ids.blockProposal}', '${OWNER_A}', '${ids.blockProfile}', '${ids.blockTarget}', 'high_priority_review', 0.95, 'v29.3a3-test', '[{"type":"email_conflict","severity":"blocking","explanation":"Different observed emails"}]'),
  ('${ids.staleProposal}', '${OWNER_A}', '${ids.staleProfile}', '${ids.staleTarget}', 'standard_review', 0.64, 'v29.3a3-test', '[]'),
  ('${ids.concurrencyProposalA}', '${OWNER_A}', '${ids.concurrencyProfile}', '${ids.concurrencyTargetA}', 'high_priority_review', 0.88, 'v29.3a3-test', '[]'),
  ('${ids.concurrencyProposalB}', '${OWNER_A}', '${ids.concurrencyProfile}', '${ids.concurrencyTargetB}', 'high_priority_review', 0.87, 'v29.3a3-test', '[]');

insert into public.evidence_items(owner_id, candidate_id, source_profile_id, source, label, detail) values
  ('${OWNER_A}', '${ids.previous}', '${ids.profile}', 'github', 'Repository evidence', 'Tied evidence'),
  ('${OWNER_A}', '${ids.previous}', null, 'resume_xray', 'Independent evidence', 'Must remain on provisional candidate');
insert into public.candidate_contacts(owner_id, candidate_id, source_profile_id, type, value, source) values
  ('${OWNER_A}', '${ids.previous}', '${ids.profile}', 'email', 'public@example.test', 'github');
insert into public.open_to_work_signals(owner_id, candidate_id, source_profile_id, source, label, detail) values
  ('${OWNER_A}', '${ids.previous}', '${ids.profile}', 'github', 'Availability signal', 'Public profile wording');
insert into public.evidence_claims(owner_id, candidate_id, source_profile_id, field_name, claimed_value, source) values
  ('${OWNER_A}', '${ids.previous}', '${ids.profile}', 'current_title', 'Platform Engineer', 'github');

insert into public.projects(id, owner_id, name) values ('${ids.project}', '${OWNER_A}', 'Role state guard');
insert into public.project_candidates(project_id, candidate_id, owner_id) values ('${ids.project}', '${ids.rolePrevious}', '${OWNER_A}');
`)
}

async function main() {
  for (const command of ['psql', 'createdb', 'dropdb']) {
    assert(run('bash', ['-lc', `command -v ${command}`]).ok, `required command is available: ${command}`)
  }

  const report = { assertions, schema: {}, results: {}, fingerprints: {}, canonicalCounts: {}, concurrency: {} }

  const emptyDb = `${PREFIX}_empty`
  createDatabase(emptyDb)
  const empty = apply(emptyDb, DECISIONS)
  assert(!empty.ok, 'decision migration fails closed without durable identity foundation')

  const db = `${PREFIX}_apply`
  createDatabase(db)
  execute(db, BOOTSTRAP)
  for (const file of PRODUCTION_SEQUENCE) assert(apply(db, file).ok, `production reconstruction applies: ${file}`)
  assert(apply(db, BASELINE).ok, 'canonical baseline applies')
  assert(apply(db, IDENTITY).ok, 'durable identity foundation applies')

  report.canonicalCounts.before = canonicalCounts(db)
  assert(apply(db, DECISIONS).ok, 'transactional identity decision migration applies')
  report.canonicalCounts.afterFirst = canonicalCounts(db)
  assert(report.canonicalCounts.before === report.canonicalCounts.afterFirst, 'decision migration changes no canonical rows')

  report.schema.tableExists = query(db, `select to_regclass('public.identity_decision_events') is not null;`) === 't'
  report.schema.rls = query(db, `select relrowsecurity from pg_class where oid = 'public.identity_decision_events'::regclass;`) === 't'
  report.schema.browserWrites = Number(query(db, `select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='identity_decision_events' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');`))
  report.schema.securityDefiner = Number(query(db, `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('decide_identity_match_proposal','revert_identity_decision') and p.prosecdef;`))
  report.schema.authenticatedExecute = Number(query(db, `select count(*) from information_schema.routine_privileges where routine_schema='public' and routine_name in ('decide_identity_match_proposal','revert_identity_decision') and grantee='authenticated' and privilege_type='EXECUTE';`))
  report.schema.serviceExecute = Number(query(db, `select count(*) from information_schema.routine_privileges where routine_schema='public' and routine_name in ('decide_identity_match_proposal','revert_identity_decision') and grantee='service_role' and privilege_type='EXECUTE';`))
  assert(report.schema.tableExists, 'decision event table exists')
  assert(report.schema.rls, 'decision event table has RLS')
  assert(report.schema.browserWrites === 0, 'browser roles have no decision-event writes')
  assert(report.schema.securityDefiner === 2, 'both transaction RPCs are security definer')
  assert(report.schema.authenticatedExecute === 0, 'authenticated browser role cannot execute decision RPCs')
  assert(report.schema.serviceExecute === 2, 'service role can execute both decision RPCs')

  report.fingerprints.afterFirst = schemaFingerprint(db)
  assert(apply(db, DECISIONS).ok, 'transaction migration replays idempotently')
  report.fingerprints.afterSecond = schemaFingerprint(db)
  report.canonicalCounts.afterSecond = canonicalCounts(db)
  assert(report.fingerprints.afterFirst === report.fingerprints.afterSecond, 'decision replay preserves schema and function fingerprint')
  assert(report.canonicalCounts.before === report.canonicalCounts.afterSecond, 'decision replay preserves canonical row counts')

  seed(db)

  report.results.precondition = callDecision(db, ids.staleProposal, 'approve', 'missing preconditions', { proposalTimestamp: 'null', sourceTimestamp: 'null' })
  assert(report.results.precondition.code === 'identity_decision_precondition_required', 'blind decision is rejected')

  report.results.staleProposal = callDecision(db, ids.staleProposal, 'approve', 'stale proposal', { proposalTimestamp: `'2000-01-01'::timestamptz` })
  assert(report.results.staleProposal.code === 'identity_proposal_stale', 'stale proposal timestamp is rejected')
  report.results.staleSource = callDecision(db, ids.staleProposal, 'approve', 'stale source', { sourceTimestamp: `'2000-01-01'::timestamptz` })
  assert(report.results.staleSource.code === 'identity_source_profile_stale', 'stale source-profile timestamp is rejected')

  report.results.blocking = callDecision(db, ids.blockProposal, 'approve', 'blocking conflict')
  assert(report.results.blocking.code === 'identity_blocking_conflict', 'blocking negative evidence prevents approval')

  report.results.roleState = callDecision(db, ids.roleProposal, 'approve', 'role state guard')
  assert(report.results.roleState.code === 'identity_provisional_candidate_has_role_state', 'candidate role state prevents source reassignment')

  report.results.crossOwnerActor = parseJsonOutput(query(db, `select public.decide_identity_match_proposal('${OWNER_A}', '${ids.keepProposal}', 'reject', '${OWNER_B}', (select updated_at from public.identity_match_proposals where id='${ids.keepProposal}'), (select updated_at from public.source_profiles where id='${ids.keepProfile}'), 'cross owner')::text;`))
  assert(report.results.crossOwnerActor.code === 'identity_actor_not_authorized', 'cross-owner actor is rejected')
  report.results.crossOwnerLookup = parseJsonOutput(query(db, `select public.decide_identity_match_proposal('${OWNER_B}', '${ids.keepProposal}', 'reject', '${OWNER_B}', now(), now(), 'cross owner lookup')::text;`))
  assert(report.results.crossOwnerLookup.code === 'identity_proposal_not_found', 'owner scope hides another owner proposal')

  report.results.keepSeparate = callDecision(db, ids.keepProposal, 'keep_separate', 'distinct people')
  assert(report.results.keepSeparate.code === 'identity_profiles_kept_separate', 'keep-separate decision applies')
  assert(query(db, `select status from public.identity_match_proposals where id='${ids.keepProposal}';`) === 'rejected', 'keep-separate records rejected proposal status')
  assert(query(db, `select candidate_id from public.source_profiles where id='${ids.keepProfile}';`) === ids.keepPrevious, 'keep-separate does not move source profile')
  report.results.keepRollback = callRollback(db, report.results.keepSeparate.eventId)
  assert(report.results.keepRollback.ok === true, 'keep-separate rollback succeeds')
  assert(query(db, `select status from public.identity_match_proposals where id='${ids.keepProposal}';`) === 'pending', 'keep-separate rollback restores pending proposal')

  report.results.reject = callDecision(db, ids.rejectProposal, 'reject', 'insufficient evidence')
  assert(report.results.reject.code === 'identity_proposal_rejected', 'reject decision applies')
  report.results.rejectRollback = callRollback(db, report.results.reject.eventId)
  assert(report.results.rejectRollback.ok === true, 'reject rollback succeeds')

  report.results.approve = callDecision(db, ids.proposal, 'approve', 'same person confirmed')
  assert(report.results.approve.code === 'identity_proposal_approved', 'approval succeeds')
  assert(query(db, `select candidate_id || '|' || status from public.source_profiles where id='${ids.profile}';`) === `${ids.target}|confirmed`, 'approval attaches source profile to canonical candidate')
  for (const table of ['evidence_items', 'candidate_contacts', 'open_to_work_signals', 'evidence_claims']) {
    assert(query(db, `select candidate_id from public.${table} where source_profile_id='${ids.profile}' limit 1;`) === ids.target, `approval moves source-tied ${table}`)
  }
  assert(query(db, `select candidate_id from public.evidence_items where source_profile_id is null and label='Independent evidence';`) === ids.previous, 'approval leaves independent provisional evidence untouched')
  assert(query(db, `select count(*) from public.candidates where id='${ids.previous}';`) === '1', 'approval preserves provisional candidate')
  assert(query(db, `select status from public.identity_match_proposals where id='${ids.competingProposal}';`) === 'superseded', 'approval supersedes competing pending proposals')

  report.results.approveRollback = callRollback(db, report.results.approve.eventId)
  assert(report.results.approveRollback.ok === true, 'approval rollback succeeds')
  assert(query(db, `select candidate_id || '|' || status from public.source_profiles where id='${ids.profile}';`) === `${ids.previous}|pending`, 'approval rollback restores source profile')
  for (const table of ['evidence_items', 'candidate_contacts', 'open_to_work_signals', 'evidence_claims']) {
    assert(query(db, `select candidate_id from public.${table} where source_profile_id='${ids.profile}' limit 1;`) === ids.previous, `approval rollback restores source-tied ${table}`)
  }
  assert(query(db, `select status from public.identity_match_proposals where id='${ids.proposal}';`) === 'superseded', 'reverted approval requires a fresh proposal')
  report.results.secondRollback = callRollback(db, report.results.approve.eventId)
  assert(report.results.secondRollback.code === 'identity_decision_already_reverted', 'decision cannot be reverted twice')

  report.concurrency.sessions = await concurrentApproval(db)
  assert(report.concurrency.sessions.every(session => session.ok), 'competing approval sessions complete without deadlock')
  report.concurrency.results = report.concurrency.sessions.map(session => parseJsonOutput(session.stdout))
  const approved = report.concurrency.results.filter(result => result.code === 'identity_proposal_approved').length
  const safelyBlocked = report.concurrency.results.filter(result => ['identity_source_has_active_approval', 'identity_proposal_not_pending'].includes(result.code)).length
  assert(approved === 1 && safelyBlocked === 1, 'exactly one concurrent approval wins and the other fails closed')
  assert(query(db, `select count(*) from public.identity_decision_events where source_profile_id='${ids.concurrencyProfile}' and action='approve' and event_status='applied';`) === '1', 'concurrency creates one active approval event')

  const eventCrossOwner = run('psql', [...connectionArgs(db), '--command', `insert into public.identity_decision_events(owner_id, proposal_id, action, source_profile_id, target_candidate_id, previous_source_status, actor_id) values ('${OWNER_B}', '${ids.staleProposal}', 'reject', '${ids.staleProfile}', '10000000-0000-4000-8000-000000000099', 'pending', '${OWNER_B}');`])
  assert(!eventCrossOwner.ok, 'composite foreign keys reject cross-owner decision events')

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`decision report written to ${REPORT_PATH}`)
  console.log(`assertions: ${assertions.filter(item => item.ok).length}/${assertions.length} passed`)
}

main()
  .catch(error => {
    console.error(`IDENTITY DECISION HARNESS ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
  .finally(() => {
    for (const database of [...createdDatabases]) dropDatabase(database)
  })
