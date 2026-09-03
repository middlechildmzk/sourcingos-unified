export type CandidateDataProviderV36_8 =
  | 'pearch'
  | 'people_data_labs'
  | 'coresignal'
  | 'data_vertex'
  | 'contactout'
  | 'signalhire'
  | 'linkup'
  | 'exa'
  | 'crustdata'
  | 'apollo'
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
  /** Explicit person-name anchors from Universal People Search. */
  names?: string[]
  /** Recruiter-approved title terms from Role Brain; provider must not expand silently. */
  titles?: string[]
  /** Recruiter-approved capability terms from Role Brain. */
  skills?: string[]
  /** Explicit employer/company context. This is professional search context, never identity authority. */
  companies?: string[]
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

export type CandidateProviderExperienceV36_14 = {
  title?: string
  company?: string
  location?: string
  startDate?: string
  endDate?: string
  current?: boolean
  description?: string
}

export type CandidateProviderEducationV36_14 = {
  school?: string
  degree?: string
  field?: string
  startDate?: string
  endDate?: string
  description?: string
}

export type CandidateProviderCertificationV36_14 = {
  name: string
  issuer?: string
  issuedAt?: string
  expiresAt?: string
  credentialUrl?: string
}

export type CandidateProviderProjectV36_14 = {
  name: string
  description?: string
  url?: string
  technologies?: string[]
}

/**
 * Optional structured professional history carried exactly as provider-observed
 * fields. Missing fields stay missing. SourcingOS must not synthesize chronology,
 * tenure, degrees, certifications, or project claims that a source did not return.
 */
export type CandidateProviderRichProfileV36_14 = {
  summary?: string
  experience?: CandidateProviderExperienceV36_14[]
  education?: CandidateProviderEducationV36_14[]
  certifications?: CandidateProviderCertificationV36_14[]
  projects?: CandidateProviderProjectV36_14[]
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
  /** Structured provider-observed career/profile fields; optional and provenance-bound. */
  richProfile?: CandidateProviderRichProfileV36_14
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
