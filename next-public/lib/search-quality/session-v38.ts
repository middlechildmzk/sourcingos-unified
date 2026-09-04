import type { CandidateDataOrchestrationV36_8 } from '../candidate-data/orchestrator-v36-8'
import type { CandidateDataProviderV36_8, CandidateDataSearchRequestV36_8 } from '../candidate-data/types-v36-8'
import { applySearchDiscoveryExpansionV37_2 } from '../search-discovery-expansion-v37-2'
import { providerHealthEventsV38, summarizeProviderHealthV38, type ProviderHealthEventV38 } from './provider-health-v38'

export type DiscoveryExpansionItemV38 = {
  type: 'title_alias' | 'skill_alias' | 'nearby_market'
  value: string
  reason: string
  searchOnly: true
  evidenceEligible: false
}

export type SanitizedProviderRequestV38 = {
  provider: CandidateDataProviderV36_8
  queryStrategy: 'structured_people_search'
  titles: string[]
  skills: string[]
  locations: string[]
  companies: string[]
  names: string[]
  limit: number
  reasonSelected: string
  intentionallyNotSentAsQualificationKeywords: string[]
  secretsExposed: false
}

export type SearchQualitySessionV38 = {
  version: 'v38'
  interpretation: {
    originalQuery: string
    titles: string[]
    skills: string[]
    companies: string[]
    locations: string[]
    requirements: Array<{ text: string; mustHave: boolean }>
  }
  discoveryExpansion: DiscoveryExpansionItemV38[]
  providerRequests: SanitizedProviderRequestV38[]
  providerHealth: ProviderHealthEventV38[]
  providerSummary: ReturnType<typeof summarizeProviderHealthV38>
  funnel: {
    rawDiscoveries: number
    relevanceAdmitted: number
    relevanceRejected: number
    finalRetained: number
    contributingProviders: number
  }
  trust: {
    expansionIsCandidateEvidence: false
    retrievalIsQualification: false
    missingEvidenceIsNegative: false
    identityMergePerformed: false
  }
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function diff(original: string[] | undefined, expanded: string[] | undefined): string[] {
  const before = new Set((original || []).map(normalize))
  return (expanded || []).filter(value => !before.has(normalize(value)))
}

export function searchDiscoveryExpansionPacketV38(request: CandidateDataSearchRequestV36_8): DiscoveryExpansionItemV38[] {
  const expanded = applySearchDiscoveryExpansionV37_2(request)
  return [
    ...diff(request.titles, expanded.titles).map(value => ({
      type: 'title_alias' as const,
      value,
      reason: 'Bounded title adjacency for retrieval recall.',
      searchOnly: true as const,
      evidenceEligible: false as const,
    })),
    ...diff(request.skills, expanded.skills).map(value => ({
      type: 'skill_alias' as const,
      value,
      reason: 'Reviewed capability alias used only to broaden provider retrieval.',
      searchOnly: true as const,
      evidenceEligible: false as const,
    })),
    ...diff(request.locations, expanded.locations).map(value => ({
      type: 'nearby_market' as const,
      value,
      reason: 'Recruiter asked for proximity; nearby market is a discovery location, not candidate residence evidence.',
      searchOnly: true as const,
      evidenceEligible: false as const,
    })),
  ]
}

export function sanitizedProviderRequestsV38(
  request: CandidateDataSearchRequestV36_8,
  providers: CandidateDataProviderV36_8[],
): SanitizedProviderRequestV38[] {
  const expanded = applySearchDiscoveryExpansionV37_2(request)
  const qualificationText = (request.requirements || []).filter(item => item.mustHave).map(item => item.text)
  return providers.map(provider => ({
    provider,
    queryStrategy: 'structured_people_search',
    titles: [...(expanded.titles || [])],
    skills: [...(expanded.skills || [])],
    locations: [...(expanded.locations || [])],
    companies: [...(expanded.companies || [])],
    names: [...(expanded.names || [])],
    limit: Math.max(1, Math.min(50, expanded.limit || 20)),
    reasonSelected: 'Configured candidate-search provider selected for this recruiter-approved search pass.',
    intentionallyNotSentAsQualificationKeywords: qualificationText,
    secretsExposed: false,
  }))
}

export function buildSearchQualitySessionV38(params: {
  request: CandidateDataSearchRequestV36_8
  result: CandidateDataOrchestrationV36_8
  requestedProviders: CandidateDataProviderV36_8[]
}): SearchQualitySessionV38 {
  const providerHealth = providerHealthEventsV38(params.result.telemetry, params.result.retainedProviderMix)
  const admittedBeforeCap = Math.max(0, params.result.discoveredBeforeCap - params.result.relevanceRejected)
  return {
    version: 'v38',
    interpretation: {
      originalQuery: params.request.query,
      titles: [...(params.request.titles || [])],
      skills: [...(params.request.skills || [])],
      companies: [...(params.request.companies || [])],
      locations: [...(params.request.locations || [])],
      requirements: [...(params.request.requirements || [])],
    },
    discoveryExpansion: searchDiscoveryExpansionPacketV38(params.request),
    providerRequests: sanitizedProviderRequestsV38(params.request, params.requestedProviders),
    providerHealth,
    providerSummary: summarizeProviderHealthV38(providerHealth),
    funnel: {
      rawDiscoveries: params.result.discoveredBeforeCap,
      relevanceAdmitted: admittedBeforeCap,
      relevanceRejected: params.result.relevanceRejected,
      finalRetained: params.result.returnedAfterCap,
      contributingProviders: params.result.contributingProviders,
    },
    trust: {
      expansionIsCandidateEvidence: false,
      retrievalIsQualification: false,
      missingEvidenceIsNegative: false,
      identityMergePerformed: false,
    },
  }
}
