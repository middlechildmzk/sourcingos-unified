import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron-auth'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { runEnrichmentTickV40_4 } from '@/lib/fleet/enrichment-runtime-v40-4'

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
    const result = await runEnrichmentTickV40_4(sb)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Enrichment tick failed.' }, { status: 500 })
  }
}
