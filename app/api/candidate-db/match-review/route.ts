import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'
import { compareSourceProfiles } from '@/lib/candidate-graph'
import { sharedProfessionalProfileAnchorsV36_10 } from '@/lib/identity-anchors-v36-10'
import { classifySourceResult } from '@/lib/entity-classification'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { allSourceNames, type SourceName, type SourceResult } from '@/lib/source-types'

export const dynamic = 'force-dynamic'

function parseRaw(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return {} }
}

/**
 * Reconstruct the canonical source-result envelope from durable or preview
 * source-profile rows. Rich V29.2+ saves retain the complete classified source
 * result in `raw`; older rows fall back conservatively to observed profile
 * fields only. Search criteria are never introduced here.
 */
function sourceResultFromStoredProfile(profile: any): SourceResult | null {
  const source = String(profile.source || '').trim() as SourceName
  if (!allSourceNames.includes(source)) return null

  const rawCandidate = parseRaw(profile.raw ?? profile.rawText ?? profile.raw_text)
  const rawRecord = rawCandidate && typeof rawCandidate === 'object' && !Array.isArray(rawCandidate)
    ? rawCandidate as Record<string, unknown>
    : {}
  const nested = rawRecord.raw && typeof rawRecord.raw === 'object' && !Array.isArray(rawRecord.raw)
    ? rawRecord.raw
    : rawCandidate

  const storedLooksCanonical = rawRecord.source === source
    && typeof rawRecord.sourceProfileId === 'string'
    && typeof rawRecord.displayName === 'string'

  const candidate: SourceResult = storedLooksCanonical
    ? {
        ...(rawRecord as unknown as SourceResult),
        source,
        sourceProfileId: String(rawRecord.sourceProfileId || profile.source_profile_id || profile.sourceProfileId || ''),
        displayName: String(rawRecord.displayName || profile.display_name || profile.displayName || '').trim(),
        profileUrl: String(rawRecord.profileUrl || profile.profile_url || profile.profileUrl || '').trim() || undefined,
        skills: Array.isArray(rawRecord.skills) ? rawRecord.skills.filter((item): item is string => typeof item === 'string') : [],
        evidence: Array.isArray(rawRecord.evidence) ? rawRecord.evidence as SourceResult['evidence'] : [],
        contactSignals: Array.isArray(rawRecord.contactSignals) ? rawRecord.contactSignals as SourceResult['contactSignals'] : [],
        identitySignals: Array.isArray(rawRecord.identitySignals) ? rawRecord.identitySignals as SourceResult['identitySignals'] : [],
        refreshedAt: typeof rawRecord.refreshedAt === 'string' ? rawRecord.refreshedAt : new Date().toISOString(),
        raw: nested,
      }
    : {
        id: String(profile.id || `${source}:${profile.source_profile_id || profile.sourceProfileId || ''}`),
        source,
        sourceProfileId: String(profile.source_profile_id || profile.sourceProfileId || '').trim(),
        entityKind: 'unknown',
        displayName: String(profile.display_name || profile.displayName || '').trim(),
        headline: String(profile.headline || '').trim() || undefined,
        location: String(profile.location || '').trim() || undefined,
        organization: String(profile.organization || '').trim() || undefined,
        profileUrl: String(profile.profile_url || profile.profileUrl || '').trim() || undefined,
        skills: [],
        evidence: [],
        contactSignals: [],
        identitySignals: [],
        refreshedAt: String(profile.last_seen_at || profile.lastSeenAt || profile.created_at || profile.createdAt || new Date().toISOString()),
        raw: nested,
      }

  if (!candidate.sourceProfileId || !candidate.displayName) return null
  return classifySourceResult(candidate)
}

