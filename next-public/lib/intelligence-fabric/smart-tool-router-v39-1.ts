import type {
  FabricOperationV39_1,
  ProviderCapabilityRecordV39_1,
} from './capability-registry-v39-1'

export type FabricRouteRequestV39_1 = {
  operation: FabricOperationV39_1
  allowExternal: boolean
  requireFreshness?: boolean
  recruiterApprovedSpend?: boolean
  recruiterApprovedSensitiveReveal?: boolean
  maxExternalProviders?: number
}

export type FabricRouteStepV39_1 = {
  provider: ProviderCapabilityRecordV39_1['provider']
  operation: FabricOperationV39_1
  order: number
  score: number
  reason: string
  externalSpendPossible: boolean
  candidateRankingAuthority: false
}

export type FabricRouteDecisionV39_1 = {
  operation: FabricOperationV39_1
  steps: FabricRouteStepV39_1[]
  skipped: Array<{ provider: ProviderCapabilityRecordV39_1['provider']; reason: string }>
  trust: {
    providerRoutingIsCandidateRanking: false
    retrievalIsQualification: false
    missingEvidenceIsNegative: false
    paidContactRevealRequiresApproval: true
  }
}

const unavailableHealth = new Set([
  'NOT_CONFIGURED',
  'NOT_ENTITLED',
  'CREDITS_EXHAUSTED',
  'AUTH_FAILURE',
  'PREVIEW_ACCESS_BLOCKED',
])

const failedHealth = new Set([
  'PROVIDER_ERROR',
  'BAD_REQUEST',
  'UNSUPPORTED_QUERY',
  'UNKNOWN_FAILURE',
])

function operationCapability(record: ProviderCapabilityRecordV39_1, operation: FabricOperationV39_1) {
  return record.operations.find(item => item.operation === operation)
}

function runtimeScore(record: ProviderCapabilityRecordV39_1): number {
  if (record.owned) return 1000
  if (record.runtimeHealth === 'SUCCESS') return 80
  if (record.runtimeHealth === 'PARTIAL') return 55
  if (record.runtimeHealth === 'ZERO_RESULTS') return 45
  if (record.runtimeHealth === 'RATE_LIMITED' || record.runtimeHealth === 'TIMEOUT') return 15
  if (record.runtimeHealth === 'NOT_OBSERVED') return 30
  return 0
}

function costPenalty(record: ProviderCapabilityRecordV39_1, operation: FabricOperationV39_1): number {
  const capability = operationCapability(record, operation)
  if (!capability) return 100
  if (capability.costClass === 'none') return 0
  if (capability.costClass === 'low') return 2
  if (capability.costClass === 'medium') return 5
  if (capability.costClass === 'high') return 12
  if (capability.costClass === 'variable') return 8
  return 4
}

function freshnessBonus(record: ProviderCapabilityRecordV39_1, requireFreshness: boolean): number {
  if (!requireFreshness) return 0
  if (record.freshness === 'live' || record.freshness === 'mixed') return 10
  return 0
}

/**
 * Selects execution lanes, not candidates. The owned graph is always searched
 * first when it supports the requested operation. External providers are then
 * selected only when explicitly allowed and when capability, runtime state,
 * spend boundaries, and approval boundaries permit execution.
 */
export function routeFabricOperationV39_1(
  request: FabricRouteRequestV39_1,
  registry: ProviderCapabilityRecordV39_1[],
): FabricRouteDecisionV39_1 {
  const steps: FabricRouteStepV39_1[] = []
  const skipped: FabricRouteDecisionV39_1['skipped'] = []
  const owned = registry.find(item => item.owned && operationCapability(item, request.operation)?.maturity === 'active')

  if (owned) {
    steps.push({
      provider: owned.provider,
      operation: request.operation,
      order: 1,
      score: runtimeScore(owned),
      reason: 'Search the recruiter-owned canonical SourcingOS graph before spending on external retrieval.',
      externalSpendPossible: false,
      candidateRankingAuthority: false,
    })
  }

  if (!request.allowExternal) {
    for (const record of registry.filter(item => !item.owned && operationCapability(item, request.operation))) {
      skipped.push({ provider: record.provider, reason: 'External execution was not approved for this route.' })
    }
    return decision(request.operation, steps, skipped)
  }

  const external: Array<{ record: ProviderCapabilityRecordV39_1; score: number }> = []
  for (const record of registry.filter(item => !item.owned)) {
    const capability = operationCapability(record, request.operation)
    if (!capability) continue
    if (capability.maturity !== 'active') {
      skipped.push({ provider: record.provider, reason: capability.maturity === 'planned' ? 'Capability is planned but not wired.' : 'Capability is wired but not executable in this environment.' })
      continue
    }
    if (!record.configured || !record.adapterExecutable || record.entitlement === 'not_configured') {
      skipped.push({ provider: record.provider, reason: 'Provider is not executable in this environment.' })
      continue
    }
    if (record.entitlement === 'not_entitled' || record.entitlement === 'credits_exhausted') {
      skipped.push({ provider: record.provider, reason: `Provider runtime entitlement is ${record.entitlement}.` })
      continue
    }
    if (unavailableHealth.has(record.runtimeHealth) || failedHealth.has(record.runtimeHealth)) {
      skipped.push({ provider: record.provider, reason: `Provider runtime health is ${record.runtimeHealth}.` })
      continue
    }
    if (capability.approvalRequired && !request.recruiterApprovedSensitiveReveal) {
      skipped.push({ provider: record.provider, reason: 'Sensitive/contact reveal requires explicit recruiter approval.' })
      continue
    }
    if (capability.costClass !== 'none' && capability.costClass !== 'unknown' && !request.recruiterApprovedSpend) {
      skipped.push({ provider: record.provider, reason: 'Potential paid execution requires recruiter-approved spend.' })
      continue
    }

    const score = runtimeScore(record) + freshnessBonus(record, Boolean(request.requireFreshness)) - costPenalty(record, request.operation)
    external.push({ record, score })
  }

  external.sort((a, b) => b.score - a.score || a.record.provider.localeCompare(b.record.provider))
  const max = Math.max(0, Math.min(12, request.maxExternalProviders ?? 4))
  for (const item of external.slice(0, max)) {
    steps.push({
      provider: item.record.provider,
      operation: request.operation,
      order: steps.length + 1,
      score: item.score,
      reason: `Selected for ${request.operation} from capability, runtime health, freshness, and conservative cost metadata.`,
      externalSpendPossible: operationCapability(item.record, request.operation)?.costClass !== 'none',
      candidateRankingAuthority: false,
    })
  }
  for (const item of external.slice(max)) {
    skipped.push({ provider: item.record.provider, reason: 'Eligible but outside the bounded external-provider fan-out for this route.' })
  }

  return decision(request.operation, steps, skipped)
}

function decision(
  operation: FabricOperationV39_1,
  steps: FabricRouteStepV39_1[],
  skipped: FabricRouteDecisionV39_1['skipped'],
): FabricRouteDecisionV39_1 {
  return {
    operation,
    steps,
    skipped,
    trust: {
      providerRoutingIsCandidateRanking: false,
      retrievalIsQualification: false,
      missingEvidenceIsNegative: false,
      paidContactRevealRequiresApproval: true,
    },
  }
}
