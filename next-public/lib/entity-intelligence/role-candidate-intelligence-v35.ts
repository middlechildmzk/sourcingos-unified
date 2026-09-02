import type { EvidenceClaim } from '@/lib/evidence-ledger'
import type { RequirementAssessment } from '@/lib/requirement-assessment-v32'
import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'
import { entityByIdV35 } from './registry-v35'
import { matchLocationEntitiesV35 } from './location-v35'
import {
  approvedLocationIntentV35,
  approvedRetrievalContextV35,
  type RoleSearchIntelligenceStateV35,
} from './search-approval-v35'

export type RoleCandidateIntelligenceV35 = {
  candidateId?: string
  requirements: {
    supported: string[]
    needsVerification: string[]
    missingEvidence: string[]
    contradicted: string[]
  }
  discoverySignals: Array<{
    entityId: string
    label: string
    observed: boolean
    state: 'search_only_observed' | 'search_only_not_observed'
    explanation: string
  }>
  geography: {
    state: 'compatible' | 'unknown' | 'outside_approved_search_area' | 'not_constrained'
    roleAnchor?: string
    approvedSearchLocations: string[]
    candidateLocation?: string
    explanation: string
  }
  explanation: string[]
  trust: string[]
  version: 'v35.3'
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#./ -]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function containsTerm(text: string, term: string): boolean {
  const haystack = ` ${normalized(text)} `
  const needle = ` ${normalized(term)} `
  return Boolean(needle.trim() && haystack.includes(needle))
}

function candidateObservedText(candidate: RoleCandidate, claims: EvidenceClaim[]): string {
  return [
    candidate.headline,
    candidate.company,
    candidate.location,
    ...candidate.tags,
    ...claims.flatMap(claim => [claim.claimedValue, claim.detail, claim.spanValidated ? claim.spanText || '' : '']),
  ].filter(Boolean).join(' ')
}

function requirementBuckets(requirements: RequirementAssessment[]) {
  return {
    supported: requirements.filter(item => item.state === 'supported').map(item => item.requirementText),
    needsVerification: requirements.filter(item => item.state === 'needs_verification').map(item => item.requirementText),
    missingEvidence: requirements.filter(item => item.state === 'unknown').map(item => item.requirementText),
    contradicted: requirements.filter(item => item.state === 'contradicted').map(item => item.requirementText),
  }
}

function structuredGeography(
  intake: RoleIntake,
  candidate: RoleCandidate,
  searchIntelligence?: RoleSearchIntelligenceStateV35,
): RoleCandidateIntelligenceV35['geography'] {
  const intent = approvedLocationIntentV35(intake, searchIntelligence)
  const approvedIds = new Set([
    ...(intent.anchorLocationId ? [intent.anchorLocationId] : []),
    ...intent.recruiterApprovedExpansionIds,
  ])
  const approvedSearchLocations = Array.from(approvedIds)
    .map(id => entityByIdV35(id)?.canonicalLabel)
    .filter((value): value is string => Boolean(value))

  if (intent.mode === 'remote' || !intent.anchorLocationId && !intent.recruiterApprovedExpansionIds.length) {
    return {
      state: 'not_constrained',
      ...(intent.anchorLabel ? { roleAnchor: intent.anchorLabel } : {}),
      approvedSearchLocations,
      ...(candidate.location ? { candidateLocation: candidate.location } : {}),
      explanation: intent.mode === 'remote'
        ? 'Role location intent is remote. Candidate residence is shown as an observed profile field, not used as a negative fit finding.'
        : 'No structured geographic constraint is active for this explanation.',
    }
  }

  if (!candidate.location?.trim()) {
    return {
      state: 'unknown',
      ...(intent.anchorLabel ? { roleAnchor: intent.anchorLabel } : {}),
      approvedSearchLocations,
      explanation: 'Candidate location is missing, so geography remains unknown rather than negative.',
    }
  }

  const candidateLocations = matchLocationEntitiesV35(candidate.location)
  if (!candidateLocations.length) {
    return {
      state: 'unknown',
      ...(intent.anchorLabel ? { roleAnchor: intent.anchorLabel } : {}),
      approvedSearchLocations,
      candidateLocation: candidate.location,
      explanation: 'Candidate location is present but does not resolve to a reviewed V35 location entity yet. Geography remains unknown.',
    }
  }

  const compatible = candidateLocations.some(entity => approvedIds.has(entity.id))
  return {
    state: compatible ? 'compatible' : 'outside_approved_search_area',
    ...(intent.anchorLabel ? { roleAnchor: intent.anchorLabel } : {}),
    approvedSearchLocations,
    candidateLocation: candidate.location,
    explanation: compatible
      ? 'Observed candidate location resolves to the recruiter-approved search geography.'
      : 'Observed candidate location resolves outside the current structured anchor/approved expansion set. This is a search-area observation, not an automatic rejection.',
  }
}

