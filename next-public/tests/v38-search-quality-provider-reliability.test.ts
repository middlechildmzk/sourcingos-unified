import { describe, expect, it } from 'vitest'
import { SEARCH_BENCHMARK_CORPUS_V38, SEARCH_BENCHMARK_FAMILIES_V38, searchBenchmarkByIdV38 } from '../lib/search-quality/benchmark-corpus-v38'
import { classifyProviderHealthV38, providerHealthEventsV38, summarizeProviderHealthV38 } from '../lib/search-quality/provider-health-v38'
import { buildSearchQualitySessionV38, sanitizedProviderRequestsV38, searchDiscoveryExpansionPacketV38 } from '../lib/search-quality/session-v38'
import { assertSearchTrustGateV38, evaluateSearchQualityV38 } from '../lib/search-quality/evaluation-v38'
import { buildUniversalPeopleProviderRequestV36_9 } from '../lib/universal-people-search-v36-9'
import { applySearchDiscoveryExpansionV37_2 } from '../lib/search-discovery-expansion-v37-2'
import type { CandidateDataOrchestrationV36_8 } from '../lib/candidate-data/orchestrator-v36-8'
import type { CandidateDataProviderTelemetryV36_8, CandidateDataSearchRequestV36_8 } from '../lib/candidate-data/types-v36-8'

const flagshipQuery = 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher'

function telemetry(
  provider: CandidateDataProviderTelemetryV36_8['provider'],
  status: CandidateDataProviderTelemetryV36_8['status'],
  discovered: number,
  message?: string,
): CandidateDataProviderTelemetryV36_8 {
  return { provider, status, discovered, latencyMs: 25, ...(message ? { message } : {}) }
}

describe('V38 golden recruiter benchmark corpus', () => {
  it('contains 27 stable scenarios across 10 distinct talent families', () => {
    expect(SEARCH_BENCHMARK_CORPUS_V38).toHaveLength(27)
    expect(SEARCH_BENCHMARK_FAMILIES_V38).toHaveLength(10)
    expect(new Set(SEARCH_BENCHMARK_CORPUS_V38.map(item => item.id)).size).toBe(27)
  })

  it('covers every required benchmark family with human-reviewed intent', () => {
    expect(new Set(SEARCH_BENCHMARK_FAMILIES_V38)).toEqual(new Set([
      'cleared_federal',
      'software_engineering',
      'data_ai',
      'gtm',
      'talent_recruiting',
      'healthcare',
      'engineering_hardware',
      'product_program',
      'finance',
      'operations_supply_chain',
    ]))
    for (const scenario of SEARCH_BENCHMARK_CORPUS_V38) {
      expect(scenario.query.length).toBeGreaterThan(15)
      expect(scenario.expected.titles.length).toBeGreaterThan(0)
      expect(scenario.expected.mustHave.length).toBeGreaterThan(0)
    }
  })

  it('pins the RHEL north-star semantics and explicit non-inferences', () => {
    const scenario = searchBenchmarkByIdV38('cleared-rhel-annapolis')!
    expect(scenario.query).toBe(flagshipQuery)
    expect(scenario.expected.skills).toContain('RHEL')
    expect(scenario.expected.locations).toContain('Annapolis Junction, MD')
    expect(scenario.expected.mustHave).toEqual(expect.arrayContaining([
      'RHEL', '5+ years relevant experience', 'Secret clearance or higher',
    ]))
    expect(scenario.expected.discoveryOnly).toEqual(expect.arrayContaining([
      'Linux Administrator', 'Linux Systems Administrator', 'Fort Meade, MD', 'Ansible',
    ]))
    expect(scenario.expected.neverInfer).toEqual(expect.arrayContaining([
      'Linux proves RHEL', 'Fort Meade proves residence', 'Secret requirement proves clearance', 'TS/SCI means TypeScript',
    ]))
  })
})

