import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  decideIdentityProposal,
  IdentityDecisionUnavailableError,
  isIdentityDecisionActivationEnabled,
  isIdentityDecisionRpcUnavailable,
  type IdentityDecisionResult,
} from '@/lib/identity/proposal-decision'

export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()
const confirmationByAction = {
  approve: 'attach_source_profile',
  keep_separate: 'keep_profiles_separate',
  reject: 'reject_identity_proposal',
} as const

const decisionSchema = z.object({
  action: z.enum(['approve', 'keep_separate', 'reject']),
  reason: z.string().trim().min(10).max(1000),
  expectedProposalUpdatedAt: z.string().datetime({ offset: true }),
  expectedSourceUpdatedAt: z.string().datetime({ offset: true }),
  confirmation: z.enum([
    'attach_source_profile',
    'keep_profiles_separate',
    'reject_identity_proposal',
  ]),
}).strict().superRefine((value, context) => {
  if (value.confirmation !== confirmationByAction[value.action]) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmation'],
      message: 'Confirmation does not match the requested identity action.',
    })
  }
})

const ERROR_MESSAGES: Record<string, string> = {
  identity_decision_precondition_required: 'Reload this proposal before making a decision.',
  identity_actor_not_authorized: 'You are not authorized to decide this proposal.',
  identity_action_invalid: 'The requested identity action is invalid.',
  identity_proposal_not_found: 'This identity proposal no longer exists.',
  identity_proposal_not_pending: 'This proposal has already been decided. Reload the review queue.',
  identity_proposal_stale: 'The proposal changed after you opened it. Reload and review the latest evidence.',
  identity_source_profile_stale: 'The incoming source profile changed after you opened it. Reload and review the latest evidence.',
  identity_source_has_active_approval: 'This source profile already has an active approved identity decision.',
  identity_blocking_conflict: 'Approval is blocked by recorded negative identity evidence.',
  identity_source_already_attached: 'This source profile is already attached to the proposed candidate.',
  identity_provisional_candidate_has_role_state: 'This source profile cannot be reassigned while its current candidate has project or pipeline state.',
  identity_target_candidate_not_found: 'The proposed canonical candidate no longer exists.',
  identity_previous_candidate_not_found: 'The source profile references a candidate that no longer exists.',
  identity_source_profile_not_found: 'The incoming source profile no longer exists.',
  identity_decision_conflict: 'Another recruiter completed a conflicting identity decision first. Reload the proposal.',
  identity_decision_invalid_response: 'The decision service returned an invalid response.',
}

function statusForDecision(result: IdentityDecisionResult): number {
  if (result.ok) return 200
  if (result.code === 'identity_actor_not_authorized') return 403
  if (result.code.endsWith('_not_found')) return 404
  if (result.code === 'identity_action_invalid' || result.code === 'identity_decision_precondition_required') return 400
  if (result.code === 'identity_blocking_conflict' || result.code === 'identity_provisional_candidate_has_role_state') return 422
  return 409
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === request.nextUrl.origin
  } catch {
    return false
  }
}

function safeDecisionResult(result: IdentityDecisionResult) {
  return {
    ok: result.ok,
    code: result.code,
    eventId: result.eventId,
    proposalId: result.proposalId,
    sourceProfileId: result.sourceProfileId,
    previousCandidateId: result.previousCandidateId,
    targetCandidateId: result.targetCandidateId,
    status: result.status,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(request, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  if (!sameOrigin(request)) {
    return NextResponse.json({
      ok: false,
      code: 'identity_decision_origin_rejected',
      error: 'Identity decisions require a same-origin browser request.',
    }, { status: 403 })
  }

  const parsedId = idSchema.safeParse(params.id)
  if (!parsedId.success) {
    return NextResponse.json({
      ok: false,
      code: 'invalid_identity_proposal_id',
      error: 'Invalid identity proposal ID.',
    }, { status: 400 })
  }

  const parsedBody = decisionSchema.safeParse(await request.json().catch(() => null))
  if (!parsedBody.success) {
    return NextResponse.json({
      ok: false,
      code: 'invalid_identity_decision_request',
      error: 'Provide one deliberate action, a 10 to 1000 character reason, current review timestamps, and the matching confirmation.',
      issues: parsedBody.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })),
    }, { status: 400 })
  }

  if (gate.preview || !isSupabaseConfigured() || !isIdentityDecisionActivationEnabled()) {
    return NextResponse.json({
      ok: false,
      available: false,
      code: 'identity_decisions_unavailable',
      error: 'Recruiter identity decisions are not activated in this environment. No record was changed.',
    }, { status: 503 })
  }

  try {
    const result = await decideIdentityProposal({
      ownerId: gate.userId,
      proposalId: parsedId.data,
      action: parsedBody.data.action,
      reason: parsedBody.data.reason,
      expectedProposalUpdatedAt: parsedBody.data.expectedProposalUpdatedAt,
      expectedSourceUpdatedAt: parsedBody.data.expectedSourceUpdatedAt,
    })

    const status = statusForDecision(result)
    return NextResponse.json({
      ...safeDecisionResult(result),
      available: true,
      error: result.ok ? undefined : ERROR_MESSAGES[result.code] || 'The identity decision was not applied.',
    }, { status })
  } catch (error) {
    if (error instanceof IdentityDecisionUnavailableError || isIdentityDecisionRpcUnavailable(error)) {
      return NextResponse.json({
        ok: false,
        available: false,
        code: 'identity_decisions_unavailable',
        error: 'The transactional identity-decision functions are not activated in this environment. No record was changed.',
      }, { status: 503 })
    }

    return NextResponse.json({
      ok: false,
      available: true,
      code: 'identity_decision_failed',
      error: 'The identity decision could not be applied. No partial result is reported.',
    }, { status: 500 })
  }
}
