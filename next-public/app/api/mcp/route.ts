import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  explainCandidateV38_5,
  getCandidateV38_5,
  getKnownContactsV38_5,
  lookupPersonV38_5,
  resolveMcpPrincipalV38_5,
  searchOwnedPeopleV38_5,
} from '@/lib/mcp/sourcingos-mcp-v38-5'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SUPPORTED_PROTOCOLS = new Set(['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'])

type RpcId = string | number | null

type RpcRequest = {
  jsonrpc?: string
  id?: RpcId
  method?: string
  params?: Record<string, any>
}

const tools = [
  {
    name: 'search_people',
    description: 'Search the recruiter-owned durable SourcingOS Candidate Graph. This does not trigger live provider fan-out or paid enrichment.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, title, company, location, or other canonical candidate text.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'lookup_person',
    description: 'Resolve a known person already present in the Candidate Graph by name, professional URL, email, or phone. It never silently merges identities.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Person name, professional profile URL, observed email, or observed phone.' },
        company: { type: 'string', description: 'Optional company disambiguator for name lookup.' },
      },
      required: ['identifier'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_candidate',
    description: 'Load a canonical Candidate Graph dossier with source profiles, evidence, known contacts, and role membership.',
    inputSchema: {
      type: 'object',
      properties: { candidateId: { type: 'string' } },
      required: ['candidateId'],
      additionalProperties: false,
    },
  },
  {
    name: 'explain_candidate',
    description: 'Return the evidence and provenance behind a candidate without turning missing evidence into a rejection or provider scores into hiring decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        candidateId: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['candidateId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_known_contacts',
    description: 'Read already-observed contact signals for a candidate. This tool never triggers paid contact enrichment and never sends outreach.',
    inputSchema: {
      type: 'object',
      properties: { candidateId: { type: 'string' } },
      required: ['candidateId'],
      additionalProperties: false,
    },
  },
]

function rpcResult(id: RpcId | undefined, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result }, {
    headers: {
      'Cache-Control': 'no-store',
      'MCP-Protocol-Version': '2026-07-28',
    },
  })
}

function rpcError(id: RpcId | undefined, code: number, message: string, status = 200) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function textContent(payload: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: false,
  }
}

async function callTool(userId: string, name: string, args: Record<string, unknown>) {
  if (name === 'search_people') return searchOwnedPeopleV38_5(userId, args)
  if (name === 'lookup_person') return lookupPersonV38_5(userId, args)
  if (name === 'get_candidate') return getCandidateV38_5(userId, args)
  if (name === 'explain_candidate') return explainCandidateV38_5(userId, args)
  if (name === 'get_known_contacts') return getKnownContactsV38_5(userId, args)
  throw new Error(`Unknown tool: ${name}`)
}

export async function POST(req: NextRequest) {
  const principal = await resolveMcpPrincipalV38_5(req)
  if (!principal) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: 'Authentication required. Use a valid SourcingOS session or Supabase access token.' },
    }, {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': 'Bearer realm="SourcingOS MCP"',
      },
    })
  }

  const rl = await rateLimit(req, 'workbench', principal.userId)
  if (!rl.ok) return rl.response

  let body: RpcRequest
  try {
    body = await req.json() as RpcRequest
  } catch {
    return rpcError(null, -32700, 'Parse error')
  }

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return rpcError(body.id, -32600, 'Invalid Request')
  }

  // JSON-RPC notifications intentionally produce an empty HTTP response.
  const notification = body.id === undefined

  if (body.method === 'initialize') {
    const requested = String(body.params?.protocolVersion || '')
    const protocolVersion = SUPPORTED_PROTOCOLS.has(requested) ? requested : '2026-07-28'
    const response = rpcResult(body.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: 'sourcingos',
        title: 'SourcingOS Recruiter Intelligence',
        version: '38.5.0',
      },
      instructions: 'Evidence-first recruiter intelligence over the canonical SourcingOS Candidate Graph. Retrieval is not qualification. Identity merges, paid enrichment, outreach, rejection, and hiring decisions require explicit recruiter-controlled workflows outside this read-heavy MCP surface.',
    })
    return notification ? new NextResponse(null, { status: 202 }) : response
  }

  if (notification) return new NextResponse(null, { status: 202 })

  if (body.method === 'ping') return rpcResult(body.id, {})
  if (body.method === 'tools/list') return rpcResult(body.id, { tools })

  if (body.method === 'tools/call') {
    const name = String(body.params?.name || '')
    const args = body.params?.arguments && typeof body.params.arguments === 'object'
      ? body.params.arguments as Record<string, unknown>
      : {}
    try {
      const result = await callTool(principal.userId, name, args)
      return rpcResult(body.id, textContent(result))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed.'
      return rpcResult(body.id, {
        content: [{ type: 'text', text: message }],
        isError: true,
      })
    }
  }

  return rpcError(body.id, -32601, 'Method not found')
}

// Stateless MCP: this endpoint does not expose a server-to-client SSE stream.
// Clients should use POST request/response. Returning 405 is allowed when GET
// streaming is not offered by the server.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
