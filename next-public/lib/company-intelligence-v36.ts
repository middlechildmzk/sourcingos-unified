import type {
  EntityProvenance,
  EntityRelationship,
  EntityReviewState,
  IntelligenceEntity,
} from '@/lib/entity-intelligence/types-v35'
import type { EmploymentObservationV36 } from '@/lib/candidate-universe-v36'

export type CompanyIdentifierKindV36 = 'uei' | 'cage' | 'lei' | 'cik' | 'npi2' | 'domain'

export type CompanyIdentifierV36 = {
  kind: CompanyIdentifierKindV36
  value: string
  source: EntityProvenance['source']
  sourceRef?: string
  reviewState: EntityReviewState
}

export type CompanyParentUnknownReasonV36 =
  | 'not_reported'
  | 'reporting_exception'
  | 'binding_legal_constraint'
  | 'legal_obstacles'
  | 'disclosure_detrimental'
  | 'consent_not_obtained'
  | 'unknown'

export type CompanyTechnologyEvidenceClassV36 =
  | 'company_published_artifact'
  | 'company_job_posting'
  | 'company_technical_writing'
  | 'vendor_case_study'

export type CompanyTechnologyObservationV36 = {
  companyEntityId: string
  technologyEntityId: string
  technologyLabel: string
  evidenceClass: CompanyTechnologyEvidenceClassV36
  source: string
  sourceUrl?: string
  observedAt?: string
  retrievedAt?: string
  reviewState: EntityReviewState
  explanation: string
}

export type CompanyAwardObservationV36 = {
  companyEntityId: string
  awardingAgency?: string
  naics?: string
  psc?: string
  placeOfPerformance?: string
  amount?: number
  source: 'usaspending' | 'sam_gov' | 'other'
  sourceRef?: string
  observedAt?: string
  explanation: string
}

export type CompanyIdentityResolutionV36 =
  | {
      disposition: 'deterministic_match'
      anchors: CompanyIdentifierV36[]
      explanation: string
    }
  | {
      disposition: 'identifier_conflict'
      conflicts: Array<{ kind: CompanyIdentifierKindV36; left: string; right: string }>
      explanation: string
    }
  | {
      disposition: 'proposal_only'
      nameSimilarityAllowedForRanking: true
      explanation: string
    }

export type CompanyShadowProjectionV36 = {
  entity: IntelligenceEntity
  identifiers: CompanyIdentifierV36[]
  relationships: EntityRelationship[]
  parentUnknownReason?: CompanyParentUnknownReasonV36
  observedTitles: Array<{ title: string; knownCandidateCount: number }>
  technologyObservations: CompanyTechnologyObservationV36[]
  awardObservations: CompanyAwardObservationV36[]
  knownCandidateCount: number
  knownCandidateCountLabel: string
  employmentObservationCount: number
  trustBoundaries: string[]
  version: 'v36.1-shadow'
}

type UsaspendingRecipientLike = Record<string, unknown>

export type NormalizedUsaspendingRecipientV36 = {
  entity: IntelligenceEntity
  identifiers: CompanyIdentifierV36[]
  parent?: {
    entity: IntelligenceEntity
    identifiers: CompanyIdentifierV36[]
    relationship: EntityRelationship
  }
  recipientLevel?: 'parent' | 'child' | 'neither'
  parentUnknownReason?: CompanyParentUnknownReasonV36
  adapterNote: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value)
    if (normalized) return normalized
  }
  return ''
}

function normalizeIdentifierValue(kind: CompanyIdentifierKindV36, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (kind === 'domain') {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .replace(/\.$/, '')
  }
  return trimmed.toUpperCase().replace(/\s+/g, '')
}

function stableIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'unknown'
}

function provenance(source: EntityProvenance['source'], sourceRef: string | undefined, note: string): EntityProvenance[] {
  return [{
    source,
    sourceRef,
    version: 'v36.1-shadow',
    reviewState: 'reviewed',
    note,
  }]
}

export function companyIdentifierV36(
  kind: CompanyIdentifierKindV36,
  value: string,
  source: EntityProvenance['source'],
  sourceRef?: string,
  reviewState: EntityReviewState = 'reviewed',
): CompanyIdentifierV36 | null {
  const normalized = normalizeIdentifierValue(kind, value)
  if (!normalized) return null
  return { kind, value: normalized, source, sourceRef, reviewState }
}

function companyEntityFromIdentity(input: {
  canonicalLabel: string
  identifiers: CompanyIdentifierV36[]
  source: EntityProvenance['source']
  sourceRef?: string
  note: string
}): IntelligenceEntity {
  const preferred = input.identifiers.find(identifier => ['uei', 'lei', 'cik', 'npi2', 'cage'].includes(identifier.kind))
  const identityPart = preferred ? `${preferred.kind}-${stableIdPart(preferred.value)}` : stableIdPart(input.canonicalLabel)
  return {
    id: `company:${identityPart}`,
    kind: 'company',
    canonicalLabel: input.canonicalLabel,
    aliases: [],
    provenance: provenance(input.source, input.sourceRef, input.note),
    metadata: {
      identifiers: input.identifiers.map(identifier => ({ kind: identifier.kind, value: identifier.value })),
      resolutionPolicy: 'identifier_anchored_proposal_only',
    },
  }
}