function compareStoredProfiles(a: any, b: any) {
  const profileA = sourceResultFromStoredProfile(a)
  const profileB = sourceResultFromStoredProfile(b)
  if (!profileA || !profileB) return null
  const base = compareSourceProfiles(profileA, profileB)
  const professional = sharedProfessionalProfileAnchorsV36_10(profileA, profileB)
  return {
    profileA,
    profileB,
    comparison: {
      ...base,
      score: Math.min(100, base.score + (professional.matched ? 40 : 0)),
      reasons: Array.from(new Set([...base.reasons, ...professional.reasons])),
      deterministicRules: [
        ...base.deterministicRules,
        {
          ruleId: 'shared_canonical_professional_profile',
          passed: professional.matched,
          evidence: professional.matched
            ? professional.reasons.join(' · ')
            : 'No shared canonical professional profile URL',
        },
      ],
      deterministicAnchor: base.deterministicAnchor || professional.matched,
    },
  }
}

function profileForReview(row: any) {
  return {
    id: String(row.id || ''),
    candidateId: row.candidate_id || row.candidateId || undefined,
    source: String(row.source || ''),
    sourceProfileId: String(row.source_profile_id || row.sourceProfileId || ''),
    displayName: String(row.display_name || row.displayName || ''),
    headline: row.headline || undefined,
    organization: row.organization || undefined,
    location: row.location || undefined,
    profileUrl: row.profile_url || row.profileUrl || undefined,
    status: row.status || 'pending',
    lastSeenAt: row.last_seen_at || row.lastSeenAt || undefined,
  }
}

