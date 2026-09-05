import 'server-only'

export type AgentFleetWebProviderV40 = 'exa_baseline' | 'exa_vercel' | 'firecrawl' | 'parallel'

export type AgentFleetWebResultV40 = {
  provider: AgentFleetWebProviderV40
  url: string
  title?: string
  snippet?: string
}

export type AgentFleetProviderSearchV40 = {
  provider: AgentFleetWebProviderV40
  status: 'ok' | 'unavailable' | 'failed' | 'disabled'
  requests: number
  latencyMs: number
  results: AgentFleetWebResultV40[]
  error?: string
}

type SearchInput = {
  query: string
  objective?: string
  limit?: number
}

const EXA_ENDPOINT = 'https://api.exa.ai/search'
const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/search'
const PARALLEL_ENDPOINT = 'https://api.parallel.ai/v1beta/search'

function keyFor(provider: AgentFleetWebProviderV40): string | undefined {
  if (provider === 'exa_baseline') return process.env.EXA_API_KEY?.trim() || undefined
  if (provider === 'exa_vercel') return process.env.VERCEL_EXA_EXA_API_KEY?.trim() || undefined
  if (provider === 'firecrawl') return process.env.FIRECRAWL_API_KEY?.trim() || undefined
  return process.env.PARALLEL_API_KEY?.trim() || undefined
}

function boundedLimit(limit = 8): number {
  return Math.max(1, Math.min(10, Math.trunc(limit)))
}

function text(value: unknown, max = 1200): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, max) : undefined
}

export function isAllowedAgentFleetPublicUrlV40(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    if (url.username || url.password) return false
    const host = url.hostname.toLowerCase()
    if (!host || host === 'localhost' || host.endsWith('.local')) return false
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return false
    if (/^(?:10\.|127\.|169\.254\.|192\.168\.)/.test(host)) return false
    const private172 = host.match(/^172\.(\d{1,3})\./)
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false
    if (host === '0.0.0.0' || host === '::1') return false
    return true
  } catch {
    return false
  }
}

function normalized(results: AgentFleetWebResultV40[]): AgentFleetWebResultV40[] {
  const seen = new Set<string>()
  const out: AgentFleetWebResultV40[] = []
  for (const result of results) {
    if (!isAllowedAgentFleetPublicUrlV40(result.url)) continue
    let normalizedUrl: string
    try {
      const url = new URL(result.url)
      url.hash = ''
      normalizedUrl = url.toString()
    } catch {
      continue
    }
    if (seen.has(normalizedUrl)) continue
    seen.add(normalizedUrl)
    out.push({ ...result, url: normalizedUrl })
  }
  return out
}

function exaResults(provider: AgentFleetWebProviderV40, json: unknown): AgentFleetWebResultV40[] {
  const record = json && typeof json === 'object' ? json as Record<string, unknown> : {}
  const items = Array.isArray(record.results) ? record.results : []
  return items.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const url = text(row.url, 2048)
    if (!url) return []
    const highlights = Array.isArray(row.highlights) ? row.highlights.map(value => text(value, 600)).filter(Boolean).join(' ') : undefined
    return [{ provider, url, title: text(row.title, 300), snippet: highlights || text(row.text, 800) }]
  })
}

function firecrawlResults(json: unknown): AgentFleetWebResultV40[] {
  const record = json && typeof json === 'object' ? json as Record<string, unknown> : {}
  const data = record.data
  const items = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).web)
      ? (data as Record<string, unknown>).web as unknown[]
      : []
  return items.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const url = text(row.url, 2048)
    if (!url) return []
    return [{ provider: 'firecrawl' as const, url, title: text(row.title, 300), snippet: text(row.description, 800) || text(row.markdown, 800) }]
  })
}

function parallelResults(json: unknown): AgentFleetWebResultV40[] {
  const record = json && typeof json === 'object' ? json as Record<string, unknown> : {}
  const items = Array.isArray(record.results) ? record.results : []
  return items.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const url = text(row.url, 2048)
    if (!url) return []
    const excerpts = Array.isArray(row.excerpts) ? row.excerpts.map(value => text(value, 600)).filter(Boolean).join(' ') : undefined
    return [{ provider: 'parallel' as const, url, title: text(row.title, 300), snippet: excerpts || text(row.snippet, 800) }]
  })
}

export async function searchAgentFleetProviderV40(provider: AgentFleetWebProviderV40, input: SearchInput): Promise<AgentFleetProviderSearchV40> {
  if (process.env.AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED !== 'true') {
    return { provider, status: 'disabled', requests: 0, latencyMs: 0, results: [] }
  }
  const key = keyFor(provider)
  if (!key) return { provider, status: 'unavailable', requests: 0, latencyMs: 0, results: [] }

  const query = input.query.trim().slice(0, 1000)
  const objective = input.objective?.trim().slice(0, 1500) || query
  const limit = boundedLimit(input.limit)
  if (!query) return { provider, status: 'failed', requests: 0, latencyMs: 0, results: [], error: 'query_required' }

  const started = Date.now()
  try {
    let response: Response
    if (provider === 'exa_baseline' || provider === 'exa_vercel') {
      response = await fetch(EXA_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ query, type: 'instant', numResults: limit, contents: { highlights: true } }),
        cache: 'no-store',
      })
    } else if (provider === 'firecrawl') {
      response = await fetch(FIRECRAWL_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, limit, sources: ['web'], categories: [{ type: 'pdf' }] }),
        cache: 'no-store',
      })
    } else {
      response = await fetch(PARALLEL_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'parallel-beta': 'search-extract-2025-10-10',
        },
        body: JSON.stringify({ objective, search_queries: [query], max_results: limit, max_chars_per_result: 3000 }),
        cache: 'no-store',
      })
    }

    const latencyMs = Date.now() - started
    if (!response.ok) return { provider, status: 'failed', requests: 1, latencyMs, results: [], error: `provider_http_${response.status}` }
    const json = await response.json() as unknown
    const results = provider === 'firecrawl'
      ? firecrawlResults(json)
      : provider === 'parallel'
        ? parallelResults(json)
        : exaResults(provider, json)
    return { provider, status: 'ok', requests: 1, latencyMs, results: normalized(results) }
  } catch {
    return { provider, status: 'failed', requests: 1, latencyMs: Date.now() - started, results: [], error: 'provider_request_failed' }
  }
}

export async function runAgentFleetProviderTournamentV40(input: SearchInput): Promise<{
  enabled: boolean
  providers: AgentFleetProviderSearchV40[]
  uniquePublicUrls: number
}> {
  if (process.env.AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED !== 'true') return { enabled: false, providers: [], uniquePublicUrls: 0 }
  const providers: AgentFleetWebProviderV40[] = ['exa_baseline', 'exa_vercel', 'firecrawl', 'parallel']
  const results: AgentFleetProviderSearchV40[] = []
  // Sequential by design for the first benchmark: bounded spend and easy attribution.
  for (const provider of providers) results.push(await searchAgentFleetProviderV40(provider, input))
  const unique = new Set(results.flatMap(result => result.results.map(item => item.url)))
  return { enabled: true, providers: results, uniquePublicUrls: unique.size }
}
