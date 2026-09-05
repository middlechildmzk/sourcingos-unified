import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fuseRetrievalLanesV39_1 } from '../lib/intelligence-fabric/rrf-v39-1'
import { routeFabricOperationV39_1 } from '../lib/intelligence-fabric/smart-tool-router-v39-1'
import type { ProviderCapabilityRecordV39_1 } from '../lib/intelligence-fabric/capability-registry-v39-1'

const root = process.cwd()
const capabilitySource = fs.readFileSync(path.join(root, 'lib/intelligence-fabric/capability-registry-v39-1.ts'), 'utf8')
const neo4jSource = fs.readFileSync(path.join(root, 'lib/intelligence-fabric/neo4j-projection-v39-1.ts'), 'utf8')
const gatewaySource = fs.readFileSync(path.join(root, 'lib/ai/gateway-v39-1.ts'), 'utf8')
const toolSource = fs.readFileSync(path.join(root, 'lib/intelligence-fabric/tool-contracts-v39-1.ts'), 'utf8')
const mcpRoute = fs.readFileSync(path.join(root, 'app/api/mcp/route.ts'), 'utf8')

function provider(overrides: Partial<ProviderCapabilityRecordV39_1> = {}): ProviderCapabilityRecordV39_1 {
  return {
    provider: 'pearch',
    label: 'Pearch',
    owned: false,
    configured: true,
    adapterExecutable: true,
    entitlement: 'entitled',
    runtimeHealth: 'SUCCESS',
    operations: [{ operation: 'people_search', maturity: 'active', costClass: 'unknown', approvalRequired: false }],
    rateLimit: { known: false, note: 'unknown' },
    rights: {
      status: 'provider_terms_require_audit',
      normalizedStorage: 'provider_terms',
      rawPayloadStorage: 'disabled_by_default',
      searchUse: 'provider_terms',
      retention: 'provider_terms',
    },
    freshness: 'live',
    notes: [],
    ...overrides,
  }
}

const owned = provider({
  provider: 'sourcingos_owned_graph',
  label: 'SourcingOS Candidate Graph',
  owned: true,
  operations: [{ operation: 'people_search', maturity: 'active', costClass: 'none', approvalRequired: false }],
  freshness: 'durable',
  rights: {
    status: 'canonical_owned_graph',
    normalizedStorage: 'allowed',
    rawPayloadStorage: 'not_applicable',
    searchUse: 'allowed',
    retention: 'canonical',
  },
})

describe('V39.1 SourcingOS Intelligence Fabric', () => {
  it('routes the owned canonical graph before eligible external providers', () => {
    const result = routeFabricOperationV39_1({ operation: 'people_search', allowExternal: true }, [provider(), owned])
    expect(result.steps[0]?.provider).toBe('sourcingos_owned_graph')
    expect(result.steps[1]?.provider).toBe('pearch')
    expect(result.trust.providerRoutingIsCandidateRanking).toBe(false)
    expect(result.trust.retrievalIsQualification).toBe(false)
  })

  it('does not treat API-key configuration as entitlement, credits, or runtime health', () => {
    for (const runtimeHealth of ['NOT_ENTITLED', 'CREDITS_EXHAUSTED', 'AUTH_FAILURE'] as const) {
      const result = routeFabricOperationV39_1(
        { operation: 'people_search', allowExternal: true },
        [owned, provider({ runtimeHealth, entitlement: runtimeHealth === 'NOT_ENTITLED' ? 'not_entitled' : runtimeHealth === 'CREDITS_EXHAUSTED' ? 'credits_exhausted' : 'unknown' })],
      )
      expect(result.steps.some(item => item.provider === 'pearch')).toBe(false)
    }
    expect(capabilitySource).toContain('API key presence does not prove entitlement')
  })

  it('requires explicit recruiter approval before contact reveal execution', () => {
    const contactProvider = provider({
      operations: [{ operation: 'contact_enrich', maturity: 'active', costClass: 'variable', approvalRequired: true }],
    })
    const denied = routeFabricOperationV39_1({ operation: 'contact_enrich', allowExternal: true, recruiterApprovedSpend: true }, [contactProvider])
    expect(denied.steps).toHaveLength(0)
    expect(denied.skipped[0]?.reason).toContain('explicit recruiter approval')

    const approved = routeFabricOperationV39_1({
      operation: 'contact_enrich',
      allowExternal: true,
      recruiterApprovedSpend: true,
      recruiterApprovedSensitiveReveal: true,
    }, [contactProvider])
    expect(approved.steps[0]?.provider).toBe('pearch')
  })

  it('uses one governed tool contract for MCP and embedded AI without exposing paid enrichment', () => {
    expect(toolSource).toContain('embeddedAiExposed')
    expect(toolSource).toContain('paidEnrichment: false')
    expect(toolSource).not.toContain("name: 'enrich_contact'")
    expect(mcpRoute).toContain('mcpToolSpecsV39_1()')
    expect(mcpRoute).toContain('executeSourcingOsToolV39_1')
  })

  it('keeps Neo4j derived, rights-aware, and contact/raw-payload free by default', () => {
    expect(neo4jSource).toContain("sourceOfTruth: 'supabase'")
    expect(neo4jSource).toContain("projectionRole: 'derived_search_graph'")
    expect(neo4jSource).toContain('if (source.searchAllowed === false) return false')
    expect(neo4jSource).toContain('retentionUntil')
    expect(neo4jSource).toContain('contactValuesProjected: false')
    expect(neo4jSource).toContain('rawProviderPayloadProjected: false')
    expect(neo4jSource).toContain('identityMergePerformed: false')
  })

  it('fuses lexical, structured, graph, and vector retrieval without merging identities or creating qualification scores', () => {
    const fused = fuseRetrievalLanesV39_1([
      { lane: 'lexical', hits: [{ candidateId: 'a' }, { candidateId: 'b' }] },
      { lane: 'structured', hits: [{ candidateId: 'b' }, { candidateId: 'a' }] },
      { lane: 'graph', hits: [{ candidateId: 'a' }] },
      { lane: 'vector', hits: [{ candidateId: 'b' }, { candidateId: 'b' }] },
    ])
    expect(fused).toHaveLength(2)
    expect(fused.every(item => item.identityMergePerformed === false)).toBe(true)
    expect(fused.every(item => item.qualificationScore === false)).toBe(true)
    expect(fused[0]?.candidateId).toBe('a')
  })

  it('detects Vercel Gateway auth modes without ever exposing credential material', () => {
    expect(gatewaySource).toContain('AI_GATEWAY_API_KEY')
    expect(gatewaySource).toContain('VERCEL_OIDC_TOKEN')
    expect(gatewaySource).toContain('secretMaterialExposed: false')
    expect(gatewaySource).toContain('aiSdkRuntimeIntegrated: false')
    expect(gatewaySource).not.toContain('apiKey: process.env.AI_GATEWAY_API_KEY')
  })

  it('keeps provider expansion conservative when plan terms are not audited', () => {
    expect(capabilitySource).toContain("contactout: ['people_count']")
    expect(capabilitySource).toContain("serper: ['research_search', 'patent_search']")
    expect(capabilitySource).toContain("coresignal: ['subscription_refresh']")
    expect(capabilitySource).toContain("status: 'provider_terms_require_audit'")
    expect(capabilitySource).toContain("rawPayloadStorage: 'disabled_by_default'")
  })
})
