export type CandidateProviderRoadmapUseV36_8 =
  | 'candidate_search'
  | 'public_web_locator'
  | 'contact_enrichment'
  | 'identity_corroboration'
  | 'disabled_for_employment'

export type CandidateProviderRoadmapEntryV36_8 = {
  id: string
  label: string
  state: 'wired' | 'next' | 'research' | 'disabled'
  uses: CandidateProviderRoadmapUseV36_8[]
  rationale: string
}

/**
 * Research/implementation registry for sources that are not yet part of the
 * executable CandidateDataProvider union. A source appears here before code is
 * allowed to imply that it is wired.
 *
 * Consumer public-record/background-check sources are not interchangeable with
 * professional recruiting data. Their presence on the public internet does not
 * make them permissible candidate-ranking inputs.
 */
export const candidateProviderRoadmapV36_8: CandidateProviderRoadmapEntryV36_8[] = [
  {
    id: 'apollo',
    label: 'Apollo People Search',
    state: 'next',
    uses: ['candidate_search', 'contact_enrichment'],
    rationale: 'People Search currently costs zero credits and separates search from contact enrichment, but search returns limited/obfuscated identity. Add an explicit Apollo enrichment bridge before Candidate Graph admission.',
  },
  {
    id: 'company_enrich',
    label: 'CompanyEnrich People Search',
    state: 'next',
    uses: ['candidate_search', 'contact_enrichment'],
    rationale: 'Structured professional people search with current work-history filters and MCP support. Pin the complete response schema before normalizing person observations.',
  },
  {
    id: 'crustdata',
    label: 'Crustdata People Search',
    state: 'next',
    uses: ['candidate_search', 'public_web_locator'],
    rationale: 'Large professional index plus real-time public-web people search is a strong fit for SourcingOS discovery and freshness; finalize one canonical API version/schema before wiring.',
  },
  {
    id: 'perplexity_people',
    label: 'Perplexity People Search',
    state: 'next',
    uses: ['public_web_locator'],
    rationale: 'Dedicated professional people-search backend is useful for parallel recall and source discovery. Treat results as locator evidence until a structured identity is resolved.',
  },
  {
    id: 'openai_web',
    label: 'OpenAI Web Search / MCP',
    state: 'research',
    uses: ['public_web_locator'],
    rationale: 'Use as an agentic research/orchestration layer over current public web and direct SourcingOS tools, not as a claimed proprietary people database.',
  },
  {
    id: 'anthropic_web',
    label: 'Claude Web Search',
    state: 'research',
    uses: ['public_web_locator'],
    rationale: 'Use cited current-web search as a corroboration/locator lane. It is an agent research surface, not a canonical professional profile provider.',
  },
  {
    id: 'lusha',
    label: 'Lusha',
    state: 'next',
    uses: ['candidate_search', 'contact_enrichment'],
    rationale: 'V3 prospecting plus explicit enrich is a natural fit and MCP is available; preserve direct provenance instead of treating opaque third-party waterfall output as canonical evidence.',
  },
  {
    id: 'zoominfo',
    label: 'ZoomInfo',
    state: 'research',
    uses: ['candidate_search', 'contact_enrichment'],
    rationale: 'Enterprise data and refresh coverage can be valuable as a high-confidence lane once commercial API access and exact entitlements are confirmed.',
  },
  {
    id: 'pipl',
    label: 'Pipl',
    state: 'research',
    uses: ['identity_corroboration'],
    rationale: 'Evaluate as identity resolution/corroboration, not candidate qualification, after current recruiting-permitted contract terms and response provenance are verified.',
  },
  {
    id: 'osint_industries',
    label: 'OSINT Industries',
    state: 'research',
    uses: ['identity_corroboration'],
    rationale: 'Potential post-identification corroboration lane only. Do not use broad account discovery as candidate suitability evidence or recruiter ranking input.',
  },
  {
    id: 'openweb_ninja',
    label: 'OpenWeb Ninja',
    state: 'next',
    uses: ['public_web_locator', 'contact_enrichment'],
    rationale: 'Use for real-time public-web corroboration and source URLs rather than as a primary professional candidate index.',
  },
  {
    id: 'enformion_go',
    label: 'EnformionGO',
    state: 'disabled',
    uses: ['disabled_for_employment'],
    rationale: 'Provider terms expressly prohibit using the service to determine a prospective candidate’s suitability for employment. Do not wire this source into SourcingOS recruiting.',
  },
  {
    id: 'true_people_search',
    label: 'TruePeopleSearch',
    state: 'disabled',
    uses: ['disabled_for_employment'],
    rationale: 'Consumer people-search/public-record data is outside the SourcingOS professional recruiting data plane. No current first-party recruiter-permitted API contract has been established.',
  },
]

export function providerRoadmapEntryV36_8(id: string): CandidateProviderRoadmapEntryV36_8 | undefined {
  return candidateProviderRoadmapV36_8.find(item => item.id === id)
}

export function employmentDisabledProviderIdsV36_8(): string[] {
  return candidateProviderRoadmapV36_8.filter(item => item.uses.includes('disabled_for_employment')).map(item => item.id)
}
