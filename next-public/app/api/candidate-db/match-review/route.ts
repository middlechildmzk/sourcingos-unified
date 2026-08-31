import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'
import { compareSourceProfiles } from '@/lib/candidate-graph'
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
  return { profileA, profileB, comparison: compareSourceProfiles(profileA, profileB) }
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
    const { data, error } = await sb!
      .from('identity_match_reviews')
      .select('*')
      .eq('owner_id', session.userId!)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, mode: 'supabase', reviews: data || [] })
  }

  const db = getCandidateDb()
  return NextResponse.json({ ok: true, mode: 'preview', reviews: db.matchReviews })
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
          version: 'v29.2.1-proposal-only',
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
        version: 'v29.2.1-proposal-only',
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
