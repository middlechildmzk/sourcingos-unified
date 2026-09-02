export type GeographyExecutionSourceV35 =
  | 'github'
  | 'stackoverflow'
  | 'stackexchange_infrastructure'
  | 'devto'
  | 'huggingface'
  | 'npi'
  | 'campaign'

export type GeographyExecutionModeV35 =
  | 'bounded_fanout'
  | 'array_native'
  | 'source_agnostic'
  | 'none'

export type GeographyExecutionPlanV35 = {
  source: GeographyExecutionSourceV35
  mode: GeographyExecutionModeV35
  requestedLocations: string[]
  executedLocations: string[]
  omittedLocations: string[]
  perLocationLimit: number
  explanation: string
}

function uniqueLocations(values: readonly string[], max = 20): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(cleaned)
    if (output.length >= max) break
  }
  return output
}

function boundedPerLocationLimit(limit: number, marketCount: number, maxPerMarket: number): number {
  if (!marketCount) return Math.max(1, Math.min(limit, maxPerMarket))
  return Math.max(1, Math.min(maxPerMarket, Math.ceil(limit / marketCount)))
}

/**
 * Source-specific geography execution contract.
 *
 * Geography is retrieval intent only. A source supporting a location parameter
 * does not make that location a candidate fact; candidate geography must still
 * come from observed person-level source data. Sources without native location
 * filtering are deliberately source-agnostic rather than re-run wastefully for
 * every recruiter-approved market.
 */
export function planGeographyExecutionV35(
  source: GeographyExecutionSourceV35,
  locations: readonly string[],
  limit: number,
): GeographyExecutionPlanV35 {
  const requestedLocations = uniqueLocations(locations)
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit || 1), 50))

  if (!requestedLocations.length) {
    return {
      source,
      mode: 'none',
      requestedLocations: [],
      executedLocations: [],
      omittedLocations: [],
      perLocationLimit: safeLimit,
      explanation: 'No recruiter-approved geography was supplied for this source execution.',
    }
  }

  if (source === 'github') {
    const executedLocations = requestedLocations.slice(0, 2)
    return {
      source,
      mode: 'bounded_fanout',
      requestedLocations,
      executedLocations,
      omittedLocations: requestedLocations.slice(executedLocations.length),
      perLocationLimit: boundedPerLocationLimit(safeLimit, executedLocations.length, 6),
      explanation: 'GitHub supports one location per technical search, so SourcingOS executes a bounded anchor-first fan-out across at most two recruiter-approved markets per pass.',
    }
  }

  if (source === 'stackoverflow') {
    const executedLocations = requestedLocations.slice(0, 3)
    return {
      source,
      mode: 'bounded_fanout',
      requestedLocations,
      executedLocations,
      omittedLocations: requestedLocations.slice(executedLocations.length),
      perLocationLimit: boundedPerLocationLimit(safeLimit, executedLocations.length, 8),
      explanation: 'Stack Overflow V2 supports one location per execution, so SourcingOS fans out across at most three recruiter-approved markets and deduplicates people afterward.',
    }
  }

  if (source === 'npi' || source === 'campaign') {
    return {
      source,
      mode: 'array_native',
      requestedLocations,
      executedLocations: requestedLocations,
      omittedLocations: [],
      perLocationLimit: safeLimit,
      explanation: 'This source accepts the recruiter-approved location array natively; SourcingOS sends the bounded array once rather than multiplying requests.',
    }
  }

  return {
    source,
    mode: 'source_agnostic',
    requestedLocations,
    executedLocations: [],
    omittedLocations: [],
    perLocationLimit: safeLimit,
    explanation: source === 'stackexchange_infrastructure'
      ? 'Infrastructure Stack Exchange discovery is capability/tag based and has no native person-location filter; observed candidate geography is evaluated downstream.'
      : `${source === 'devto' ? 'DEV' : 'Hugging Face'} discovery does not currently execute a native location filter; SourcingOS searches once and evaluates observed candidate geography downstream.`,
  }
}

export type GeographyFanoutResultV35<T> = {
  items: T[]
  discoveredByLocation: Record<string, number>
}

/**
 * Sequential bounded fan-out keeps connector quota use predictable. Results are
 * deduplicated by the caller-supplied person/source key while preserving the
 * anchor-first execution order.
 */
export async function runBoundedGeographyFanoutV35<T>(
  plan: GeographyExecutionPlanV35,
  run: (location: string, limit: number) => Promise<readonly T[]>,
  keyOf: (item: T) => string,
): Promise<GeographyFanoutResultV35<T>> {
  const items: T[] = []
  const seen = new Set<string>()
  const discoveredByLocation: Record<string, number> = {}

  for (const location of plan.executedLocations) {
    const batch = await run(location, plan.perLocationLimit)
    let added = 0
    for (const item of batch) {
      const key = keyOf(item)
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push(item)
      added += 1
    }
    discoveredByLocation[location] = added
  }

  return { items, discoveredByLocation }
}
