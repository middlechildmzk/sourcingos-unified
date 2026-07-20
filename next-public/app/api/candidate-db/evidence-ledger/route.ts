import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { buildEvidenceLedger } from '@/lib/evidence-ledger'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { listEvidenceLedgerFromSupabase } from '@/lib/supabase-evidence-ledger'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  candidateId: z.string().trim().min(1).max(120).optional(),
})

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = querySchema.safeParse({
    candidateId: req.nextUrl.searchParams.get('candidateId') || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid candidate filter.' }, { status: 400 })
  }

  const candidateId = parsed.data.candidateId

  if (gate.preview || !isSupabaseConfigured()) {
    const ledger = buildEvidenceLedger(getCandidateDb(), { candidateId })
    return NextResponse.json({
      ok: true,
      persistence_mode: 'preview',
      ...ledger,
      _note: 'Preview mode adapts the in-memory Candidate Database into the V19 evidence standard. Data is not durable.',
    })
  }

  const result = await listEvidenceLedgerFromSupabase(gate.userId, candidateId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: 'Evidence Ledger read failed.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    persistence_mode: 'supabase',
    ...result.ledger,
  })
}
