import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { buildCandidate360 } from '@/lib/candidate-intelligence-v18'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getCandidateDb()
  const dossier = buildCandidate360(db, params.id)
  if (!dossier) return NextResponse.json({ ok: false, error: 'Candidate not found' }, { status: 404 })
  return NextResponse.json({ ok: true, dossier })
}
