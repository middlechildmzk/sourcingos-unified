import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import {
  type ConversationalSourcingPlanV36_15,
} from '@/lib/agent-runtime-v36-15'
import { planConversationalSourcingTurnV36_16 } from '@/lib/agent-runtime-v36-16'

export const dynamic = 'force-dynamic'

const requirementSchema = z.object({ text: z.string().max(300), mustHave: z.boolean() })
const previousPlanSchema = z.object({
  version: z.literal('v36.15'),
  action: z.enum(['search_people', 'approval_required']),
  assistantSummary: z.string().max(1000),
  providerRequest: z.object({
    query: z.string().max(3000),
    requirements: z.array(requirementSchema).max(30).optional(),
    names: z.array(z.string().max(180)).max(20).optional(),
    titles: z.array(z.string().max(160)).max(20).optional(),
    skills: z.array(z.string().max(160)).max(40).optional(),
    companies: z.array(z.string().max(180)).max(30).optional(),
    locations: z.array(z.string().max(120)).max(20).optional(),
    limit: z.number().int().min(1).max(50),
    highFreshness: z.boolean(),
  }),
  criteria: z.object({
    titles: z.array(z.string().max(160)).max(20),
    skills: z.array(z.string().max(160)).max(40),
    companies: z.array(z.string().max(180)).max(30),
    locations: z.array(z.string().max(120)).max(20),
    requirements: z.array(requirementSchema).max(30),
    limit: z.number().int().min(1).max(50),
  }),
  toolPlan: z.array(z.object({
    tool: z.enum(['search_people', 'enrich_person', 'find_contacts', 'save_candidate', 'engage', 'sync_ats']),
    rationale: z.string().max(1000),
    costClass: z.enum(['breadth', 'paid_enrichment', 'consequential']),
    freshnessClass: z.enum(['provider_index', 'live_or_paid', 'not_applicable']),
    approvalRequired: z.boolean(),
    executableNow: z.boolean(),
    targetCount: z.number().int().min(1).max(25).optional(),
  })).max(8),
  readOnly: z.literal(true),
  model: z.object({
    configured: z.boolean(),
    used: z.boolean(),
    provider: z.string().max(40).optional(),
    model: z.string().max(120).optional(),
  }),
  assumptions: z.array(z.string().max(240)).max(12),
  warnings: z.array(z.string().max(500)).max(20),
}).strict()

const bodySchema = z.object({
  message: z.string().trim().min(2).max(3000),
  previousPlan: previousPlanSchema.optional(),
}).strict()

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'ai', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid conversational sourcing request.', details: parsed.error.flatten() }, { status: 400 })
  }

  const plan = await planConversationalSourcingTurnV36_16({
    message: parsed.data.message,
    previousPlan: parsed.data.previousPlan as ConversationalSourcingPlanV36_15 | undefined,
  })

  return NextResponse.json({
    ok: true,
    plan,
    trust: {
      readOnlyAutoExecutionOnly: true,
      searchResultsAreObservations: true,
      liveWebContentIsUntrustedEvidence: true,
      providerRationaleIsCandidateEvidence: false,
      contactRevealPerformed: false,
      identityMergePerformed: false,
      recruiterDecisionPerformed: false,
      outreachPerformed: false,
      atsWritePerformed: false,
    },
  })
}
