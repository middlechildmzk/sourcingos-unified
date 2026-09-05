import type { CandidateDataOrchestrationV36_8 } from './candidate-data/orchestrator-v36-8'
import type { CandidateDataSearchRequestV36_8 } from './candidate-data/types-v36-8'
import { buildSearchQualitySessionV38, type SearchQualitySessionV38 } from './search-quality/session-v38'

export type CanonicalSearchRoleV36_12 = {
  key: string
  label: string
  query: string
}

/**
 * Stable compatibility roles used by pre-V38 trend views. V38 expands the
 * benchmark corpus separately without changing these keys.
 */
export const CANONICAL_SEARCH_ROLES_V36_12: CanonicalSearchRoleV36_12[] = [
  {
    key: 'cleared-rhel-annapolis',
    label: 'Cleared RHEL administrator — Annapolis Junction',
    query: 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher',
  },
  {
    key: 'cleared-cyber-fort-meade',
    label: 'Cleared cybersecurity engineer — Fort Meade',
    query: 'Find a cybersecurity engineer with 7+ years of experience near Fort Meade, MD with TS/SCI clearance',
  },
  {
    key: 'software-engineer-remote',
    label: 'Senior software engineer — remote US',
    query: 'Find a senior software engineer with TypeScript, React, and Node.js experience in the United States',
  },
  {
    key: 'ml-researcher-boston',
    label: 'Machine learning researcher — Boston',
    query: 'Find a machine learning researcher with Python and PyTorch experience in Boston, MA',
  },
  {
    key: 'enterprise-gtm-sourcer',
    label: 'Enterprise GTM sourcer — remote US',
    query: 'Find a senior talent sourcer with enterprise sales and go-to-market recruiting experience in the United States',
  },
]

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function canonicalSearchRoleKeyV36_12(query: string): string | undefined {
  const value = normalized(query)
  return CANONICAL_SEARCH_ROLES_V36_12.find(role => normalized(role.query) === value)?.key
}

export type SearchQualitySnapshotV36_12 = {
  version: 'v36.12'
  canonicalRoleKey?: string
  rawObservations: number
  retainedObservations: number
  executedProviders: number
  contributingProviders: number
  completedProviders: number
  failedProviders: number
  skippedProviders: number
  zeroYieldCompletedProviders: number
  contactAvailableObservations: number
  contactAvailabilityRate: number
  estimatedCredits: number
  averageProviderLatencyMs: number
  providerMix: Record<string, number>
  retainedProviderMix: Record<string, number>
  novelPeople: number | null
  evidencedMustHaveObservations: number | null
  recruiterYes: number | null
  recruiterMaybe: number | null
  recruiterNo: number | null
  /** V38 additive diagnostics; old analytics consumers can ignore this field. */
  v38: SearchQualitySessionV38
}

export function buildSearchQualitySnapshotV36_12(
  request: CandidateDataSearchRequestV36_8,
  result: CandidateDataOrchestrationV36_8,
  overrides: Partial<Pick<SearchQualitySnapshotV36_12,
    'novelPeople' | 'evidencedMustHaveObservations' | 'recruiterYes' | 'recruiterMaybe' | 'recruiterNo'>> = {},
): SearchQualitySnapshotV36_12 {
  const completed = result.telemetry.filter(item => item.status === 'completed')
  const contactAvailableObservations = result.observations.filter(observation =>
    observation.contactAvailability.email === true || observation.contactAvailability.phone === true,
  ).length
  const estimatedCredits = result.telemetry.reduce((sum, item) => sum + (item.estimatedCredits || 0), 0)
  const averageProviderLatencyMs = result.telemetry.length
    ? Math.round(result.telemetry.reduce((sum, item) => sum + Math.max(0, item.latencyMs || 0), 0) / result.telemetry.length)
    : 0
  const requestedProviders = result.telemetry.map(item => item.provider)

  return {
    version: 'v36.12',
    canonicalRoleKey: canonicalSearchRoleKeyV36_12(request.query),
    rawObservations: result.discoveredBeforeCap,
    retainedObservations: result.returnedAfterCap,
    executedProviders: result.telemetry.length,
    contributingProviders: result.contributingProviders,
    completedProviders: completed.length,
    failedProviders: result.telemetry.filter(item => item.status === 'failed').length,
    skippedProviders: result.telemetry.filter(item => item.status === 'skipped').length,
    zeroYieldCompletedProviders: completed.filter(item => item.discovered === 0).length,
    contactAvailableObservations,
    contactAvailabilityRate: result.returnedAfterCap
      ? Number((contactAvailableObservations / result.returnedAfterCap).toFixed(4))
      : 0,
    estimatedCredits,
    averageProviderLatencyMs,
    providerMix: { ...result.providerMix },
    retainedProviderMix: { ...result.retainedProviderMix },
    novelPeople: overrides.novelPeople ?? null,
    evidencedMustHaveObservations: overrides.evidencedMustHaveObservations ?? null,
    recruiterYes: overrides.recruiterYes ?? null,
    recruiterMaybe: overrides.recruiterMaybe ?? null,
    recruiterNo: overrides.recruiterNo ?? null,
    v38: buildSearchQualitySessionV38({ request, result, requestedProviders }),
  }
}
