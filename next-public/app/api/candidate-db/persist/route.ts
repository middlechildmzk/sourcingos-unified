import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import {
  persistCandidateGraphSnapshot,
  requiredCandidateGraphEnv,
  hasSupabaseCandidateGraphEnv,
} from '@/lib/supabase-candidate-graph'
import { getUserIdFromHeader } from '@/lib/supabase/auth'

export async function GET() {
  const configured = hasSupabaseCandidateGraphEnv()
  return NextResponse.json({
    ok: true,
    configured,
    mode: configured ? 'supabase' : 'preview',
    message: configured
      ? 'Supabase is configured. POST to this route to persist the current snapshot.'
      : 'Preview memory mode. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistence.',
    requiredEnv: requiredCandidateGraphEnv,
  })
}

export async function POST(req: NextRequest) {
  try {
    const snapshot = getCandidateDb()
    // Try to get the caller's user ID from auth header
    const authHeader = req.headers.get('authorization')
    const userId = await getUserIdFromHeader(authHeader)

    const result = await persistCandidateGraphSnapshot(
      snapshot,
      userId ?? undefined  // falls back to SUPABASE_DEFAULT_OWNER_ID inside
    )
    return NextResponse.json(result, { status: result.ok ? 200 : 207 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Persist failed' },
      { status: 500 }
    )
  }
}
