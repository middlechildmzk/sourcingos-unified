import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { buildCandidateProfessionalProfileV36_14 } from '@/lib/candidate-professional-profile-v36-14'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { candidateIdentityFamiliesV36_10, resolveCanonicalCandidateIdV36_10 } from '@/lib/candidate-identity-redirects-v36-10'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response
  const { id: requestedCandidateId } = await params

  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
    const ownerId = session.userId!

    const canonical = await resolveCanonicalCandidateIdV36_10({ sb, ownerId, candidateId: requestedCandidateId })
    const candidateId = canonical.candidateId
    const identityFamilies = await candidateIdentityFamiliesV36_10({ sb, ownerId, candidateIds: [candidateId] })
    const familyCandidateIds = identityFamilies.canonicalToFamily.get(candidateId) || [candidateId]
    const { data, error } = await sb
      .from('source_profiles')
      .select('id,source,source_profile_id,last_seen_at,raw')
      .in('candidate_id', familyCandidateIds)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: `Professional profile sources could not be loaded: ${error.message}` }, { status: 502 })
    return NextResponse.json({
      ok: true,
      candidateId,
      requestedCandidateId,
      profile: buildCandidateProfessionalProfileV36_14(data || []),
      mode: 'supabase',
    })
  }

  const db = getCandidateDb()
  const candidate = db.candidates.find(item => item.id === requestedCandidateId)
  if (!candidate) return NextResponse.json({ ok: false, error: 'Candidate not found in preview mode.' }, { status: 404 })
  const sourceProfiles = db.sourceProfiles.filter(profile => candidate.sourceProfileIds.includes(profile.id) || profile.candidateId === candidate.id)
  return NextResponse.json({
    ok: true,
    candidateId: candidate.id,
    requestedCandidateId,
    profile: buildCandidateProfessionalProfileV36_14(sourceProfiles),
    mode: 'preview',
  })
}
