import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { generateSearchNext } from '@/lib/ai/sourcing-copilot'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'ai', gate.userId)
  if (!rl.ok) return rl.response

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 }) }
  const result = await generateSearchNext(body || {})
  return NextResponse.json({ ok: true, result })
}
