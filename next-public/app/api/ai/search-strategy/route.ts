import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { generateSearchStrategy } from '@/lib/ai/sourcing-copilot'
import type { CopilotPlanInput } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'ai', gate.userId)
  if (!rl.ok) return rl.response

  let body: CopilotPlanInput
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 }) }
  const result = await generateSearchStrategy(body || {})
  return NextResponse.json({ ok: true, result })
}
