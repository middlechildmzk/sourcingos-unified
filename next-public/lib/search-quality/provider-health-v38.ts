import type { CandidateDataProviderTelemetryV36_8 } from '../candidate-data/types-v36-8'

export type ProviderHealthCategoryV38 =
  | 'SUCCESS'
  | 'ZERO_RESULTS'
  | 'NOT_CONFIGURED'
  | 'NOT_ENTITLED'
  | 'CREDITS_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_QUERY'
  | 'AUTH_FAILURE'
  | 'PARTIAL'
  | 'PREVIEW_ACCESS_BLOCKED'
  | 'UNKNOWN_FAILURE'

export type ProviderHealthEventV38 = {
  provider: string
  category: ProviderHealthCategoryV38
  status: CandidateDataProviderTelemetryV36_8['status']
  discovered: number
  retained: number
  uniqueRetained: number | null
  duplicateContribution: number | null
  latencyMs: number
  estimatedCredits: number
  message?: string
  configuredCapability: 'candidate_search'
  runtimeCapability: 'working' | 'degraded' | 'unavailable' | 'unknown'
}

function text(item: CandidateDataProviderTelemetryV36_8): string {
  return String(item.message || '').toLowerCase()
}

/**
 * Runtime truth classifier. Configuration is deliberately not treated as health:
 * an API key can exist while credits, entitlement, auth, or provider availability
 * prevent a real search from executing.
 */
export function classifyProviderHealthV38(item: CandidateDataProviderTelemetryV36_8): ProviderHealthCategoryV38 {
  const message = text(item)
  if (/preview.*(?:blocked|protection|sso)|vercel.*(?:auth|protection)/i.test(message)) return 'PREVIEW_ACCESS_BLOCKED'
  if (item.status === 'unavailable') {
    if (/not configured|missing.*(?:key|credential)|no .*key/i.test(message)) return 'NOT_CONFIGURED'
    return 'UNKNOWN_FAILURE'
  }
  if (item.status === 'skipped') {
    if (/unsupported|does not support|cannot search/i.test(message)) return 'UNSUPPORTED_QUERY'
    return 'NOT_CONFIGURED'
  }
  if (item.status === 'completed') {
    if (/partial|incomplete|degraded/i.test(message)) return 'PARTIAL'
    return item.discovered > 0 ? 'SUCCESS' : 'ZERO_RESULTS'
  }

  if (/\b429\b|rate.?limit|too many requests/i.test(message)) return 'RATE_LIMITED'
  if (/credit|quota|balance|plan limit|usage limit/i.test(message)) return 'CREDITS_EXHAUSTED'
  if (/not entitled|entitlement|upgrade.*plan|plan does not|not included/i.test(message)) return 'NOT_ENTITLED'
  if (/\b401\b|unauthori[sz]ed|invalid.*(?:api.?key|token|credential)|authentication failed/i.test(message)) return 'AUTH_FAILURE'
  if (/\b403\b|forbidden/i.test(message)) {
    // 403 alone is ambiguous: it can be entitlement or auth. Never invent one.
    return /plan|entitl|access level|permission/i.test(message) ? 'NOT_ENTITLED' : 'AUTH_FAILURE'
  }
  if (/\b400\b|bad request|invalid query|validation|malformed/i.test(message)) return 'BAD_REQUEST'
  if (/timeout|timed out|deadline|abort/i.test(message)) return 'TIMEOUT'
  if (/unsupported|not supported|unsupported query/i.test(message)) return 'UNSUPPORTED_QUERY'
  if (/partial|incomplete|degraded/i.test(message)) return 'PARTIAL'
  if (/\b5\d\d\b|provider.*(?:error|failed)|upstream|service unavailable/i.test(message)) return 'PROVIDER_ERROR'
  return 'UNKNOWN_FAILURE'
}

function runtimeCapability(category: ProviderHealthCategoryV38): ProviderHealthEventV38['runtimeCapability'] {
  if (category === 'SUCCESS' || category === 'ZERO_RESULTS') return 'working'
  if (category === 'PARTIAL' || category === 'RATE_LIMITED' || category === 'TIMEOUT') return 'degraded'
  if (['NOT_CONFIGURED', 'NOT_ENTITLED', 'CREDITS_EXHAUSTED', 'AUTH_FAILURE', 'PREVIEW_ACCESS_BLOCKED'].includes(category)) return 'unavailable'
  return 'unknown'
}

export function providerHealthEventsV38(
  telemetry: CandidateDataProviderTelemetryV36_8[],
  retainedProviderMix: Record<string, number>,
): ProviderHealthEventV38[] {
  return telemetry.map(item => {
    const category = classifyProviderHealthV38(item)
    return {
      provider: item.provider,
      category,
      status: item.status,
      discovered: Math.max(0, item.discovered || 0),
      retained: Math.max(0, retainedProviderMix[item.provider] || 0),
      uniqueRetained: null,
      duplicateContribution: null,
      latencyMs: Math.max(0, item.latencyMs || 0),
      estimatedCredits: Math.max(0, item.estimatedCredits || 0),
      message: item.message,
      configuredCapability: 'candidate_search',
      runtimeCapability: runtimeCapability(category),
    }
  })
}

export type ProviderHealthSummaryV38 = {
  selected: number
  successful: number
  zeroResults: number
  degraded: number
  unavailable: number
  failed: number
  byCategory: Partial<Record<ProviderHealthCategoryV38, number>>
}

export function summarizeProviderHealthV38(events: ProviderHealthEventV38[]): ProviderHealthSummaryV38 {
  const byCategory: Partial<Record<ProviderHealthCategoryV38, number>> = {}
  for (const event of events) byCategory[event.category] = (byCategory[event.category] || 0) + 1
  return {
    selected: events.length,
    successful: events.filter(event => event.category === 'SUCCESS').length,
    zeroResults: events.filter(event => event.category === 'ZERO_RESULTS').length,
    degraded: events.filter(event => event.runtimeCapability === 'degraded').length,
    unavailable: events.filter(event => event.runtimeCapability === 'unavailable').length,
    failed: events.filter(event => ['PROVIDER_ERROR', 'BAD_REQUEST', 'UNSUPPORTED_QUERY', 'UNKNOWN_FAILURE'].includes(event.category)).length,
    byCategory,
  }
}
