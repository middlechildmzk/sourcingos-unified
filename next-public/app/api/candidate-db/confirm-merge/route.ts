import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso } from '@/lib/candidate-db-v18'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const reviewId = String(body.reviewId || '')
    const decision = body.decision === 'confirmed' ? 'confirmed' : body.decision === 'rejected' ? 'rejected' : ''
    if (!reviewId || !decision) return NextResponse.json({ ok: false, error: 'reviewId and confirmed/rejected decision are required.' }, { status: 400 })
    const db = getCandidateDb()
    const review = db.matchReviews.find(item => item.id === reviewId)
    if (!review) return NextResponse.json({ ok: false, error: 'Review not found.' }, { status: 404 })
    review.decision = decision
    review.decidedBy = String(body.decidedBy || 'preview-recruiter')
    review.decidedAt = nowIso()
    const profiles = db.sourceProfiles.filter(profile => review.sourceProfileIds.includes(profile.id))
    profiles.forEach(profile => { profile.status = decision })
    if (decision === 'confirmed') {
      const candidate = db.candidates.find(item => item.id === review.candidateId) || db.candidates.find(item => item.id === profiles[0]?.candidateId)
      if (candidate) {
        const ids = Array.from(new Set([...candidate.sourceProfileIds, ...profiles.map(p => p.id)]))
        candidate.sourceProfileIds = ids
        candidate.mergeStatus = 'confirmed'
        candidate.updatedAt = nowIso()
        profiles.forEach(profile => { profile.candidateId = candidate.id })
        db.evidenceItems.filter(item => review.sourceProfileIds.includes(item.sourceProfileId || '')).forEach(item => { item.candidateId = candidate.id })
        db.contactSignals.filter(item => review.sourceProfileIds.includes(item.sourceProfileId || '')).forEach(item => { item.candidateId = candidate.id })
        db.openToWorkSignals.filter(item => review.sourceProfileIds.includes(item.sourceProfileId || '')).forEach(item => { item.candidateId = candidate.id })
      }
    }
    return NextResponse.json({ ok: true, review, profiles })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Merge decision failed' }, { status: 500 })
  }
}
