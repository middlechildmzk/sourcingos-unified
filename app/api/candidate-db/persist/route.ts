// ─────────────────────────────────────────────────────────────────────────────
// /api/candidate-db/persist — Persist the in-memory candidate snapshot.
// Security sprint: auth REQUIRED (fail-closed). Writes are scoped to the
// authenticated user only — the SUPABASE_DEFAULT_OWNER_ID fallback is gone.
// GET no longer returns env-var names or internal configuration details.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { persistCandidateGraphSnapshot, hasSupabaseCandidateGraphEnv } from '@/lib/supabase-candidate-graph'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  const configured = hasSupabaseCandidateGraphEnv()
  return NextResponse.json({
    ok: true,
    mode: configured ? 'supabase' : 'preview',
    message: configured
      ? 'Persistence is available. POST to this route to persist the current snapshot.'
      : 'Persistence is not available in this environment. Saved work will not survive a restart.',
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  // Preview-bypass sessions may exercise the flow but can never write to Supabase.
  if (gate.preview) {
    return NextResponse.json({
      ok: false,
      mode: 'preview',
      message: 'Preview mode: persistence is disabled. Saved work will not survive a restart.',
    }, { status: 200 })
  }

  try {
    const snapshot = getCandidateDb()
    const result = await persistCandidateGraphSnapshot(snapshot, gate.userId)
    return NextResponse.json(result, { status: result.ok ? 200 : 207 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Persist failed.' }, { status: 500 })
  }
}
