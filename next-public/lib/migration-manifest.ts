// ─────────────────────────────────────────────────────────────────────────────
// SourcingOS migration manifest - V29.3A0 ledger reconciliation.
//
// This file is the single declared source of truth for which SQL files exist,
// which were applied to production, how they were applied, and whether they are
// safe to replay.
//
// It exists because the repository had two disjoint migration mechanisms:
//   - next-public/sql/*.sql        ad hoc files, applied by hand or by CLI
//   - next-public/supabase/migrations/*.sql   the versioned migration system
//
// Every migration recorded in the production ledger came from the first
// directory. Nothing in the second directory has ever been applied to
// production. A `supabase db push` would therefore apply three unreviewed
// migrations in one shot.
//
// Tests assert this manifest against the files actually on disk, so drift
// cannot reappear silently.
// ─────────────────────────────────────────────────────────────────────────────

export type ApplicationMethod =
  /** Run by hand in the Supabase SQL editor. Never recorded in the ledger. */
  | 'manual_sql_editor'
  /** Recorded in the production supabase_migrations ledger. */
  | 'ledger'
  /** Present in the repository, never applied to production. */
  | 'unapplied'

export type ReplaySafety =
  /** Re-running the file against an already-migrated database succeeds. */
  | 'replay_safe'
  /** Re-running fails. The specific reason is recorded. */
  | 'replay_unsafe'
  /** Re-running succeeds but changes nothing, masking its own divergence. */
  | 'silent_no_op'
  /** Re-running fails against the live schema because it targets a different shape. */
  | 'incompatible'

export type MigrationRecord = {
  file: string
  ledgerName: string | null
  method: ApplicationMethod
  replaySafety: ReplaySafety
  /** Order within the reconstructed production sequence. Null if never applied. */
  order: number | null
  note: string
}

/**
 * The reconstructed production sequence, in the order that produces the live
 * schema. Verified by replaying against a disposable PostgreSQL 17 cluster and
 * comparing the result against the read-only production introspection.
 */
export const PRODUCTION_SEQUENCE: MigrationRecord[] = [
  {
    file: 'sql/complete-schema-v19.sql',
    ledgerName: null,
    method: 'manual_sql_editor',
    replaySafety: 'replay_unsafe',
    order: 1,
    note: 'Creates the candidate graph. Applied by hand per sql/MIGRATION-CHECKLIST.md step 1, which is why it never entered the ledger. Six of its seven CREATE TRIGGER statements have no DROP TRIGGER IF EXISTS guard.',
  },
  {
    file: 'sql/rls-policies-v19.sql',
    ledgerName: null,
    method: 'manual_sql_editor',
    replaySafety: 'replay_unsafe',
    order: 2,
    note: 'Applied by hand per checklist step 2. All 18 CREATE POLICY statements are unguarded.',
  },
  {
    file: 'sql/role-workspace-v20-1.sql',
    ledgerName: 'v20_role_workspace_durable',
    method: 'ledger',
    replaySafety: 'replay_safe',
    order: 3,
    note: 'Guards all four policies with DROP POLICY IF EXISTS. This is the pattern the other files should adopt.',
  },
  {
    file: 'sql/security-hardening-v20-3.sql',
    ledgerName: 'v20_3_security_performance_hardening',
    method: 'ledger',
    replaySafety: 'replay_safe',
    order: 4,
    note: 'Index-only migration. All 25 indexes use IF NOT EXISTS.',
  },
  {
    file: 'sql/role-workspace-v20-3-indexes.sql',
    ledgerName: 'role_workspace_v20_3_compatibility_index',
    method: 'ledger',
    replaySafety: 'replay_safe',
    order: 5,
    note: 'Single compatibility index, IF NOT EXISTS.',
  },
  {
    file: 'sql/candidate-acquisition-v21.sql',
    ledgerName: 'candidate_acquisition_v21',
    method: 'ledger',
    replaySafety: 'replay_unsafe',
    order: 6,
    note: 'Three unguarded CREATE POLICY statements.',
  },
  {
    file: 'sql/autosource-v22.sql',
    ledgerName: 'autosource_v22',
    method: 'ledger',
    replaySafety: 'replay_unsafe',
    order: 7,
    note: 'Six unguarded CREATE POLICY statements. Also the only production file wrapped in an explicit BEGIN, so a mid-file failure aborts the whole transaction and cascades into the next file.',
  },
  {
    file: 'sql/agent-os-v23-v25.sql',
    ledgerName: 'agent_os_v23_v25',
    method: 'ledger',
    replaySafety: 'replay_unsafe',
    order: 8,
    note: 'Six unguarded CREATE POLICY statements. Creates talent_graph_edges, which is separate from canonical identity resolution and stays untouched.',
  },
]

