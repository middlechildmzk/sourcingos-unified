import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getAsyncContactEnrichmentJobV36_16, publicAsyncContactJobV36_16 } from '@/lib/contact-enrichment/async-enrichment-service-v36-16'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response
  if (gate.preview) return NextResponse.json({ ok: false, error: 'Async enrichment requires an authenticated durable workspace.' }, { status: 503 })
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false, error: 'Job id is required.' }, { status: 400 })
  try {
    const job = await getAsyncContactEnrichmentJobV36_16(gate.userId, id)
    if (!job) return NextResponse.json({ ok: false, error: 'Async enrichment job not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, job: publicAsyncContactJobV36_16(job) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not load async enrichment job.' }, { status: 502 })
  }
}
