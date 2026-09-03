import type {
  ContactEnrichmentProvider,
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ContactSignal,
} from './types'
import { enrichmentFieldsUsed } from './types'

export type EnrichmentPurposeV35 =
  | 'identity_enrichment'
  | 'work_email_finder'
  | 'email_verification'
  | 'phone_enrichment'
  | 'contact_bundle'

export type ContactResolutionGoalV36_12 = 'work_email' | 'personal_email' | 'phone'

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
  stopReason: 'goal_met' | 'providers_exhausted' | 'no_provider' | 'budget_limit' | 'cache_hit'
  purpose: EnrichmentPurposeV35
  maxPaidAttempts: number
  requestedGoals?: ContactResolutionGoalV36_12[]
  satisfiedGoals?: ContactResolutionGoalV36_12[]
  missingGoals?: ContactResolutionGoalV36_12[]
}

type RunOptions = {
  request: ContactEnrichmentRequest
  purpose: EnrichmentPurposeV35
  adapters: ContactProviderAdapterV35[]
  maxPaidAttempts?: number
  maxEstimatedCredits?: number
  /** When omitted, legacy behavior remains: any returned signal satisfies the lane. */
  goals?: ContactResolutionGoalV36_12[]
  /** Existing Candidate Graph/cache signals. They cost zero and are checked first. */
  initialSignals?: ContactSignal[]
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

function uniqueSignals(signals: ContactSignal[]): ContactSignal[] {
  const seen = new Set<string>()
  return signals.filter(signal => {
    const key = `${signal.type}:${signal.value.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function usableForGoal(signal: ContactSignal): boolean {
  if (signal.permissionStatus === 'do_not_contact') return false
  if (signal.deliverability === 'invalid' || signal.deliverability === 'disconnected') return false
  return true
}

export function signalSatisfiesContactGoalV36_12(signal: ContactSignal, goal: ContactResolutionGoalV36_12): boolean {
  if (!usableForGoal(signal)) return false
  if (goal === 'work_email') return signal.type === 'email' && signal.channelKind === 'work_email'
  if (goal === 'personal_email') return signal.type === 'email' && signal.channelKind === 'personal_email'
  if (goal === 'phone') return signal.type === 'phone'
  return false
}

export function contactGoalStateV36_12(signals: ContactSignal[], goals: ContactResolutionGoalV36_12[]) {
  const requested = Array.from(new Set(goals))
  const satisfied = requested.filter(goal => signals.some(signal => signalSatisfiesContactGoalV36_12(signal, goal)))
  const missing = requested.filter(goal => !satisfied.includes(goal))
  return { requested, satisfied, missing }
}

function aggregateResult(
  request: ContactEnrichmentRequest,
  purpose: EnrichmentPurposeV35,
  signals: ContactSignal[],
  lastResult?: ContactEnrichmentResult,
): ContactEnrichmentResult {
  const unique = uniqueSignals(signals)
  return {
    provider: lastResult?.provider || 'none',
    providerConfigured: Boolean(lastResult?.providerConfigured),
    message: unique.length
      ? `Resolved ${unique.length} unique contact/profile signal${unique.length === 1 ? '' : 's'} across the contact waterfall.`
      : lastResult?.message || `No contact signal resolved for ${purpose.replace(/_/g, ' ')}.`,
    signals: unique,
    match: lastResult?.match,
    person: lastResult?.person,
    log: {
      provider: lastResult?.provider || 'none',
      attemptedAt: new Date().toISOString(),
      fieldsUsed: enrichmentFieldsUsed(request),
      resultCount: unique.length,
      warnings: lastResult?.log.warnings || [],
      persistenceMode: 'none',
    },
  }
}

/**
 * Provider-neutral contact waterfall. With goals supplied, the waterfall does
 * not stop merely because a provider returned something: only a usable signal
 * that satisfies the requested channel goal counts. Cached Candidate Graph
 * signals are evaluated first at zero cost. DNC, invalid, and disconnected
 * observations remain visible for provenance but never satisfy a resolution goal.
 */
export async function runContactEnrichmentOrchestratorV35(options: RunOptions): Promise<ContactEnrichmentOrchestrationV35> {
  const maxPaidAttempts = Math.max(1, Math.min(8, options.maxPaidAttempts ?? 1))
  const goals = options.goals?.length ? Array.from(new Set(options.goals)) : undefined
  const collected = uniqueSignals([...(options.initialSignals || [])])
  const initialGoalState = goals ? contactGoalStateV36_12(collected, goals) : undefined

  if (goals && initialGoalState?.missing.length === 0) {
    return {
      result: aggregateResult(options.request, options.purpose, collected),
      attempts: [],
      stopReason: 'cache_hit',
      purpose: options.purpose,
      maxPaidAttempts,
      requestedGoals: initialGoalState.requested,
      satisfiedGoals: initialGoalState.satisfied,
      missingGoals: [],
    }
  }

  const eligible = options.adapters.filter(adapter => adapter.purposes.includes(options.purpose))
  if (!eligible.length) {
    const state = goals ? contactGoalStateV36_12(collected, goals) : undefined
    return {
      result: collected.length ? aggregateResult(options.request, options.purpose, collected) : emptyResult(options.request, options.purpose),
      attempts: [],
      stopReason: 'no_provider',
      purpose: options.purpose,
      maxPaidAttempts,
      ...(state ? { requestedGoals: state.requested, satisfiedGoals: state.satisfied, missingGoals: state.missing } : {}),
    }
  }

  const attempts: ContactEnrichmentAttemptV35[] = []
  let estimatedCredits = 0
  let lastResult: ContactEnrichmentResult | undefined

  for (const adapter of eligible) {
    if (attempts.length >= maxPaidAttempts) break
    const nextCredits = adapter.estimatedCredits ?? 0
    if (typeof options.maxEstimatedCredits === 'number' && estimatedCredits + nextCredits > options.maxEstimatedCredits) {
      const state = goals ? contactGoalStateV36_12(collected, goals) : undefined
      return {
        result: aggregateResult(options.request, options.purpose, collected, lastResult),
        attempts,
        stopReason: 'budget_limit',
        purpose: options.purpose,
        maxPaidAttempts,
        ...(state ? { requestedGoals: state.requested, satisfiedGoals: state.satisfied, missingGoals: state.missing } : {}),
      }
    }

    const started = Date.now()
    const result = await adapter.enrich(options.request)
    lastResult = result
    estimatedCredits += nextCredits
    collected.push(...result.signals)
    const deduped = uniqueSignals(collected)
    collected.splice(0, collected.length, ...deduped)

    attempts.push({
      provider: adapter.id,
      purpose: options.purpose,
      configured: result.providerConfigured,
      resultCount: result.signals.length,
      latencyMs: Math.max(0, Date.now() - started),
      ...(adapter.estimatedCredits !== undefined ? { estimatedCredits: adapter.estimatedCredits } : {}),
      warnings: [...result.log.warnings],
    })

    if (goals) {
      const state = contactGoalStateV36_12(collected, goals)
      if (state.missing.length === 0) {
        return {
          result: aggregateResult(options.request, options.purpose, collected, result),
          attempts,
          stopReason: 'goal_met',
          purpose: options.purpose,
          maxPaidAttempts,
          requestedGoals: state.requested,
          satisfiedGoals: state.satisfied,
          missingGoals: [],
        }
      }
    } else if (result.signals.length > 0) {
      return {
        result,
        attempts,
        stopReason: 'goal_met',
        purpose: options.purpose,
        maxPaidAttempts,
      }
    }
  }

  const state = goals ? contactGoalStateV36_12(collected, goals) : undefined
  return {
    result: aggregateResult(options.request, options.purpose, collected, lastResult),
    attempts,
    stopReason: 'providers_exhausted',
    purpose: options.purpose,
    maxPaidAttempts,
    ...(state ? { requestedGoals: state.requested, satisfiedGoals: state.satisfied, missingGoals: state.missing } : {}),
  }
}
