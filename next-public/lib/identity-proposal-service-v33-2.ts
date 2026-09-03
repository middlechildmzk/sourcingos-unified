import 'server-only'
import { compareSourceProfiles } from './candidate-graph'
import { sharedProfessionalProfileAnchorsV36_10 } from './identity-anchors-v36-10'
import { sourceResultFromStoredProfile } from './stored-source-profile-v33-2'
import type { SourceResult } from './source-types'

type ProposalRow = {
  existingSourceProfileId: string
  targetCandidateId: string
  score: number
  reasons: string[]
  conflicts: ReturnType<typeof compareSourceProfiles>['conflicts']
  deterministicRules: ReturnType<typeof compareSourceProfiles>['deterministicRules']
}

export type IdentityProposalServiceResult = {
  created: Array<{
    reviewId: string
    sourceProfileIds: string[]
    targetCandidateId: string
    score: number
    reasons: string[]
  }>
  considered: number
  anchored: number
  warning?: string
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function isLinkedInProfileUrl(value?: string): boolean {
  const raw = String(value || '').trim()
  if (!raw) return false
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    return host === 'linkedin.com' && /^\/(?:in|pub)\//i.test(parsed.pathname)
  } catch {
    return false
  }
}

/**
 * The legacy explicit-cross-profile rule predates commercial provider rows. A
 * provider-reported LinkedIn URL must not become deterministic identity
 * authority merely because another observation exposes the same URL. Preserve
 * the comparison as ordinary review evidence, but remove its deterministic
 * weight when the linked target is a LinkedIn profile.
 */
function suppressLinkedInCrossLinkAuthority(
  base: ReturnType<typeof compareSourceProfiles>,
  existing: SourceResult,
  incoming: SourceResult,
) {
  const crossLink = base.deterministicRules.find(rule => rule.ruleId === 'explicit_cross_profile_link')
  const restrictedTarget = isLinkedInProfileUrl(existing.profileUrl) || isLinkedInProfileUrl(incoming.profileUrl)
  if (!crossLink?.passed || !restrictedTarget) return base

  const deterministicRules = base.deterministicRules.map(rule => rule.ruleId === 'explicit_cross_profile_link'
    ? {
        ...rule,
        passed: false,
        evidence: 'LinkedIn profile overlap is preserved for review but is not deterministic cross-source identity authority',
      }
    : rule)
  const reasons = base.reasons.filter(reason => reason !== 'One profile explicitly links to the other')
  const deterministicAnchor = deterministicRules.some(rule => rule.passed && rule.ruleId !== 'same_source_stable_id')

  return {
    ...base,
    score: Math.max(0, base.score - 30),
    reasons,
    deterministicRules,
    deterministicAnchor,
  }
}

function identityComparisonV36_10(existing: SourceResult, incoming: SourceResult) {
  const rawBase = compareSourceProfiles(existing, incoming)
  const base = suppressLinkedInCrossLinkAuthority(rawBase, existing, incoming)
  const professional = sharedProfessionalProfileAnchorsV36_10(existing, incoming)
  const professionalRule = {
    ruleId: 'shared_canonical_professional_profile',
    passed: professional.matched,
    evidence: professional.matched
      ? professional.reasons.join(' · ')
      : 'No shared deterministic GitHub, Stack Overflow, Hugging Face, DEV, Kaggle, or ORCID profile URL',
  }

  return {
    ...base,
    score: Math.min(100, base.score + (professional.matched ? 40 : 0)),
    reasons: Array.from(new Set([...base.reasons, ...professional.reasons])),
    deterministicRules: [...base.deterministicRules, professionalRule],
    deterministicAnchor: base.deterministicAnchor || professional.matched,
  }
}

/**
 * Create recruiter-review proposals for a newly saved source profile.
 *
 * Automatic proposal creation is intentionally stricter than manual identity
 * review: at least one deterministic cross-source anchor is required (shared
 * observed public email, personal domain, explicit source-native cross-link,
 * or the same approved public professional profile observed independently by
 * two sources). LinkedIn overlap is review context only and cannot satisfy this
 * deterministic gate. Names, locations, organizations, and topic overlap may
 * rank a proposal but can never cause one to be created on their own.
 *
 * This function never links source profiles and never changes candidate IDs.
 */
