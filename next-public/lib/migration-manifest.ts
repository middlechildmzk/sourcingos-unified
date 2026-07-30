// ─────────────────────────────────────────────────────────────────────────────
// SourcingOS migration manifest — V29.3A0.1 replay-safety remediation.
//
// This is the declared source of truth for the reconstructed production
// sequence, the reconstruction-only replay guard, held release candidates, and
// superseded SQL. Historical production SQL remains immutable.
// ─────────────────────────────────────────────────────────────────────────────

export type ApplicationMethod =
  | 'manual_sql_editor'
  | 'ledger'
  | 'reconciliation_support'
  | 'held'
  | 'orphaned'

export type ReplaySafety =
  | 'replay_safe'
  | 'replay_safe_with_guard'
  | 'table_shape_no_op_secondary_drift'
  | 'incompatible'
  | 'additive_held'
  | 'superseded'

export type MigrationRecord = {
  file: string
  ledgerName: string | null
  method: ApplicationMethod
  replaySafety: ReplaySafety
  /** Order within the reconstructed production sequence. Null for non-sequence files. */
  order: number | null
  note: string
}

/**
 * The eight-file sequence that reconstructs the current production schema.
 *
 * Five files are not safe to run twice by themselves because they recreate
 * named policies or triggers. V29.3A0.1 deliberately does not rewrite those
 * historical files. The reconstruction-only guard prelude removes exactly the
 * named objects they recreate, making the composite sequence replay-safe.
 */
export const PRODUCTION_SEQUENCE: MigrationRecord[] = [
  {
    file: 'sql/complete-schema-v19.sql',
    ledgerName: null,
    method: 'manual_sql_editor',
    replaySafety: 'replay_safe_with_guard',
    order: 1,
    note: 'Manual V19 candidate graph baseline. Six updated_at triggers require the reconstruction guard before replay.',
  },
  {
    file: 'sql/rls-policies-v19.sql',
    ledgerName: null,
    method: 'manual_sql_editor',
    replaySafety: 'replay_safe_with_guard',
    order: 2,
    note: 'Manual V19 RLS layer. Eighteen named policies require the reconstruction guard before replay.',
  },
  {
    file: 'sql/role-workspace-v20-1.sql',
    ledgerName: 'v20_role_workspace_durable',
    method: 'ledger',
    replaySafety: 'replay_safe',
    order: 3,
    note: 'Already uses drop-then-create policy guards.',
  },
  {
    file: 'sql/security-hardening-v20-3.sql',
    ledgerName: 'v20_3_security_performance_hardening',
    method: 'ledger',
    replaySafety: 'replay_safe',
    order: 4,
    note: 'Index-only hardening with IF NOT EXISTS.',
  },
  {
    file: 'sql/role-workspace-v20-3-indexes.sql',
    ledgerName: 'role_workspace_v20_3_compatibility_index',
    method: 'ledger',
    replaySafety: 'replay_safe',
    order: 5,
    note: 'Compatibility index guarded with IF NOT EXISTS.',
  },
  {
    file: 'sql/candidate-acquisition-v21.sql',
    ledgerName: 'candidate_acquisition_v21',
    method: 'ledger',
    replaySafety: 'replay_safe_with_guard',
    order: 6,
    note: 'Three named owner-select policies require the reconstruction guard before replay.',
  },
  {
    file: 'sql/autosource-v22.sql',
    ledgerName: 'autosource_v22',
    method: 'ledger',
    replaySafety: 'replay_safe_with_guard',
    order: 7,
    note: 'Six named owner-select policies require the reconstruction guard before replay. Historical transaction wrapper remains immutable.',
  },
  {
    file: 'sql/agent-os-v23-v25.sql',
    ledgerName: 'agent_os_v23_v25',
    method: 'ledger',
    replaySafety: 'replay_safe_with_guard',
    order: 8,
    note: 'Six named owner-select policies require the reconstruction guard before replay.',
  },
]

export const RECONCILIATION_SUPPORT: MigrationRecord[] = [
  {
    file: 'sql/replay-safety-guards-v29-3a0.sql',
    ledgerName: null,
    method: 'reconciliation_support',
    replaySafety: 'replay_safe',
    order: null,
    note: 'Disposable reconstruction prelude. Drops only the named policies and triggers recreated by the historical sequence. Never a production migration.',
  },
]

/**
 * Preserved SQL release candidates deliberately removed from the active
 * supabase/migrations directory. They are reviewable but cannot be picked up by
 * an unqualified db push.
 */
