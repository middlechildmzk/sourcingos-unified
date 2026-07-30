import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  getIdentityProposal,
  IdentityProposalNotFoundError,
  IdentitySchemaUnavailableError,
  isIdentitySchemaUnavailable,
} from '@/lib/identity/proposal-read'
import {
  getIdentityDecisionPreconditions,
  IdentityDecisionContextNotFoundError,
  isIdentityDecisionActivationEnabled,
} from '@/lib/identity/proposal-decision'

export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid()
const SENSITIVE_FIELD = /(email|phone|contact|address)/i

function browserSafeProposal(proposal: Awaited<ReturnType<typeof getIdentityProposal>>) {
  return {
    ...proposal,
    candidateClaims: proposal.candidateClaims.map(claim => SENSITIVE_FIELD.test(claim.fieldName)
      ? { ...claim, value: '[Sensitive claim masked]', normalizedValue: null }
      : claim),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(request, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = idSchema.safeParse(params.id)
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      available: true,
      code: 'invalid_identity_proposal_id',
      error: 'Invalid identity proposal ID.',
    }, { status: 400 })
  }

  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      available: false,
      code: 'identity_schema_unavailable',
      error: 'Durable identity review is unavailable in preview mode. No proposal data was read or written.',
    }, { status: 503 })
  }

  try {
    const [proposal, decisionPreconditions] = await Promise.all([
      getIdentityProposal(gate.userId, parsed.data),
      getIdentityDecisionPreconditions(gate.userId, parsed.data),
    ])
    const decisionsEnabled = isIdentityDecisionActivationEnabled()
    return NextResponse.json({
      ok: true,
      available: true,
      proposal: {
        ...browserSafeProposal(proposal),
        decisionPreconditions,
        decisionControls: {
          enabled: decisionsEnabled,
          actions: ['approve', 'keep_separate', 'reject'],
          bulkDecisions: false,
          automaticAttachment: false,
        },
      },
      readOnly: !decisionsEnabled,
    })
  } catch (error) {
    if (error instanceof IdentityProposalNotFoundError || error instanceof IdentityDecisionContextNotFoundError) {
      return NextResponse.json({ ok: false, available: true, code: error.code, error: error.message }, { status: 404 })
    }
    if (error instanceof IdentitySchemaUnavailableError || isIdentitySchemaUnavailable(error)) {
      return NextResponse.json({
        ok: false,
        available: false,
        code: 'identity_schema_unavailable',
        error: 'The durable identity-review schema is not applied in this environment.',
      }, { status: 503 })
    }
    return NextResponse.json({
      ok: false,
      available: true,
      code: 'identity_proposal_read_failed',
      error: error instanceof Error ? error.message : 'Could not load this identity proposal.',
    }, { status: 500 })
  }
}
