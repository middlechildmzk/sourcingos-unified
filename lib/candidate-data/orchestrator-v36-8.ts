import type {
  CandidateDataSearchAdapterV36_8,
  CandidateDataSearchRequestV36_8,
  CandidateDataProviderTelemetryV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
} from './types-v36-8'
import { candidateObservationKeyV36_8 } from './types-v36-8'
import { candidateObservationMatchExplanationV36_9 } from './observation-match-explanation-v36-9'
import { passesRetrievalRelevanceGateV37 } from './retrieval-relevance-v37'
import { applySearchDiscoveryExpansionV37_2 } from '../search-discovery-expansion-v37-2'

export type CandidateDataOrchestrationV36_8 = {
  observations: CandidateProviderObservationV36_8[]
  telemetry: CandidateDataProviderTelemetryV36_8[]
  warnings: string[]
  /** Raw discoveries returned by each provider before relevance admission/global capping. */
  providerMix: Record<string, number>
  /** Provider composition of the retained, interleaved slate after relevance admission and capping. */
  retainedProviderMix: Record<string, number>
  discoveredBeforeCap: number
  returnedAfterCap: number
  contributingProviders: number
  /** Observations excluded before diversity because they lacked minimum retrieval relevance. */
  relevanceRejected: number
}

export type CandidateProviderProgressCallbackV37 = (result: CandidateDataSearchResultV36_8) => void | Promise<void>

export const DEFAULT_CANDIDATE_PROVIDER_TIMEOUT_MS_V39_1 = 25_000

class CandidateProviderTimeoutErrorV39_1 extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Provider timed out after ${timeoutMs}ms.`)
    this.name = 'CandidateProviderTimeoutErrorV39_1'
  }
}

/**
 * A single slow vendor must never hold the entire recruiter slate open forever.
 * This deadline terminalizes only that provider lane. It does not turn a timeout
 * into zero results and it does not cancel or reinterpret other providers.
 */
async function withProviderDeadlineV39_1<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CandidateProviderTimeoutErrorV39_1(timeoutMs)), timeoutMs)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

function expansionSummary(
  original: CandidateDataSearchRequestV36_8,
  expanded: CandidateDataSearchRequestV36_8,
): string | undefined {
  const originalTitles = new Set((original.titles || []).map(value => value.toLowerCase()))
  const originalSkills = new Set((original.skills || []).map(value => value.toLowerCase()))
  const originalLocations = new Set((original.locations || []).map(value => value.toLowerCase()))
  const titles = (expanded.titles || []).filter(value => !originalTitles.has(value.toLowerCase()))
  const skills = (expanded.skills || []).filter(value => !originalSkills.has(value.toLowerCase()))
  const locations = (expanded.locations || []).filter(value => !originalLocations.has(value.toLowerCase()))
  const parts = [
    titles.length ? `title aliases: ${titles.join(', ')}` : '',
    skills.length ? `skill aliases: ${skills.join(', ')}` : '',
    locations.length ? `nearby markets: ${locations.join(', ')}` : '',
  ].filter(Boolean)
  return parts.length
    ? `Discovery expansion applied before provider execution (${parts.join(' · ')}). Expansion broadens retrieval only; recruiter requirements and evidence standards are unchanged.`
    : undefined
}

/**
 * Execute every configured provider selected for the pass before applying the
 * global result cap. Provider observations are not identity-merged here.
 *
 * Cross-provider overlap is intentionally NOT guessed here: Pearch id 123 and
 * Coresignal id 456 are separate observations until Candidate Graph has a
 * deterministic/proposed identity relationship. Incremental canonical reach is
 * measured after identity resolution, not by adding vendor headline counts.
 *
 * V37 optionally exposes provider-terminal progress. The callback is telemetry
 * only: it never bypasses the relevance floor, identity rules, or final
 * cross-source interleaving used for the retained slate.
 */
export async function runCandidateDataSearchV36_8(
  request: CandidateDataSearchRequestV36_8,
  adapters: CandidateDataSearchAdapterV36_8[],
  globalLimit = 50,
  onProviderSettled?: CandidateProviderProgressCallbackV37,
  providerTimeoutMs = DEFAULT_CANDIDATE_PROVIDER_TIMEOUT_MS_V39_1,
): Promise<CandidateDataOrchestrationV36_8> {
  const effectiveRequest = applySearchDiscoveryExpansionV37_2(request)
  const settled = await Promise.all(adapters.map(async adapter => {
    let result: CandidateDataSearchResultV36_8
    try {
      result = await withProviderDeadlineV39_1(adapter.search(effectiveRequest), providerTimeoutMs)
    } catch (error) {
      const timedOut = error instanceof CandidateProviderTimeoutErrorV39_1
      result = {
        observations: [],
        telemetry: {
          provider: adapter.provider,
          status: 'failed' as const,
          discovered: 0,
          latencyMs: timedOut ? error.timeoutMs : 0,
          message: timedOut
            ? `Provider timed out after ${error.timeoutMs}ms; other provider results were allowed to complete.`
            : 'Provider adapter failed before returning a normalized result.',
        },
        warnings: [timedOut
          ? `${adapter.provider} timed out after ${error.timeoutMs}ms; the search continued with other sources.`
          : `${adapter.provider} adapter failed.`],
      }
    }
    try {
      await onProviderSettled?.(result)
    } catch {
      // Progress delivery is best-effort and must never change search truth.
    }
    return result
  }))

  const telemetry = settled.map(item => item.telemetry)
  const warnings = settled.flatMap(item => item.warnings)
  const appliedExpansion = expansionSummary(request, effectiveRequest)
  if (appliedExpansion) warnings.unshift(appliedExpansion)
  const providerMix: Record<string, number> = {}
  for (const item of settled) providerMix[item.telemetry.provider] = item.observations.length
  const discoveredBeforeCap = Object.values(providerMix).reduce((sum, count) => sum + count, 0)
  const contributingProviders = Object.values(providerMix).filter(count => count > 0).length

  // A provider-neutral minimum retrieval floor runs before diversity/interleaving.
  // This is not candidate fit or qualification. It prevents an obviously
  // unrelated fast source from consuming the visible slate while preserving
  // unknown/missing candidate evidence as unknown rather than negative evidence.
  let relevanceRejected = 0
  const admitted = settled.map(item => item.observations.filter(observation => {
    const keep = passesRetrievalRelevanceGateV37(effectiveRequest, observation)
    if (!keep) relevanceRejected += 1
    return keep
  }))
  if (relevanceRejected > 0) warnings.push(`${relevanceRejected} provider observation${relevanceRejected === 1 ? '' : 's'} excluded by the minimum retrieval-relevance gate before source diversity.`)

  // Attach a SourcingOS explanation derived only from normalized provider fields
  // and recruiter-entered search criteria plus explicit retrieval expansion.
  // This is transparency, not ranking or qualification.
  const queues = admitted.map(items => items.map(observation => ({
    ...observation,
    providerExplanation: [
      observation.providerExplanation,
      candidateObservationMatchExplanationV36_9(effectiveRequest, observation),
    ].filter(Boolean).join(' '),
  })))

  // Interleave only admitted provider observations so diversity cannot promote a
  // weak/unrelated observation above stronger candidate-like evidence.
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
    relevanceRejected,
  }
}
