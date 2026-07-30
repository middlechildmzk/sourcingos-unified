import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_BASELINE_MIGRATIONS,
  ACTIVE_IDENTITY_MIGRATIONS,
  ACTIVE_REPO_MIGRATIONS,
  ALL_SQL_RECORDS,
  CANONICAL_TABLES,
  HELD_REPO_MIGRATIONS,
  IDENTITY_FOUNDATION_TABLES,
  ORPHANED_SQL,
  PRODUCTION_LEDGER_ENTRIES,
  PRODUCTION_SEQUENCE,
  RECONCILIATION_SUPPORT,
  isIdentityFoundationRehearsable,
  isLedgerReplaySafe,
  isMigrationHistoryAlignable,
  isRawHistoricalReplaySafe,
  rawReplayGuardedFiles,
} from '../lib/migration-manifest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')
const sqlFiles = (directory: string) => {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute).filter(file => file.endsWith('.sql')).map(file => `${directory}/${file}`)
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

describe('V29.3A3 migration inventory', () => {
  it('accounts for every SQL artifact exactly once', () => {
    const onDisk = [...sqlFiles('sql'), ...sqlFiles('supabase/migrations'), ...sqlFiles('supabase/held-migrations')].sort()
    expect(ALL_SQL_RECORDS.map(record => record.file).sort()).toEqual(onDisk)
    expect(new Set(ALL_SQL_RECORDS.map(record => record.file)).size).toBe(ALL_SQL_RECORDS.length)
  })

  it('points every declared record at a file', () => {
    for (const record of ALL_SQL_RECORDS) expect(existsSync(join(root, record.file)), record.file).toBe(true)
  })

  it('keeps the historical production sequence ordered one through eight', () => {
    expect(PRODUCTION_SEQUENCE.map(record => record.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('maps exactly the six read-only confirmed production ledger entries', () => {
    const claimed = PRODUCTION_SEQUENCE.map(record => record.ledgerName).filter(Boolean)
    expect(claimed.sort()).toEqual([...PRODUCTION_LEDGER_ENTRIES].sort())
    for (const name of PRODUCTION_LEDGER_ENTRIES) {
      expect(PRODUCTION_SEQUENCE.filter(record => record.ledgerName === name)).toHaveLength(1)
    }
  })
})

describe('V29.3A3 active and held migration boundary', () => {
  it('contains only the ordered baseline and identity migrations', () => {
    expect(sqlFiles('supabase/migrations')).toEqual([
      'supabase/migrations/20260730172500_canonical_baseline_anchor.sql',
      'supabase/migrations/20260730181000_durable_identity_foundation.sql',
    ])
    expect(ACTIVE_REPO_MIGRATIONS.map(record => record.order)).toEqual([1, 2])
    expect(ACTIVE_BASELINE_MIGRATIONS[0].replaySafety).toBe('zero_change_guarded_anchor')
    expect(ACTIVE_IDENTITY_MIGRATIONS[0].replaySafety).toBe('additive_replay_safe')
  })

  it('keeps the baseline zero-change and fail-closed', () => {
    const migration = stripComments(read(ACTIVE_BASELINE_MIGRATIONS[0].file)).toLowerCase()
    expect(migration).toContain('canonical baseline mismatch')
    expect(migration).toContain("to_regclass('public.' || required_table)")
    expect(migration).not.toMatch(/\b(create|alter|drop|truncate|insert|update|delete)\s+(table|index|policy|trigger|into|public\.)/)
  })

  it('keeps all unrelated and decision migrations held', () => {
    expect(HELD_REPO_MIGRATIONS.map(record => record.file).sort()).toEqual([
      'supabase/held-migrations/20260701173000_jobs_v2_foundation.sql',
      'supabase/held-migrations/20260721173000_role_workspace_owner_safety.sql',
      'supabase/held-migrations/20260722160000_role_calibration_state.sql',
      'supabase/held-migrations/20260730194500_transactional_identity_decisions.sql',
    ])
    const readme = read('supabase/held-migrations/README.md')
    expect(readme).toContain('not active migrations')
    expect(readme).toContain('explicit production approval')
  })
})

describe('V29.3A3 replay safety', () => {
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

  it('declares the guarded sequence, baseline, and identity migration rehearsable', () => {
    expect(isLedgerReplaySafe()).toBe(true)
    expect(isMigrationHistoryAlignable()).toBe(true)
    expect(isIdentityFoundationRehearsable()).toBe(true)
  })

  it('keeps the replay guard outside active migrations and covers all 33 policies', () => {
    const guardRecord = RECONCILIATION_SUPPORT[0]
    expect(guardRecord.file.startsWith('supabase/migrations/')).toBe(false)
    const guard = normalize(read(guardRecord.file))
    const policies = rawReplayGuardedFiles().flatMap(record => createdPolicies(read(record.file)))
    expect(policies).toHaveLength(33)
    for (const policy of policies) {
      expect(guard).toContain(`drop policy if exists ${policy.name} on ${policy.table}`)
    }
  })

  it('guards every V19 trigger previously unsafe on replay', () => {
    const guard = normalize(read(RECONCILIATION_SUPPORT[0].file))
    for (const statement of [
      'drop trigger if exists set_updated_at_profiles on public.profiles',
      'drop trigger if exists set_updated_at_projects on public.projects',
      'drop trigger if exists set_updated_at_candidates on public.candidates',
      'drop trigger if exists set_updated_at_project_candidates on public.project_candidates',
      'drop trigger if exists set_updated_at_pipeline_entries on public.pipeline_entries',
      'drop trigger if exists set_updated_at_source_profiles on public.source_profiles',
    ]) expect(guard).toContain(statement)
  })
})

describe('V29.3A3 canonical contracts', () => {
  it('keeps current production truth distinct from unapplied identity designs', () => {
    expect(CANONICAL_TABLES.evidence_claims.present).toBe(false)
    expect(CANONICAL_TABLES.talent_graph_edges.present).toBe(true)
    expect(IDENTITY_FOUNDATION_TABLES).toContain('evidence_claims')
    expect(IDENTITY_FOUNDATION_TABLES).toContain('identity_match_proposals')
    expect(HELD_REPO_MIGRATIONS.some(record => record.file.endsWith('transactional_identity_decisions.sql'))).toBe(true)
  })

  it('keeps exact-source idempotency and contact verification fail-closed', () => {
    const schema = stripComments(read('sql/complete-schema-v19.sql')).toLowerCase()
    expect(schema).toMatch(/unique\s*\(owner_id,\s*source,\s*source_profile_id\)/)
    expect(schema).toMatch(/check\s*\(\s*verified\s*=\s*false\s*\)/)
  })

  it('keeps incompatible and V18 drift classifications honest', () => {
    expect(ORPHANED_SQL.filter(record => record.replaySafety === 'incompatible')).toHaveLength(2)
    expect(ORPHANED_SQL.find(record => record.file === 'sql/candidate-graph-v18.sql')?.replaySafety)
      .toBe('table_shape_no_op_secondary_drift')
    expect(ORPHANED_SQL.find(record => record.file === 'sql/candidate-intelligence-spine-v19.sql')?.replaySafety)
      .toBe('superseded')
  })
})

describe('V29.3A3 CI gates', () => {
  it('keeps all migration commands distinct', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts['migration:reconcile']).toBe('node scripts/migration-replay.js')
    expect(pkg.scripts['migration:replay']).toBe('node scripts/migration-replay-remediated.js')
    expect(pkg.scripts['migration:baseline']).toBe('node scripts/migration-baseline-alignment.js')
    expect(pkg.scripts['migration:identity']).toBe('node scripts/migration-identity-foundation.js')
    expect(pkg.scripts['migration:identity-decisions']).toBe('node scripts/migration-identity-decisions-held.js')
  })

  it('runs PostgreSQL 17 replay, baseline, identity, and held-decision gates', () => {
    const workflow = read('../.github/workflows/next-public-ci.yml')
    expect(workflow).toContain('image: postgres:17')
    expect(workflow).toContain('npm run migration:replay')
    expect(workflow).toContain('npm run migration:baseline')
    expect(workflow).toContain('npm run migration:identity')
    expect(workflow).toContain('npm run migration:identity-decisions')
  })

  it('fails closed and fingerprints every promoted or held rehearsal layer', () => {
    const replay = read('scripts/migration-replay-remediated.js')
    const baseline = read('scripts/migration-baseline-alignment.js')
    const identity = read('scripts/migration-identity-foundation.js')
    const decision = read('scripts/migration-identity-decisions.js')
    const heldWrapper = read('scripts/migration-identity-decisions-held.js')
    expect(replay).toContain('process.exitCode = 1')
    expect(replay).toContain('beforeGuardedReplay')
    expect(baseline).toContain('schemaAfterSecond')
    expect(identity).toContain('identity migration fails closed without canonical baseline')
    expect(identity).toContain('afterSecond')
    expect(identity).toContain('cross-owner source-profile attachment')
    expect(decision).toContain('exactly one concurrent approval wins and the other fails closed')
    expect(heldWrapper).toContain('supabase/held-migrations/20260730194500_transactional_identity_decisions.sql')
  })
})
