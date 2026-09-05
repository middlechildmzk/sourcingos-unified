import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { createRefreshPlan } from '@/lib/candidate-intelligence-v18'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(null, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const db = getCandidateDb()
  return NextResponse.json({ ok: true, plan: createRefreshPlan(db) })
}
