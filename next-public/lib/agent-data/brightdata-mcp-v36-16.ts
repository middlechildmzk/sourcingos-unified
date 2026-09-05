import 'server-only'
import { callAllowlistedRemoteMcpToolV36_16 } from '@/lib/mcp/streamable-http-v36-16'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

const HOST = 'mcp.brightdata.com'
const API_HOST = 'api.brightdata.com'
const ALLOWED_TOOLS = ['search_engine', 'scrape_as_markdown'] as const

function apiToken(): string | undefined {
  return process.env.BRIGHTDATA_API_KEY?.trim() || undefined
}

function endpoint(): string | undefined {
  const token = apiToken()
  if (!token) return undefined
  const url = new URL(`https://${HOST}/mcp`)
  url.searchParams.set('token', token)
  url.searchParams.set('tools', ALLOWED_TOOLS.join(','))
  return url.toString()
}

export type BrightDataSearchEngineV36_16 = 'google' | 'bing' | 'yandex'

export type BrightDataWebResultV36_16 = {
  provider: 'brightdata'
  transport: 'mcp'
  tool: 'search_engine' | 'scrape_as_markdown'
  text: string
  observedAt: string
  freshness: 'live'
  trust: {
    externalContentIsUntrusted: true
    becomesCandidateFact: false
  }
}

export function combineBrightDataSearchPayloadV36_16(text: string, structuredContent: unknown): string {
  let structured = ''
  if (structuredContent !== undefined && structuredContent !== null) {
    try { structured = JSON.stringify(structuredContent) } catch { structured = '' }
  }
  return [String(text || ''), structured]
    .filter(Boolean)
    .join('\n')
    .slice(0, 50_000)
}

export function brightDataPayloadHasPublicUrlV36_16(text: string): boolean {
  return /https?:\/\//i.test(String(text || ''))
}

export function brightDataSearchEngineForQueryV36_16(
  query: string,
  requested?: BrightDataSearchEngineV36_16,
): BrightDataSearchEngineV36_16 {
  if (requested) return requested
  return /(?:\bresume\b|\bcv\b|curriculum\s+vitae|filetype\s*:\s*(?:pdf|docx?|rtf))/i.test(query)
    ? 'bing'
    : 'google'
}

function isResumeResearchQuery(query: string): boolean {
  return /(?:\bresume\b|\bcv\b|curriculum\s+vitae|filetype\s*:\s*(?:pdf|docx?|rtf))/i.test(query)
}

type BrightDataDiscoverRecordV36_16 = {
  link?: string
  title?: string
  description?: string
  relevance_score?: number
}

async function fetchJsonWithTimeoutV36_16(url: string, init: RequestInit, timeoutMs = 12_000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Bright Data Discover API returned HTTP ${response.status}.`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Bright Data's hosted MCP deployment currently does not expose `discover`
 * even though the current official server source documents it. The same
 * official provider exposes Discover directly at api.brightdata.com/discover.
 * Use that read-only search API as a narrowly-scoped fallback for Resume/CV
 * searches only when the MCP SERP response contains no URL.
 *
 * This performs public search-result discovery only. It does not fetch result
 * pages, bypass authentication/paywalls/CAPTCHAs, enumerate storage, or capture
 * contact values.
 */
async function discoverPublicResumeLinksV36_16(query: string): Promise<string> {
  const token = apiToken()
  if (!token) throw new Error('Bright Data is not configured.')
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'sourcingos-resume-public-discovery/40.5g',
  }
  const triggered = await fetchJsonWithTimeoutV36_16(`https://${API_HOST}/discover`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      format: 'json',
      intent: 'Find already-public professional Resume/CV documents or portfolio pages that directly match this named person.',
      country: 'US',
      language: 'en',
      num_results: 10,
      remove_duplicates: true,
    }),
  }) as { task_id?: unknown }
  const taskId = typeof triggered?.task_id === 'string' ? triggered.task_id : ''
  if (!taskId) throw new Error('Bright Data Discover API did not return a task_id.')

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const polled = await fetchJsonWithTimeoutV36_16(
      `https://${API_HOST}/discover?task_id=${encodeURIComponent(taskId)}`,
      { method: 'GET', headers },
    ) as { status?: unknown; results?: unknown }
    if (polled?.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 500))
      continue
    }
    const rows = Array.isArray(polled?.results) ? polled.results : []
    const safeRows = rows.slice(0, 10).map(item => {
      const row = item && typeof item === 'object' && !Array.isArray(item) ? item as BrightDataDiscoverRecordV36_16 : {}
      return {
        link: typeof row.link === 'string' ? row.link : undefined,
        title: typeof row.title === 'string' ? row.title.slice(0, 500) : undefined,
        description: typeof row.description === 'string' ? row.description.slice(0, 1500) : undefined,
        relevance_score: typeof row.relevance_score === 'number' ? row.relevance_score : undefined,
      }
    })
    return JSON.stringify(safeRows).slice(0, 30_000)
  }
  throw new Error('Bright Data Discover API timed out waiting for public search results.')
}

export async function searchWebWithBrightDataV36_16(
  query: string,
  options: { engine?: BrightDataSearchEngineV36_16 } = {},
): Promise<BrightDataWebResultV36_16> {
  const mcpEndpoint = endpoint()
  if (!mcpEndpoint) throw new Error('Bright Data is not configured.')
  const clean = query.replace(/\s+/g, ' ').trim().slice(0, 500)
  if (!clean) throw new Error('A web-search query is required.')
  const engine = brightDataSearchEngineForQueryV36_16(clean, options.engine)
  const result = await callAllowlistedRemoteMcpToolV36_16({
    endpoint: mcpEndpoint,
    allowedHosts: [HOST],
    allowedTools: [...ALLOWED_TOOLS],
    tool: 'search_engine',
    arguments: { query: clean, engine },
    clientName: 'sourcingos-web-research',
  })
  if (result.isError) throw new Error('Bright Data MCP search_engine returned an error.')

  let text = combineBrightDataSearchPayloadV36_16(result.text, result.structuredContent)
  if (isResumeResearchQuery(clean) && !brightDataPayloadHasPublicUrlV36_16(text)) {
    const discoveredText = await discoverPublicResumeLinksV36_16(clean)
    text = [text, discoveredText].filter(Boolean).join('\n').slice(0, 50_000)
  }

  return {
    provider: 'brightdata', transport: 'mcp', tool: 'search_engine',
    text,
    observedAt: new Date().toISOString(), freshness: 'live',
    trust: { externalContentIsUntrusted: true, becomesCandidateFact: false },
  }
}

export async function refreshPublicUrlWithBrightDataV36_16(rawUrl: string): Promise<BrightDataWebResultV36_16> {
  const mcpEndpoint = endpoint()
  if (!mcpEndpoint) throw new Error('Bright Data is not configured.')
  const url = publicDeepRefreshUrlV36_16(rawUrl)
  const result = await callAllowlistedRemoteMcpToolV36_16({
    endpoint: mcpEndpoint,
    allowedHosts: [HOST],
    allowedTools: [...ALLOWED_TOOLS],
    tool: 'scrape_as_markdown',
    arguments: { url },
    clientName: 'sourcingos-web-research',
  })
  if (result.isError) throw new Error('Bright Data MCP scrape_as_markdown returned an error.')
  return {
    provider: 'brightdata', transport: 'mcp', tool: 'scrape_as_markdown',
    text: result.text,
    observedAt: new Date().toISOString(), freshness: 'live',
    trust: { externalContentIsUntrusted: true, becomesCandidateFact: false },
  }
}
