import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { parseRoleBriefWithAiV33_4 } from '@/lib/ai/role-brief-parser-v33-4'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'ai', gate.userId)
  if (!rl.ok) return rl.response

  let body: { text?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 }) }
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (text.length < 10) return NextResponse.json({ ok: false, error: 'Describe who you need in a sentence or paste the job description.' }, { status: 400 })
  if (text.length > 20000) return NextResponse.json({ ok: false, error: 'Role context is too long. Keep the request under 20,000 characters.' }, { status: 400 })

  const result = await parseRoleBriefWithAiV33_4(text)
  return NextResponse.json({ ok: true, result })
}
