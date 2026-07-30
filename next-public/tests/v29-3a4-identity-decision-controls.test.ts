import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')

const routePath = 'app/api/identity/proposals/[id]/decision/route.ts'
const route = read(routePath)
const detailRoute = read('app/api/identity/proposals/[id]/route.ts')
const service = read('lib/identity/proposal-decision.ts')
const panel = read('components/IdentityDecisionPanel.tsx')
const workspace = read('components/IdentityReviewClient.tsx')
const transactionMigration = 'supabase/held-migrations/20260730194500_transactional_identity_decisions.sql'
const serializationMigration = 'supabase/held-migrations/20260730194600_transactional_identity_decision_serialization.sql'

describe('V29.3A4 authenticated mutation boundary', () => {
  it('adds one single-proposal POST route and no bulk decision route', () => {
    expect(existsSync(join(root, routePath))).toBe(true)
    expect(route).toContain('export async function POST')
    expect(existsSync(join(root, 'app/api/identity/proposals/decision/route.ts'))).toBe(false)
    expect(existsSync(join(root, 'app/api/identity/proposals/bulk-decision/route.ts'))).toBe(false)
  })

  it('requires session authentication, owner-scoped rate limiting, and same-origin submission', () => {
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(request, 'workbench', gate.userId)")
    expect(route).toContain("request.headers.get('origin')")
    expect(route).toContain('request.nextUrl.origin')
    expect(route).toContain("code: 'identity_decision_origin_rejected'")
  })

  it('validates UUID, exact action, reason, timestamps, confirmation, and rejects unknown fields', () => {
    expect(route).toContain('z.string().uuid()')
    expect(route).toContain("z.enum(['approve', 'keep_separate', 'reject'])")
    expect(route).toContain('z.string().trim().min(10).max(1000)')
    expect((route.match(/z\.string\(\)\.datetime\(\{ offset: true \}\)/g) || []).length).toBe(2)
    expect(route).toContain("'attach_source_profile'")
    expect(route).toContain("'keep_profiles_separate'")
    expect(route).toContain("'reject_identity_proposal'")
    expect(route).toContain('}).strict().superRefine')
  })

  it('derives owner and actor exclusively from the authenticated session', () => {
    expect(route).toContain('ownerId: gate.userId')
    expect(service).toContain('p_actor_id: input.ownerId')
    expect(service).toContain('p_owner_id: input.ownerId')
    expect(route).not.toMatch(/body\.(ownerId|owner_id|actorId|actor_id)/)
    expect(service).not.toContain('input.actorId')
  })
})