describe('V38 flagship interpretation and discovery boundaries', () => {
  const request = buildUniversalPeopleProviderRequestV36_9({ query: flagshipQuery, limit: 20 })

  it('parses role, RHEL, location, tenure, and Secret+ without corrupting the request', () => {
    expect(request.titles?.map(value => value.toLowerCase())).toContain('rhel admin')
    expect(request.skills).toContain('RHEL')
    expect(request.locations).toContain('Annapolis Junction, MD')
    expect(request.requirements).toEqual(expect.arrayContaining([
      { text: 'RHEL', mustHave: true },
      { text: '5+ years relevant experience', mustHave: true },
      { text: 'Secret clearance or higher', mustHave: true },
    ]))
  })

  it('keeps expansion search-only and evidence-ineligible', () => {
    const packet = searchDiscoveryExpansionPacketV38(request)
    expect(packet.map(item => item.value)).toEqual(expect.arrayContaining([
      'Linux Administrator', 'Linux Systems Administrator', 'Fort Meade, MD', 'Jessup, MD', 'Odenton, MD',
    ]))
    expect(packet.every(item => item.searchOnly && item.evidenceEligible === false)).toBe(true)
    const expanded = applySearchDiscoveryExpansionV37_2(request)
    expect(expanded.requirements).toEqual(request.requirements)
  })

  it('does not silently create nearby markets for an exact-location request', () => {
    const exact: CandidateDataSearchRequestV36_8 = {
      ...request,
      query: 'Find a RHEL admin in Annapolis Junction, MD',
      locations: ['Annapolis Junction, MD'],
    }
    expect(searchDiscoveryExpansionPacketV38(exact).filter(item => item.type === 'nearby_market')).toHaveLength(0)
  })
})

describe('V38 provider runtime health taxonomy', () => {
  it('distinguishes successful execution, zero results, rate limits, auth, entitlement, credits, bad requests, timeouts, and provider faults', () => {
    expect(classifyProviderHealthV38(telemetry('exa', 'completed', 4))).toBe('SUCCESS')
    expect(classifyProviderHealthV38(telemetry('coresignal', 'completed', 0))).toBe('ZERO_RESULTS')
    expect(classifyProviderHealthV38(telemetry('pearch', 'failed', 0, 'HTTP 429 rate limit'))).toBe('RATE_LIMITED')
    expect(classifyProviderHealthV38(telemetry('linkup', 'failed', 0, 'HTTP 401 unauthorized'))).toBe('AUTH_FAILURE')
    expect(classifyProviderHealthV38(telemetry('crustdata', 'failed', 0, 'HTTP 403 plan entitlement required'))).toBe('NOT_ENTITLED')
    expect(classifyProviderHealthV38(telemetry('signalhire', 'failed', 0, 'credits exhausted for this account'))).toBe('CREDITS_EXHAUSTED')
    expect(classifyProviderHealthV38(telemetry('apollo', 'failed', 0, 'HTTP 400 bad request'))).toBe('BAD_REQUEST')
    expect(classifyProviderHealthV38(telemetry('contactout', 'failed', 0, 'request timed out'))).toBe('TIMEOUT')
    expect(classifyProviderHealthV38(telemetry('data_vertex', 'failed', 0, 'provider returned 503 service unavailable'))).toBe('PROVIDER_ERROR')
    expect(classifyProviderHealthV38(telemetry('serper', 'skipped', 0, 'unsupported query mode'))).toBe('UNSUPPORTED_QUERY')
    expect(classifyProviderHealthV38(telemetry('people_data_labs', 'unavailable', 0, 'not configured: missing key'))).toBe('NOT_CONFIGURED')
  })

  it('does not equate configured/executed with healthy and summarizes runtime truth', () => {
    const events = providerHealthEventsV38([
      telemetry('exa', 'completed', 10),
      telemetry('coresignal', 'completed', 0),
      telemetry('pearch', 'failed', 0, '429 rate limited'),
      telemetry('linkup', 'failed', 0, '401 unauthorized'),
    ], { exa: 3 })
    const summary = summarizeProviderHealthV38(events)
    expect(summary).toMatchObject({ selected: 4, successful: 1, zeroResults: 1, degraded: 1, unavailable: 1 })
    expect(events.find(item => item.provider === 'exa')?.retained).toBe(3)
    expect(events.every(item => item.configuredCapability === 'candidate_search')).toBe(true)
  })
})

