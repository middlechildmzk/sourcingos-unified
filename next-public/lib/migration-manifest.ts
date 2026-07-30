// ─────────────────────────────────────────────────────────────────────────────
// SourcingOS migration manifest — V29.3A3 transactional identity decisions.
// ─────────────────────────────────────────────────────────────────────────────

export type ApplicationMethod =
  | 'manual_sql_editor'
  | 'ledger'
  | 'reconciliation_support'
  | 'baseline_anchor'
  | 'identity_foundation'
  | 'held'
  | 'orphaned'

export type ReplaySafety =
  | 'replay_safe'
  | 'replay_safe_with_guard'
  | 'zero_change_guarded_anchor'
  | 'additive_replay_safe'
  | 'table_shape_no_op_secondary_drift'
  | 'incompatible'
  | 'additive_held'
  | 'superseded'

export type MigrationRecord = {
  file: string
  ledgerName: string | null
  method: ApplicationMethod
  replaySafety: ReplaySafety
  order: number | null
  note: string
}

export const PRODUCTION_SEQUENCE: MigrationRecord[] = [
  {
    file: 'sql/complete-schema-v19.sql', ledgerName: null, method: 'manual_sql_editor', replaySafety: 'replay_safe_with_guard', order: 1,
    note: 'Manual V19 candidate graph baseline. Six updated_at triggers require the reconstruction guard before replay.',
  },
  {
    file: 'sql/rls-policies-v19.sql', ledgerName: null, method: 'manual_sql_editor', replaySafety: 'replay_safe_with_guard', order: 2,
    note: 'Manual V19 RLS layer. Eighteen named policies require the reconstruction guard before replay.',
  },
  {
    file: 'sql/role-workspace-v20-1.sql', ledgerName: 'v20_role_workspace_durable', method: 'ledger', replaySafety: 'replay_safe', order: 3,
    note: 'Already uses drop-then-create policy guards.',
  },
  {
    file: 'sql/security-hardening-v20-3.sql', ledgerName: 'v20_3_security_performance_hardening', method: 'ledger', replaySafety: 'replay_safe', order: 4,
    note: 'Index-only hardening with IF NOT EXISTS.',
  },
  {
    file: 'sql/role-workspace-v20-3-indexes.sql', ledgerName: 'role_workspace_v20_3_compatibility_index', method: 'ledger', replaySafety: 'replay_safe', order: 5,
    note: 'Compatibility index guarded with IF NOT EXISTS.',
  },
  {
    file: 'sql/candidate-acquisition-v21.sql', ledgerName: 'candidate_acquisition_v21', method: 'ledger', replaySafety: 'replay_safe_with_guard', order: 6,
    note: 'Three named owner-select policies require the reconstruction guard before replay.',
  },
  {
    file: 'sql/autosource-v22.sql', ledgerName: 'autosource_v22', method: 'ledger', replaySafety: 'replay_safe_with_guard', order: 7,
    note: 'Six named owner-select policies require the reconstruction guard before replay. Historical transaction wrapper remains immutable.',
  },
  {
    file: 'sql/agent-os-v23-v25.sql', ledgerName: 'agent_os_v23_v25', method: 'ledger', replaySafety: 'replay_safe_with_guard', order: 8,
    note: 'Six named owner-select policies require the reconstruction guard before replay.',
  },
]

export const RECONCILIATION_SUPPORT: MigrationRecord[] = [
  {
    file: 'sql/replay-safety-guards-v29-3a0.sql', ledgerName: null, method: 'reconciliation_support', replaySafety: 'replay_safe', order: null,
    note: 'Disposable reconstruction prelude. Never a production migration.',
  },
]

export const ACTIVE_BASELINE_MIGRATIONS: MigrationRecord[] = [
  {
    file: 'supabase/migrations/20260730172500_canonical_baseline_anchor.sql',
    ledgerName: 'v29_3a0_canonical_baseline_anchor',
    method: 'baseline_anchor',
    replaySafety: 'zero_change_guarded_anchor',
    order: 1,
    note: 'Zero-change, fail-closed ledger anchor. Production application requires separate explicit approval.',
  },
]

export const ACTIVE_IDENTITY_MIGRATIONS: MigrationRecord[] = [
  {
    file: 'supabase/migrations/20260730181000_durable_identity_foundation.sql',
    ledgerName: 'v29_3a1_durable_identity_foundation',
    method: 'identity_foundation',
    replaySafety: 'additive_replay_safe',
    order: 2,
    note: 'Adds owner-safe identity metadata, proposals, provenance claims, and merge-event contracts with no backfill or automatic merge.',
  },
]

export const ACTIVE_REPO_MIGRATIONS: MigrationRecord[] = [
  ...ACTIVE_BASELINE_MIGRATIONS,
  ...ACTIVE_IDENTITY_MIGRATIONS,
]

