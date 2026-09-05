import 'server-only'

export type Neo4jProjectionStatusV39_1 = {
  configured: boolean
  database: string
  missingEnvironmentKeys: string[]
  sourceOfTruth: 'supabase'
  projectionRole: 'derived_search_graph'
  contactValuesProjected: false
  rawProviderPayloadProjected: false
}

export type ProjectionSourceProfileV39_1 = {
  id: string
  source: string
  status?: string | null
  searchAllowed?: boolean
  retentionUntil?: string | null
  usageScope?: string[]
}

export type ProjectionEvidenceV39_1 = {
  id: string
  source: string
  label: string
  detail?: string | null
  sourceProfileId?: string | null
  /** Production stores legacy confidence as text; normalize only at this boundary. */
  confidence?: number | string | null
  url?: string | null
}

export type ProjectionCandidateV39_1 = {
  id: string
  canonicalName: string
  headline?: string | null
  currentTitle?: string | null
  currentCompany?: string | null
  location?: string | null
  skills?: string[]
  sourceProfiles?: ProjectionSourceProfileV39_1[]
  evidence?: ProjectionEvidenceV39_1[]
  /** Accepted for caller compatibility but deliberately ignored by projection. */
  contacts?: unknown[]
}

export type Neo4jProjectionNodeV39_1 = {
  key: string
  label: 'Candidate' | 'Company' | 'Skill' | 'Credential' | 'Evidence'
  properties: Record<string, string | number | boolean | null>
}

export type Neo4jProjectionEdgeV39_1 = {
  from: string
  to: string
  type: 'CURRENTLY_AT' | 'HAS_SKILL' | 'HAS_CREDENTIAL' | 'SUPPORTED_BY'
  properties?: Record<string, string | number | boolean | null>
}

export type Neo4jProjectionBatchV39_1 = {
  candidateId: string
  nodes: Neo4jProjectionNodeV39_1[]
  edges: Neo4jProjectionEdgeV39_1[]
  excludedSourceProfileIds: string[]
  trust: {
    supabaseIsCanonical: true
    neo4jIsDerived: true
    contactValuesProjected: false
    rawProviderPayloadProjected: false
    identityMergePerformed: false
  }
}

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

export function neo4jProjectionStatusV39_1(): Neo4jProjectionStatusV39_1 {
  const required = {
    NEO4J_QUERY_API_URL: process.env.NEO4J_QUERY_API_URL,
    NEO4J_USERNAME: process.env.NEO4J_USERNAME,
    NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
  }
  const missingEnvironmentKeys = Object.entries(required).filter(([, value]) => !present(value)).map(([key]) => key)
  return {
    configured: missingEnvironmentKeys.length === 0,
    database: process.env.NEO4J_DATABASE?.trim() || 'neo4j',
    missingEnvironmentKeys,
    sourceOfTruth: 'supabase',
    projectionRole: 'derived_search_graph',
    contactValuesProjected: false,
    rawProviderPayloadProjected: false,
  }
}

function activeForProjection(source: ProjectionSourceProfileV39_1, nowMs: number): boolean {
  if (source.status?.toLowerCase() === 'rejected') return false
  if (source.searchAllowed === false) return false
  if (source.retentionUntil) {
    const expiry = Date.parse(source.retentionUntil)
    if (Number.isFinite(expiry) && expiry <= nowMs) return false
  }
  const scopes = source.usageScope || ['recruiting_search']
  return scopes.includes('recruiting_search') || scopes.includes('talent_graph_projection')
}

function slug(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9+#.]+/g, '-').replace(/^-|-$/g, '').slice(0, 180)
}

function credentialEvidence(evidence: ProjectionEvidenceV39_1): boolean {
  return /certif|credential|license/i.test(evidence.label)
}

function normalizedConfidence(value: ProjectionEvidenceV39_1['confidence']): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Builds a rights-aware graph projection packet only. Network writes belong to
 * the durable projection worker in V39.1B. Supabase remains canonical.
 */
export function buildNeo4jProjectionBatchV39_1(
  candidate: ProjectionCandidateV39_1,
  now = new Date(),
): Neo4jProjectionBatchV39_1 {
  const profiles = candidate.sourceProfiles || []
  const permitted = new Set(profiles.filter(item => activeForProjection(item, now.getTime())).map(item => item.id))
  const excludedSourceProfileIds = profiles.filter(item => !permitted.has(item.id)).map(item => item.id)
  const evidence = (candidate.evidence || []).filter(item => !item.sourceProfileId || permitted.has(item.sourceProfileId))
  const candidateKey = `candidate:${candidate.id}`
  const nodes = new Map<string, Neo4jProjectionNodeV39_1>()
  const edges: Neo4jProjectionEdgeV39_1[] = []

  nodes.set(candidateKey, {
    key: candidateKey,
    label: 'Candidate',
    properties: {
      candidateId: candidate.id,
      canonicalName: candidate.canonicalName,
      headline: candidate.headline || null,
      currentTitle: candidate.currentTitle || null,
      location: candidate.location || null,
    },
  })

  const company = String(candidate.currentCompany || '').trim()
  if (company) {
    const companyKey = `company:${slug(company)}`
    nodes.set(companyKey, { key: companyKey, label: 'Company', properties: { name: company } })
    edges.push({ from: candidateKey, to: companyKey, type: 'CURRENTLY_AT' })
  }

  const seenSkills = new Set<string>()
  for (const raw of candidate.skills || []) {
    const skill = String(raw || '').trim()
    if (!skill) continue
    const normalized = skill.toLowerCase()
    if (seenSkills.has(normalized)) continue
    seenSkills.add(normalized)
    const skillKey = `skill:${slug(skill)}`
    nodes.set(skillKey, { key: skillKey, label: 'Skill', properties: { name: skill } })
    edges.push({ from: candidateKey, to: skillKey, type: 'HAS_SKILL' })
  }

  for (const item of evidence) {
    const evidenceKey = `evidence:${item.id}`
    nodes.set(evidenceKey, {
      key: evidenceKey,
      label: 'Evidence',
      properties: {
        evidenceId: item.id,
        source: item.source,
        label: item.label,
        detail: item.detail || null,
        confidence: normalizedConfidence(item.confidence),
        url: item.url || null,
      },
    })
    edges.push({ from: candidateKey, to: evidenceKey, type: 'SUPPORTED_BY' })

    if (credentialEvidence(item) && item.detail?.trim()) {
      const credentialKey = `credential:${slug(item.detail)}`
      nodes.set(credentialKey, { key: credentialKey, label: 'Credential', properties: { name: item.detail.trim() } })
      edges.push({ from: candidateKey, to: credentialKey, type: 'HAS_CREDENTIAL', properties: { evidenceId: item.id } })
    }
  }

  return {
    candidateId: candidate.id,
    nodes: Array.from(nodes.values()),
    edges,
    excludedSourceProfileIds,
    trust: {
      supabaseIsCanonical: true,
      neo4jIsDerived: true,
      contactValuesProjected: false,
      rawProviderPayloadProjected: false,
      identityMergePerformed: false,
    },
  }
}
