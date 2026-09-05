import 'server-only'
import { callAllowlistedRemoteMcpToolV36_16 } from '@/lib/mcp/streamable-http-v36-16'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

const HOST = 'mcp.brightdata.com'
const API_HOST = 'api.brightdata.com'
const FIRECRAWL_HOST = 'api.firecrawl.dev'
const ALLOWED_TOOLS = ['search_engine', 'scrape_as_markdown'] as const

function apiToken(): string | undefined {
  return process.env.BRIGHTDATA_API_KEY?.trim() || undefined
}

function firecrawlToken(): string | undefined {
  return process.env.FIRECRAWL_API_KEY?.trim() || undefined
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

export type PublicUrlRefreshResultV40_5I = {
  provider: 'brightdata' | 'firecrawl'
  transport: 'mcp' | 'rest'
  tool: 'scrape_as_markdown' | 'scrape'
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

export function firecrawlMarkdownFromPayloadV40_5I(payload: unknown): string {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {}
  const markdown = typeof data.markdown === 'string' ? data.markdown : ''
  return markdown.slice(0, 100_000)
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

async function fetchJsonWithTimeoutV36_16(url: string, init: RequestInit, timeoutMs = 12_000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Bright Data API returned HTTP ${response.status}.`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFirecrawlJsonV40_5I(url: string, init: RequestInit, timeoutMs = 30_000): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Firecrawl public document refresh returned HTTP ${response.status}.`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

type BrightDataZoneV36_16 = { name?: unknown; type?: unknown }
let cachedSerpZoneV36_16: string | null = null

async function resolveActiveSerpZoneV36_16(token: string): Promise<string> {
  const configured = process.env.BRIGHTDATA_SERP_ZONE?.trim()
  if (configured) return configured
  if (cachedSerpZoneV36_16) return cachedSerpZoneV36_16

  const zones = await fetchJsonWithTimeoutV36_16(`https://${API_HOST}/zone/get_active_zones`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
  const rows = Array.isArray(zones) ? zones as BrightDataZoneV36_16[] : []
  const serp = rows.find(row => row?.type === 'serp' && typeof row?.name === 'string')
  const name = typeof serp?.name === 'string' ? serp.name.trim() : ''
  if (!name) throw new Error('Bright Data has no active SERP API zone available for public Resume/CV search.')
  cachedSerpZoneV36_16 = name
  return name
}

/**
 * The retired /discover endpoint returned HTTP 410 in production. Bright Data's
 * current documented public search endpoint is POST /request with an active SERP
 * API zone. Use it only as a bounded Resume/CV fallback when hosted MCP search
 * returns no URL. This is structured search-result retrieval only; downstream
 * policy still decides which already-public document URLs are eligible to fetch.
 */
async function searchPublicResumeLinksWithSerpApiV36_16(query: string): Promise<string> {
  const token = apiToken()
  if (!token) throw new Error('Bright Data is not configured.')
  const zone = await resolveActiveSerpZoneV36_16(token)
  const response = await fetchJsonWithTimeoutV36_16(`https://${API_HOST}/request`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'sourcingos-resume-public-discovery/40.5h',
    },
    body: JSON.stringify({
      zone,
      search_engine: 'bing',
      query,
      data_format: 'parsed_bing_api',
      format: 'json',
      country: 'us',
    }),
  }, 20_000)
  try { return JSON.stringify(response).slice(0, 40_000) } catch { return '' }
}

async function refreshPublicUrlWithFirecrawlV40_5I(url: string): Promise<PublicUrlRefreshResultV40_5I> {
  const token = firecrawlToken()
  if (!token) throw new Error('Firecrawl is not configured for public document refresh.')
  const payload = await fetchFirecrawlJsonV40_5I(`https://${FIRECRAWL_HOST}/v2/scrape`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'sourcingos-public-document-refresh/40.5i',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      parsers: ['pdf'],
      removeBase64Images: true,
      blockAds: true,
      timeout: 25_000,
    }),
  })
  const text = firecrawlMarkdownFromPayloadV40_5I(payload)
  if (!text.trim()) throw new Error('Firecrawl public document refresh returned no markdown.')
  return {
    provider: 'firecrawl', transport: 'rest', tool: 'scrape',
    text,
    observedAt: new Date().toISOString(), freshness: 'live',
    trust: { externalContentIsUntrusted: true, becomesCandidateFact: false },
  }
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
    const serpText = await searchPublicResumeLinksWithSerpApiV36_16(clean)
    text = [text, serpText].filter(Boolean).join('\n').slice(0, 50_000)
  }

  return {
    provider: 'brightdata', transport: 'mcp', tool: 'search_engine',
    text,
    observedAt: new Date().toISOString(), freshness: 'live',
    trust: { externalContentIsUntrusted: true, becomesCandidateFact: false },
  }
}

export async function refreshPublicUrlWithBrightDataV36_16(rawUrl: string): Promise<PublicUrlRefreshResultV40_5I> {
  // Every fetch route starts from the existing SourcingOS public-web policy.
  // Firecrawl is only a retrieval transport for the already-approved public URL;
  // it does not loosen host restrictions or perform authenticated interaction.
  const url = publicDeepRefreshUrlV36_16(rawUrl)
  const mcpEndpoint = endpoint()
  let brightDataError: unknown = null

  if (mcpEndpoint) {
    try {
      const result = await callAllowlistedRemoteMcpToolV36_16({
        endpoint: mcpEndpoint,
        allowedHosts: [HOST],
        allowedTools: [...ALLOWED_TOOLS],
        tool: 'scrape_as_markdown',
        arguments: { url },
        clientName: 'sourcingos-web-research',
      })
      if (result.isError) throw new Error('Bright Data MCP scrape_as_markdown returned an error.')
      if (!result.text.trim()) throw new Error('Bright Data MCP scrape_as_markdown returned no public text.')
      return {
        provider: 'brightdata', transport: 'mcp', tool: 'scrape_as_markdown',
        text: result.text,
        observedAt: new Date().toISOString(), freshness: 'live',
        trust: { externalContentIsUntrusted: true, becomesCandidateFact: false },
      }
    } catch (error) {
      brightDataError = error
    }
  }

  // Bright Data's hosted MCP currently exposes search_engine but not the
  // requested scrape tool in production. Firecrawl is a bounded fallback only
  // when its server-side key is configured; no browser actions or auth headers
  // from the target site are supplied.
  if (firecrawlToken()) return await refreshPublicUrlWithFirecrawlV40_5I(url)

  if (brightDataError instanceof Error) throw brightDataError
  throw new Error('No public document refresh provider is configured.')
}
