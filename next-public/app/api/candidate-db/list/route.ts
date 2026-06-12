// ─────────────────────────────────────────────────────────────────────────────
// /api/candidate-db/list — List candidates for the authenticated user.
// Security sprint: auth REQUIRED (fail-closed). Reads are scoped to the
// session user; the Authorization-header/preview-store fallback is gone and
// responses no longer leak configuration details.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { listCandidatesFromSupabase } from '@/lib/supabase-candidate-graph'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  // Explicit preview bypass → in-memory store, clearly labeled, never durable.
  if (gate.preview || !isSupabaseConfigured()) {
    const db = getCandidateDb()
    return NextResponse.json({
      ok: true,
      persistence_mode: 'preview',
      ...db,
      _note: 'Preview mode: data resets between restarts and is not durable.',
    })
  }

  const candidates = await listCandidatesFromSupabase(gate.userId)
  return NextResponse.json({
    ok: true,
    persistence_mode: 'supabase',
    candidates,
    count: candidates.length,
  })
}