export const HELD_REPO_MIGRATIONS: MigrationRecord[] = [
  {
    file: 'supabase/held-migrations/20260701173000_jobs_v2_foundation.sql', ledgerName: null, method: 'held', replaySafety: 'additive_held', order: null,
    note: 'Held until Jobs V2 receives dedicated review and release approval.',
  },
  {
    file: 'supabase/held-migrations/20260721173000_role_workspace_owner_safety.sql', ledgerName: null, method: 'held', replaySafety: 'additive_held', order: null,
    note: 'Held until ownership consistency and lock risk are preflighted against production.',
  },
  {
    file: 'supabase/held-migrations/20260722160000_role_calibration_state.sql', ledgerName: null, method: 'held', replaySafety: 'additive_held', order: null,
    note: 'Held until the role-calibration product release is intentionally promoted.',
  },
  {
    file: 'supabase/held-migrations/20260730194500_transactional_identity_decisions.sql', ledgerName: null, method: 'held', replaySafety: 'additive_held', order: null,
    note: 'Fully rehearsed transactional identity-decision RPC design. Held until a separate activation review approves the API, UI, migration, and production rollout together.',
  },
]

export const ORPHANED_SQL: MigrationRecord[] = [
  {
    file: 'sql/candidate-graph-schema.sql', ledgerName: null, method: 'orphaned', replaySafety: 'incompatible', order: null,
    note: 'Superseded text-ID candidate graph scaffold.',
  },
  {
    file: 'sql/candidate-graph-schema-v17-3.sql', ledgerName: null, method: 'orphaned', replaySafety: 'incompatible', order: null,
    note: 'Superseded text-ID candidate graph scaffold.',
  },
  {
    file: 'sql/candidate-graph-v18.sql', ledgerName: null, method: 'orphaned', replaySafety: 'table_shape_no_op_secondary_drift', order: null,
    note: 'Preserves table shape but can add secondary index drift.',
  },
  {
    file: 'sql/candidate-intelligence-spine-v19.sql', ledgerName: null, method: 'orphaned', replaySafety: 'superseded', order: null,
    note: 'Its evidence-claim concept is promoted and ownership-hardened by V29.3A1. The ad hoc file is no longer a release candidate.',
  },
  {
    file: 'sql/sourcingos-jobs-v17-6.sql', ledgerName: null, method: 'orphaned', replaySafety: 'superseded', order: null,
    note: 'Superseded by the held Jobs V2 design.',
  },
]

export const ALL_SQL_RECORDS: MigrationRecord[] = [
  ...PRODUCTION_SEQUENCE,
  ...RECONCILIATION_SUPPORT,
  ...ACTIVE_REPO_MIGRATIONS,
  ...HELD_REPO_MIGRATIONS,
  ...ORPHANED_SQL,
]

export const PRODUCTION_LEDGER_ENTRIES = [
  'v20_role_workspace_durable',
  'v20_3_security_performance_hardening',
  'role_workspace_v20_3_compatibility_index',
  'candidate_acquisition_v21',
  'autosource_v22',
  'agent_os_v23_v25',
] as const

/** Current production before any V29.3A migration application. */
export const CANONICAL_TABLES = {
  candidates: { present: true, source: 'sql/complete-schema-v19.sql' },
  source_profiles: { present: true, source: 'sql/complete-schema-v19.sql' },
  evidence_items: { present: true, source: 'sql/complete-schema-v19.sql' },
  candidate_contacts: { present: true, source: 'sql/complete-schema-v19.sql' },
  identity_match_reviews: { present: true, source: 'sql/complete-schema-v19.sql' },
  evidence_claims: { present: false, source: 'sql/candidate-intelligence-spine-v19.sql' },
  talent_graph_edges: { present: true, source: 'sql/agent-os-v23-v25.sql' },
} as const

export const IDENTITY_FOUNDATION_TABLES = [
  'source_profile_snapshots',
  'source_profile_identifiers',
  'identity_block_keys',
  'identity_match_proposals',
  'evidence_claims',
  'evidence_claim_events',
  'candidate_merge_events',
] as const

export function rawReplayGuardedFiles(): MigrationRecord[] {
  return PRODUCTION_SEQUENCE.filter(record => record.replaySafety === 'replay_safe_with_guard')
}

export function replayUnsafeFiles(): MigrationRecord[] {
  return rawReplayGuardedFiles()
}

export function isRawHistoricalReplaySafe(): boolean {
  return rawReplayGuardedFiles().length === 0
}

export function isLedgerReplaySafe(): boolean {
  const allowed = new Set<ReplaySafety>(['replay_safe', 'replay_safe_with_guard'])
  return PRODUCTION_SEQUENCE.every(record => allowed.has(record.replaySafety))
    && RECONCILIATION_SUPPORT.some(record => record.file === 'sql/replay-safety-guards-v29-3a0.sql')
}

export function isMigrationHistoryAlignable(): boolean {
  return isLedgerReplaySafe()
    && ACTIVE_BASELINE_MIGRATIONS.length === 1
    && ACTIVE_BASELINE_MIGRATIONS[0].replaySafety === 'zero_change_guarded_anchor'
}

export function isIdentityFoundationRehearsable(): boolean {
  return isMigrationHistoryAlignable()
    && ACTIVE_REPO_MIGRATIONS.map(record => record.order).join(',') === '1,2'
    && ACTIVE_IDENTITY_MIGRATIONS.length === 1
    && ACTIVE_IDENTITY_MIGRATIONS[0].replaySafety === 'additive_replay_safe'
}
