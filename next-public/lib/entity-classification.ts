import type {
  ClassifiedSourceResult,
  EntityKind,
  SourceName,
  SourceResult,
} from './source-types'

const PERSON_SOURCES = new Set<SourceName>([
  'stackoverflow',
  'openalex',
  'orcid',
  'semantic_scholar',
  'arxiv',
  'pubmed',
])

const ARTIFACT_SOURCES = new Set<SourceName>([
  'npm',
  'pypi',
  'huggingface',
  'dockerhub',
  'crates',
  'rubygems',
])

const SEARCH_LANE_SOURCES = new Set<SourceName>(['kaggle', 'resume_xray'])

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

/**
 * Authorized LinkedIn connection imports were historically stored with the
 * connector source `resume_xray`. Treat those records as people at read time
 * without rewriting production data. The actual Resume X-Ray discovery record
 * remains a search lane.
 */
export function isLegacyLinkedInConnectionImport(raw: unknown): boolean {
  const root = record(raw)
  const nested = record(root.raw)
  const candidates = [root, nested]

  return candidates.some(candidate =>
    candidate.importType === 'linkedin_connections'
    && candidate.importSource === 'linkedin_export'
  )
}

/**
 * Derive subject kind from source and source evidence. The optional entityKind
 * field is intentionally not trusted because public request bodies can be
 * modified by clients.
 */
export function resolveStoredEntityKind(input: {
  source?: string | null
  raw?: unknown
  entityKind?: EntityKind | null
}): EntityKind {
  if (isLegacyLinkedInConnectionImport(input.raw)) return 'person'

  const source = input.source as SourceName | undefined
  if (!source) return 'unknown'
  if (SEARCH_LANE_SOURCES.has(source)) return 'search_lane'
  if (ARTIFACT_SOURCES.has(source)) return 'artifact'
  if (PERSON_SOURCES.has(source)) return 'person'

  if (source === 'github') {
    const root = record(input.raw)
    const nested = record(root.raw)
    const apiType = String(nested.type ?? root.type ?? '').toLowerCase()
    if (apiType === 'organization') return 'organization'
    if (apiType === 'user') return 'person'
    return 'unknown'
  }

  if (source === 'npi') {
    const root = record(input.raw)
    const nested = record(root.raw)
    const payload = Object.keys(nested).length ? nested : root
    const basic = record(payload.basic)
    const enumerationType = String(
      payload.enumeration_type ?? basic.enumeration_type ?? '',
    ).toUpperCase()
    if (enumerationType === 'NPI-2' || basic.organization_name) return 'organization'
    if (enumerationType === 'NPI-1' || basic.first_name || basic.last_name) return 'person'
    return 'unknown'
  }

  // DEV accounts can represent individuals or organizations. Do not infer
  // personhood from display-name shape alone.
  if (source === 'devto') return 'unknown'

  return 'unknown'
}

export function isGeneratedDemoResult(result: SourceResult): boolean {
  if (result.sourceProfileId.startsWith('demo-')) return true
  if (result.id.includes(':demo-')) return true
  if (result.headline?.startsWith('Demo ')) return true
  return result.evidence.some(item => item.label === 'Demo fallback result')
}

export function classifySourceResult(result: SourceResult): ClassifiedSourceResult {
  return {
    ...result,
    entityKind: resolveStoredEntityKind({
      source: result.source,
      raw: result.raw,
      entityKind: result.entityKind,
    }),
  }
}

export function classifyRealSourceResults(results: SourceResult[]): ClassifiedSourceResult[] {
  return results
    .filter(result => !isGeneratedDemoResult(result))
    .map(classifySourceResult)
}

export function canPromoteToCandidate(entityKind: EntityKind): boolean {
  return entityKind === 'person'
}

export const entityKindLabels: Record<EntityKind, string> = {
  person: 'Person',
  organization: 'Organization',
  artifact: 'Artifact',
  publication: 'Publication',
  search_lane: 'Discovery lane',
  unknown: 'Needs classification',
}
