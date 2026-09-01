import type { AgenticConnectorKey, AgenticSearchSurface } from './agentic-search-v30'

const SURFACE_CONNECTORS: Partial<Record<AgenticSearchSurface, readonly AgenticConnectorKey[]>> = {
  github: ['github'],
  stackoverflow: ['stackoverflow'],
  devto: ['devto'],
  huggingface: ['huggingface'],
  healthcare_registry: ['npi'],
  research_publications: ['orcid', 'openalex', 'pubmed', 'crossref'],
}

/** Canonical source mapping shared by search-memory and execution telemetry. */
export function connectorKeysForSurface(surface: AgenticSearchSurface): Set<AgenticConnectorKey> {
  return new Set(SURFACE_CONNECTORS[surface] || [])
}

/**
 * Preserve each connector's internal ranking while preventing an early source
 * from exhausting the global result cap before later selected sources can
 * contribute. The result is round-robin across sources in the requested source
 * order, followed by any additional observed source keys.
 *
 * This is diversity in discovery only. It is not candidate ranking and it does
 * not change evidence, requirement assessment, or recruiter decisions.
 */
export function sourceDiverseResults<T extends { sourceKey: string }>(
  results: readonly T[],
  limit: number,
  requestedOrder: readonly string[] = [],
): T[] {
  if (!Number.isFinite(limit) || limit <= 0 || !results.length) return []
  const cappedLimit = Math.max(0, Math.floor(limit))
  if (results.length <= cappedLimit) return [...results]

  const buckets = new Map<string, T[]>()
  for (const result of results) {
    const key = String(result.sourceKey || '').trim() || 'unknown'
    const bucket = buckets.get(key) || []
    bucket.push(result)
    buckets.set(key, bucket)
  }

  const sourceOrder: string[] = []
  const seen = new Set<string>()
  for (const source of requestedOrder) {
    const key = String(source || '').trim()
    if (!key || seen.has(key) || !buckets.has(key)) continue
    seen.add(key)
    sourceOrder.push(key)
  }
  for (const result of results) {
    const key = String(result.sourceKey || '').trim() || 'unknown'
    if (seen.has(key)) continue
    seen.add(key)
    sourceOrder.push(key)
  }

  const offsets = new Map<string, number>()
  const output: T[] = []
  while (output.length < cappedLimit) {
    let advanced = false
    for (const source of sourceOrder) {
      const bucket = buckets.get(source) || []
      const offset = offsets.get(source) || 0
      const candidate = bucket[offset]
      if (!candidate) continue
      output.push(candidate)
      offsets.set(source, offset + 1)
      advanced = true
      if (output.length >= cappedLimit) break
    }
    if (!advanced) break
  }

  return output
}

export function sourceDistribution(results: readonly { sourceKey: string }[]): Record<string, number> {
  const distribution: Record<string, number> = {}
  for (const result of results) {
    const source = String(result.sourceKey || '').trim() || 'unknown'
    distribution[source] = (distribution[source] || 0) + 1
  }
  return distribution
}
