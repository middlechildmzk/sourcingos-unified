// ─────────────────────────────────────────────────────────────────────────────
// V29.3A0 migration ledger reconciliation contract tests.
//
// These follow the repository convention for SQL contract tests: deterministic
// assertions over file contents and the declared manifest, with no live
// database dependency in the suite. The PostgreSQL 17 replay rehearsal lives in
// scripts/migration-replay.js and is run as a release gate, not in vitest.
//
// The purpose is to make schema drift loud. If someone adds a SQL file, changes
// an application method, or fixes a replay hazard without updating the
// manifest, one of these fails.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_SQL_RECORDS,
  CANONICAL_TABLES,
  ORPHANED_SQL,
  PENDING_REPO_MIGRATIONS,
  PRODUCTION_LEDGER_ENTRIES,
  PRODUCTION_SEQUENCE,
  isLedgerReplaySafe,
  replayUnsafeFiles,
} from '../lib/migration-manifest'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '')

describe('V29.3A0 - the manifest matches the files on disk', () => {
  it('accounts for every SQL file in both directories', () => {
    const onDisk = [
      ...readdirSync(join(root, 'sql')).filter(f => f.endsWith('.sql')).map(f => `sql/${f}`),
      ...readdirSync(join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).map(f => `supabase/migrations/${f}`),
    ].sort()

    const declared = ALL_SQL_RECORDS.map(r => r.file).sort()
    expect(declared).toEqual(onDisk)
  })

  it('points every manifest entry at a file that exists', () => {
    for (const record of ALL_SQL_RECORDS) {
      expect(existsSync(join(root, record.file)), `missing ${record.file}`).toBe(true)
    }
  })

  it('gives the production sequence a contiguous order starting at 1', () => {
    const orders = PRODUCTION_SEQUENCE.map(r => r.order)
    expect(orders).toEqual(orders.map((_, i) => i + 1))
  })
})

describe('V29.3A0 - the repository reconciles against the production ledger', () => {
  it('maps every production ledger entry to exactly one repository file', () => {
    for (const entry of PRODUCTION_LEDGER_ENTRIES) {
      const matches = PRODUCTION_SEQUENCE.filter(r => r.ledgerName === entry)
      expect(matches, `ledger entry ${entry} has no unique repository file`).toHaveLength(1)
    }
  })

  it('records no ledger entry that production does not have', () => {
    const claimed = PRODUCTION_SEQUENCE.map(r => r.ledgerName).filter(Boolean)
    for (const name of claimed) {
      expect(PRODUCTION_LEDGER_ENTRIES).toContain(name as (typeof PRODUCTION_LEDGER_ENTRIES)[number])
    }
  })

  it('shows that no ledger migration came from the versioned migrations directory', () => {
    const ledgerFiles = PRODUCTION_SEQUENCE.filter(r => r.method === 'ledger').map(r => r.file)
    expect(ledgerFiles.length).toBe(PRODUCTION_LEDGER_ENTRIES.length)
    expect(ledgerFiles.every(f => f.startsWith('sql/'))).toBe(true)
    expect(ledgerFiles.some(f => f.startsWith('supabase/migrations/'))).toBe(false)
  })

  it('shows that every versioned migration is still unapplied', () => {
    const versioned = ALL_SQL_RECORDS.filter(r => r.file.startsWith('supabase/migrations/'))
    expect(versioned.length).toBeGreaterThan(0)
    expect(versioned.every(r => r.method === 'unapplied')).toBe(true)
    expect(PENDING_REPO_MIGRATIONS.map(r => r.file).sort()).toEqual(versioned.map(r => r.file).sort())
  })

  it('records that the candidate graph was applied outside the ledger', () => {
    const manual = PRODUCTION_SEQUENCE.filter(r => r.method === 'manual_sql_editor')
    expect(manual.map(r => r.file)).toEqual([
      'sql/complete-schema-v19.sql',
      'sql/rls-policies-v19.sql',
    ])
    const checklist = read('sql/MIGRATION-CHECKLIST.md')
    expect(checklist).toContain('complete-schema-v19.sql')
    expect(checklist).toContain('rls-policies-v19.sql')
    expect(checklist.toLowerCase()).toContain('supabase sql editor')
  })
})

describe('V29.3A0 - replay safety is measured, not assumed', () => {
  it('pins the exact set of replay-unsafe production files', () => {
    expect(replayUnsafeFiles().map(r => r.file).sort()).toEqual([
      'sql/agent-os-v23-v25.sql',
      'sql/autosource-v22.sql',
      'sql/candidate-acquisition-v21.sql',
      'sql/complete-schema-v19.sql',
      'sql/rls-policies-v19.sql',
    ])
  })

  it('reports the ledger as not yet replay-safe', () => {
    expect(isLedgerReplaySafe()).toBe(false)
  })

  it('attributes every replay failure to an unguarded policy or trigger', () => {
    for (const record of replayUnsafeFiles()) {
      const sql = stripComments(read(record.file)).toLowerCase()
      const createPolicies = (sql.match(/create policy/g) || []).length
      const dropPolicyGuards = (sql.match(/drop policy if exists/g) || []).length
      const createTriggers = (sql.match(/create trigger/g) || []).length
      const dropTriggerGuards = (sql.match(/drop trigger if exists/g) || []).length

      const unguarded = (createPolicies - dropPolicyGuards) + (createTriggers - dropTriggerGuards)
      expect(unguarded, `${record.file} should have an unguarded object`).toBeGreaterThan(0)
    }
  })

  it('confirms the replay-safe files use the drop-then-create guard', () => {
    const safe = PRODUCTION_SEQUENCE.filter(r => r.replaySafety === 'replay_safe')
    for (const record of safe) {
      const sql = stripComments(read(record.file)).toLowerCase()
      const createPolicies = (sql.match(/create policy/g) || []).length
      const dropPolicyGuards = (sql.match(/drop policy if exists/g) || []).length
      expect(dropPolicyGuards, `${record.file} guards every policy`).toBeGreaterThanOrEqual(createPolicies)
    }
  })

  it('keeps every table creation behind IF NOT EXISTS', () => {
    for (const record of PRODUCTION_SEQUENCE) {
      const sql = stripComments(read(record.file)).toLowerCase()
      const creates = (sql.match(/create table/g) || []).length
      const guarded = (sql.match(/create table if not exists/g) || []).length
      expect(guarded, `${record.file} guards every create table`).toBe(creates)
    }
  })

  it('flags the single production file wrapped in an explicit transaction', () => {
    const wrapped = PRODUCTION_SEQUENCE.filter(r => /^\s*begin;/im.test(read(r.file)))
    expect(wrapped.map(r => r.file)).toEqual(['sql/autosource-v22.sql'])
  })
})

