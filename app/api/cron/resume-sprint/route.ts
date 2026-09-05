import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { runResumeSprintTickV40_5 } from '@/lib/fleet/resume-sprint-v40-5'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req)
  if (auth === 'unavailable') return NextResponse.json({ ok: false, error: 'Cron authentication is unavailable.' }, { status: 503 })
  if (auth !== 'authorized') return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 503 })

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })

  try {
    const result = await runResumeSprintTickV40_5(sb)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Resume sprint tick failed.' }, { status: 500 })
  }
}
