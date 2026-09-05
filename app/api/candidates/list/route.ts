import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { queueSnapshot } from '@/lib/candidate-store'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(null, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const snapshot = queueSnapshot()
  return NextResponse.json({ ok: true, ...snapshot, generatedAt: new Date().toISOString() })
}