describe('V29.3A0 - canonical table contract for V29.3A1', () => {
  it('sources each canonical table from the file that actually defines it', () => {
    for (const [table, meta] of Object.entries(CANONICAL_TABLES)) {
      const sql = stripComments(read(meta.source)).toLowerCase()
      expect(sql, `${meta.source} should define ${table}`).toContain(`create table if not exists public.${table}`)
    }
  })

  it('records evidence_claims as absent from production', () => {
    expect(CANONICAL_TABLES.evidence_claims.present).toBe(false)
    const orphanFiles = ORPHANED_SQL.map(r => r.file)
    expect(orphanFiles).toContain(CANONICAL_TABLES.evidence_claims.source)
  })

  it('preserves the source_profiles idempotency key that exact source reuse depends on', () => {
    const sql = stripComments(read('sql/complete-schema-v19.sql')).toLowerCase()
    expect(sql).toMatch(/unique\s*\(owner_id,\s*source,\s*source_profile_id\)/)
  })

  it('preserves the contact verification guardrail at schema level', () => {
    const sql = stripComments(read('sql/complete-schema-v19.sql')).toLowerCase()
    expect(sql).toMatch(/verified\s+boolean\s+not null default false/)
    expect(sql).toMatch(/check\s*\(\s*verified\s*=\s*false\s*\)/)
  })

  it('keeps talent_graph_edges outside canonical identity resolution', () => {
    expect(CANONICAL_TABLES.talent_graph_edges.source).toBe('sql/agent-os-v23-v25.sql')
    const identityFiles = [
      'sql/complete-schema-v19.sql',
      'sql/candidate-intelligence-spine-v19.sql',
    ]
    for (const file of identityFiles) {
      expect(stripComments(read(file)).toLowerCase()).not.toContain('talent_graph_edges')
    }
  })
})

describe('V29.3A0 - orphan classification', () => {
  it('classifies the superseded candidate graph scaffolds as incompatible', () => {
    const incompatible = ORPHANED_SQL.filter(r => r.replaySafety === 'incompatible').map(r => r.file)
    expect(incompatible.sort()).toEqual([
      'sql/candidate-graph-schema-v17-3.sql',
      'sql/candidate-graph-schema.sql',
    ])
  })

  it('flags candidate-graph-v18 as table-shape no-op with secondary-object drift', () => {
    const v18 = ORPHANED_SQL.find(r => r.file === 'sql/candidate-graph-v18.sql')
    expect(v18?.replaySafety).toBe('table_shape_no_op_secondary_drift')
    const sql = stripComments(read('sql/candidate-graph-v18.sql')).toLowerCase()
    const creates = (sql.match(/create table/g) || []).length
    const guarded = (sql.match(/create table if not exists/g) || []).length
    const indexes = (sql.match(/create index if not exists/g) || []).length
    expect(guarded).toBe(creates)
    expect(creates).toBeGreaterThan(0)
    expect(indexes).toBeGreaterThan(0)
  })

  it('does not put any orphan in the production sequence', () => {
    const sequenceFiles = new Set(PRODUCTION_SEQUENCE.map(r => r.file))
    for (const orphan of ORPHANED_SQL) {
      expect(sequenceFiles.has(orphan.file)).toBe(false)
    }
  })
})

describe('V29.3A0 - replay gate is reproducible in CI', () => {
  it('exposes the replay command without an undeclared runtime dependency', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts?.['migration:replay']).toBe('node scripts/migration-replay.js')
    const replay = read('scripts/migration-replay.js')
    expect(replay).not.toContain("require('embedded-postgres')")
    expect(replay).toContain("require('node:child_process')")
  })

  it('runs the replay harness against the PostgreSQL 17 CI service', () => {
    const workflow = read('../.github/workflows/next-public-ci.yml')
    expect(workflow).toContain('image: postgres:17')
    expect(workflow).toContain('npm run migration:replay')
  })

  it('fails closed when measured outcomes drift', () => {
    const replay = read('scripts/migration-replay.js')
    expect(replay).toContain('EXPECTED_REPLAY_UNSAFE')
    expect(replay).toContain('ORPHAN_EXPECTATIONS')
    expect(replay).toContain('tableShapeFingerprint')
    expect(replay).toContain('fullSchemaFingerprint')
    expect(replay).toContain('Assertion failed:')
    expect(replay).toContain('process.exitCode = 1')
  })
})
