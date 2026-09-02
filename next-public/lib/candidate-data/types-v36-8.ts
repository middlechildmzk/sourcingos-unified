export type CandidateDataProviderV36_8 =
  | 'pearch'
  | 'people_data_labs'
  | 'coresignal'
  | 'data_vertex'
  | 'contactout'
  | 'openweb_ninja'

export type CandidateDataCapabilityV36_8 =
  | 'candidate_search'
  | 'profile_enrichment'
  | 'contact_enrichment'
  | 'freshness_refresh'
  | 'public_web_corroboration'

export type CandidateDataProviderStateV36_8 = 'configured' | 'missing_key' | 'planned' | 'disabled'

export type CandidateDataProviderStatusV36_8 = {
  provider: CandidateDataProviderV36_8
  label: string
  state: CandidateDataProviderStateV36_8
  capabilities: CandidateDataCapabilityV36_8[]
  /** True only when an adapter is implemented AND the runtime key is present. */
  executable: boolean
  message: string
}

export type CandidateSearchRequirementV36_8 = {
  text: string
  mustHave: boolean
}

export type CandidateDataSearchRequestV36_8 = {
  query: string
  requirements?: CandidateSearchRequirementV36_8[]
  /** Recruiter-approved title terms from Role Brain; provider must not expand silently. */
  titles?: string[]
  /** Recruiter-approved capability terms from Role Brain. */
  skills?: string[]
  locations?: string[]
  limit?: number
  offset?: number
  providerPersonBlacklist?: string[]
  /** Contact reveal is deliberately opt-in and false for search. */
  revealContact?: boolean
  /** Freshness refresh is deliberately opt-in because it can add cost/latency. */
  highFreshness?: boolean
}

export type CandidateProviderProfileUrlV36_8 = {
  kind: 'linkedin' | 'github' | 'stackoverflow' | 'personal' | 'other'
  url: string
}

export type CandidateProviderContactAvailabilityV36_8 = {
  email: boolean | 'unknown'
  phone: boolean | 'unknown'
}

/**
 * A provider observation is retrieval input, not SourcingOS qualification truth.
 * Provider scores are preserved only as provider-native retrieval metadata.
 */
export type CandidateProviderObservationV36_8 = {
  provider: CandidateDataProviderV36_8
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills: string[]
  profileUrls: CandidateProviderProfileUrlV36_8[]
  contactAvailability: CandidateProviderContactAvailabilityV36_8
  providerRetrievalScore?: number
  providerScoreScale?: string
  providerExplanation?: string
  refreshedAt?: string
  observedAt: string
}

export type CandidateDataProviderTelemetryV36_8 = {
  provider: CandidateDataProviderV36_8
  status: 'completed' | 'failed' | 'unavailable' | 'skipped'
  discovered: number
  latencyMs: number
  estimatedCredits?: number
  message?: string
}

export type CandidateDataSearchResultV36_8 = {
  observations: CandidateProviderObservationV36_8[]
  telemetry: CandidateDataProviderTelemetryV36_8
  nextOffset?: number
  threadId?: string
  warnings: string[]
}

export type CandidateDataSearchAdapterV36_8 = {
  provider: CandidateDataProviderV36_8
  search: (request: CandidateDataSearchRequestV36_8) => Promise<CandidateDataSearchResultV36_8>
}

export function candidateObservationKeyV36_8(observation: Pick<CandidateProviderObservationV36_8, 'provider' | 'providerPersonId'>): string {
  return `${observation.provider}:${observation.providerPersonId}`
}

export function safeCandidateSearchLimitV36_8(limit?: number): number {
  return Math.max(1, Math.min(50, Math.trunc(limit || 20)))
}
