import type {
  CandidateDataSearchAdapterV36_8,
  CandidateDataSearchRequestV36_8,
  CandidateDataProviderTelemetryV36_8,
  CandidateProviderObservationV36_8,
} from './types-v36-8'
import { candidateObservationKeyV36_8 } from './types-v36-8'
import { candidateObservationMatchExplanationV36_9 } from './observation-match-explanation-v36-9'

export type CandidateDataOrchestrationV36_8 = {
  observations: CandidateProviderObservationV36_8[]
  telemetry: CandidateDataProviderTelemetryV36_8[]
  warnings: string[]
  /** Raw discoveries returned by each provider before global capping. */
  providerMix: Record<string, number>
  /** Provider composition of the retained, interleaved slate after capping. */
  retainedProviderMix: Record<string, number>
  discoveredBeforeCap: number
  returnedAfterCap: number
  contributingProviders: number
}

/**
 * Execute every configured provider selected for the pass before applying the
 * global result cap. Provider observations are not identity-merged here.
 *
 * Cross-provider overlap is intentionally NOT guessed here: Pearch id 123 and
 * Coresignal id 456 are separate observations until Candidate Graph has a
 * deterministic/proposed identity relationship. Incremental canonical reach is
 * measured after identity resolution, not by adding vendor headline counts.
 */
export async function runCandidateDataSearchV36_8(
  request: CandidateDataSearchRequestV36_8,
  adapters: CandidateDataSearchAdapterV36_8[],
  globalLimit = 50,
): Promise<CandidateDataOrchestrationV36_8> {
  const settled = await Promise.all(adapters.map(async adapter => {
    try {
      return await adapter.search(request)
    } catch {
      return {
        observations: [],
        telemetry: {
          provider: adapter.provider,
          status: 'failed' as const,
          discovered: 0,
          latencyMs: 0,
          message: 'Provider adapter failed before returning a normalized result.',
        },
        warnings: [`${adapter.provider} adapter failed.`],
      }
    }
  }))

  const telemetry = settled.map(item => item.telemetry)
  const warnings = settled.flatMap(item => item.warnings)
  const providerMix: Record<string, number> = {}
  for (const item of settled) providerMix[item.telemetry.provider] = item.observations.length
  const discoveredBeforeCap = Object.values(providerMix).reduce((sum, count) => sum + count, 0)
  const contributingProviders = Object.values(providerMix).filter(count => count > 0).length

  // Attach a SourcingOS explanation derived only from normalized provider fields
  // and recruiter-entered search criteria. This is transparency, not ranking.
  const queues = settled.map(item => item.observations.map(observation => ({
    ...observation,
    providerExplanation: [
      observation.providerExplanation,
      candidateObservationMatchExplanationV36_9(request, observation),
    ].filter(Boolean).join(' '),
  })))

  // Interleave provider results to avoid an early provider monopolizing the slate.
  const observations: CandidateProviderObservationV36_8[] = []
  const seenProviderIds = new Set<string>()
  const cap = Math.max(1, Math.min(100, globalLimit))
  let madeProgress = true
  while (observations.length < cap && madeProgress) {
    madeProgress = false
    for (const queue of queues) {
      const next = queue.shift()
      if (!next) continue
      madeProgress = true
      const key = candidateObservationKeyV36_8(next)
      if (seenProviderIds.has(key)) continue
      seenProviderIds.add(key)
      observations.push(next)
      if (observations.length >= cap) break
    }
  }

  const retainedProviderMix: Record<string, number> = {}
  for (const observation of observations) retainedProviderMix[observation.provider] = (retainedProviderMix[observation.provider] || 0) + 1

  return {
    observations,
    telemetry,
    warnings,
    providerMix,
    retainedProviderMix,
    discoveredBeforeCap,
    returnedAfterCap: observations.length,
    contributingProviders,
  }
}
