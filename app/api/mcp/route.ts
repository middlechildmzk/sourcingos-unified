import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { resolveMcpPrincipalV38_5 } from '@/lib/mcp/sourcingos-mcp-v38-5'
import {
  executeSourcingOsToolV39_1,
  mcpToolSpecsV39_1,
} from '@/lib/intelligence-fabric/tool-contracts-v39-1'

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
        version: '39.1.0',
      },
      instructions: 'Evidence-first recruiter intelligence over the canonical SourcingOS Candidate Graph. MCP and embedded AI share the same governed tool contracts. Retrieval is not qualification. Identity merges, paid enrichment, outreach, rejection, and hiring decisions require explicit recruiter-controlled workflows outside this read-heavy surface.',
    })
    return notification ? new NextResponse(null, { status: 202 }) : response
  }

  if (notification) return new NextResponse(null, { status: 202 })

  if (body.method === 'ping') return rpcResult(body.id, {})
  if (body.method === 'tools/list') return rpcResult(body.id, { tools: mcpToolSpecsV39_1() })

  if (body.method === 'tools/call') {
    const name = String(body.params?.name || '')
    const args = body.params?.arguments && typeof body.params.arguments === 'object'
      ? body.params.arguments as Record<string, unknown>
      : {}
    try {
      const result = await executeSourcingOsToolV39_1(principal.userId, name, args)
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
