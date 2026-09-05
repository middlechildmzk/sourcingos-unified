import 'server-only'

import type { Neo4jProjectionBatchV39_1, Neo4jProjectionNodeV39_1 } from './neo4j-projection-v39-1'
import { neo4jProjectionStatusV39_1 } from './neo4j-projection-v39-1'

export type Neo4jQueryRecordV39_1B = Record<string, unknown>

export type Neo4jQueryResponseV39_1B = {
  ok: boolean
  status: number
  records: Neo4jQueryRecordV39_1B[]
  errorCode?: 'not_configured' | 'invalid_endpoint' | 'timeout' | 'network_error' | 'query_rejected' | 'invalid_response'
}

export type Neo4jLiveStatusV39_1B = {
  configured: boolean
  connected: boolean
  database: string
  queryApi: 'neo4j-query-api-v2'
  sourceOfTruth: 'supabase'
  projectionRole: 'derived_search_graph'
  networkWritesEnabled: boolean
  candidateCount: number | null
  nodeCount: number | null
  relationshipCount: number | null
  lastSuccessfulProjection: string | null
  lastErrorCode: Neo4jQueryResponseV39_1B['errorCode'] | null
  trust: {
    tenantScopedGraphKeys: true
    contactValuesProjected: false
    rawProviderPayloadProjected: false
    identityMergePerformed: false
  }
}

type QueryInput = {
  statement: string
  parameters?: Record<string, unknown>
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 8_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 30_000

function clampTimeout(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, Math.round(value as number)))
}

/**
 * Accept either an Aura hostname / HTTPS base URL or the complete Query API v2
 * endpoint. neo4j+s:// connection URIs are normalized to HTTPS because this
 * module deliberately uses Aura's HTTP Query API rather than the Bolt driver.
 */
export function resolveNeo4jQueryEndpointV39_1B(raw: string, database = 'neo4j'): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (candidate.startsWith('neo4j+s://')) candidate = `https://${candidate.slice('neo4j+s://'.length)}`
  else if (candidate.startsWith('neo4j://')) candidate = `https://${candidate.slice('neo4j://'.length)}`
  else if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''

    const cleanPath = url.pathname.replace(/\/+$/, '')
    if (/\/db\/[^/]+\/query\/v2$/i.test(cleanPath)) {
      url.pathname = cleanPath
      return url.toString()
    }

    if (/\/db\/[^/]+$/i.test(cleanPath)) {
      url.pathname = `${cleanPath}/query/v2`
      return url.toString()
    }

    const base = cleanPath === '/' ? '' : cleanPath
    url.pathname = `${base}/db/${encodeURIComponent(database || 'neo4j')}/query/v2`
    return url.toString()
  } catch {
    return null
  }
}

function queryConfig() {
  const status = neo4jProjectionStatusV39_1()
  if (!status.configured) return { ok: false as const, status }
  const endpoint = resolveNeo4jQueryEndpointV39_1B(process.env.NEO4J_QUERY_API_URL || '', status.database)
  if (!endpoint) return { ok: false as const, status, invalidEndpoint: true as const }
  return {
    ok: true as const,
    status,
    endpoint,
    username: process.env.NEO4J_USERNAME || '',
    password: process.env.NEO4J_PASSWORD || '',
  }
}

function recordsFromBody(body: unknown): Neo4jQueryRecordV39_1B[] | null {
  if (!body || typeof body !== 'object') return null
  const data = (body as any).data
  const fields = Array.isArray(data?.fields) ? data.fields.map((value: unknown) => String(value)) : null
  const values = Array.isArray(data?.values) ? data.values : null
  if (!fields || !values) return []
  return values.filter(Array.isArray).map((row: unknown[]) => Object.fromEntries(fields.map((field: string, index: number) => [field, row[index]])))
}

/** Server-only, sanitized Query API wrapper. It never returns credentials or raw remote error bodies. */
export async function queryNeo4jV39_1B(input: QueryInput): Promise<Neo4jQueryResponseV39_1B> {
  const config = queryConfig()
  if (!config.ok) {
    return {
      ok: false,
      status: 503,
      records: [],
      errorCode: config.invalidEndpoint ? 'invalid_endpoint' : 'not_configured',
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), clampTimeout(input.timeoutMs))

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`, 'utf8').toString('base64')}`,
      },
      body: JSON.stringify({ statement: input.statement, parameters: input.parameters || {} }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const body = await response.json().catch(() => null)
    if (!response.ok) {
      return { ok: false, status: response.status, records: [], errorCode: 'query_rejected' }
    }

    const records = recordsFromBody(body)
    if (records === null) {
      return { ok: false, status: response.status, records: [], errorCode: 'invalid_response' }
    }
    return { ok: true, status: response.status, records }
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'AbortError'
    return { ok: false, status: 503, records: [], errorCode: timeout ? 'timeout' : 'network_error' }
  } finally {
    clearTimeout(timer)
  }
}

