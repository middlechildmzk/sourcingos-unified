import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso, scoreIdentityMatch, uid } from '@/lib/candidate-db-v18'

export async function GET() {
  const db = getCandidateDb()
  return NextResponse.json({ ok: true, reviews: db.matchReviews })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceProfileIds = body.sourceProfileIds as string[]
    if (!Array.isArray(sourceProfileIds) || sourceProfileIds.length < 2) return NextResponse.json({ ok: false, error: 'At least two sourceProfileIds are required.' }, { status: 400 })
    const db = getCandidateDb()
    const profiles = db.sourceProfiles.filter(profile => sourceProfileIds.includes(profile.id))
    if (profiles.length < 2) return NextResponse.json({ ok: false, error: 'Matching source profiles not found.' }, { status: 404 })
    const pair = scoreIdentityMatch(profiles[0], profiles[1])
    const review = {
      id: uid('match'),
      candidateId: profiles.find(p => p.candidateId)?.candidateId,
      sourceProfileIds,
      proposedCanonicalName: body.proposedCanonicalName || profiles[0].displayName,
      score: pair.score,
      reasons: pair.reasons,
      conflicts: pair.conflicts,
      decision: 'pending' as const,
      createdAt: nowIso()
    }
    db.matchReviews.unshift(review)
    return NextResponse.json({ ok: true, review, profiles })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Match review failed' }, { status: 500 })
  }
}
