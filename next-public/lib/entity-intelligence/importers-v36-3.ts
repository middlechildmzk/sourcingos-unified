import type { EntityKind, EntityRelationshipType } from './types-v35'

export type RecruitingKnowledgeSourceV36_3 = 'onet' | 'esco' | 'naics' | 'geography'
export type AliasDispositionV36_3 = 'reviewed_equivalence' | 'search_variant' | 'quarantined'

export interface RecruitingKnowledgeRelationshipInputV36_3 {
  toExternalId: string
  type: EntityRelationshipType
  sourceRelation?: string
  note?: string
}

export interface RecruitingKnowledgeImportRecordV36_3 {
  externalId: string
  kind: EntityKind
  canonicalLabel: string
  aliases?: string[]
  aliasPolicy?: Exclude<AliasDispositionV36_3, 'quarantined'>
  relationships?: RecruitingKnowledgeRelationshipInputV36_3[]
  /** Source-native fields are preserved rather than reinterpreted as candidate facts. */
  metadata?: Record<string, unknown>
}

export interface RecruitingKnowledgeImportBatchV36_3 {
  source: RecruitingKnowledgeSourceV36_3
  sourceVersion: string
  sourceRef: string
  records: RecruitingKnowledgeImportRecordV36_3[]
}

export interface NormalizedKnowledgeAliasV36_3 {
  value: string
  disposition: AliasDispositionV36_3
  reason?: string
}

export interface NormalizedKnowledgeRecordV36_3 {
  id: string
  source: RecruitingKnowledgeSourceV36_3
  sourceVersion: string
  sourceRef: string
  externalId: string
  kind: EntityKind
  canonicalLabel: string
  aliases: NormalizedKnowledgeAliasV36_3[]
  relationships: RecruitingKnowledgeRelationshipInputV36_3[]
  metadata: Record<string, unknown>
}

export interface KnowledgeImportDiagnosticV36_3 {
  code:
    | 'missing_source_version'
    | 'missing_source_ref'
    | 'missing_external_id'
    | 'missing_canonical_label'
    | 'onet_scale_id_required'
    | 'relationship_target_required'
  severity: 'error' | 'warning'
  externalId?: string
  message: string
}

export interface NormalizedKnowledgeBatchV36_3 {
  source: RecruitingKnowledgeSourceV36_3
  sourceVersion: string
  sourceRef: string
  records: NormalizedKnowledgeRecordV36_3[]
  diagnostics: KnowledgeImportDiagnosticV36_3[]
  valid: boolean
}

/**
 * Release baselines observed when V36.3 was authored. Importers accept explicit
 * versions so a future release does not silently reinterpret older records.
 */
export const AUTHORITATIVE_SOURCE_BASELINES_V36_3 = {
  onet: {
    observedCurrentVersion: '31.0',
    sourceRef: 'https://www.onetcenter.org/database.html',
    note: 'O*NET DB production release observed August 2026. Preserve Scale ID with scored data values.',
  },
  esco: {
    observedCurrentVersion: '1.2.1',
    sourceRef: 'https://esco.ec.europa.eu/en/use-esco/download',
    note: 'ESCO classification download observed as v1.2.1. Preserve occupation-skill relationships and source identifiers.',
  },
  naics: {
    observedCurrentVersion: '2022',
    sourceRef: 'https://www.census.gov/naics/',
    note: 'Use official Census NAICS structure; do not treat an industry code as candidate employment evidence.',
  },
  geography: {
    observedCurrentVersion: 'source-specific',
    sourceRef: 'source-specific authoritative geography dataset',
    note: 'Coordinates, postal areas, municipal boundaries, metros and regions require source provenance. Never infer candidate residence from a search anchor.',
  },
} as const

const AMBIGUOUS_SHORT_ALIASES = new Set([
  'ts', 'r', 'c', 'go', 'rn', 'pa', 'np', 'pm', 'sa', 'se', 'ml', 'ai', 'it', 'hr', 'dc', 'md', 'va',
])

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function slug(value: string): string {
  const out = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return out || 'unknown'
}

function stableRecordId(source: RecruitingKnowledgeSourceV36_3, externalId: string): string {
  return `external:${source}:${slug(externalId)}`
}

function aliasDisposition(
  alias: string,
  canonicalLabel: string,
  requested: RecruitingKnowledgeImportRecordV36_3['aliasPolicy'],
): NormalizedKnowledgeAliasV36_3 {
  const value = normalizedText(alias).toLowerCase()
  const canonical = canonicalLabel.toLowerCase()
  if (value === canonical) return { value, disposition: 'reviewed_equivalence' }
  if (value.length <= 1 || AMBIGUOUS_SHORT_ALIASES.has(value)) {
    return {
      value,
      disposition: 'quarantined',
      reason: 'Ambiguous short token requires domain/context review before activation.',
    }
  }
  return {
    value,
    disposition: requested || 'search_variant',
    ...(requested === 'reviewed_equivalence' ? {} : { reason: 'Preserved as search/discovery vocabulary rather than silent normalization.' }),
  }
}