/**
 * Explains why a Candidate Graph person surfaced for a role without converting
 * retrieval expansion into qualification evidence or an opaque fit score.
 */
export function buildRoleCandidateIntelligenceV35(
  intake: RoleIntake,
  candidate: RoleCandidate,
  requirements: RequirementAssessment[],
  claims: EvidenceClaim[],
  searchIntelligence?: RoleSearchIntelligenceStateV35,
): RoleCandidateIntelligenceV35 {
  const buckets = requirementBuckets(requirements)
  const approved = approvedRetrievalContextV35(searchIntelligence)
  const observedText = candidateObservedText(candidate, claims)
  const approvedIds = [
    ...(searchIntelligence?.approvedEntityIds || []),
    ...(searchIntelligence?.approvedLocationExpansionIds || []),
  ]

  const discoverySignals = approvedIds.flatMap(entityId => {
    const entity = entityByIdV35(entityId)
    if (!entity || approved.locationTerms.includes(entity.canonicalLabel)) return []
    const terms = [entity.canonicalLabel, ...entity.aliases]
    const observed = terms.some(term => containsTerm(observedText, term))
    return [{
      entityId,
      label: entity.canonicalLabel,
      observed,
      state: observed ? 'search_only_observed' as const : 'search_only_not_observed' as const,
      explanation: observed
        ? `${entity.canonicalLabel} is observed in candidate-linked context and was recruiter-approved for discovery. It does not satisfy a requirement unless the requirement assessor independently supports it.`
        : `${entity.canonicalLabel} was recruiter-approved for discovery, but no candidate-linked evidence is currently observed for it.`,
    }]
  })

  const geography = structuredGeography(intake, candidate, searchIntelligence)
  const explanation: string[] = []
  if (buckets.supported.length) explanation.push(`Supported recruiter requirements: ${buckets.supported.join(', ')}.`)
  if (buckets.needsVerification.length) explanation.push(`Needs verification: ${buckets.needsVerification.join(', ')}.`)
  if (buckets.missingEvidence.length) explanation.push(`Missing evidence remains unknown: ${buckets.missingEvidence.join(', ')}.`)
  if (buckets.contradicted.length) explanation.push(`Recorded evidence conflicts with: ${buckets.contradicted.join(', ')}.`)
  const observedSearch = discoverySignals.filter(signal => signal.observed).map(signal => signal.label)
  if (observedSearch.length) explanation.push(`Search-only discovery signals observed: ${observedSearch.join(', ')}. These explain retrieval, not qualification.`)
  explanation.push(geography.explanation)

  return {
    candidateId: candidate.candidateId,
    requirements: buckets,
    discoverySignals,
    geography,
    explanation,
    trust: [
      'There is no universal fit score in this packet.',
      'Recruiter-approved search expansion explains retrieval only and cannot satisfy a candidate requirement by itself.',
      'Missing evidence is unknown, not a negative finding.',
      'Clearance, credentials, and other verification-gated requirements remain governed by the requirement evidence policy.',
    ],
    version: 'v35.3',
  }
}
