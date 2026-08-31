import 'server-only'
import { compareSourceProfiles } from './candidate-graph'
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

/**
 * Create recruiter-review proposals for a newly saved source profile.
 *
 * Automatic proposal creation is intentionally stricter than manual identity
 * review: at least one deterministic cross-source anchor is required (shared
 * observed public email, personal domain, or explicit profile cross-link).
 * Names, locations, organizations, and topic overlap may rank a proposal but
 * can never cause one to be created on their own.
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

      const comparison = compareSourceProfiles(existing, input.incomingResult)
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
