import type {
  CandidateDataSearchAdapterV36_8,
  CandidateDataSearchRequestV36_8,
  CandidateDataProviderTelemetryV36_8,
  CandidateProviderObservationV36_8,
} from './types-v36-8'
import { candidateObservationKeyV36_8 } from './types-v36-8'

export type CandidateDataOrchestrationV36_8 = {
  observations: CandidateProviderObservationV36_8[]
  telemetry: CandidateDataProviderTelemetryV36_8[]
  warnings: string[]
  providerMix: Record<string, number>
}

/**
 * Execute every configured provider selected for the pass before applying the
 * global result cap. Provider observations are not identity-merged here.
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

  // Interleave provider results to avoid an early provider monopolizing the slate.
  const queues = settled.map(item => [...item.observations])
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

  return { observations, telemetry, warnings, providerMix }
}