function validateRecord(
  batch: RecruitingKnowledgeImportBatchV36_3,
  record: RecruitingKnowledgeImportRecordV36_3,
): KnowledgeImportDiagnosticV36_3[] {
  const out: KnowledgeImportDiagnosticV36_3[] = []
  if (!normalizedText(record.externalId || '')) {
    out.push({ code: 'missing_external_id', severity: 'error', message: 'Every imported record requires a stable source externalId.' })
  }
  if (!normalizedText(record.canonicalLabel || '')) {
    out.push({ code: 'missing_canonical_label', severity: 'error', externalId: record.externalId, message: 'Every imported record requires a canonical label.' })
  }
  for (const rel of record.relationships || []) {
    if (!normalizedText(rel.toExternalId || '')) {
      out.push({ code: 'relationship_target_required', severity: 'error', externalId: record.externalId, message: 'Imported relationships require a source target id.' })
    }
  }

  // O*NET scored observations are meaningless without the source Scale ID.
  // We preserve both rather than applying a made-up universal threshold.
  if (batch.source === 'onet') {
    const metadata = record.metadata || {}
    const hasDataValue = metadata.dataValue !== undefined || metadata.data_value !== undefined || metadata.value !== undefined
    const hasScaleId = Boolean(metadata.scaleId || metadata.scale_id)
    if (hasDataValue && !hasScaleId) {
      out.push({
        code: 'onet_scale_id_required',
        severity: 'error',
        externalId: record.externalId,
        message: 'O*NET scored values require Scale ID; do not compare or threshold a bare Data Value.',
      })
    }
  }
  return out
}

export function normalizeKnowledgeImportV36_3(batch: RecruitingKnowledgeImportBatchV36_3): NormalizedKnowledgeBatchV36_3 {
  const sourceVersion = normalizedText(batch.sourceVersion || '')
  const sourceRef = normalizedText(batch.sourceRef || '')
  const diagnostics: KnowledgeImportDiagnosticV36_3[] = []
  if (!sourceVersion) diagnostics.push({ code: 'missing_source_version', severity: 'error', message: 'Importer batches require an explicit source version.' })
  if (!sourceRef) diagnostics.push({ code: 'missing_source_ref', severity: 'error', message: 'Importer batches require an explicit source reference.' })

  const records: NormalizedKnowledgeRecordV36_3[] = []
  const ordered = [...batch.records].sort((a, b) =>
    normalizedText(a.externalId || '').localeCompare(normalizedText(b.externalId || '')) ||
    normalizedText(a.canonicalLabel || '').localeCompare(normalizedText(b.canonicalLabel || ''))
  )

  for (const record of ordered) {
    const recordDiagnostics = validateRecord(batch, record)
    diagnostics.push(...recordDiagnostics)
    if (recordDiagnostics.some(item => item.severity === 'error')) continue

    const canonicalLabel = normalizedText(record.canonicalLabel)
    const aliasValues = Array.from(new Set([
      canonicalLabel,
      ...(record.aliases || []).map(normalizedText).filter(Boolean),
    ].map(value => value.toLowerCase()))).sort((a, b) => a.localeCompare(b))

    const relationships = [...(record.relationships || [])]
      .map(rel => ({ ...rel, toExternalId: normalizedText(rel.toExternalId) }))
      .sort((a, b) => a.toExternalId.localeCompare(b.toExternalId) || a.type.localeCompare(b.type))

    const metadata = Object.fromEntries(
      Object.entries(record.metadata || {}).sort(([a], [b]) => a.localeCompare(b))
    )

    records.push({
      id: stableRecordId(batch.source, record.externalId),
      source: batch.source,
      sourceVersion,
      sourceRef,
      externalId: normalizedText(record.externalId),
      kind: record.kind,
      canonicalLabel,
      aliases: aliasValues.map(alias => aliasDisposition(alias, canonicalLabel, record.aliasPolicy)),
      relationships,
      metadata,
    })
  }

  diagnostics.sort((a, b) => (a.externalId || '').localeCompare(b.externalId || '') || a.code.localeCompare(b.code))
  return {
    source: batch.source,
    sourceVersion,
    sourceRef,
    records,
    diagnostics,
    valid: !diagnostics.some(item => item.severity === 'error'),
  }
}

/** Stable replay key for an authoritative source record. */
export function knowledgeImportReplayKeyV36_3(record: NormalizedKnowledgeRecordV36_3): string {
  return [record.source, record.sourceVersion, record.externalId].join(':')
}

/**
 * O*NET adapter contract. Callers must provide the actual source id/title and,
 * for scored observations, both Data Value and Scale ID.
 */
export function onetRecordV36_3(input: {
  onetSocCode: string
  title: string
  kind?: EntityKind
  aliases?: string[]
  dataValue?: number
  scaleId?: string
}): RecruitingKnowledgeImportRecordV36_3 {
  return {
    externalId: input.onetSocCode,
    kind: input.kind || 'occupation',
    canonicalLabel: input.title,
    aliases: input.aliases,
    aliasPolicy: 'search_variant',
    metadata: {
      ...(input.dataValue === undefined ? {} : { dataValue: input.dataValue }),
      ...(input.scaleId ? { scaleId: input.scaleId } : {}),
      onetSocCode: input.onetSocCode,
    },
  }
}

/** ESCO relationships stay explicit; an occupation label never absorbs its skills as aliases. */
export function escoRecordV36_3(input: {
  uri: string
  preferredLabel: string
  kind: EntityKind
  alternativeLabels?: string[]
  relationships?: RecruitingKnowledgeRelationshipInputV36_3[]
}): RecruitingKnowledgeImportRecordV36_3 {
  return {
    externalId: input.uri,
    kind: input.kind,
    canonicalLabel: input.preferredLabel,
    aliases: input.alternativeLabels,
    aliasPolicy: 'search_variant',
    relationships: input.relationships,
    metadata: { escoUri: input.uri },
  }
}

/** NAICS is company/industry context only. It must never become candidate employment evidence. */
export function naicsIndustryRecordV36_3(input: {
  code: string
  title: string
  aliases?: string[]
}): RecruitingKnowledgeImportRecordV36_3 {
  return {
    externalId: input.code,
    kind: 'industry',
    canonicalLabel: input.title,
    aliases: input.aliases,
    aliasPolicy: 'search_variant',
    metadata: { naicsCode: input.code, candidateEmploymentEvidence: false },
  }
}