const SCHEMA_STATEMENTS = [
  'CREATE CONSTRAINT sourcingos_candidate_key_v39_1b IF NOT EXISTS FOR (n:Candidate) REQUIRE n.key IS UNIQUE',
  'CREATE CONSTRAINT sourcingos_company_key_v39_1b IF NOT EXISTS FOR (n:Company) REQUIRE n.key IS UNIQUE',
  'CREATE CONSTRAINT sourcingos_skill_key_v39_1b IF NOT EXISTS FOR (n:Skill) REQUIRE n.key IS UNIQUE',
  'CREATE CONSTRAINT sourcingos_credential_key_v39_1b IF NOT EXISTS FOR (n:Credential) REQUIRE n.key IS UNIQUE',
  'CREATE CONSTRAINT sourcingos_evidence_key_v39_1b IF NOT EXISTS FOR (n:Evidence) REQUIRE n.key IS UNIQUE',
] as const

export async function ensureNeo4jProjectionSchemaV39_1B(): Promise<Neo4jQueryResponseV39_1B> {
  for (const statement of SCHEMA_STATEMENTS) {
    const result = await queryNeo4jV39_1B({ statement, timeoutMs: 15_000 })
    if (!result.ok) return result
  }
  return { ok: true, status: 200, records: [] }
}

function scopedKey(ownerId: string, node: Neo4jProjectionNodeV39_1): string {
  return `${ownerId}:${node.key}`
}

function relationRows(batch: Neo4jProjectionBatchV39_1, ownerId: string, label: Neo4jProjectionNodeV39_1['label'], edgeType: string) {
  const nodeByKey = new Map(batch.nodes.filter(node => node.label === label).map(node => [node.key, node]))
  return batch.edges
    .filter(edge => edge.type === edgeType)
    .map(edge => {
      const node = nodeByKey.get(edge.to)
      if (!node) return null
      return {
        key: scopedKey(ownerId, node),
        properties: node.properties,
        edgeProperties: edge.properties || {},
      }
    })
    .filter(Boolean)
}

const PROJECT_CANDIDATE_STATEMENT = `
MERGE (candidate:Candidate {key: $candidateKey})
SET candidate += $candidateProperties,
    candidate.ownerId = $ownerId,
    candidate.candidateId = $candidateId,
    candidate.sourcingOsManaged = true,
    candidate.projectedAt = $projectedAt
WITH candidate
CALL {
  WITH candidate
  OPTIONAL MATCH (candidate)-[old:CURRENTLY_AT|HAS_SKILL|HAS_CREDENTIAL|SUPPORTED_BY]->()
  WHERE old.sourcingOsManaged = true AND old.ownerId = $ownerId
  DELETE old
  RETURN count(old) AS removedRelationships
}
CALL {
  WITH candidate
  MATCH (oldEvidence:Evidence {ownerId: $ownerId, ownerCandidateId: $candidateId, sourcingOsManaged: true})
  DETACH DELETE oldEvidence
  RETURN count(oldEvidence) AS removedEvidence
}
CALL {
  WITH candidate
  UNWIND $companies AS row
  MERGE (node:Company {key: row.key})
  SET node += row.properties, node.ownerId = $ownerId, node.sourcingOsManaged = true
  MERGE (candidate)-[rel:CURRENTLY_AT]->(node)
  SET rel += row.edgeProperties, rel.ownerId = $ownerId, rel.sourcingOsManaged = true, rel.projectedAt = $projectedAt
  RETURN count(*) AS companyEdges
}
CALL {
  WITH candidate
  UNWIND $skills AS row
  MERGE (node:Skill {key: row.key})
  SET node += row.properties, node.ownerId = $ownerId, node.sourcingOsManaged = true
  MERGE (candidate)-[rel:HAS_SKILL]->(node)
  SET rel += row.edgeProperties, rel.ownerId = $ownerId, rel.sourcingOsManaged = true, rel.projectedAt = $projectedAt
  RETURN count(*) AS skillEdges
}
CALL {
  WITH candidate
  UNWIND $credentials AS row
  MERGE (node:Credential {key: row.key})
  SET node += row.properties, node.ownerId = $ownerId, node.sourcingOsManaged = true
  MERGE (candidate)-[rel:HAS_CREDENTIAL]->(node)
  SET rel += row.edgeProperties, rel.ownerId = $ownerId, rel.sourcingOsManaged = true, rel.projectedAt = $projectedAt
  RETURN count(*) AS credentialEdges
}
CALL {
  WITH candidate
  UNWIND $evidence AS row
  MERGE (node:Evidence {key: row.key})
  SET node += row.properties,
      node.ownerId = $ownerId,
      node.ownerCandidateId = $candidateId,
      node.sourcingOsManaged = true
  MERGE (candidate)-[rel:SUPPORTED_BY]->(node)
  SET rel += row.edgeProperties, rel.ownerId = $ownerId, rel.sourcingOsManaged = true, rel.projectedAt = $projectedAt
  RETURN count(*) AS evidenceEdges
}
RETURN candidate.candidateId AS candidateId,
       removedRelationships,
       removedEvidence,
       companyEdges,
       skillEdges,
       credentialEdges,
       evidenceEdges
`.trim()

