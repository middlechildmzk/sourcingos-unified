import type { CandidateDataProviderTelemetryV36_8 } from './candidate-data/types-v36-8'

export type SourceHealthOutcomeV36_12 =
  | 'yielding'
  | 'zero_yield'
  | 'authentication_or_entitlement_failure'
  | 'rate_limited'
  | 'provider_failure'
  | 'skipped'
  | 'unavailable'

export type SourceHealthEventV36_12 = {
  provider: string
  status: CandidateDataProviderTelemetryV36_8['status']
  outcome: SourceHealthOutcomeV36_12
  discovered: number
  retained: number
  latencyMs: number
  estimatedCredits: number
  message?: string
}

function messageText(item: CandidateDataProviderTelemetryV36_8): string {
  return String(item.message || '').toLowerCase()
}

export function classifySourceHealthOutcomeV36_12(item: CandidateDataProviderTelemetryV36_8): SourceHealthOutcomeV36_12 {
  const message = messageText(item)
  if (item.status === 'unavailable') return 'unavailable'
  if (item.status === 'skipped') return 'skipped'
  if (item.status === 'failed') {
    if (/auth|credential|entitlement|401|403/.test(message)) return 'authentication_or_entitlement_failure'
    if (/rate.?limit|429/.test(message)) return 'rate_limited'
    return 'provider_failure'
  }
  return item.discovered > 0 ? 'yielding' : 'zero_yield'
}

export function sourceHealthEventsForSearchV36_12(
  telemetry: CandidateDataProviderTelemetryV36_8[],
  retainedProviderMix: Record<string, number>,
): SourceHealthEventV36_12[] {
  return telemetry.map(item => ({
    provider: item.provider,
    status: item.status,
    outcome: classifySourceHealthOutcomeV36_12(item),
    discovered: Math.max(0, item.discovered || 0),
    retained: Math.max(0, retainedProviderMix[item.provider] || 0),
    latencyMs: Math.max(0, item.latencyMs || 0),
    estimatedCredits: Math.max(0, item.estimatedCredits || 0),
    message: item.message,
  }))
}
