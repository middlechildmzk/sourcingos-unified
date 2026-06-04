import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { generateSearchNext } from '@/lib/ai/sourcing-copilot'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (isSupabaseConfigured()) {
    const s = await getRouteSession()
    if (!s.authenticated) {
      return NextResponse.json({ ok: false, code: 'auth_required', error: 'Sign in to use AI Copilot.' }, { status: 401 })
    }
  }
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid body.' }, { status: 400 }) }
  const result = await generateSearchNext(body || {})
  return NextResponse.json({ ok: true, result })
}
