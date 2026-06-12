import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso } from '@/lib/candidate-db-v18'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

// Guardrail: no auto-merge — recruiter action required for every merge decision.
// 'confirmed' = link source profiles to candidate; 'rejected' = keep separate.

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const reviewId = String(body.reviewId || '')
    const decision = body.decision === 'confirmed' ? 'confirmed' : body.decision === 'rejected' ? 'rejected' : ''
    const decidedBy = String(body.decidedBy || 'recruiter')

    if (!reviewId || !decision) {
      return NextResponse.json({ ok: false, error: 'reviewId and decision (confirmed|rejected) are required.' }, { status: 400 })
    }

    // ── Supabase mode ──────────────────────────────────────────────────────────
    if (isSupabaseConfigured()) {
      const session = await getRouteSession()
      if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

      const sb = createServerSupabaseClient()
      const ownerId = session.userId!

      // Fetch the review — must be owned by this user
      const { data: review, error: fetchError } = await sb!
        .from('identity_match_reviews')
        .select('*')
        .eq('id', reviewId)
        .eq('owner_id', ownerId)
        .single()

      if (fetchError || !review) {
        return NextResponse.json({ ok: false, error: 'Review not found or not owned by you.' }, { status: 404 })
      }

      // 1. Update the review decision (creates audit record)
      const { error: updateReviewError } = await sb!
        .from('identity_match_reviews')
        .update({
          decision,
          decided_by: decidedBy,
          decided_at: new Date().toISOString(),
        })
        .eq('id', reviewId)
        .eq('owner_id', ownerId)

      if (updateReviewError) {
        return NextResponse.json({ ok: false, error: `Review update failed: ${updateReviewError.message}` }, { status: 500 })
      }

      // 2. Update source_profiles.status for all involved profiles
      const profileIds: string[] = Array.isArray(review.source_profile_ids) ? review.source_profile_ids : []
      if (profileIds.length > 0) {
        const { error: spError } = await sb!
          .from('source_profiles')
          .update({ status: decision, updated_at: new Date().toISOString() })
          .in('id', profileIds)
          .eq('owner_id', ownerId)

        if (spError) {
          console.error('[confirm-merge] source_profiles update error:', spError.message)
        }
      }

      // 3. On confirmed merge: link source profiles to the candidate
      if (decision === 'confirmed' && review.candidate_id) {
        const { error: linkError } = await sb!
          .from('source_profiles')
          .update({ candidate_id: review.candidate_id, updated_at: new Date().toISOString() })
          .in('id', profileIds)
          .eq('owner_id', ownerId)

        if (linkError) {
          console.error('[confirm-merge] source profile link error:', linkError.message)
        }

        // Update the candidate's merge_status
        const { error: candError } = await sb!
          .from('candidates')
          .update({ merge_status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', review.candidate_id)
          .eq('owner_id', ownerId)

        if (candError) {
          console.error('[confirm-merge] candidate merge_status update error:', candError.message)
        }
      }

      return NextResponse.json({
        ok: true,
        mode: 'supabase',
        decision,
        reviewId,
        profilesUpdated: profileIds.length,
        note: decision === 'confirmed'
          ? `Identity match confirmed. ${profileIds.length} source profile(s) linked to candidate. Merge was recruiter-approved, not automatic.`
          : `Profiles kept separate. No merge performed. Each source profile retains independent identity.`,
      })
    }

    // ── Preview fallback ─────────────────────────────────────────────────────
    const db = getCandidateDb()
    const review = db.matchReviews.find(r => r.id === reviewId)
    if (!review) return NextResponse.json({ ok: false, error: 'Review not found (preview mode).' }, { status: 404 })

    review.decision = decision
    review.decidedBy = decidedBy
    review.decidedAt = nowIso()

    const profiles = db.sourceProfiles.filter(p => review.sourceProfileIds.includes(p.id))
    profiles.forEach(p => { p.status = decision })

    if (decision === 'confirmed') {
      const candidate = db.candidates.find(c => c.id === review.candidateId)
        || db.candidates.find(c => c.id === profiles[0]?.candidateId)
      if (candidate) {
        const ids = Array.from(new Set([...candidate.sourceProfileIds, ...profiles.map(p => p.id)]))
        candidate.sourceProfileIds = ids
        candidate.mergeStatus = 'confirmed'
        candidate.updatedAt = nowIso()
        profiles.forEach(p => { p.candidateId = candidate.id })
        db.evidenceItems.filter(e => review.sourceProfileIds.includes(e.sourceProfileId || '')).forEach(e => { e.candidateId = candidate.id })
        db.contactSignals.filter(c => review.sourceProfileIds.includes(c.sourceProfileId || '')).forEach(c => { c.candidateId = candidate.id })
        db.openToWorkSignals.filter(s => review.sourceProfileIds.includes(s.sourceProfileId || '')).forEach(s => { s.candidateId = candidate.id })
      }
    }

    return NextResponse.json({
      ok: true, mode: 'preview', decision, review, profiles,
      note: 'Preview mode — decision is in-memory only.',
    })

  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Merge decision failed' }, { status: 500 })
  }
}
