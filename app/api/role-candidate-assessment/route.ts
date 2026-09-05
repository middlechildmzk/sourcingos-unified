import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb, type CandidateDbSnapshot } from '@/lib/candidate-db-v18'
import { fuseCandidateIdentityV34 } from '@/lib/candidate-identity-fusion-v34'
import { resolveCandidate360FieldsV35 } from '@/lib/candidate-field-resolution-v35'
import { buildEvidenceLedger } from '@/lib/evidence-ledger'
import { buildRequirementAssessments, requirementAssessmentTally } from '@/lib/requirement-assessment-v32'
import { buildRoleCandidateIntelligenceV35 } from '@/lib/entity-intelligence/role-candidate-intelligence-v35'
import { normalizeRoleSearchIntelligenceV35 } from '@/lib/entity-intelligence/search-approval-v35'
import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CandidateInput = Pick<RoleCandidate, 'candidateId' | 'name' | 'headline' | 'company' | 'location' | 'fitReasons' | 'concerns' | 'tags' | 'contactStatus' | 'evidenceStatus'>

type RequestBody = {
  intake?: RoleIntake
  candidates?: CandidateInput[]
  searchIntelligence?: unknown
}

function compactText(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function textArray(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => compactText(item, 300)).filter(Boolean))).slice(0, max)
}

function sameText(a: unknown, b: unknown): boolean {
  return compactText(a, 1000).toLowerCase() === compactText(b, 1000).toLowerCase()
}

function validIntake(value: unknown): RoleIntake | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  return {
    title: compactText(input.title, 300) || 'Untitled role',
    location: compactText(input.location, 300) || 'Not specified',
    workMode: ['remote', 'hybrid', 'onsite', 'flexible', 'unknown'].includes(String(input.workMode)) ? input.workMode as RoleIntake['workMode'] : 'unknown',
    compensation: compactText(input.compensation, 300) || 'Not specified',
    clearance: compactText(input.clearance, 300) || 'Not specified',
    mustHaves: textArray(input.mustHaves),
    niceToHaves: textArray(input.niceToHaves),
    disqualifiers: textArray(input.disqualifiers),
    targetCompanies: textArray(input.targetCompanies),
    adjacentBackgrounds: textArray(input.adjacentBackgrounds),
    hiringManagerNotes: compactText(input.hiringManagerNotes, 3000),
    rawDescription: compactText(input.rawDescription, 12000),
  }
}

function validCandidate(value: unknown): CandidateInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const candidateId = compactText(input.candidateId, 200)
  const name = compactText(input.name, 300)
  if (!candidateId || !name) return null
  const contactStatus = ['unknown', 'signals_found', 'verified', 'blocked'].includes(String(input.contactStatus))
    ? input.contactStatus as RoleCandidate['contactStatus']
    : 'unknown'
  const evidenceStatus = ['unreviewed', 'reviewed', 'conflicting', 'stale'].includes(String(input.evidenceStatus))
    ? input.evidenceStatus as RoleCandidate['evidenceStatus']
    : 'unreviewed'
  return {
    candidateId,
    name,
    headline: compactText(input.headline, 500),
    company: compactText(input.company, 300),
    location: compactText(input.location, 300),
    fitReasons: textArray(input.fitReasons, 20),
    concerns: textArray(input.concerns, 20),
    tags: textArray(input.tags, 20),
    contactStatus,
    evidenceStatus,
  }
}

function subsetPreview(snapshot: CandidateDbSnapshot, ids: Set<string>): CandidateDbSnapshot {
  const profiles = snapshot.sourceProfiles.filter(profile => profile.candidateId && ids.has(profile.candidateId))
  const profileIds = new Set(profiles.map(profile => profile.id))
  return {
    candidates: snapshot.candidates.filter(candidate => ids.has(candidate.id)),
    sourceProfiles: profiles,
    evidenceItems: snapshot.evidenceItems.filter(item => (item.candidateId && ids.has(item.candidateId)) || (item.sourceProfileId && profileIds.has(item.sourceProfileId))),
    contactSignals: snapshot.contactSignals.filter(item => (item.candidateId && ids.has(item.candidateId)) || (item.sourceProfileId && profileIds.has(item.sourceProfileId))),
    openToWorkSignals: snapshot.openToWorkSignals.filter(item => (item.candidateId && ids.has(item.candidateId)) || (item.sourceProfileId && profileIds.has(item.sourceProfileId))),
    matchReviews: snapshot.matchReviews.filter(review => (review.candidateId && ids.has(review.candidateId)) || review.sourceProfileIds.some(id => profileIds.has(id))),
    importBatches: [],
  }
}

