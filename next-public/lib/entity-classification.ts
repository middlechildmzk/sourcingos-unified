import type { EntityKind, SourceName, SourceResult } from './source-types'

type StoredEntityRecord = {
  source?: string | null
  display_name?: string | null
  headline?: string | null
  raw?: unknown
}

type SourceEntityInput = Pick<SourceResult, 'source' | 'displayName' | 'headline' | 'raw'>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function unwrapRaw(value: unknown): Record<string, unknown> {
  const top = asRecord(value)
  const nested = asRecord(top.raw)
  return Object.keys(nested).length > 0 ? nested : top
}

export function classifySourceEntity(input: SourceEntityInput): EntityKind {
  const raw = unwrapRaw(input.raw)

  switch (input.source) {
    case 'github': {
      const accountType = String(raw.type || '').toLowerCase()
      if (accountType === 'organization') return 'organization'
      if (accountType === 'user') return 'person'
      return 'unknown'
    }
    case 'stackoverflow':
    case 'openalex':
    case 'orcid':
    case 'semantic_scholar':
    case 'arxiv':
    case 'pubmed':
      return 'person'
    case 'npi': {
      const basic = asRecord(raw.basic)
      const hasPersonName = Boolean(basic.first_name || basic.last_name)
      const hasOrganizationName = Boolean(basic.organization_name)
      if (hasPersonName) return 'person'
      if (hasOrganizationName) return 'organization'
      return 'unknown'
    }
    case 'npm':
    case 'pypi':
    case 'huggingface':
    case 'dockerhub':
    case 'crates':
    case 'rubygems':
      return 'artifact'
    case 'kaggle':
    case 'resume_xray':
      return 'search_lane'
    case 'devto':
      // DEV supports both personal and organizational accounts. Do not infer
      // personhood from display-name shape alone.
      return 'unknown'
    default:
      return 'unknown'
  }
}

export function resolveStoredEntityKind(record: StoredEntityRecord): EntityKind {
  const raw = unwrapRaw(record.raw)
  const importType = String(raw.importType || '')
  const importSource = String(raw.importSource || '')

  // 27,294 authorized LinkedIn connection imports were historically stored
  // under source='resume_xray'. Preserve them as people at read time while a
  // separate, rehearsed provenance reconciliation is prepared.
  if (importType === 'linkedin_connections' && importSource === 'linkedin_export') {
    return 'person'
  }

  const source = String(record.source || '') as SourceName
  return classifySourceEntity({
    source,
    displayName: String(record.display_name || ''),
    headline: String(record.headline || ''),
    raw: record.raw,
  })
}

export function isPersonEntity(kind: EntityKind): kind is 'person' {
  return kind === 'person'
}
