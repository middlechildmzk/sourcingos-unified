import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')
const migrationPath = 'supabase/migrations/20260730194500_transactional_identity_decisions.sql'
const migration = read(migrationPath)
const harness = read('scripts/migration-identity-decisions.js')
const workflow = read('../.github/workflows/next-public-ci.yml')
const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> }

describe('V29.3A3 transaction boundary', () => {
  it('creates only schema and service-role RPCs, with no automatic execution', () => {
    expect(migration).toContain('create table if not exists public.identity_decision_events')
    expect(migration).toContain('create or replace function public.decide_identity_match_proposal')
    expect(migration).toContain('create or replace function public.revert_identity_decision')
    expect(migration).not.toContain('select public.decide_identity_match_proposal(')
    expect(migration).not.toContain('select public.revert_identity_decision(')
  })

  it('requires both proposal and source-profile optimistic locks', () => {
    expect(migration).toContain('p_expected_proposal_updated_at timestamptz')
    expect(migration).toContain('p_expected_source_updated_at timestamptz')
    expect(migration).toContain("code', 'identity_decision_precondition_required")
    expect(migration).toContain("code', 'identity_proposal_stale")
    expect(migration).toContain("code', 'identity_source_profile_stale")
  })

  it('is service-role-only and uses fixed-path security-definer functions', () => {
    expect((migration.match(/security definer/g) || []).length).toBe(2)
    expect((migration.match(/set search_path = ''/g) || []).length).toBe(2)
    expect(migration).toContain('from PUBLIC, anon, authenticated')
    expect(migration).toContain('to service_role')
    expect(migration).not.toMatch(/grant execute[\s\S]{0,180}to authenticated/)
  })

  it('owner-scopes every mutable table statement', () => {
    for (const table of [
      'source_profiles',
      'evidence_items',
      'candidate_contacts',
      'open_to_work_signals',
      'evidence_claims',
      'identity_match_proposals',
      'identity_decision_events',
    ]) {
      const updates = [...migration.matchAll(new RegExp(`update public\\.${table}[\\s\\S]*?;`, 'g'))]
      for (const update of updates) expect(update[0], table).toContain('owner_id = p_owner_id')
    }
  })

  it('never deletes candidates, profiles, evidence, contacts, signals, or claims', () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.(candidates|source_profiles|evidence_items|candidate_contacts|open_to_work_signals|evidence_claims)/i)
    expect(migration).toContain('No event deletes a candidate')
    expect(migration).toContain('never deletes the provisional candidate')
  })
})

describe('V29.3A3 approval safety', () => {
  it('blocks negative evidence and existing role state', () => {
    expect(migration).toContain("conflict->>'severity' = 'blocking'")
    expect(migration).toContain("code', 'identity_blocking_conflict")
    expect(migration).toContain('from public.project_candidates')
    expect(migration).toContain('from public.pipeline_entries')
    expect(migration).toContain("code', 'identity_provisional_candidate_has_role_state")
  })

  it('moves only records explicitly tied to the incoming source profile', () => {
    for (const table of ['evidence_items', 'candidate_contacts', 'open_to_work_signals', 'evidence_claims']) {
      expect(migration).toMatch(new RegExp(`update public\\.${table}[\\s\\S]{0,180}source_profile_id = v_profile\\.id`))
    }
  })

  it('serializes competing source-profile approvals and supersedes stale proposals', () => {
    expect(migration).toContain('for update')
    expect(migration).toContain("code', 'identity_source_has_active_approval")
    expect(migration).toContain("decision_reason = 'superseded by approved identity decision'")
  })

  it('records before and after state in an owner-safe event ledger', () => {
    expect(migration).toContain('before_state jsonb not null')
    expect(migration).toContain('after_state jsonb not null')
    expect(migration).toContain('identity_decision_events_owner_proposal_fk')
    expect(migration).toContain('identity_decision_events_owner_profile_fk')
    expect(migration).toContain('identity_decision_events_owner_previous_candidate_fk')
    expect(migration).toContain('identity_decision_events_owner_target_candidate_fk')
  })
})

describe('V29.3A3 rollback safety', () => {
  it('restores source-tied records and refuses changed or repeated rollbacks', () => {
    expect(migration).toContain("code', 'identity_source_profile_changed_after_decision")
    expect(migration).toContain("code', 'identity_decision_already_reverted")
    expect(migration).toContain("code', 'identity_decision_superseded_by_later_event")
    expect(migration).toContain('set candidate_id = v_event.previous_candidate_id')
    expect(migration).toContain("set status = 'superseded'")
  })

  it('keeps rejected and keep-separate decisions distinguishable in the event ledger', () => {
    expect(migration).toContain("action in ('approve', 'keep_separate', 'reject')")
    expect(migration).toContain("identity_profiles_kept_separate")
    expect(migration).toContain("identity_proposal_rejected")
  })
})

describe('V29.3A3 executable proof', () => {
  it('rehearses approval, rollback, stale writes, conflicts, owner isolation, and concurrency', () => {
    for (const phrase of [
      'blind decision is rejected',
      'stale proposal timestamp is rejected',
      'stale source-profile timestamp is rejected',
      'blocking negative evidence prevents approval',
      'candidate role state prevents source reassignment',
      'cross-owner actor is rejected',
      'keep-separate rollback succeeds',
      'approval rollback restores source profile',
      'competing approval sessions complete without deadlock',
      'exactly one concurrent approval wins and the other fails closed',
    ]) expect(harness).toContain(phrase)
  })

  it('is wired into the locked package command and PostgreSQL CI job', () => {
    expect(packageJson.scripts?.['migration:identity-decisions']).toBe('node scripts/migration-identity-decisions.js')
    expect(workflow).toContain('Rehearse transactional identity decisions')
    expect(workflow).toContain('npm run migration:identity-decisions')
    expect(workflow).toContain('/tmp/sourcingos-identity-decision-report.json')
  })

  it('keeps the exact ordered active migration stack', () => {
    const migrations = readdirSync(join(root, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort()
    expect(migrations).toEqual([
      '20260730172500_canonical_baseline_anchor.sql',
      '20260730181000_durable_identity_foundation.sql',
      '20260730194500_transactional_identity_decisions.sql',
    ])
    expect(existsSync(join(root, migrationPath))).toBe(true)
  })

  it('adds no browser decision endpoint or decision control', () => {
    expect(existsSync(join(root, 'app/api/identity/proposals/[id]/decision/route.ts'))).toBe(false)
    const reviewClient = read('components/IdentityReviewClient.tsx')
    expect(reviewClient).toContain('Decision controls are intentionally unavailable')
    expect(reviewClient).not.toMatch(/method:\s*['"]POST['"]/)
  })
})
