import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const routePath = path.join(root, 'app/api/mcp/route.ts')
const libPath = path.join(root, 'lib/mcp/sourcingos-mcp-v38-5.ts')
const contractsPath = path.join(root, 'lib/intelligence-fabric/tool-contracts-v39-1.ts')

describe('V38.5 SourcingOS MCP trust contract', () => {
  const route = fs.readFileSync(routePath, 'utf8')
  const lib = fs.readFileSync(libPath, 'utf8')
  const contracts = fs.readFileSync(contractsPath, 'utf8')

  it('ships an authenticated MCP endpoint with an intentionally read-heavy tool surface', () => {
    expect(route).toContain('mcpToolSpecsV39_1()')
    expect(contracts).toContain("name: 'search_people'")
    expect(contracts).toContain("name: 'lookup_person'")
    expect(contracts).toContain("name: 'get_candidate'")
    expect(contracts).toContain("name: 'explain_candidate'")
    expect(contracts).toContain("name: 'get_known_contacts'")
    expect(contracts).not.toContain("name: 'merge_candidate'")
    expect(contracts).not.toContain("name: 'send_outreach'")
    expect(contracts).not.toContain("name: 'reject_candidate'")
  })

  it('validates bearer identity server-side and never trusts caller-supplied owner ids', () => {
    expect(lib).toContain('sb.auth.getUser(bearer)')
    expect(lib).toContain('getRouteSession()')
    expect(lib).not.toContain('args.ownerId')
    expect(lib).not.toContain('body.ownerId')
  })

  it('keeps MCP search on the owned Candidate Graph and prevents implicit provider spend', () => {
    expect(lib).toContain("mode: 'owned_candidate_graph'")
    expect(lib).toContain('does not trigger paid enrichment')
    expect(contracts).toContain('This does not trigger live provider fan-out or paid enrichment.')
    expect(contracts).toContain('externalProviderFanout: false')
    expect(contracts).toContain('paidEnrichment: false')
  })

  it('keeps identity and hiring decisions outside the MCP authority boundary', () => {
    expect(route).toContain('Identity merges, paid enrichment, outreach, rejection, and hiring decisions require explicit recruiter-controlled workflows')
    expect(contracts).toContain('never silently merges identities')
    expect(lib).toContain('Ambiguous identities remain separate until recruiter review.')
  })

  it('implements the core stateless JSON-RPC lifecycle', () => {
    expect(route).toContain("body.method === 'initialize'")
    expect(route).toContain("body.method === 'ping'")
    expect(route).toContain("body.method === 'tools/list'")
    expect(route).toContain("body.method === 'tools/call'")
    expect(route).toContain("'2026-07-28'")
    expect(route).toContain("'2025-11-25'")
  })
})
