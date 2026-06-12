import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { z } from 'zod'
import { applyMergeDecision } from '@/lib/candidate-store'

const schema = z.object({
  candidateId: z.string().min(2),
  sourceProfileIds: z.array(z.string()).min(1),
  decision: z.enum(['pending', 'confirmed', 'rejected']),
  decidedBy: z.string().optional().default('recruiter')
})

export async function POST(req: Request) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = schema.parse(await req.json())
    const candidate = applyMergeDecision(body.candidateId, body.sourceProfileIds, body.decision, body.decidedBy)
    if (!candidate) return NextResponse.json({ ok: false, error: 'Candidate not found' }, { status: 404 })
    return NextResponse.json({ ok: true, candidate, guardrail: 'Merge decisions are explicit recruiter actions. SourcingOS does not auto-merge identities.' })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Merge decision failed' }, { status: 400 })
  }
}
