import 'server-only'
import { callAllowlistedRemoteMcpToolV36_16 } from '@/lib/mcp/streamable-http-v36-16'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

const HOST = 'mcp.brightdata.com'
const ALLOWED_TOOLS = ['search_engine', 'scrape_as_markdown'] as const

function endpoint(): string | undefined {
  const token = process.env.BRIGHTDATA_API_KEY?.trim()
  if (!token) return undefined
  const url = new URL(`https://${HOST}/mcp`)
  url.searchParams.set('token', token)
  url.searchParams.set('tools', ALLOWED_TOOLS.join(','))
  return url.toString()
}

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

export async function searchWebWithBrightDataV36_16(query: string): Promise<BrightDataWebResultV36_16> {
  const mcpEndpoint = endpoint()
  if (!mcpEndpoint) throw new Error('Bright Data is not configured.')
  const clean = query.replace(/\s+/g, ' ').trim().slice(0, 500)
  if (!clean) throw new Error('A web-search query is required.')
  const result = await callAllowlistedRemoteMcpToolV36_16({
    endpoint: mcpEndpoint,
    allowedHosts: [HOST],
    allowedTools: [...ALLOWED_TOOLS],
    tool: 'search_engine',
    arguments: { query: clean },
    clientName: 'sourcingos-web-research',
  })
  if (result.isError) throw new Error('Bright Data MCP search_engine returned an error.')
  return {
    provider: 'brightdata', transport: 'mcp', tool: 'search_engine',
    text: result.text,
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