async function supabaseSnapshot(ownerId: string, ids: string[]): Promise<CandidateDbSnapshot> {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')

  const [candidateRes, profileRes, evidenceRes, contactRes, availabilityRes, reviewRes] = await Promise.all([
    sb.from('candidates').select('*').eq('owner_id', ownerId).in('id', ids),
    sb.from('source_profiles').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('evidence_items').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('candidate_contacts').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('open_to_work_signals').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
    sb.from('identity_match_reviews').select('*').eq('owner_id', ownerId).in('candidate_id', ids),
  ])

  const error = candidateRes.error || profileRes.error || evidenceRes.error || contactRes.error || availabilityRes.error || reviewRes.error
  if (error) throw error

  return {
    candidates: (candidateRes.data || []).map((candidate: any) => ({
      id: candidate.id,
      canonicalName: candidate.canonical_name,
      headline: candidate.headline || '',
      location: candidate.location || undefined,
      currentCompany: candidate.current_company || undefined,
      currentTitle: candidate.current_title || undefined,
      summary: candidate.summary || '',
      skills: Array.isArray(candidate.skills) ? candidate.skills : [],
      createdAt: candidate.created_at,
      updatedAt: candidate.updated_at,
      lastRefreshedAt: candidate.last_refreshed_at || undefined,
      sourceProfileIds: [], evidenceItemIds: [], contactSignalIds: [], openToWorkSignalIds: [],
      mergeStatus: candidate.merge_status || 'pending',
    })),
    sourceProfiles: (profileRes.data || []).map((profile: any) => ({
      id: profile.id,
      candidateId: profile.candidate_id || undefined,
      source: profile.source,
      sourceProfileId: profile.source_profile_id,
      profileUrl: profile.profile_url || undefined,
      displayName: profile.display_name,
      headline: profile.headline || undefined,
      location: profile.location || undefined,
      organization: profile.organization || undefined,
      rawText: profile.raw_text || undefined,
      raw: profile.raw,
      status: profile.status || 'pending',
      matchScore: profile.match_score || 0,
      matchReasons: Array.isArray(profile.match_reasons) ? profile.match_reasons : [],
      lastSeenAt: profile.last_seen_at || profile.created_at,
      createdAt: profile.created_at,
    })),
    evidenceItems: (evidenceRes.data || []).map((item: any) => ({
      id: item.id,
      candidateId: item.candidate_id || undefined,
      sourceProfileId: item.source_profile_id || undefined,
      source: item.source,
      label: item.label,
      detail: item.detail,
      confidence: item.confidence || 'medium',
      url: item.url || undefined,
      spanStart: Number.isInteger(item.span_start) ? item.span_start : undefined,
      spanEnd: Number.isInteger(item.span_end) ? item.span_end : undefined,
      spanText: item.span_text || undefined,
      sourceTextRef: item.source_text_ref || undefined,
      createdAt: item.created_at,
    })),
    contactSignals: (contactRes.data || []).map((item: any) => ({
      id: item.id,
      candidateId: item.candidate_id || undefined,
      sourceProfileId: item.source_profile_id || undefined,
      type: item.type,
      value: item.value,
      source: item.source,
      confidence: item.confidence || 'medium',
      verified: false as const,
      permissionStatus: item.permission_status || 'unknown',
      createdAt: item.created_at,
    })),
    openToWorkSignals: (availabilityRes.data || []).map((item: any) => ({
      id: item.id,
      candidateId: item.candidate_id || undefined,
      sourceProfileId: item.source_profile_id || undefined,
      source: item.source,
      label: item.label,
      detail: item.detail,
      confidence: item.confidence || 'medium',
      requiresReview: true,
      createdAt: item.created_at,
    })),
    matchReviews: (reviewRes.data || []).map((review: any) => ({
      id: review.id,
      candidateId: review.candidate_id || undefined,
      sourceProfileIds: Array.isArray(review.source_profile_ids) ? review.source_profile_ids : [],
      proposedCanonicalName: review.proposed_canonical_name || 'Identity review',
      score: review.match_score || 0,
      reasons: Array.isArray(review.match_reasons) ? review.match_reasons : [],
      conflicts: Array.isArray(review.conflicts) ? review.conflicts : [],
      decision: review.decision || 'pending',
      decidedBy: review.decided_by || undefined,
      decidedAt: review.decided_at || undefined,
      createdAt: review.created_at,
    })),
    importBatches: [],
  }
}

