import type {
  ClassifiedSourceResult,
  ContactSignal,
  EntityKind,
  IdentitySignal,
  SourceName,
  SourceResult,
} from './source-types'

const PERSON_SOURCES = new Set<SourceName>([
  'stackoverflow',
  'openalex',
  'semantic_scholar',
])

const PUBLICATION_SOURCES = new Set<SourceName>([
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
const ACTIONABLE_CONTACT_TYPES = new Set<ContactSignal['type']>(['public_email', 'website'])
const ORCID_ID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  const item = record(value)
  return typeof item.value === 'string' ? item.value.trim() : ''
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;|]+/)
      .map(item => item.trim())
      .filter(Boolean)
  }
  return []
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function resolvedOrcidName(raw: unknown): string {
  const root = record(raw)
  const person = record(root.person)
  const name = record(person.name ?? root.name)

  const given = text(
    root['given-names']
    ?? root.givenNames
    ?? root.given_names
    ?? name['given-names']
    ?? name.givenNames,
  )
  const family = text(
    root['family-names']
    ?? root['family-name']
    ?? root.familyName
    ?? root.family_names
    ?? name['family-name']
    ?? name.familyName,
  )
  const credit = text(
    root['credit-name']
    ?? root.creditName
    ?? name['credit-name']
    ?? name.creditName,
  )

  return credit || [given, family].filter(Boolean).join(' ').trim()
}

function isIdentifierOnlyOrcidResult(result: SourceResult): boolean {
  if (result.source !== 'orcid') return false
  if (resolvedOrcidName(result.raw)) return false

  const displayName = result.displayName.trim()
  const sourceId = result.sourceProfileId.trim()
  return !displayName
    || displayName === sourceId
    || ORCID_ID_PATTERN.test(displayName)
    || displayName.toLowerCase() === 'orcid researcher'
}

function observedSkills(result: SourceResult): string[] {
  const root = record(result.raw)

  if (result.source === 'github') {
    // The GitHub API boundary has a dedicated truth guard that derives skills
    // only from observed repository languages and topics.
    return unique(result.skills)
  }

  if (result.source === 'stackoverflow') {
    // V33.2's technical-talent connector writes a tag only after the official
    // Stack Exchange top-answerer endpoint returns this person for that tag.
    // Legacy user-search payloads have no observedTags and therefore still
    // yield no candidate skills.
    return unique(stringList(root.observedTags))
  }

  if (result.source === 'openalex') {
    const concepts = Array.isArray(root.x_concepts) ? root.x_concepts : []
    return unique(concepts.map(item => text(record(item).display_name)).filter(Boolean))
  }

  if (result.source === 'npi') {
    const taxonomies = Array.isArray(root.taxonomies) ? root.taxonomies : []
    return unique(taxonomies.map(item => {
      const taxonomy = record(item)
      return text(taxonomy.desc) || text(taxonomy.code)
    }).filter(Boolean))
  }

  if (result.source === 'devto') {
    // V33.6 writes only tags observed on articles authored by this public DEV
    // user. Retrieval terms are intentionally absent from observedTags.
    return unique(stringList(root.observedTags))
  }

  if (result.source === 'huggingface') {
    return unique(stringList(root.tags))
  }

  if (result.source === 'npm') {
    return unique(stringList(record(root.package).keywords))
  }

  if (result.source === 'pypi') {
    return unique(stringList(root.keywords))
  }

  // ORCID search, Semantic Scholar author search, publications, package search,
  // and discovery lanes do not return verified person-skill claims in their
  // current connector payloads. Search terms may explain discovery, but they
  // must not become candidate skills.
  return []
}

function actionableContacts(contacts: ContactSignal[]): ContactSignal[] {
  return contacts.filter(contact => ACTIONABLE_CONTACT_TYPES.has(contact.type))
}

function observedIdentitySignals(signals: IdentitySignal[], skills: string[]): IdentitySignal[] {
  const observed = new Set(skills.map(skill => skill.toLowerCase()))
  return signals.filter(signal => signal.type !== 'skill' || observed.has(signal.value.toLowerCase()))
}

function publicationPresentation(result: SourceResult): Pick<SourceResult, 'displayName' | 'headline'> {
  const root = record(result.raw)
  const title = text(root.title)
  const author = result.displayName.trim()
  const sourceLabel = result.source === 'arxiv' ? 'arXiv' : 'PubMed'

  if (!title) {
    return {
      displayName: `${sourceLabel} publication`,
      headline: author ? `Publication evidence associated with ${author}.` : 'Publication evidence.',
    }
  }

  return {
    displayName: title,
    headline: author
      ? `${sourceLabel} publication · First listed author: ${author}`
      : `${sourceLabel} publication evidence`,
  }
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
  if (PUBLICATION_SOURCES.has(source)) return 'publication'
  if (ARTIFACT_SOURCES.has(source)) return 'artifact'
  if (PERSON_SOURCES.has(source)) return 'person'

  if (source === 'orcid') {
    return resolvedOrcidName(input.raw) ? 'person' : 'unknown'
  }

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

  if (source === 'devto') {
    const root = record(input.raw)
    const profile = record(root.profile)
    const profileType = String(profile.type_of ?? '').toLowerCase()
    const username = text(profile.username)
    // DEV can represent users and organizations. Only a resolved public user
    // payload from the V33.6 connector is candidate-eligible.
    return profileType === 'user' && Boolean(username) ? 'person' : 'unknown'
  }

  return 'unknown'
}

export function isGeneratedDemoResult(result: SourceResult): boolean {
  if (result.sourceProfileId.startsWith('demo-')) return true
  if (result.id.includes(':demo-')) return true
  if (result.headline?.startsWith('Demo ')) return true
  return result.evidence.some(item => item.label === 'Demo fallback result')
}

export function classifySourceResult(result: SourceResult): ClassifiedSourceResult {
  const entityKind = resolveStoredEntityKind({
    source: result.source,
    raw: result.raw,
    entityKind: result.entityKind,
  })
  const skills = observedSkills(result)
  const contactSignals = actionableContacts(result.contactSignals)
  const identitySignals = observedIdentitySignals(result.identitySignals, skills)

  if (entityKind === 'unknown' && isIdentifierOnlyOrcidResult(result)) {
    return {
      ...result,
      entityKind,
      displayName: 'Unresolved ORCID identity',
      headline: 'ORCID identifier found, but no public person name was resolved.',
      skills: [],
      contactSignals: [],
      identitySignals: identitySignals.filter(signal => signal.type === 'source_url'),
    }
  }

  if (entityKind === 'publication') {
    return {
      ...result,
      ...publicationPresentation(result),
      entityKind,
      skills: [],
      contactSignals: [],
      identitySignals: identitySignals.filter(signal => signal.type !== 'skill'),
    }
  }

  return {
    ...result,
    entityKind,
    skills,
    contactSignals,
    identitySignals,
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
