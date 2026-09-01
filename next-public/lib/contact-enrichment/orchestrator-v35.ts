import type {
  ContactEnrichmentProvider,
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
} from './types'
import { enrichmentFieldsUsed } from './types'

export type EnrichmentPurposeV35 =
  | 'identity_enrichment'
  | 'work_email_finder'
  | 'email_verification'
  | 'phone_enrichment'

export type ContactProviderAdapterV35 = {
  id: Exclude<ContactEnrichmentProvider, 'none'>
  purposes: EnrichmentPurposeV35[]
  estimatedCredits?: number
  enrich: (request: ContactEnrichmentRequest) => Promise<ContactEnrichmentResult>
}

export type ContactEnrichmentAttemptV35 = {
  provider: ContactEnrichmentProvider
  purpose: EnrichmentPurposeV35
  configured: boolean
  resultCount: number
  latencyMs: number
  estimatedCredits?: number
  warnings: string[]
}

export type ContactEnrichmentOrchestrationV35 = {
  result: ContactEnrichmentResult
  attempts: ContactEnrichmentAttemptV35[]
  stopReason: 'goal_met' | 'providers_exhausted' | 'no_provider' | 'budget_limit'
  purpose: EnrichmentPurposeV35
  maxPaidAttempts: number
}

type RunOptions = {
  request: ContactEnrichmentRequest
  purpose: EnrichmentPurposeV35
  adapters: ContactProviderAdapterV35[]
  maxPaidAttempts?: number
  maxEstimatedCredits?: number
}

function emptyResult(request: ContactEnrichmentRequest, purpose: EnrichmentPurposeV35): ContactEnrichmentResult {
  return {
    provider: 'none',
    providerConfigured: false,
    message: `No configured contact provider can run the ${purpose.replace(/_/g, ' ')} lane.`,
    signals: [],
    log: {
      provider: 'none',
      attemptedAt: new Date().toISOString(),
      fieldsUsed: enrichmentFieldsUsed(request),
      resultCount: 0,
      warnings: ['No eligible enrichment provider.'],
      persistenceMode: 'none',
    },
  }
}

/**
 * V35 provider-neutral enrichment seam.
 *
 * This does not resolve cross-source identity, grant permission to contact, or
 * infer candidate fit. The caller must pass the existing identity-readiness gate
 * before invoking the orchestrator. The first implementation intentionally uses
 * the existing PDL adapter only; future providers can be added without rewriting
 * the API route or trust boundary.
 */
export async function runContactEnrichmentOrchestratorV35(options: RunOptions): Promise<ContactEnrichmentOrchestrationV35> {
  const maxPaidAttempts = Math.max(1, Math.min(5, options.maxPaidAttempts ?? 1))
  const eligible = options.adapters.filter(adapter => adapter.purposes.includes(options.purpose))
  if (!eligible.length) {
    return {
      result: emptyResult(options.request, options.purpose),
      attempts: [],
      stopReason: 'no_provider',
      purpose: options.purpose,
      maxPaidAttempts,
    }
  }

  const attempts: ContactEnrichmentAttemptV35[] = []
  let estimatedCredits = 0
  let lastResult: ContactEnrichmentResult | undefined

  for (const adapter of eligible) {
    if (attempts.length >= maxPaidAttempts) break
    const nextCredits = adapter.estimatedCredits ?? 0
    if (typeof options.maxEstimatedCredits === 'number' && estimatedCredits + nextCredits > options.maxEstimatedCredits) {
      return {
        result: lastResult || emptyResult(options.request, options.purpose),
        attempts,
        stopReason: 'budget_limit',
        purpose: options.purpose,
        maxPaidAttempts,
      }
    }

    const started = Date.now()
    const result = await adapter.enrich(options.request)
    lastResult = result
    estimatedCredits += nextCredits
    attempts.push({
      provider: adapter.id,
      purpose: options.purpose,
      configured: result.providerConfigured,
      resultCount: result.signals.length,
      latencyMs: Math.max(0, Date.now() - started),
      ...(adapter.estimatedCredits !== undefined ? { estimatedCredits: adapter.estimatedCredits } : {}),
      warnings: [...result.log.warnings],
    })

    if (result.signals.length > 0) {
      return {
        result,
        attempts,
        stopReason: 'goal_met',
        purpose: options.purpose,
        maxPaidAttempts,
      }
    }
  }

  return {
    result: lastResult || emptyResult(options.request, options.purpose),
    attempts,
    stopReason: 'providers_exhausted',
    purpose: options.purpose,
    maxPaidAttempts,
  }
}
