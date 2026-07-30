// ─────────────────────────────────────────────────────────────────────────────
// V29.3A0.1 migration replay-safety and quarantine contract tests.
//
// These tests keep repository state deterministic. PostgreSQL behavior is
// verified separately by scripts/migration-replay-remediated.js in CI.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALL_SQL_RECORDS,
  CANONICAL_TABLES,
  HELD_REPO_MIGRATIONS,
  ORPHANED_SQL,
  PRODUCTION_LEDGER_ENTRIES,
  PRODUCTION_SEQUENCE,
  RECONCILIATION_SUPPORT,
  isLedgerReplaySafe,
  isRawHistoricalReplaySafe,
  rawReplayGuardedFiles,
} from '../lib/migration-manifest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')
const sqlFiles = (relativeDirectory: string) => {
  const directory = join(root, relativeDirectory)
  if (!existsSync(directory)) return []
  return readdirSync(directory)
    .filter(file => file.endsWith('.sql'))
    .map(file => `${relativeDirectory}/${file}`)
}

const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, '')
const normalize = (value: string) => value.toLowerCase().replace(/["']/g, '').replace(/\s+/g, ' ').trim()

function createdPolicies(sql: string): Array<{ name: string; table: string }> {
  const result: Array<{ name: string; table: string }> = []
  const expression = /create\s+policy\s+("[^"]+"|[a-zA-Z0-9_]+)\s+on\s+([a-zA-Z0-9_.]+)/gi
  for (const match of stripComments(sql).matchAll(expression)) {
    result.push({ name: normalize(match[1]), table: normalize(match[2]) })
  }
  return result
}

describe('V29.3A0.1 - manifest accounts for every SQL artifact', () => {
  it('accounts for historical, support, held, and orphan SQL', () => {
    const onDisk = [
      ...sqlFiles('sql'),
      ...sqlFiles('supabase/migrations'),
      ...sqlFiles('supabase/held-migrations'),
    ].sort()
    const declared = ALL_SQL_RECORDS.map(record => record.file).sort()
    expect(declared).toEqual(onDisk)
  })

  it('points every manifest record at an existing file', () => {
    for (const record of ALL_SQL_RECORDS) {
      expect(existsSync(join(root, record.file)), `missing ${record.file}`).toBe(true)
    }
  })

  it('keeps the production sequence ordered from one through eight', () => {
    expect(PRODUCTION_SEQUENCE.map(record => record.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('V29.3A0.1 - production ledger reconciliation remains intact', () => {
  it('maps every production ledger entry to one historical SQL file', () => {
    for (const ledgerName of PRODUCTION_LEDGER_ENTRIES) {
      expect(PRODUCTION_SEQUENCE.filter(record => record.ledgerName === ledgerName)).toHaveLength(1)
    }
  })

  it('does not invent remote ledger entries', () => {
    const claimed = PRODUCTION_SEQUENCE.map(record => record.ledgerName).filter(Boolean)
    expect(claimed.sort()).toEqual([...PRODUCTION_LEDGER_ENTRIES].sort())
  })

  it('retains the two manual SQL-editor baseline files', () => {
    expect(PRODUCTION_SEQUENCE.filter(record => record.method === 'manual_sql_editor').map(record => record.file)).toEqual([
      'sql/complete-schema-v19.sql',
      'sql/rls-policies-v19.sql',
    ])
  })
})

describe('V29.3A0.1 - active migration directory is fail-closed', () => {
  it('contains no SQL migration eligible for an accidental db push', () => {
    expect(sqlFiles('supabase/migrations')).toEqual([])
  })

  it('preserves all three unapplied migrations in the held directory', () => {
    expect(HELD_REPO_MIGRATIONS.map(record => record.file).sort()).toEqual([
      'supabase/held-migrations/20260701173000_jobs_v2_foundation.sql',
      'supabase/held-migrations/20260721173000_role_workspace_owner_safety.sql',
      'supabase/held-migrations/20260722160000_role_calibration_state.sql',
    ])
    expect(HELD_REPO_MIGRATIONS.every(record => record.method === 'held')).toBe(true)
  })

  it('documents why each held migration cannot be activated implicitly', () => {
    const readme = read('supabase/held-migrations/README.md')
    for (const record of HELD_REPO_MIGRATIONS) {
      expect(readme).toContain(record.file.split('/').at(-1))
    }
    expect(readme).toContain('not active migrations')
    expect(readme).toContain('explicit production approval')
  })
})

describe('V29.3A0.1 - reconstruction replay is safe as a declared composite', () => {
  it('keeps the five raw historical hazards visible', () => {
    expect(rawReplayGuardedFiles().map(record => record.file).sort()).toEqual([
      'sql/agent-os-v23-v25.sql',
      'sql/autosource-v22.sql',
      'sql/candidate-acquisition-v21.sql',
      'sql/complete-schema-v19.sql',
      'sql/rls-policies-v19.sql',
    ])
    expect(isRawHistoricalReplaySafe()).toBe(false)
  })

  it('declares the guarded eight-file reconstruction replay-safe', () => {
    expect(isLedgerReplaySafe()).toBe(true)
    expect(RECONCILIATION_SUPPORT.map(record => record.file)).toContain('sql/replay-safety-guards-v29-3a0.sql')
  })

  it('keeps the replay guard outside the active migration directory', () => {
    const guard = RECONCILIATION_SUPPORT[0]
    expect(guard.method).toBe('reconciliation_support')
    expect(guard.file.startsWith('supabase/migrations/')).toBe(false)
    expect(read(guard.file)).toContain('NOT a production migration')
  })

  it('guards every policy recreated by the five raw-unsafe files', () => {
    const guard = normalize(read('sql/replay-safety-guards-v29-3a0.sql'))
    const policies = rawReplayGuardedFiles().flatMap(record => createdPolicies(read(record.file)))
    expect(policies).toHaveLength(33)
    for (const policy of policies) {
      expect(
        guard,
        `guard must drop policy ${policy.name} on ${policy.table}`,
      ).toContain(`drop policy if exists ${policy.name} on ${policy.table}`)
    }
  })

  it('guards every V19 trigger that was previously unguarded', () => {
    const guard = normalize(read('sql/replay-safety-guards-v29-3a0.sql'))
    const expected = [
      'drop trigger if exists set_updated_at_profiles on public.profiles',
      'drop trigger if exists set_updated_at_projects on public.projects',
      'drop trigger if exists set_updated_at_candidates on public.candidates',
      'drop trigger if exists set_updated_at_project_candidates on public.project_candidates',
      'drop trigger if exists set_updated_at_pipeline_entries on public.pipeline_entries',
      'drop trigger if exists set_updated_at_source_profiles on public.source_profiles',
    ]
    for (const statement of expected) expect(guard).toContain(statement)
  })
})

describe('V29.3A0.1 - canonical identity contract is unchanged', () => {
  it('keeps exact-source idempotency in source_profiles', () => {
    expect(stripComments(read('sql/complete-schema-v19.sql')).toLowerCase()).toMatch(
      /unique\s*\(owner_id,\s*source,\s*source_profile_id\)/,
    )
  })

  it('keeps contact verification fail-closed in the schema', () => {
    const schema = stripComments(read('sql/complete-schema-v19.sql')).toLowerCase()
    expect(schema).toMatch(/verified\s+boolean\s+not null default false/)
    expect(schema).toMatch(/check\s*\(\s*verified\s*=\s*false\s*\)/)
  })

  it('keeps evidence_claims absent and talent_graph_edges separate', () => {
    expect(CANONICAL_TABLES.evidence_claims.present).toBe(false)
    expect(CANONICAL_TABLES.talent_graph_edges.present).toBe(true)
    expect(CANONICAL_TABLES.talent_graph_edges.source).toBe('sql/agent-os-v23-v25.sql')
  })
})

describe('V29.3A0.1 - orphan classifications remain honest', () => {
  it('classifies the two text-ID scaffolds as incompatible', () => {
    expect(ORPHANED_SQL.filter(record => record.replaySafety === 'incompatible').map(record => record.file).sort()).toEqual([
      'sql/candidate-graph-schema-v17-3.sql',
      'sql/candidate-graph-schema.sql',
    ])
  })

  it('describes V18 as table-shape no-op with secondary drift', () => {
    expect(ORPHANED_SQL.find(record => record.file === 'sql/candidate-graph-v18.sql')?.replaySafety)
      .toBe('table_shape_no_op_secondary_drift')
  })
})

describe('V29.3A0.1 - CI executes the remediated gate', () => {
  it('keeps the reconciliation harness and promotes the guarded harness', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts['migration:reconcile']).toBe('node scripts/migration-replay.js')
    expect(pkg.scripts['migration:replay']).toBe('node scripts/migration-replay-remediated.js')
  })

  it('uses PostgreSQL 17 and the promoted migration:replay command in CI', () => {
    const workflow = read('../.github/workflows/next-public-ci.yml')
    expect(workflow).toContain('image: postgres:17')
    expect(workflow).toContain('npm run migration:replay')
  })

  it('fails closed and fingerprints the schema before and after guarded replay', () => {
    const replay = read('scripts/migration-replay-remediated.js')
    expect(replay).toContain('process.exitCode = 1')
    expect(replay).toContain('beforeGuardedReplay')
    expect(replay).toContain('afterGuardedReplay')
    expect(replay).toContain('active supabase/migrations directory contains no SQL files')
  })
})