function recipientLevel(recipientId: string): 'parent' | 'child' | 'neither' | undefined {
  const normalized = recipientId.trim().toUpperCase()
  if (normalized.endsWith('-P')) return 'parent'
  if (normalized.endsWith('-C')) return 'child'
  if (normalized.endsWith('-R')) return 'neither'
  return undefined
}

function collectRecipientIdentifiers(
  raw: Record<string, unknown>,
  sourceRef?: string,
): CompanyIdentifierV36[] {
  const identifiers = [
    companyIdentifierV36('uei', firstText(raw.recipient_uei, raw.uei, raw.unique_entity_id), 'usaspending', sourceRef),
    companyIdentifierV36('cage', firstText(raw.cage, raw.cage_code), 'usaspending', sourceRef),
  ].filter((item): item is CompanyIdentifierV36 => Boolean(item))
  return Array.from(new Map(identifiers.map(identifier => [`${identifier.kind}:${identifier.value}`, identifier])).values())
}

/**
 * Normalize a USAspending recipient-style record without making a live API claim.
 *
 * This adapter intentionally accepts a loose record shape because the exact live
 * endpoint/schema remains on the external-verification queue. The fields used here
 * are the researched recipient contract. Any production fetcher must pin a schema
 * version and primary-source fixture before wiring network I/O.
 */
export function normalizeUsaspendingRecipientV36(input: UsaspendingRecipientLike): NormalizedUsaspendingRecipientV36 {
  const raw = record(input) || {}
  const recipientId = firstText(raw.recipient_id, raw.id)
  const sourceRef = recipientId ? `usaspending:recipient:${recipientId}` : 'usaspending:recipient:unversioned-fixture'
  const canonicalLabel = firstText(raw.recipient_name, raw.name, raw.legal_business_name) || 'Unresolved recipient'
  const identifiers = collectRecipientIdentifiers(raw, sourceRef)
  const entity = companyEntityFromIdentity({
    canonicalLabel,
    identifiers,
    source: 'usaspending',
    sourceRef,
    note: 'USAspending-compatible recipient observation. Network endpoint/schema must be primary-source verified before production fetching.',
  })

  const parentName = firstText(raw.parent_name, raw.parent_recipient_name)
  const parentUei = firstText(raw.parent_uei, raw.parent_uei_number)
  const parentId = firstText(raw.parent_id, raw.parent_recipient_id)
  const parentSourceRef = parentId ? `usaspending:recipient:${parentId}` : sourceRef

  let parent: NormalizedUsaspendingRecipientV36['parent']
  if (parentName || parentUei) {
    const parentIdentifiers = [
      companyIdentifierV36('uei', parentUei, 'usaspending', parentSourceRef),
    ].filter((item): item is CompanyIdentifierV36 => Boolean(item))
    const parentEntity = companyEntityFromIdentity({
      canonicalLabel: parentName || 'Parent recipient',
      identifiers: parentIdentifiers,
      source: 'usaspending',
      sourceRef: parentSourceRef,
      note: 'Parent recipient observation from USAspending-compatible hierarchy fields.',
    })
    parent = {
      entity: parentEntity,
      identifiers: parentIdentifiers,
      relationship: {
        id: `company-rel:${stableIdPart(parentEntity.id)}:${stableIdPart(entity.id)}:subsidiary`,
        fromEntityId: entity.id,
        toEntityId: parentEntity.id,
        type: 'SUBSIDIARY_OF',
        direction: 'directed',
        confidence: parentUei ? 'deterministic' : 'moderate',
        provenance: provenance('usaspending', sourceRef, parentUei
          ? 'Recipient hierarchy carries a parent UEI anchor.'
          : 'Parent name is present without a deterministic parent identifier; treat as reviewable hierarchy.'),
      },
    }
  }

  return {
    entity,
    identifiers,
    parent,
    recipientLevel: recipientLevel(recipientId),
    parentUnknownReason: parent ? undefined : 'not_reported',
    adapterNote: 'Shadow normalization only. Absence of a reported parent is unknown, never evidence that the company is independent.',
  }
}

