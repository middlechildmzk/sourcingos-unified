import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso, scoreIdentityMatch, uid } from '@/lib/candidate-db-v18'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

export async function GET() {
  // ── Supabase mode ──────────────────────────────────────────────────────────
  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

    const sb = createServerSupabaseClient()
    const { data, error } = await sb!
      .from('identity_match_reviews')
      .select('*')
      .eq('owner_id', session.userId!)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, mode: 'supabase', reviews: data || [] })
  }

  // ── Preview fallback ───────────────────────────────────────────────────────
  const db = getCandidateDb()
  return NextResponse.json({ ok: true, mode: 'preview', reviews: db.matchReviews })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const sourceProfileIds = body.sourceProfileIds as string[]
    if (!Array.isArray(sourceProfileIds) || sourceProfileIds.length < 2) {
      return NextResponse.json({ ok: false, error: 'At least two sourceProfileIds are required.' }, { status: 400 })
    }

    // ── Supabase mode ────────────────────────────────────────────────────────
    if (isSupabaseConfigured()) {
      const session = await getRouteSession()
      if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

      const sb = createServerSupabaseClient()
      const ownerId = session.userId!

      // Fetch both source profiles from Supabase for scoring
      const { data: profiles, error: spError } = await sb!
        .from('source_profiles')
        .select('*')
        .in('id', sourceProfileIds)
        .eq('owner_id', ownerId)

      if (spError) return NextResponse.json({ ok: false, error: spError.message }, { status: 500 })
      if (!profiles || profiles.length < 2) {
        return NextResponse.json({ ok: false, error: 'Source profiles not found or not owned by you.' }, { status: 404 })
      }

      // Score identity match using existing helper (maps snake_case → camelCase for scoring)
      const profileA = { ...profiles[0], displayName: profiles[0].display_name, profileUrl: profiles[0].profile_url }
      const profileB = { ...profiles[1], displayName: profiles[1].display_name, profileUrl: profiles[1].profile_url }
      const pair = scoreIdentityMatch(profileA as any, profileB as any)

      const candidateId = body.candidateId || profiles.find((p: any) => p.candidate_id)?.candidate_id || null

      const { data: review, error: insertError } = await sb!
        .from('identity_match_reviews')
        .insert({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_ids: sourceProfileIds,
          match_score: pair.score,
          match_reasons: pair.reasons,
          conflicts: pair.conflicts,
          decision: 'pending',
        })
        .select('*')
        .single()

      if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })

      return NextResponse.json({ ok: true, mode: 'supabase', review, profiles })
    }

    // ── Preview fallback ─────────────────────────────────────────────────────
    const db = getCandidateDb()
    const memProfiles = db.sourceProfiles.filter(p => sourceProfileIds.includes(p.id))
    if (memProfiles.length < 2) return NextResponse.json({ ok: false, error: 'Matching source profiles not found.' }, { status: 404 })

    const pair = scoreIdentityMatch(memProfiles[0], memProfiles[1])
    const review = {
      id: uid('match'),
      candidateId: body.candidateId || memProfiles.find(p => p.candidateId)?.candidateId,
      sourceProfileIds,
      proposedCanonicalName: body.proposedCanonicalName || memProfiles[0].displayName,
      score: pair.score, reasons: pair.reasons, conflicts: pair.conflicts,
      decision: 'pending' as const, createdAt: nowIso(),
    }
    db.matchReviews.unshift(review)
    return NextResponse.json({ ok: true, mode: 'preview', review, profiles: memProfiles })

  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Match review failed' }, { status: 500 })
  }
}