function roleCandidateContext(candidate: CandidateInput): RoleCandidate {
  const now = new Date().toISOString()
  return {
    id: candidate.candidateId!,
    candidateId: candidate.candidateId,
    name: candidate.name,
    headline: candidate.headline || '',
    company: candidate.company || '',
    location: candidate.location || '',
    source: 'candidate_database',
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: candidate.fitReasons || [],
    concerns: candidate.concerns || [],
    tags: candidate.tags || [],
    contactStatus: candidate.contactStatus || 'unknown',
    evidenceStatus: candidate.evidenceStatus || 'unreviewed',
    addedAt: now,
    updatedAt: now,
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const intake = validIntake(body.intake)
  const searchIntelligence = normalizeRoleSearchIntelligenceV35(body.searchIntelligence)
  const candidates = (Array.isArray(body.candidates) ? body.candidates : []).map(validCandidate).filter((candidate): candidate is CandidateInput => Boolean(candidate)).slice(0, 50)
  if (!intake) return NextResponse.json({ ok: false, error: 'A valid role intake is required.' }, { status: 400 })
  if (!candidates.length) return NextResponse.json({ ok: true, candidates: [], mode: isSupabaseConfigured() ? 'supabase' : 'preview' })

  const ids = Array.from(new Set(candidates.map(candidate => candidate.candidateId!).filter(Boolean)))
  try {
    const snapshot = isSupabaseConfigured()
      ? await supabaseSnapshot(gate.userId, ids)
      : subsetPreview(getCandidateDb(), new Set(ids))
    const ledger = buildEvidenceLedger(snapshot)
    const graphCandidates = new Map(snapshot.candidates.map(candidate => [candidate.id, candidate]))

    const assessments = candidates.map(candidate => {
      const candidateId = candidate.candidateId!
      const claims = ledger.claims.filter(claim => claim.candidateId === candidateId)
      const candidateContext = roleCandidateContext(candidate)
      const requirements = buildRequirementAssessments(intake, claims, candidateContext)
      const tally = requirementAssessmentTally(requirements)
      const mustHaves = requirements.filter(requirement => requirement.tier === 'must_have')
      const mustHaveTally = requirementAssessmentTally(mustHaves)
      const graphCandidate = graphCandidates.get(candidateId)
      const resolvedProfile = resolveCandidate360FieldsV35(snapshot, ledger, candidateId)
      const state = mustHaveTally.contradicted > 0
        ? 'conflicting'
        : mustHaveTally.needsVerification > 0
          ? 'needs_verification'
          : mustHaveTally.unknown > 0
            ? 'insufficient_evidence'
            : mustHaveTally.total > 0
              ? 'evidence_ready'
              : 'no_requirements'
      const matchExplanation = buildRoleCandidateIntelligenceV35(
        intake,
        candidateContext,
        requirements,
        claims,
        searchIntelligence,
      )

      return {
        candidateId,
        canonicalName: graphCandidate?.canonicalName || candidate.name,
        headline: graphCandidate?.headline || candidate.headline || '',
        state,
        tally,
        mustHaveTally,
        claimCount: claims.length,
        publicIdentity: fuseCandidateIdentityV34(snapshot, candidateId),
        // V35.3 role-specific explanation: supported / missing / verification-gated /
        // contradicted / search-only. Role-scoped, never a candidate fact.
        matchExplanation,
        // V35 shadow projection. Existing scalar fields remain compatibility output;
        // no Candidate Graph row or canonical scalar is mutated by this resolver.
        resolvedProfile,
        profileResolutionShadow: {
          legacyVsResolved: {
            nameChanged: Boolean(resolvedProfile.name.value && !sameText(graphCandidate?.canonicalName || candidate.name, resolvedProfile.name.value)),
            headlineChanged: Boolean(resolvedProfile.headline.value && !sameText(graphCandidate?.headline || candidate.headline, resolvedProfile.headline.value)),
            companyChanged: Boolean(resolvedProfile.currentCompany.value && !sameText(graphCandidate?.currentCompany || candidate.company, resolvedProfile.currentCompany.value)),
            titleChanged: Boolean(resolvedProfile.currentTitle.value && !sameText(graphCandidate?.currentTitle || candidate.headline, resolvedProfile.currentTitle.value)),
            locationChanged: Boolean(resolvedProfile.location.value && !sameText(graphCandidate?.location || candidate.location, resolvedProfile.location.value)),
          },
          conflictCount: resolvedProfile.conflictCount,
          reviewCount: resolvedProfile.reviewCount,
          shadowOnly: true,
        },
        requirements: requirements.map(requirement => ({
          requirementId: requirement.requirementId,
          requirementText: requirement.requirementText,
          tier: requirement.tier,
          kind: requirement.kind,
          state: requirement.state,
          rationale: requirement.rationale,
          evidence: requirement.claims.slice(0, 4).map(claim => ({
            id: claim.id,
            source: claim.source,
            sourceType: claim.sourceType,
            sourceUrl: claim.sourceUrl,
            evidenceClass: claim.evidenceClass,
            detail: claim.detail,
            spanText: claim.spanValidated ? claim.spanText : undefined,
            freshness: claim.freshness,
          })),
          contradictions: requirement.contradictions.slice(0, 4).map(claim => ({ id: claim.id, source: claim.source, detail: claim.detail, sourceUrl: claim.sourceUrl })),
          recruiterContext: requirement.recruiterContext,
        })),
      }
    })

    return NextResponse.json({
      ok: true,
      mode: isSupabaseConfigured() ? 'supabase' : 'preview',
      candidates: assessments,
      trust: {
        decision: 'This is an evidence review slate, not a fit score, ranking, rejection, or hiring recommendation.',
        unknown: 'Missing evidence remains unknown and never becomes a negative finding.',
        sensitive: 'Clearance, credentials, disqualifiers, and other sensitive requirements remain verification-gated.',
        discovery: 'Recruiter-approved search expansions may explain why a person surfaced but cannot satisfy a requirement by themselves.',
        resolution: 'V35 resolved profile fields are a read-only shadow projection over attached observations. Conflicts remain visible and no scalar value is silently overwritten.',
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Role evidence assessment failed.' }, { status: 500 })
  }
}