export function resolveCompanyIdentityV36(
  left: { canonicalLabel: string; identifiers: CompanyIdentifierV36[] },
  right: { canonicalLabel: string; identifiers: CompanyIdentifierV36[] },
): CompanyIdentityResolutionV36 {
  const leftByKind = new Map(left.identifiers.map(identifier => [identifier.kind, identifier.value]))
  const rightByKind = new Map(right.identifiers.map(identifier => [identifier.kind, identifier.value]))
  const shared: CompanyIdentifierV36[] = []
  const conflicts: Array<{ kind: CompanyIdentifierKindV36; left: string; right: string }> = []

  for (const [kind, leftValue] of leftByKind.entries()) {
    const rightValue = rightByKind.get(kind)
    if (!rightValue) continue
    if (leftValue === rightValue) {
      const anchor = left.identifiers.find(identifier => identifier.kind === kind && identifier.value === leftValue)
      if (anchor) shared.push(anchor)
    } else {
      conflicts.push({ kind, left: leftValue, right: rightValue })
    }
  }

  if (conflicts.length) {
    return {
      disposition: 'identifier_conflict',
      conflicts,
      explanation: 'A deterministic company identifier conflicts. Name similarity cannot override the conflict.',
    }
  }
  if (shared.length) {
    return {
      disposition: 'deterministic_match',
      anchors: shared,
      explanation: 'At least one reviewed deterministic company identifier matches exactly.',
    }
  }
  return {
    disposition: 'proposal_only',
    nameSimilarityAllowedForRanking: true,
    explanation: 'No deterministic identifier match exists. Company-name similarity may rank a proposal but cannot merge entities.',
  }
}

export function companyTechnologyObservationV36(input: {
  companyEntityId: string
  technologyEntityId: string
  technologyLabel: string
  evidenceClass: CompanyTechnologyEvidenceClassV36
  source: string
  sourceUrl?: string
  observedAt?: string
  retrievedAt?: string
  reviewState?: EntityReviewState
}): CompanyTechnologyObservationV36 {
  return {
    ...input,
    reviewState: input.reviewState || 'needs_review',
    explanation: 'Company-level technology observation is discovery context only. It never creates a candidate skill or qualification claim.',
  }
}

function employmentCountsForCompany(
  companyLabel: string,
  employmentObservations: EmploymentObservationV36[],
): { knownCandidateCount: number; employmentObservationCount: number; observedTitles: Array<{ title: string; knownCandidateCount: number }> } {
  const normalizedCompany = companyLabel.trim().toLowerCase()
  const eligible = employmentObservations.filter(observation =>
    observation.companyName.trim().toLowerCase() === normalizedCompany
    && (observation.evidenceClass === 'profile_statement' || observation.evidenceClass === 'provider_assertion'))

  const candidateIds = new Set(eligible.map(observation => observation.candidateId))
  const titleCandidates = new Map<string, Set<string>>()
  for (const observation of eligible) {
    if (!observation.title) continue
    const set = titleCandidates.get(observation.title) || new Set<string>()
    set.add(observation.candidateId)
    titleCandidates.set(observation.title, set)
  }

  return {
    knownCandidateCount: candidateIds.size,
    employmentObservationCount: eligible.length,
    observedTitles: Array.from(titleCandidates.entries())
      .map(([title, ids]) => ({ title, knownCandidateCount: ids.size }))
      .sort((a, b) => b.knownCandidateCount - a.knownCandidateCount || a.title.localeCompare(b.title)),
  }
}

export function buildCompanyShadowProjectionV36(input: {
  entity: IntelligenceEntity
  identifiers?: CompanyIdentifierV36[]
  relationships?: EntityRelationship[]
  parentUnknownReason?: CompanyParentUnknownReasonV36
  employmentObservations?: EmploymentObservationV36[]
  technologyObservations?: CompanyTechnologyObservationV36[]
  awardObservations?: CompanyAwardObservationV36[]
}): CompanyShadowProjectionV36 {
  const employment = employmentCountsForCompany(input.entity.canonicalLabel, input.employmentObservations || [])
  const technologyObservations = (input.technologyObservations || []).filter(observation => observation.companyEntityId === input.entity.id)
  const awardObservations = (input.awardObservations || []).filter(observation => observation.companyEntityId === input.entity.id)

  return {
    entity: input.entity,
    identifiers: input.identifiers || [],
    relationships: input.relationships || [],
    parentUnknownReason: input.parentUnknownReason,
    observedTitles: employment.observedTitles,
    technologyObservations,
    awardObservations,
    knownCandidateCount: employment.knownCandidateCount,
    knownCandidateCountLabel: `${employment.knownCandidateCount} ${employment.knownCandidateCount === 1 ? 'person' : 'people'} known to SourcingOS`,
    employmentObservationCount: employment.employmentObservationCount,
    trustBoundaries: [
      'Company technology is discovery context and never candidate skill evidence.',
      'Federal or defense company context never establishes a candidate clearance.',
      'Company location never establishes candidate residence.',
      'Target-company membership can explain discovery but never satisfies a candidate requirement.',
      'Company prestige, size, funding, customers, or brand never affect candidate ranking.',
      'Known-talent counts describe SourcingOS observations only; they are not labor-market estimates.',
    ],
    version: 'v36.1-shadow',
  }
}