export async function createDeterministicIdentityProposals(input: {
  sb: any
  ownerId: string
  incomingSourceProfileId: string
  incomingCandidateId: string
  incomingResult: SourceResult
  maxProposals?: number
}): Promise<IdentityProposalServiceResult> {
  const maxProposals = Math.max(1, Math.min(input.maxProposals ?? 5, 10))

  try {
    const { data: profiles, error: profilesError } = await input.sb
      .from('source_profiles')
      .select('*')
      .eq('owner_id', input.ownerId)
      .neq('id', input.incomingSourceProfileId)
      .not('candidate_id', 'is', null)
      .order('last_seen_at', { ascending: false })
      .limit(250)

    if (profilesError) {
      return { created: [], considered: 0, anchored: 0, warning: `Identity proposal scan failed: ${profilesError.message}` }
    }

    const candidates: ProposalRow[] = []
    let considered = 0

    for (const stored of profiles || []) {
      if (!stored?.id || !stored?.candidate_id) continue
      if (stored.candidate_id === input.incomingCandidateId) continue
      if (stored.source === input.incomingResult.source && stored.source_profile_id === input.incomingResult.sourceProfileId) continue

      const existing = sourceResultFromStoredProfile(stored)
      if (!existing) continue
      considered += 1

      const comparison = identityComparisonV36_10(existing, input.incomingResult)
      if (comparison.sameStableId || comparison.blocked || !comparison.deterministicAnchor) continue

      candidates.push({
        existingSourceProfileId: stored.id,
        targetCandidateId: stored.candidate_id,
        score: comparison.score,
        reasons: comparison.reasons,
        conflicts: comparison.conflicts,
        deterministicRules: comparison.deterministicRules,
      })
    }

    candidates.sort((a, b) => b.score - a.score || a.existingSourceProfileId.localeCompare(b.existingSourceProfileId))
    const anchored = candidates.length
    if (!anchored) return { created: [], considered, anchored: 0 }

    const { data: pendingReviews, error: reviewLookupError } = await input.sb
      .from('identity_match_reviews')
      .select('id,candidate_id,source_profile_ids')
      .eq('owner_id', input.ownerId)
      .eq('decision', 'pending')
      .order('created_at', { ascending: false })
      .limit(250)

    if (reviewLookupError) {
      return { created: [], considered, anchored, warning: `Identity review lookup failed: ${reviewLookupError.message}` }
    }

    const pendingPairs = new Set<string>()
    for (const review of pendingReviews || []) {
      const ids = Array.isArray(review.source_profile_ids) ? review.source_profile_ids.filter(Boolean) : []
      if (ids.length === 2) pendingPairs.add(pairKey(ids[0], ids[1]))
    }

    const rows = candidates
      .filter(candidate => !pendingPairs.has(pairKey(input.incomingSourceProfileId, candidate.existingSourceProfileId)))
      .slice(0, maxProposals)
      .map(candidate => ({
        owner_id: input.ownerId,
        // Confirming the review moves the incoming source profile toward the
        // pre-existing canonical candidate rather than inventing a new target.
        candidate_id: candidate.targetCandidateId,
        source_profile_ids: [input.incomingSourceProfileId, candidate.existingSourceProfileId],
        match_score: candidate.score,
        match_reasons: candidate.reasons,
        conflicts: candidate.conflicts,
        decision: 'pending',
      }))

    if (!rows.length) return { created: [], considered, anchored }

    const { data: inserted, error: insertError } = await input.sb
      .from('identity_match_reviews')
      .insert(rows)
      .select('id,candidate_id,source_profile_ids,match_score,match_reasons')

    if (insertError) {
      return { created: [], considered, anchored, warning: `Identity proposal write failed: ${insertError.message}` }
    }

    return {
      created: (inserted || []).map((review: any) => ({
        reviewId: review.id,
        sourceProfileIds: Array.isArray(review.source_profile_ids) ? review.source_profile_ids : [],
        targetCandidateId: review.candidate_id,
        score: Number(review.match_score || 0),
        reasons: Array.isArray(review.match_reasons) ? review.match_reasons : [],
      })),
      considered,
      anchored,
    }
  } catch (error) {
    return {
      created: [],
      considered: 0,
      anchored: 0,
      warning: error instanceof Error ? `Identity proposal service failed: ${error.message}` : 'Identity proposal service failed.',
    }
  }
}