/**
 * Writes one authoritative, tenant-scoped Candidate projection. The packet is
 * already rights-filtered by buildNeo4jProjectionBatchV39_1; this executor adds
 * owner-scoped graph keys and never accepts contacts or raw provider payloads.
 */
export async function projectNeo4jBatchV39_1B(ownerId: string, batch: Neo4jProjectionBatchV39_1): Promise<Neo4jQueryResponseV39_1B> {
  const owner = ownerId.trim()
  if (!owner) return { ok: false, status: 400, records: [], errorCode: 'query_rejected' }

  const candidate = batch.nodes.find(node => node.label === 'Candidate')
  if (!candidate) return { ok: false, status: 400, records: [], errorCode: 'query_rejected' }

  const projectedAt = new Date().toISOString()
  return queryNeo4jV39_1B({
    statement: PROJECT_CANDIDATE_STATEMENT,
    parameters: {
      ownerId: owner,
      candidateId: batch.candidateId,
      candidateKey: scopedKey(owner, candidate),
      candidateProperties: candidate.properties,
      projectedAt,
      companies: relationRows(batch, owner, 'Company', 'CURRENTLY_AT'),
      skills: relationRows(batch, owner, 'Skill', 'HAS_SKILL'),
      credentials: relationRows(batch, owner, 'Credential', 'HAS_CREDENTIAL'),
      evidence: relationRows(batch, owner, 'Evidence', 'SUPPORTED_BY'),
    },
    timeoutMs: 15_000,
  })
}

const STATUS_STATEMENT = `
CALL {
  MATCH (candidate:Candidate)
  WHERE candidate.sourcingOsManaged = true
  RETURN count(candidate) AS candidateCount, max(candidate.projectedAt) AS lastSuccessfulProjection
}
CALL {
  MATCH (node)
  WHERE node.sourcingOsManaged = true
  RETURN count(node) AS nodeCount
}
CALL {
  MATCH ()-[relationship]->()
  WHERE relationship.sourcingOsManaged = true
  RETURN count(relationship) AS relationshipCount
}
RETURN candidateCount, nodeCount, relationshipCount, lastSuccessfulProjection
`.trim()

function finiteCount(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function neo4jLiveStatusV39_1B(): Promise<Neo4jLiveStatusV39_1B> {
  const base = neo4jProjectionStatusV39_1()
  const disconnected: Neo4jLiveStatusV39_1B = {
    configured: base.configured,
    connected: false,
    database: base.database,
    queryApi: 'neo4j-query-api-v2',
    sourceOfTruth: 'supabase',
    projectionRole: 'derived_search_graph',
    networkWritesEnabled: false,
    candidateCount: null,
    nodeCount: null,
    relationshipCount: null,
    lastSuccessfulProjection: null,
    lastErrorCode: base.configured ? null : 'not_configured',
    trust: {
      tenantScopedGraphKeys: true,
      contactValuesProjected: false,
      rawProviderPayloadProjected: false,
      identityMergePerformed: false,
    },
  }
  if (!base.configured) return disconnected

  const health = await queryNeo4jV39_1B({ statement: 'RETURN 1 AS ok', timeoutMs: 5_000 })
  if (!health.ok) return { ...disconnected, lastErrorCode: health.errorCode || 'network_error' }

  const stats = await queryNeo4jV39_1B({ statement: STATUS_STATEMENT, timeoutMs: 8_000 })
  if (!stats.ok) {
    return { ...disconnected, connected: true, networkWritesEnabled: true, lastErrorCode: stats.errorCode || 'query_rejected' }
  }
  const row = stats.records[0] || {}
  return {
    ...disconnected,
    connected: true,
    networkWritesEnabled: true,
    candidateCount: finiteCount(row.candidateCount),
    nodeCount: finiteCount(row.nodeCount),
    relationshipCount: finiteCount(row.relationshipCount),
    lastSuccessfulProjection: typeof row.lastSuccessfulProjection === 'string' ? row.lastSuccessfulProjection : null,
    lastErrorCode: null,
  }
}
