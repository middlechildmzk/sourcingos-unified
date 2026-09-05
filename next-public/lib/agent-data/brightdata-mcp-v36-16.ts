import 'server-only'
import { callAllowlistedRemoteMcpToolV36_16 } from '@/lib/mcp/streamable-http-v36-16'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

const HOST = 'mcp.brightdata.com'
const ALLOWED_TOOLS = ['search_engine', 'discover', 'scrape_as_markdown'] as const

function endpoint(): string | undefined {
  const token = process.env.BRIGHTDATA_API_KEY?.trim()
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

/**
 * Bright Data's search_engine can return its actual SERP records in MCP
 * structuredContent while the text content is only a compact summary. Preserve
 * both representations in-memory so downstream public URL discovery can see
 * links that are already present in the provider response.
 *
 * The combined payload is still untrusted research content. It is bounded and
 * is not itself persisted by the Resume/CV sprint; only policy-qualified public
 * document URLs and aggregate telemetry may be stored.
 */
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

/**
 * Google parsed-light output on the hosted MCP can arrive as a compact text
 * summary that omits result links from MCP content. Bright Data documents Bing
 * search_engine output as Markdown, which keeps public result URLs visible.
 * Route only resume/CV-shaped research to Bing by default; all other searches
 * keep the existing Google default unless a caller explicitly chooses an engine.
 */
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

  // V40.5f: the hosted search_engine transport has produced non-empty response
  // text without any result URLs for Resume/CV searches. Bright Data's official
  // `discover` tool returns JSON records with explicit `link` values, so use it
  // only as a bounded public-search fallback when a resume-shaped search contains
  // no URL at all. This is search-result discovery only: it does not fetch the
  // result pages, bypass authentication, or change downstream identity gates.
  if (isResumeResearchQuery(clean) && !brightDataPayloadHasPublicUrlV36_16(text)) {
    const discovered = await callAllowlistedRemoteMcpToolV36_16({
      endpoint: mcpEndpoint,
      allowedHosts: [HOST],
      allowedTools: [...ALLOWED_TOOLS],
      tool: 'discover',
      arguments: {
        query: clean,
        intent: 'Find already-public professional Resume/CV documents or portfolio pages that directly match this named person.',
        country: 'US',
        language: 'en',
        num_results: 10,
        remove_duplicates: true,
      },
      clientName: 'sourcingos-resume-public-discovery',
    })
    if (!discovered.isError) {
      text = combineBrightDataSearchPayloadV36_16(
        text,
        combineBrightDataSearchPayloadV36_16(discovered.text, discovered.structuredContent),
      )
    }
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
