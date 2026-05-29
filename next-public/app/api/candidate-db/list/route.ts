import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { listCandidatesFromSupabase } from '@/lib/supabase-candidate-graph'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { getUserIdFromHeader } from '@/lib/supabase/auth'

export async function GET(req: NextRequest) {
  // Try Supabase when configured
  if (isSupabaseConfigured()) {
    const authHeader = req.headers.get('authorization')
    const userId = await getUserIdFromHeader(authHeader)
    if (userId) {
      const candidates = await listCandidatesFromSupabase(userId)
      return NextResponse.json({
        ok: true,
        persistence_mode: 'supabase',
        candidates,
        count: candidates.length,
      })
    }
  }

  // Fall back to in-memory preview store
  const db = getCandidateDb()
  return NextResponse.json({
    ok: true,
    persistence_mode: 'preview',
    ...db,
    _note: isSupabaseConfigured()
      ? 'Supabase configured but no auth token supplied — returning preview store.'
      : 'Preview mode: data resets between serverless invocations. Configure Supabase for durability.',
  })
}