describe('V29.3A4 fail-closed activation', () => {
  it('requires an explicit server activation flag in both read context and mutation service', () => {
    expect(service).toContain("process.env.IDENTITY_DECISIONS_ENABLED === 'true'")
    expect(service).toContain('if (!isIdentityDecisionActivationEnabled()) throw new IdentityDecisionUnavailableError()')
    expect(route).toContain('!isIdentityDecisionActivationEnabled()')
    expect(route).toContain("code: 'identity_decisions_unavailable'")
    expect(detailRoute).toContain('const decisionsEnabled = isIdentityDecisionActivationEnabled()')
    expect(detailRoute).toContain('enabled: decisionsEnabled')
    expect(detailRoute).toContain('readOnly: !decisionsEnabled')
  })

  it('keeps the service role server-only and never exposes its key', () => {
    expect(service).toContain("import 'server-only'")
    expect(service).toContain('createServerSupabaseClient')
    expect(service).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(panel).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(workspace).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('maps missing RPC/schema states to unavailable rather than a partial decision', () => {
    expect(service).toContain("code === 'PGRST202'")
    expect(service).toContain("code === '42883'")
    expect(service).toContain("message.includes('decide_identity_match_proposal')")
    expect(route).toContain('IdentityDecisionUnavailableError')
    expect(route).toContain('No record was changed.')
  })
})

describe('V29.3A4 optimistic and transactional contract', () => {
  it('reads owner-scoped proposal and source timestamps for the confirmation page', () => {
    expect(service).toContain("from('identity_match_proposals')")
    expect(service).toContain("select('id,source_profile_id,updated_at')")
    expect(service).toContain("from('source_profiles')")
    expect(service).toContain("select('id,updated_at')")
    expect((service.match(/\.eq\('owner_id', ownerId\)/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(detailRoute).toContain('getIdentityDecisionPreconditions(gate.userId, parsed.data)')
  })

  it('passes both expected timestamps to the rehearsed RPC', () => {
    expect(service).toContain('p_expected_proposal_updated_at: input.expectedProposalUpdatedAt')
    expect(service).toContain('p_expected_source_updated_at: input.expectedSourceUpdatedAt')
    expect(panel).toContain('expectedProposalUpdatedAt: proposal.decisionPreconditions.proposalUpdatedAt')
    expect(panel).toContain('expectedSourceUpdatedAt: proposal.decisionPreconditions.sourceUpdatedAt')
  })

  it('uses the service RPC rather than issuing direct client-authored table updates', () => {
    expect(service).toContain("client.rpc('decide_identity_match_proposal'")
    expect(route).not.toMatch(/\.from\(['"][^'"]+['"]\)\.(insert|update|delete)/)
    expect(panel).not.toMatch(/\.from\(['"][^'"]+['"]\)/)
    expect(workspace).not.toMatch(/\.from\(['"][^'"]+['"]\)/)
  })

  it('returns structured conflict states without leaking database error text', () => {
    for (const code of [
      'identity_proposal_stale',
      'identity_source_profile_stale',
      'identity_source_has_active_approval',
      'identity_blocking_conflict',
      'identity_provisional_candidate_has_role_state',
      'identity_decision_conflict',
    ]) expect(route).toContain(code)
    expect(route).toContain("error: 'The identity decision could not be applied. No partial result is reported.'")
    expect(route).not.toContain('error.message')
  })
})

describe('V29.3A4 recruiter confirmation UX', () => {
  it('offers only approve, keep-separate, and reject for pending proposals', () => {
    expect(panel).toContain("type IdentityDecisionAction = 'approve' | 'keep_separate' | 'reject'")
    expect(panel).toContain("const isPending = proposal.status === 'pending'")
    expect(panel).toContain('Approve source attachment')
    expect(panel).toContain('Keep profiles separate')
    expect(panel).toContain('Reject proposal')
    expect(panel).not.toContain('Merge candidates')
    expect(panel).not.toContain('Approve all')
  })

  it('requires a reason and explicit evidence-review confirmation', () => {
    expect(panel).toContain('reasonLength >= 10 && reasonLength <= 1000')
    expect(panel).toContain('checked={confirmed}')
    expect(panel).toContain('I reviewed the displayed evidence, conflicts, source profile, and proposed candidate')
    expect(panel).toContain('Do not add private or sensitive personal information.')
    expect(panel).toContain('disabled={!canSubmit}')
  })

  it('disables approval when blocking negative evidence exists', () => {
    expect(panel).toContain('const approveBlocked = proposal.blockingConflictCount > 0')
    expect(panel).toContain('disabled={!proposal.decisionControls.enabled || approveBlocked}')
    expect(panel).toContain('Approval is disabled because this proposal has')
  })

  it('submits one same-origin JSON decision and refreshes stale or completed proposals', () => {
    expect(panel).toContain("method: 'POST'")
    expect(panel).toContain("'content-type': 'application/json'")
    expect(panel).toContain('/decision`')
    expect(panel).toContain('onReloadRequested()')
    expect(workspace).toContain('onDecisionComplete={notice =>')
    expect(workspace).toContain('void loadList(statusFilter, page.offset)')
  })

  it('keeps ranking language separate from identity proof', () => {
    expect(workspace).toContain('Scores rank attention, not identity probability')
    expect(workspace).toContain('No bulk decision or automatic probabilistic attachment is available')
    expect(panel).toContain('single-proposal, recruiter-confirmed, audited')
  })
})

describe('V29.3A4 release boundary', () => {
  it('keeps only baseline and durable identity active', () => {
    expect(readdirSync(join(root, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort()).toEqual([
      '20260730172500_canonical_baseline_anchor.sql',
      '20260730181000_durable_identity_foundation.sql',
    ])
  })

  it('keeps the transaction body and serialization wrapper held together', () => {
    expect(existsSync(join(root, transactionMigration))).toBe(true)
    expect(existsSync(join(root, serializationMigration))).toBe(true)
    expect(transactionMigration.startsWith('supabase/held-migrations/')).toBe(true)
    expect(serializationMigration.startsWith('supabase/held-migrations/')).toBe(true)
  })

  it('adds no production action, environment value, or rollback UI', () => {
    expect(route).not.toContain('process.env.IDENTITY_DECISIONS_ENABLED =')
    expect(panel).not.toContain('revert_identity_decision')
    expect(existsSync(join(root, 'app/api/identity/decisions/[id]/revert/route.ts'))).toBe(false)
  })
})