/**
 * Present in next-public/supabase/migrations. None have been applied to
 * production. All three apply cleanly on top of the reconstructed schema, so
 * they are pending rather than broken, but they are unreviewed drift and a
 * `supabase db push` would apply them without anyone choosing to.
 */
export const PENDING_REPO_MIGRATIONS: MigrationRecord[] = [
  {
    file: 'supabase/migrations/20260701173000_jobs_v2_foundation.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'replay_safe',
    order: null,
    note: 'Jobs v2 foundation. Overlaps job_submissions with complete-schema-v19.sql but reconciles additively.',
  },
  {
    file: 'supabase/migrations/20260721173000_role_workspace_owner_safety.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'replay_safe',
    order: null,
    note: 'V20.4 owner-safety hardening. Its absence is consistent with the production introspection finding that foreign keys are ID-only rather than composite ownership-safe.',
  },
  {
    file: 'supabase/migrations/20260722160000_role_calibration_state.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'replay_safe',
    order: null,
    note: 'V27 role calibration state. V27 was never promoted to production.',
  },
]

/**
 * Files that are neither in the production sequence nor pending application.
 */
export const ORPHANED_SQL: MigrationRecord[] = [
  {
    file: 'sql/candidate-graph-schema.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'incompatible',
    order: null,
    note: 'Superseded V17 scaffold with text primary keys. Fails against the live schema: column "next_refresh_at" does not exist. Archive.',
  },
  {
    file: 'sql/candidate-graph-schema-v17-3.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'incompatible',
    order: null,
    note: 'Superseded V17.3 scaffold with text primary keys. Same failure. Archive.',
  },
  {
    file: 'sql/candidate-graph-v18.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'silent_no_op',
    order: null,
    note: 'The most dangerous orphan. Every CREATE uses IF NOT EXISTS, so it reports success against the live schema while changing zero columns. Its differing definitions are silently discarded, which makes it look like a valid source of truth when it is not. Archive.',
  },
  {
    file: 'sql/candidate-intelligence-spine-v19.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'replay_safe',
    order: null,
    note: 'Creates evidence_claims, confirmed absent from production. Applies cleanly on top of the live schema. This is the file V29.3A1 promotes and extends as the canonical field-claim model.',
  },
  {
    file: 'sql/sourcingos-jobs-v17-6.sql',
    ledgerName: null,
    method: 'unapplied',
    replaySafety: 'replay_safe',
    order: null,
    note: 'Superseded by the jobs v2 foundation migration. Archive.',
  },
]

export const ALL_SQL_RECORDS: MigrationRecord[] = [
  ...PRODUCTION_SEQUENCE,
  ...PENDING_REPO_MIGRATIONS,
  ...ORPHANED_SQL,
]

/** Ledger entries reported by read-only production introspection. */
export const PRODUCTION_LEDGER_ENTRIES = [
  'v20_role_workspace_durable',
  'v20_3_security_performance_hardening',
  'role_workspace_v20_3_compatibility_index',
  'candidate_acquisition_v21',
  'autosource_v22',
  'agent_os_v23_v25',
] as const

/**
 * Tables whose contract V29.3A1 depends on. `evidence_claims` is deliberately
 * listed as absent: it is defined in an orphaned file and must be promoted
 * through a real migration before anything references it.
 */
export const CANONICAL_TABLES = {
  candidates: { present: true, source: 'sql/complete-schema-v19.sql' },
  source_profiles: { present: true, source: 'sql/complete-schema-v19.sql' },
  evidence_items: { present: true, source: 'sql/complete-schema-v19.sql' },
  candidate_contacts: { present: true, source: 'sql/complete-schema-v19.sql' },
  identity_match_reviews: { present: true, source: 'sql/complete-schema-v19.sql' },
  evidence_claims: { present: false, source: 'sql/candidate-intelligence-spine-v19.sql' },
  talent_graph_edges: { present: true, source: 'sql/agent-os-v23-v25.sql' },
} as const

export function replayUnsafeFiles(): MigrationRecord[] {
  return PRODUCTION_SEQUENCE.filter(record => record.replaySafety === 'replay_unsafe')
}

export function isLedgerReplaySafe(): boolean {
  return replayUnsafeFiles().length === 0
}
