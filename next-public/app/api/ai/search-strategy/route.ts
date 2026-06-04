import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { generateSearchStrategy } from '@/lib/ai/sourcing-copilot'
import type { CopilotPlanInput } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (isSupabaseConfigured()) {
    const s = await getRouteSession()
    if (!s.authenticated) return NextResponse.json({ ok: false, code: 'auth_required', error: 'Sign in to use AI Copilot.' }, { status: 401 })
  }
  let body: CopilotPlanInput
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 }) }
  const result = await generateSearchStrategy(body || {})
  return NextResponse.json({ ok: true, result })
}
