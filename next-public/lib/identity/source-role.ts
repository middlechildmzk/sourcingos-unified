import type { EntityKind, SourceName } from '../source-types'
import type { SourceRole } from './resolver-types'

const PERSON_ANCHOR_SOURCES = new Set<SourceName>([
  'github', 'stackoverflow', 'openalex', 'npi', 'orcid', 'semantic_scholar',
])

const DISCOVERY_SOURCES = new Set<SourceName>(['resume_xray', 'kaggle'])

export function sourceRoleFor(input: {
  source: SourceName
  entityKind: EntityKind
  authorizedPersonImport?: boolean
}): SourceRole {
  if (input.authorizedPersonImport && input.entityKind === 'person') return 'person_anchor'
  if (input.entityKind === 'organization') return 'organization'
  if (input.entityKind === 'artifact' || input.entityKind === 'publication') return 'evidence_artifact'
  if (input.entityKind === 'search_lane' || DISCOVERY_SOURCES.has(input.source)) return 'discovery_lane'
  if (input.entityKind === 'person' && PERSON_ANCHOR_SOURCES.has(input.source)) return 'person_anchor'
  return 'unresolved_identity'
}

export function canEnterIdentityResolution(role: SourceRole): boolean {
  return role === 'person_anchor'
}
