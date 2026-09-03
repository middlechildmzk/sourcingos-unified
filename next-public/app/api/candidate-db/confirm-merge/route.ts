import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso } from '@/lib/candidate-db-v18'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

// Guardrail: no auto-merge — recruiter action required for every merge decision.
// 'confirmed' = atomically link explicitly reviewed source-profile provenance to
// the selected canonical candidate; 'rejected' = keep identities separate.

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const reviewId = String(body.reviewId || '')
    const decision = body.decision === 'confirmed' ? 'confirmed' : body.decision === 'rejected' ? 'rejected' : ''
    const decidedBy = String(body.decidedBy || 'recruiter').slice(0, 120)

    if (!reviewId || !decision) {
      return NextResponse.json({ ok: false, error: 'reviewId and decision (confirmed|rejected) are required.' }, { status: 400 })
    }

    // ── Supabase mode ──────────────────────────────────────────────────────────
    if (isSupabaseConfigured()) {
      const session = await getRouteSession()
      if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

      const sb = createServerSupabaseClient()
      const ownerId = session.userId!
      if (!sb) return NextResponse.json({ ok: false, error: 'Candidate database unavailable.' }, { status: 503 })

      // V34: one database transaction owns the entire recruiter-confirmed
      // identity decision. A partial route-level write can no longer leave the
      // source profile on one candidate while its evidence/contact rows remain
      // on another candidate.
      const { data, error } = await sb.rpc('confirm_identity_match_atomic_v34', {
        p_owner_id: ownerId,
        p_review_id: reviewId,
        p_decision: decision,
        p_decided_by: decidedBy || 'recruiter',
      })

      if (error) {
        console.error('[confirm-merge] atomic identity fusion RPC failed:', error.message)
        return NextResponse.json({ ok: false, error: 'Identity decision could not be committed atomically.' }, { status: 500 })
      }

      const result = data && typeof data === 'object' && !Array.isArray(data)
        ? data as Record<string, unknown>
        : {}
      if (result.ok === false) {
        const status = Number(result.status || 409)
        return NextResponse.json({
          ok: false,
          code: String(result.code || 'identity_decision_failed'),
          error: String(result.error || 'Identity decision could not be completed.'),
        }, { status: Number.isInteger(status) && status >= 400 && status < 600 ? status : 409 })
      }

      const profilesUpdated = Number(result.sourceProfilesMoved || 0)
      return NextResponse.json({
        ok: true,
        mode: 'supabase',
        decision,
        reviewId,
        candidateId: result.candidateId || undefined,
        profilesUpdated,
        fusion: decision === 'confirmed' ? {
          evidenceMoved: Number(result.evidenceMoved || 0),
          contactsMoved: Number(result.contactsMoved || 0),
          availabilityMoved: Number(result.availabilityMoved || 0),
          roleCandidatesMoved: Number(result.roleCandidatesMoved || 0),
          acquisitionRowsMoved: Number(result.acquisitionRowsMoved || 0),
        } : undefined,
        note: decision === 'confirmed'
          ? `Identity match confirmed. ${profilesUpdated} explicitly reviewed source profile(s) and their linked provenance were moved atomically to the canonical candidate. Merge was recruiter-approved, not automatic.`
          : 'Profiles kept separate. No merge performed. Each source profile retains independent identity.',
      })
    }

    // ── Preview fallback ─────────────────────────────────────────────────────
    const db = getCandidateDb()
    const review = db.matchReviews.find(r => r.id === reviewId)
    if (!review) return NextResponse.json({ ok: false, error: 'Review not found (preview mode).' }, { status: 404 })
    if (review.decision !== 'pending') {
      return NextResponse.json({ ok: false, error: 'Identity review has already been decided.' }, { status: 409 })
    }

    review.decision = decision
    review.decidedBy = decidedBy || 'recruiter'
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