describe('V38 stage packet and request inspector', () => {
  const request = buildUniversalPeopleProviderRequestV36_9({ query: flagshipQuery, limit: 10 })
  const result: CandidateDataOrchestrationV36_8 = {
    observations: [],
    telemetry: [
      telemetry('exa', 'completed', 10),
      telemetry('pearch', 'failed', 0, '429 rate limited'),
    ],
    warnings: [],
    providerMix: { exa: 10, pearch: 0 },
    retainedProviderMix: { exa: 2 },
    discoveredBeforeCap: 10,
    returnedAfterCap: 2,
    contributingProviders: 1,
    relevanceRejected: 6,
  }

  it('captures interpretation → expansion → provider health → funnel without qualification claims', () => {
    const session = buildSearchQualitySessionV38({ request, result, requestedProviders: ['exa', 'pearch'] })
    expect(session.version).toBe('v38')
    expect(session.interpretation.requirements).toEqual(request.requirements)
    expect(session.discoveryExpansion.length).toBeGreaterThan(0)
    expect(session.providerHealth.map(item => item.category)).toEqual(['SUCCESS', 'RATE_LIMITED'])
    expect(session.funnel).toEqual({ rawDiscoveries: 10, relevanceAdmitted: 4, relevanceRejected: 6, finalRetained: 2, contributingProviders: 1 })
    expect(session.trust).toEqual({
      expansionIsCandidateEvidence: false,
      retrievalIsQualification: false,
      missingEvidenceIsNegative: false,
      identityMergePerformed: false,
    })
  })

  it('provides a sanitized provider inspector and explicitly withholds qualification prose from keyword treatment', () => {
    const inspectors = sanitizedProviderRequestsV38(request, ['apollo', 'exa'])
    expect(inspectors).toHaveLength(2)
    for (const inspector of inspectors) {
      expect(inspector.secretsExposed).toBe(false)
      expect(inspector.intentionallyNotSentAsQualificationKeywords).toEqual(expect.arrayContaining([
        'RHEL', '5+ years relevant experience', 'Secret clearance or higher',
      ]))
      const serialized = JSON.stringify(inspector)
      expect(serialized).not.toMatch(/api[_-]?key|authorization|bearer|token|secret/i)
    }
  })
})

describe('V38 search quality release metrics and zero-tolerance trust gate', () => {
  const run = {
    id: 'v38-eval',
    roleId: 'role-rhel',
    planVersion: 38,
    results: [
      { candidateId: 'a', source: 'exa', claimsEvaluated: 2, unsupportedClaims: 0 },
      { candidateId: 'b', source: 'pearch', claimsEvaluated: 2, unsupportedClaims: 0 },
      { candidateId: 'c', source: 'exa', claimsEvaluated: 1, unsupportedClaims: 0 },
      { candidateId: 'd', source: 'pdl', claimsEvaluated: 1, unsupportedClaims: 0 },
      { candidateId: 'e', source: 'pdl', claimsEvaluated: 1, unsupportedClaims: 0 },
    ],
    qrels: { a: 3, b: 2, c: 0, d: 1, e: 0 } as const,
  }

  it('extends the existing evaluator with required cutoffs, source diversity, admission, and hard gate', () => {
    const evaluation = evaluateSearchQualityV38({ run, rawDiscoveries: 10, relevanceAdmitted: 5, falseWithheld: 1, relevantBeforeAdmission: 4, overAdmitted: 2, admittedJudged: 5 })
    expect(evaluation.precisionAt5).toBe(0.6)
    expect(evaluation.precisionAt10).toBe(0.3)
    expect(evaluation.recallAt25).toBe(1)
    expect(evaluation.recallAt50).toBe(1)
    expect(evaluation.recallAt100).toBe(1)
    expect(evaluation.sourceDiversity).toBe(3)
    expect(evaluation.relevanceAdmissionRate).toBe(0.5)
    expect(evaluation.falseWithholdRate).toBe(0.25)
    expect(evaluation.overAdmissionRate).toBe(0.4)
    expect(evaluation.unsupportedClaimRate).toBe(0)
    expect(evaluation.hardTrustGatePass).toBe(true)
    expect(() => assertSearchTrustGateV38(evaluation)).not.toThrow()
  })

  it('fails the release gate for any hard trust violation regardless of ranking quality', () => {
    const evaluation = evaluateSearchQualityV38({
      run,
      rawDiscoveries: 5,
      relevanceAdmitted: 5,
      trustViolations: [{ type: 'CLEARANCE_INFERENCE', candidateId: 'a', detail: 'Employer context was incorrectly promoted to candidate clearance.' }],
    })
    expect(evaluation.hardTrustGatePass).toBe(false)
    expect(() => assertSearchTrustGateV38(evaluation)).toThrow(/CLEARANCE_INFERENCE/)
  })
})