function candidateForReview(row: any) {
  return {
    id: String(row.id || ''),
    canonicalName: String(row.canonical_name || row.canonicalName || 'Unconfirmed identity'),
    headline: row.headline || row.current_title || row.currentTitle || undefined,
    currentCompany: row.current_company || row.currentCompany || undefined,
    location: row.location || undefined,
    mergeStatus: row.merge_status || row.mergeStatus || 'pending',
  }
}

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(null, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

    const sb = createServerSupabaseClient()
    const ownerId = session.userId!
    const { data, error } = await sb!
      .from('identity_match_reviews')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const reviews = data || []
    const sourceProfileIds = Array.from(new Set(reviews.flatMap((review: any) => Array.isArray(review.source_profile_ids) ? review.source_profile_ids : []).filter(Boolean)))
    const candidateIds = Array.from(new Set(reviews.map((review: any) => review.candidate_id).filter(Boolean)))

    const [profileResult, candidateResult] = await Promise.all([
      sourceProfileIds.length
        ? sb!.from('source_profiles').select('*').eq('owner_id', ownerId).in('id', sourceProfileIds)
        : Promise.resolve({ data: [], error: null }),
      candidateIds.length
        ? sb!.from('candidates').select('id,canonical_name,headline,current_title,current_company,location,merge_status').eq('owner_id', ownerId).in('id', candidateIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (profileResult.error || candidateResult.error) {
      return NextResponse.json({ ok: false, error: profileResult.error?.message || candidateResult.error?.message || 'Identity review context could not be loaded.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      mode: 'supabase',
      reviews,
      profiles: (profileResult.data || []).map(profileForReview),
      candidates: (candidateResult.data || []).map(candidateForReview),
      pendingCount: reviews.filter((review: any) => review.decision === 'pending').length,
    })
  }

  const db = getCandidateDb()
  const reviewProfileIds = new Set(db.matchReviews.flatMap(review => review.sourceProfileIds))
  const reviewCandidateIds = new Set(db.matchReviews.map(review => review.candidateId).filter(Boolean) as string[])
  return NextResponse.json({
    ok: true,
    mode: 'preview',
    reviews: db.matchReviews,
    profiles: db.sourceProfiles.filter(profile => reviewProfileIds.has(profile.id)).map(profileForReview),
    candidates: db.candidates.filter(candidate => reviewCandidateIds.has(candidate.id)).map(candidateForReview),
    pendingCount: db.matchReviews.filter(review => review.decision === 'pending').length,
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const sourceProfileIds = body.sourceProfileIds as string[]
    if (!Array.isArray(sourceProfileIds) || sourceProfileIds.length !== 2) {
      return NextResponse.json({ ok: false, error: 'Exactly two sourceProfileIds are required for an explainable identity review.' }, { status: 400 })
    }

    if (isSupabaseConfigured()) {
      const session = await getRouteSession()
      if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })

      const sb = createServerSupabaseClient()
      const ownerId = session.userId!
      const { data: profiles, error: spError } = await sb!
        .from('source_profiles')
        .select('*')
        .in('id', sourceProfileIds)
        .eq('owner_id', ownerId)

      if (spError) return NextResponse.json({ ok: false, error: spError.message }, { status: 500 })
      if (!profiles || profiles.length !== 2) {
        return NextResponse.json({ ok: false, error: 'Source profiles not found or not owned by you.' }, { status: 404 })
      }

      const resolved = compareStoredProfiles(profiles[0], profiles[1])
      if (!resolved) {
        return NextResponse.json({ ok: false, error: 'These source profiles cannot be safely reconstructed for identity review.' }, { status: 422 })
      }
      const { comparison } = resolved
      if (comparison.sameStableId) {
        return NextResponse.json({ ok: false, error: 'Exact same-source identities are reused automatically and do not require a cross-source review.' }, { status: 409 })
      }
      if (comparison.blocked) {
        return NextResponse.json({ ok: false, error: 'Identity review blocked because at least one source subject is not a person.', conflicts: comparison.conflicts }, { status: 422 })
      }

      const candidateId = body.candidateId || profiles.find((profile: any) => profile.candidate_id)?.candidate_id || null
      if (!candidateId) {
        return NextResponse.json({ ok: false, error: 'A canonical candidate target is required before creating an identity review.' }, { status: 409 })
      }

      const { data: review, error: insertError } = await sb!
        .from('identity_match_reviews')
        .insert({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_ids: sourceProfileIds,
          match_score: comparison.score,
          match_reasons: comparison.reasons,
          conflicts: comparison.conflicts,
          decision: 'pending',
        })
        .select('*')
        .single()

      if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 })

      return NextResponse.json({
        ok: true,
        mode: 'supabase',
        review,
        profiles,
        resolver: {
          version: 'v36.10-professional-anchor-review',
          deterministicAnchor: comparison.deterministicAnchor,
          deterministicRules: comparison.deterministicRules,
          conflicts: comparison.conflicts,
          mergeAuthorized: false,
          reviewRequired: true,
        },
      })
    }

    const db = getCandidateDb()
    const memProfiles = db.sourceProfiles.filter(profile => sourceProfileIds.includes(profile.id))
    if (memProfiles.length !== 2) return NextResponse.json({ ok: false, error: 'Matching source profiles not found.' }, { status: 404 })

    const resolved = compareStoredProfiles(memProfiles[0], memProfiles[1])
    if (!resolved) return NextResponse.json({ ok: false, error: 'These source profiles cannot be safely reconstructed for identity review.' }, { status: 422 })
    const { comparison } = resolved
    if (comparison.sameStableId) return NextResponse.json({ ok: false, error: 'Exact same-source identities are reused automatically.' }, { status: 409 })
    if (comparison.blocked) return NextResponse.json({ ok: false, error: 'Identity review blocked because at least one source subject is not a person.', conflicts: comparison.conflicts }, { status: 422 })

    const candidateId = body.candidateId || memProfiles.find(profile => profile.candidateId)?.candidateId
    if (!candidateId) return NextResponse.json({ ok: false, error: 'A canonical candidate target is required before creating an identity review.' }, { status: 409 })

    const review = {
      id: uid('match'),
      candidateId,
      sourceProfileIds,
      proposedCanonicalName: body.proposedCanonicalName || memProfiles[0].displayName,
      score: comparison.score,
      reasons: comparison.reasons,
      conflicts: comparison.conflicts.map(conflict => conflict.explanation),
      decision: 'pending' as const,
      createdAt: nowIso(),
    }
    db.matchReviews.unshift(review)
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      review,
      profiles: memProfiles,
      resolver: {
        version: 'v36.10-professional-anchor-review',
        deterministicAnchor: comparison.deterministicAnchor,
        deterministicRules: comparison.deterministicRules,
        conflicts: comparison.conflicts,
        mergeAuthorized: false,
        reviewRequired: true,
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Match review failed' }, { status: 500 })
  }
}
