import 'server-only'

const PROTOCOL_VERSION = '2025-11-25'
const MAX_RESPONSE_CHARS = 80_000
const TIMEOUT_MS = 45_000

type JsonRecord = Record<string, unknown>
type McpEnvelope = { jsonrpc?: string; id?: unknown; result?: unknown; error?: unknown }

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function safeEndpoint(raw: string, allowedHosts: string[]): URL {
  const endpoint = new URL(raw)
  if (endpoint.protocol !== 'https:' || !allowedHosts.includes(endpoint.hostname.toLowerCase())) {
    throw new Error('MCP endpoint is not in the server allowlist.')
  }
  return endpoint
}

function parseEventStream(text: string, wantedId?: number): McpEnvelope | undefined {
  const dataLines = text.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim())
  for (const data of dataLines) {
    if (!data || data === '[DONE]') continue
    try {
      const parsed = JSON.parse(data) as McpEnvelope
      if (wantedId === undefined || parsed.id === wantedId) return parsed
    } catch { /* ignore non-JSON SSE events */ }
  }
  return undefined
}

async function readEnvelope(response: Response, wantedId?: number): Promise<McpEnvelope | undefined> {
  if (response.status === 202 || response.status === 204) return undefined
  const text = (await response.text()).slice(0, MAX_RESPONSE_CHARS)
  if (!text) return undefined
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream')) return parseEventStream(text, wantedId)
  try { return JSON.parse(text) as McpEnvelope } catch { return undefined }
}

async function postMcp(
  endpoint: URL,
  message: JsonRecord,
  options: { sessionId?: string; method?: string; name?: string; protocolVersion?: string } = {},
): Promise<{ response: Response; envelope?: McpEnvelope; sessionId?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    }
    if (options.sessionId) headers['Mcp-Session-Id'] = options.sessionId
    if (options.protocolVersion) headers['MCP-Protocol-Version'] = options.protocolVersion
    if (options.method) headers['Mcp-Method'] = options.method
    if (options.name) headers['Mcp-Name'] = options.name
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok && response.status !== 202) throw new Error(`MCP server returned HTTP ${response.status}.`)
    const wantedId = typeof message.id === 'number' ? message.id : undefined
    const envelope = await readEnvelope(response, wantedId)
    const sessionId = response.headers.get('mcp-session-id') || response.headers.get('Mcp-Session-Id') || options.sessionId
    if (envelope?.error) {
      const error = record(envelope.error)
      throw new Error(typeof error.message === 'string' ? error.message : 'MCP server returned an error.')
    }
    return { response, envelope, sessionId: sessionId || undefined }
  } finally {
    clearTimeout(timer)
  }
}

export type McpToolV36_16 = {
  name: string
  description?: string
  inputSchema?: JsonRecord
}

export type McpToolCallResultV36_16 = {
  text: string
  isError: boolean
  structuredContent?: unknown
}

export async function callAllowlistedRemoteMcpToolV36_16(input: {
  endpoint: string
  allowedHosts: string[]
  allowedTools: string[]
  tool: string
  arguments: JsonRecord
  clientName: string
}): Promise<McpToolCallResultV36_16> {
  if (!input.allowedTools.includes(input.tool)) throw new Error('MCP tool is not allowlisted by SourcingOS.')
  const endpoint = safeEndpoint(input.endpoint, input.allowedHosts.map(host => host.toLowerCase()))

  const initialized = await postMcp(endpoint, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: input.clientName, version: '36.16' } },
  }, { method: 'initialize' })

  const initResult = record(initialized.envelope?.result)
  const negotiatedVersion = typeof initResult.protocolVersion === 'string' ? initResult.protocolVersion : PROTOCOL_VERSION
  const sessionId = initialized.sessionId

  await postMcp(endpoint, {
    jsonrpc: '2.0', method: 'notifications/initialized', params: {},
  }, { sessionId, method: 'notifications/initialized', protocolVersion: negotiatedVersion })

  const listed = await postMcp(endpoint, {
    jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
  }, { sessionId, method: 'tools/list', protocolVersion: negotiatedVersion })
  const toolsRaw = record(listed.envelope?.result).tools
  const tools: McpToolV36_16[] = Array.isArray(toolsRaw)
    ? toolsRaw.map(item => record(item)).map(item => ({
        name: typeof item.name === 'string' ? item.name : '',
        description: typeof item.description === 'string' ? item.description : undefined,
        inputSchema: record(item.inputSchema),
      })).filter(item => item.name)
    : []
  if (!tools.some(tool => tool.name === input.tool)) throw new Error(`Allowlisted MCP tool ${input.tool} is not available on the connected server.`)

  const called = await postMcp(endpoint, {
    jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: input.tool, arguments: input.arguments },
  }, { sessionId, method: 'tools/call', name: input.tool, protocolVersion: negotiatedVersion })

  const result = record(called.envelope?.result)
  const content = Array.isArray(result.content) ? result.content.map(record) : []
  const text = content
    .filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => String(item.text))
    .join('\n')
    .slice(0, 50_000)
  return {
    text,
    isError: result.isError === true,
    structuredContent: result.structuredContent,
  }
}
