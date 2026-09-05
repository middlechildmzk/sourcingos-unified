import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildNeo4jProjectionBatchV39_1 } from '@/lib/intelligence-fabric/neo4j-projection-v39-1'
import {
  projectNeo4jBatchV39_1B,
  queryNeo4jV39_1B,
  resolveNeo4jQueryEndpointV39_1B,
} from '@/lib/intelligence-fabric/neo4j-query-v39-1b'

function configureNeo4j() {
  vi.stubEnv('NEO4J_QUERY_API_URL', 'https://example.databases.neo4j.io')
  vi.stubEnv('NEO4J_USERNAME', 'neo4j')
  vi.stubEnv('NEO4J_PASSWORD', 'super-secret-password')
  vi.stubEnv('NEO4J_DATABASE', 'neo4j')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('V39.1B Neo4j Query API runtime', () => {
  it('normalizes Aura connection/base URLs to Query API v2 without embedding credentials', () => {
    expect(resolveNeo4jQueryEndpointV39_1B('neo4j+s://abc.databases.neo4j.io', 'neo4j'))
      .toBe('https://abc.databases.neo4j.io/db/neo4j/query/v2')

    const credentialUrl = new URL('https://abc.databases.neo4j.io/db/neo4j/query/v2')
    credentialUrl.username = 'user'
    credentialUrl.password = 'pass'
    expect(resolveNeo4jQueryEndpointV39_1B(credentialUrl.toString(), 'neo4j'))
      .toBe('https://abc.databases.neo4j.io/db/neo4j/query/v2')
  })

  it('uses Basic auth server-side but never returns a rejected Query API error body', async () => {
    configureNeo4j()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ errors: [{ message: 'super-secret-password should never escape' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await queryNeo4jV39_1B({ statement: 'RETURN 1 AS ok' })
    expect(result).toEqual({ ok: false, status: 401, records: [], errorCode: 'query_rejected' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.databases.neo4j.io/db/neo4j/query/v2')
    expect(init.headers.authorization).toMatch(/^Basic /)
    expect(JSON.stringify(result)).not.toContain('super-secret-password')
  })

  it('filters rejected/expired observations and normalizes legacy text confidence before graph writes', () => {
    const batch = buildNeo4jProjectionBatchV39_1({
      id: 'candidate-1',
      canonicalName: 'Example Candidate',
      currentCompany: 'Example Co',
      skills: ['RHEL', 'RHEL'],
      contacts: [{ value: 'do-not-project@example.com' }],
      sourceProfiles: [
        { id: 'allowed', source: 'public_web', status: 'accepted', searchAllowed: true, usageScope: ['recruiting_search'] },
        { id: 'rejected', source: 'provider', status: 'rejected', searchAllowed: true, usageScope: ['recruiting_search'] },
        { id: 'expired', source: 'provider', status: 'accepted', searchAllowed: true, retentionUntil: '2025-01-01T00:00:00.000Z', usageScope: ['recruiting_search'] },
      ],
      evidence: [
        { id: 'e-allowed', source: 'public_web', label: 'Certification', detail: 'RHCSA', sourceProfileId: 'allowed', confidence: '0.92' },
        { id: 'e-rejected', source: 'provider', label: 'Skill', detail: 'secret rejected evidence', sourceProfileId: 'rejected', confidence: 'high' },
        { id: 'e-expired', source: 'provider', label: 'Skill', detail: 'secret expired evidence', sourceProfileId: 'expired', confidence: '0.9' },
      ],
    }, new Date('2026-09-04T00:00:00.000Z'))

    expect(batch.excludedSourceProfileIds.sort()).toEqual(['expired', 'rejected'])
    expect(batch.nodes.filter(node => node.label === 'Skill')).toHaveLength(1)
    expect(JSON.stringify(batch)).not.toContain('do-not-project@example.com')
    expect(JSON.stringify(batch)).not.toContain('secret rejected evidence')
    expect(JSON.stringify(batch)).not.toContain('secret expired evidence')
    const evidence = batch.nodes.find(node => node.key === 'evidence:e-allowed')
    expect(evidence?.properties.confidence).toBe(0.92)
  })

  it('adds tenant-scoped graph keys at the network-write boundary', async () => {
    configureNeo4j()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ data: { fields: ['candidateId'], values: [['candidate-1']] } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const batch = buildNeo4jProjectionBatchV39_1({
      id: 'candidate-1',
      canonicalName: 'Example Candidate',
      currentCompany: 'Example Co',
      skills: ['RHEL'],
      contacts: [{ value: '+1-555-sensitive' }],
    })
    const result = await projectNeo4jBatchV39_1B('owner-123', batch)
    expect(result.ok).toBe(true)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.parameters.ownerId).toBe('owner-123')
    expect(body.parameters.candidateKey).toBe('owner-123:candidate:candidate-1')
    expect(body.statement).toContain('rel.sourcingOsManaged = true')
    expect(JSON.stringify(body)).not.toContain('+1-555-sensitive')
  })

  it('keeps the admin projection route bounded and explicit about missing durable queue fan-out', () => {
    const root = process.cwd()
    const route = fs.readFileSync(path.join(root, 'app/api/admin/intelligence-fabric/route.ts'), 'utf8')
    const worker = fs.readFileSync(path.join(root, 'lib/intelligence-fabric/neo4j-worker-v39-1b.ts'), 'utf8')
    const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260904145000_v39_1b_rights_filtered_diagnostic_fix.sql'), 'utf8')

    expect(route).toContain('requireAdmin()')
    expect(route).toContain('maxCandidatesPerRequest: 10')
    expect(route).toContain('durableQueueFanoutIntegrated: false')
    expect(worker).toContain(".from('candidate_search_documents_v39')")
    expect(worker).not.toContain('candidate_contacts')
    expect(migration).toContain("and sp.status <> 'rejected';")
    expect(migration).toContain('string_agg(')
    expect(migration).toContain(') filter (')
    expect(migration).toContain('rights_filtered_source_count = excluded.rights_filtered_source_count')
  })
})
