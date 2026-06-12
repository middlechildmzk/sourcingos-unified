import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { z } from 'zod'
import { saveCandidateGraph } from '@/lib/candidate-store'

const schema = z.object({ candidateGraph: z.array(z.any()).min(1) })

export async function POST(req: Request) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = schema.parse(await req.json())
    const candidates = saveCandidateGraph(body.candidateGraph)
    return NextResponse.json({ ok: true, candidates, savedCount: body.candidateGraph.length, note: 'Preview persistence uses an in-memory adapter. Use sql/candidate-graph-schema.sql for Supabase/Postgres.' })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Save failed' }, { status: 400 })
  }
}
