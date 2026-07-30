import { sharedBlockingKeys } from './blocking'
import { detectIdentityConflicts, hasBlockingConflict } from './conflict-detection'
import { evaluateDeterministicRules, hasCrossSourceDeterministicAnchor } from './deterministic-rules'
import { IDENTITY_RESOLVER_VERSION } from './resolver-version'
import { similarityComponents, weightedSimilarity } from './similarity'
import { canEnterIdentityResolution } from './source-role'
import type {
  CandidateComparison,
  CandidateIdentity,
  IdentityResolutionResult,
  ResolveIdentityInput,
  SimilarityComponents,
} from './resolver-types'

const EMPTY_COMPONENTS: SimilarityComponents = {
  name: null,
  handle: null,
  location: null,
  organization: null,
  personalDomain: null,
  externalLink: null,
  chronology: null,
}

function exactSourceCandidate(input: ResolveIdentityInput): CandidateIdentity | undefined {
  return input.candidates.find(candidate =>
    candidate.ownerId === input.incoming.ownerId
    && candidate.sourceProfiles.some(profile =>
      profile.source === input.incoming.source
      && profile.sourceProfileId === input.incoming.sourceProfileId,
    ),
  )
}

function comparisons(input: ResolveIdentityInput): CandidateComparison[] {
  const bounded = input.candidates
    .filter(candidate => candidate.ownerId === input.incoming.ownerId)
    .map(candidate => {
      const blocks = candidate.sourceProfiles.flatMap(profile => sharedBlockingKeys(input.incoming, profile))
      return { candidate, blocks: [...new Set(blocks)] }
    })
    .filter(item => item.blocks.length > 0)
    .sort((a, b) => b.blocks.length - a.blocks.length || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, Math.max(1, Math.min(input.comparisonLimit ?? 50, 100)))

  return bounded.map(({ candidate, blocks }) => {
    const deterministicRules = evaluateDeterministicRules(input.incoming, candidate)
    const components = similarityComponents(input.incoming, candidate)
    const conflicts = detectIdentityConflicts(input.incoming, candidate)
    const passedRules = deterministicRules.filter(rule => rule.passed)

    return {
      candidateId: candidate.id,
      score: weightedSimilarity(components),
      deterministicRules,
      similarityComponents: components,
      supportingEvidence: [
        ...blocks.map(block => ({ type: 'shared_block_key', block })),
        ...passedRules.map(rule => ({ type: 'deterministic_rule', ruleId: rule.ruleId, evidence: rule.evidence })),
      ],
      conflicts,
      blockingKeysUsed: blocks,
    }
  }).sort((a, b) => {
    const aDeterministic = hasCrossSourceDeterministicAnchor(a.deterministicRules) && !hasBlockingConflict(a.conflicts)
    const bDeterministic = hasCrossSourceDeterministicAnchor(b.deterministicRules) && !hasBlockingConflict(b.conflicts)
    if (aDeterministic !== bDeterministic) return aDeterministic ? -1 : 1
    return b.score - a.score || a.candidateId.localeCompare(b.candidateId)
  })
}

export function resolveCandidateIdentity(input: ResolveIdentityInput): IdentityResolutionResult {
  if (!canEnterIdentityResolution(input.incoming.sourceRole) || input.incoming.entityKind !== 'person') {
    return {
      incomingSourceProfileId: input.incoming.id,
      proposedCandidateId: null,
      decisionClass: 'do_not_link',
      score: null,
      deterministicRules: [],
      similarityComponents: EMPTY_COMPONENTS,
      supportingEvidence: [],
      conflicts: [{
        type: 'non_person_source',
        severity: 'blocking',
        explanation: 'Only classified person anchors may enter candidate identity resolution.',
        evidence: {
          source: input.incoming.source,
          sourceRole: input.incoming.sourceRole,
          entityKind: input.incoming.entityKind,
        },
      }],
      blockingKeysUsed: [],
      resolverVersion: IDENTITY_RESOLVER_VERSION,
      reviewRequired: false,
      safeToAttach: false,
    }
  }

  const exact = exactSourceCandidate(input)
  if (exact) {
    const deterministicRules = evaluateDeterministicRules(input.incoming, exact)
    const components = similarityComponents(input.incoming, exact)
    return {
      incomingSourceProfileId: input.incoming.id,
      proposedCandidateId: exact.id,
      decisionClass: 'exact_source_reuse',
      score: 1,
      deterministicRules,
      similarityComponents: components,
      supportingEvidence: [{
        type: 'exact_source_identity',
        source: input.incoming.source,
        sourceProfileId: input.incoming.sourceProfileId,
      }],
      conflicts: [],
      blockingKeysUsed: [],
      resolverVersion: IDENTITY_RESOLVER_VERSION,
      reviewRequired: false,
      safeToAttach: true,
    }
  }

  const ranked = comparisons(input)
  const best = ranked[0]
  if (!best) {
    return {
      incomingSourceProfileId: input.incoming.id,
      proposedCandidateId: null,
      decisionClass: 'create_new_candidate',
      score: null,
      deterministicRules: [],
      similarityComponents: EMPTY_COMPONENTS,
      supportingEvidence: [],
      conflicts: [],
      blockingKeysUsed: [],
      resolverVersion: IDENTITY_RESOLVER_VERSION,
      reviewRequired: false,
      safeToAttach: false,
    }
  }

  const deterministicAttach = hasCrossSourceDeterministicAnchor(best.deterministicRules)
    && !hasBlockingConflict(best.conflicts)

  if (deterministicAttach) {
    return {
      incomingSourceProfileId: input.incoming.id,
      proposedCandidateId: best.candidateId,
      decisionClass: 'deterministic_attach',
      score: best.score,
      deterministicRules: best.deterministicRules,
      similarityComponents: best.similarityComponents,
      supportingEvidence: best.supportingEvidence,
      conflicts: best.conflicts,
      blockingKeysUsed: best.blockingKeysUsed,
      resolverVersion: IDENTITY_RESOLVER_VERSION,
      reviewRequired: false,
      safeToAttach: true,
    }
  }

  const decisionClass = best.score >= 0.78
    ? 'high_priority_review'
    : best.score >= 0.48
      ? 'standard_review'
      : 'create_new_candidate'

  return {
    incomingSourceProfileId: input.incoming.id,
    proposedCandidateId: decisionClass === 'create_new_candidate' ? null : best.candidateId,
    decisionClass,
    score: best.score,
    deterministicRules: best.deterministicRules,
    similarityComponents: best.similarityComponents,
    supportingEvidence: best.supportingEvidence,
    conflicts: best.conflicts,
    blockingKeysUsed: best.blockingKeysUsed,
    resolverVersion: IDENTITY_RESOLVER_VERSION,
    reviewRequired: decisionClass === 'high_priority_review' || decisionClass === 'standard_review',
    safeToAttach: false,
  }
}