export const HELD_REPO_MIGRATIONS: MigrationRecord[] = [
  {
    file: 'supabase/held-migrations/20260701173000_jobs_v2_foundation.sql',
    ledgerName: null,
    method: 'held',
    replaySafety: 'additive_held',
    order: null,
    note: 'Held until Jobs V2 receives a dedicated live-schema review and release approval.',
  },
  {
    file: 'supabase/held-migrations/20260721173000_role_workspace_owner_safety.sql',
    ledgerName: null,
    method: 'held',
    replaySafety: 'additive_held',
    order: null,
    note: 'Held until ownership consistency, lock risk, and constraint application are preflighted against production.',
  },
  {
    file: 'supabase/held-migrations/20260722160000_role_calibration_state.sql',
    ledgerName: null,
    method: 'held',
    replaySafety: 'additive_held',
    order: null,
    note: 'Held until the role-calibration product release is intentionally promoted.',
  },
]

export const ORPHANED_SQL: MigrationRecord[] = [
  {
    file: 'sql/candidate-graph-schema.sql',
    ledgerName: null,
    method: 'orphaned',
    replaySafety: 'incompatible',
    order: null,
    note: 'Superseded text-ID candidate graph scaffold. Conflicts with the canonical UUID schema.',
  },
  {
    file: 'sql/candidate-graph-schema-v17-3.sql',
    ledgerName: null,
    method: 'orphaned',
    replaySafety: 'incompatible',
    order: null,
    note: 'Superseded text-ID candidate graph scaffold. Conflicts with the canonical UUID schema.',
  },
  {
    file: 'sql/candidate-graph-v18.sql',
    ledgerName: null,
    method: 'orphaned',
    replaySafety: 'table_shape_no_op_secondary_drift',
    order: null,
    note: 'Its guarded table definitions leave the canonical table shape unchanged, while secondary index statements can still add schema drift.',
  },
  {
    file: 'sql/candidate-intelligence-spine-v19.sql',
    ledgerName: null,
    method: 'orphaned',
    replaySafety: 'additive_held',
    order: null,
    note: 'Defines evidence_claims, which remains absent from production and is a candidate for promotion in V29.3A1.',
  },
  {
    file: 'sql/sourcingos-jobs-v17-6.sql',
    ledgerName: null,
    method: 'orphaned',
    replaySafety: 'superseded',
    order: null,
    note: 'Superseded by the held Jobs V2 design.',
  },
]

export const ALL_SQL_RECORDS: MigrationRecord[] = [
  ...PRODUCTION_SEQUENCE,
  ...RECONCILIATION_SUPPORT,
  ...HELD_REPO_MIGRATIONS,
  ...ORPHANED_SQL,
]

/** Ledger entries independently confirmed through read-only production access. */
export const PRODUCTION_LEDGER_ENTRIES = [
  'v20_role_workspace_durable',
  'v20_3_security_performance_hardening',
  'role_workspace_v20_3_compatibility_index',
  'candidate_acquisition_v21',
  'autosource_v22',
  'agent_os_v23_v25',
] as const

export const CANONICAL_TABLES = {
  candidates: { present: true, source: 'sql/complete-schema-v19.sql' },
  source_profiles: { present: true, source: 'sql/complete-schema-v19.sql' },
  evidence_items: { present: true, source: 'sql/complete-schema-v19.sql' },
  candidate_contacts: { present: true, source: 'sql/complete-schema-v19.sql' },
  identity_match_reviews: { present: true, source: 'sql/complete-schema-v19.sql' },
  evidence_claims: { present: false, source: 'sql/candidate-intelligence-spine-v19.sql' },
  talent_graph_edges: { present: true, source: 'sql/agent-os-v23-v25.sql' },
} as const

export function rawReplayGuardedFiles(): MigrationRecord[] {
  return PRODUCTION_SEQUENCE.filter(record => record.replaySafety === 'replay_safe_with_guard')
}

/** Compatibility alias for the V29.3A0 reconciliation report. */
export function replayUnsafeFiles(): MigrationRecord[] {
  return rawReplayGuardedFiles()
}

export function isRawHistoricalReplaySafe(): boolean {
  return rawReplayGuardedFiles().length === 0
}

/**
 * Release gate for future migration work. The reconstructed sequence is safe to
 * replay only as the declared composite: guard prelude plus eight historical
 * files. This says nothing about production migration history repair.
 */
export function isLedgerReplaySafe(): boolean {
  const allowed = new Set<ReplaySafety>(['replay_safe', 'replay_safe_with_guard'])
  return PRODUCTION_SEQUENCE.every(record => allowed.has(record.replaySafety))
    && RECONCILIATION_SUPPORT.some(record => record.file === 'sql/replay-safety-guards-v29-3a0.sql')
}
