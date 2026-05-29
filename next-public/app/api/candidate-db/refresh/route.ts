import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { markCandidateRefreshed } from '@/lib/candidate-intelligence-v18'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const candidateId = String(body.candidateId || '')
    if (!candidateId) return NextResponse.json({ ok: false, error: 'candidateId is required' }, { status: 400 })
    const db = getCandidateDb()
    const candidate = markCandidateRefreshed(db, candidateId)
    if (!candidate) return NextResponse.json({ ok: false, error: 'Candidate not found' }, { status: 404 })
    return NextResponse.json({ ok: true, candidate, note: 'Preview refresh complete. Production refresh should diff source APIs and append changed evidence.' })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Refresh failed' }, { status: 500 })
  }
}
