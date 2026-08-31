/**
 * SourcingOS Technical Talent Graph — Connector V2 contract (V33.3A).
 *
 * Every technical source connector (GitHub, Stack Overflow, GitLab, Hugging
 * Face, Kaggle, npm, PyPI, DEV, Docker Hub, research sources) speaks this
 * contract so that no connector invents its own candidate shape.
 *
 * The central rule this file encodes in the type system:
 *
 *   Search criteria are retrieval instructions, never candidate evidence.
 *
 * Retrieval terms are a branded string type. Observed technologies require an
 * `ObservationProvenance` record naming the source field the value was read
 * from. There is deliberately no function anywhere in this module that turns a
 * `RetrievalTerm` into an `ObservedTechnology`, so the contamination that V22
 * shipped cannot be reintroduced without deleting a type.
 */

import type { SourceName } from '../source-types'

/* ------------------------------------------------------------------ *
 * Retrieval boundary
 * ------------------------------------------------------------------ */

declare const retrievalOnly: unique symbol

/**
 * A term the recruiter or Search Brain supplied in order to *find* people.
 * Branded so it can never be assigned into an observed-evidence field.
 */
export type RetrievalTerm = string & { readonly [retrievalOnly]: 'retrieval-only' }

export function retrievalTerm(value: string): RetrievalTerm {
  return String(value || '').trim() as RetrievalTerm
}

export function retrievalTerms(values: readonly string[]): RetrievalTerm[] {
  const seen = new Set<string>()
  const out: RetrievalTerm[] = []
  for (const value of values) {
    const cleaned = String(value || '').trim()
    const key = cleaned.toLowerCase()
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    out.push(cleaned as RetrievalTerm)
  }
  return out
}

/** Read a retrieval term back as a plain string. Use only for building URLs. */
export function retrievalTermText(term: RetrievalTerm): string {
  return term as string
}

/**
 * What the connector was asked to look for. Everything here is retrieval-only.
 * Nothing on this object may be copied onto a person.
 */
export type DiscoveryIntent = {
  /** Free-text hypothesis from the Search Brain. */
  readonly hypothesis: RetrievalTerm
  /** Capability terms used to select tags, repositories, or search qualifiers. */
  readonly capabilityTerms: readonly RetrievalTerm[]
  /** Location filter, retrieval-only. Never becomes a candidate location. */
  readonly location?: RetrievalTerm
  readonly limit: number
  /** Opaque role/run identifiers used for telemetry only. */
  readonly runId?: string
}

export function discoveryIntent(input: {
  hypothesis: string
  capabilityTerms?: readonly string[]
  location?: string
  limit?: number
  runId?: string
}): DiscoveryIntent {
  return {
    hypothesis: retrievalTerm(input.hypothesis),
    capabilityTerms: retrievalTerms(input.capabilityTerms || []),
    location: input.location ? retrievalTerm(input.location) : undefined,
    limit: Math.max(1, Math.min(Math.trunc(input.limit ?? 12), 50)),
    runId: input.runId,
  }
}

/* ------------------------------------------------------------------ *
 * Observation provenance
 * ------------------------------------------------------------------ */

/**
 * How a piece of information came to exist in SourcingOS.
 *
 * `observed_artifact` is the strongest: the value was read off a concrete
 * public artifact belonging to the person. `source_stated` is a claim the
 * person made about themselves on the source. `derived_from_source` is a
 * computation over source data (counts, recency). `model_inference` exists so
 * that inference can be represented honestly; it must never be rendered as a
 * source fact.
 */
export type EvidenceBasis =
  | 'observed_artifact'
  | 'source_stated'
  | 'derived_from_source'
  | 'model_inference'

export type ObservationProvenance = {
  readonly source: SourceName
  /** The API field the value was literally read from, e.g. `repository.language`. */
  readonly sourceField: string
  /** Stable identifier of the artifact or record the value came from. */
  readonly sourceRecordId: string
  readonly basis: EvidenceBasis
  readonly url?: string
  readonly observedAt: string
}

/**
 * A technology attributed to a person because it was seen on their work.
 * Construction requires provenance. There is no string-only constructor.
 */
export type ObservedTechnology = {
  readonly value: string
  readonly provenance: ObservationProvenance
}

export function observedTechnology(
  value: string,
  provenance: ObservationProvenance,
): ObservedTechnology | null {
  const cleaned = String(value || '').trim()
  if (!cleaned) return null
  if (!provenance.sourceField || !provenance.sourceRecordId) return null
  if (provenance.basis === 'model_inference') return null
  return { value: cleaned, provenance }
}

/** Collapse observed technologies to display strings, preserving first-seen order. */
export function observedTechnologyValues(items: readonly ObservedTechnology[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const key = item.value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item.value)
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Technical artifacts
 * ------------------------------------------------------------------ */

export type TechnicalArtifactType =
  | 'repository'
  | 'repository_contribution'
  | 'pull_request_activity'
  | 'code_review_activity'
  | 'qa_answer'
  | 'package'
  | 'ml_model'
  | 'ml_dataset'
  | 'publication'

/**
 * How the person relates to the artifact. These are deliberately distinct.
 * "Appears in activity history" is not "maintains".
 */
export type ArtifactRelationship =
  | 'owner_maintainer'
  | 'substantial_contributor'
  | 'activity_participant'
  | 'author'
  | 'unknown'

/**
 * Source-native metrics. Intentionally *not* normalized into a universal
 * score: GitHub stars and Stack Overflow answer score are different concepts
 * and averaging them would manufacture a metric neither source published.
 */
export type SourceMetric = {
  readonly key: string
  readonly label: string
  readonly value: number
  readonly source: SourceName
}

export type TechnicalArtifact = {
  readonly artifactId: string
  readonly source: SourceName
  readonly type: TechnicalArtifactType
  readonly name: string
  readonly url?: string
  readonly description?: string
  /**
   * The precise sentence describing what the source returned, when the
   * connector can state it better than a generic relationship sentence.
   * Stack Exchange's top-answerer route is the motivating case: "returned as a
   * top answerer for [kubernetes]" is exact, whereas "authored Top answerer
   * for [kubernetes]" is not something the API ever said.
   */
  readonly statement?: string
  readonly relationship: ArtifactRelationship
  readonly technologies: readonly ObservedTechnology[]
  readonly metrics: readonly SourceMetric[]
  readonly createdAt?: string
  readonly updatedAt?: string
  readonly observedAt: string
  /** True when the artifact is a fork/copy rather than original authorship. */
  readonly derivative?: boolean
  readonly archived?: boolean
}

/* ------------------------------------------------------------------ *
 * Identity anchors
 * ------------------------------------------------------------------ */

export type IdentityAnchorKind =
  | 'personal_domain'
  | 'public_email'
  | 'github_login'
  | 'stackexchange_user_id'
  | 'orcid'
  | 'explicit_profile_link'
  | 'source_profile_url'

/**
 * `deterministic` anchors may create a recruiter identity-review proposal.
 * `supporting` anchors may only rank an existing proposal. Neither authorizes
 * an automatic cross-source merge. That decision stays with the Identity Brain
 * and, ultimately, with the recruiter.
 */
export type IdentityAnchorStrength = 'deterministic' | 'supporting'

export type IdentityAnchor = {
  readonly kind: IdentityAnchorKind
  readonly value: string
  readonly normalized: string
  readonly strength: IdentityAnchorStrength
  readonly provenance: ObservationProvenance
}

/* ------------------------------------------------------------------ *
 * Person + dossier
 * ------------------------------------------------------------------ */

export type SourcePerson = {
  readonly source: SourceName
  readonly sourceProfileId: string
  readonly profileUrl: string
  readonly displayName: string
  readonly headline?: string
  /** Employer as *stated by the person on the source*. Never verified. */
  readonly statedOrganization?: string
  /** Location as *stated by the person on the source*. Never verified. */
  readonly statedLocation?: string
  readonly websites: readonly string[]
  readonly publicEmail?: string
  readonly avatarUrl?: string
  readonly accountCreatedAt?: string
}

export type ActivityWindow = {
  readonly firstObservedAt?: string
  readonly lastObservedAt?: string
  /** Distinct calendar years in which activity was observed. */
  readonly activeYears: readonly number[]
}

/**
 * Statements about what this source could not establish. Recorded explicitly
 * so downstream requirement assessment resolves to `unknown` rather than
 * treating silence as a negative.
 */
export type DossierLimit = {
  readonly topic: string
  readonly explanation: string
}

export type TechnicalDossier = {
  readonly source: SourceName
  readonly person: SourcePerson
  readonly artifacts: readonly TechnicalArtifact[]
  readonly technologies: readonly ObservedTechnology[]
  readonly anchors: readonly IdentityAnchor[]
  readonly activity: ActivityWindow
  readonly limits: readonly DossierLimit[]
  readonly observedAt: string
  /** Raw payload references retained for provenance replay. */
  readonly raw: Record<string, unknown>
}

/* ------------------------------------------------------------------ *
 * Connector metadata + telemetry
 * ------------------------------------------------------------------ */

export type ConnectorCapability = 'discovery' | 'enrichment' | 'evidence' | 'identity'

export type ConnectorApiStatus =
  | 'official_public_api'
  | 'official_authenticated_api'
  | 'manual_safe_lane'

export type ConnectorMetadata = {
  readonly sourceKey: SourceName
  readonly label: string
  readonly apiStatus: ConnectorApiStatus
  readonly capabilities: readonly ConnectorCapability[]
  /** Human-readable summary of the published quota, for operator display. */
  readonly rateLimitNote: string
  /** Whether an API credential is required for the connector to run at all. */
  readonly requiresCredential: boolean
  /** Documented terms-of-service constraints an operator must respect. */
  readonly termsNote: string
}

export type ConnectorRunReport = {
  readonly sourceKey: SourceName
  requestsAttempted: number
  requestsServedFromCache: number
  requestsDeduplicated: number
  apiErrors: number
  backoffSeconds: number
  quotaRemaining: number | null
  peopleDiscovered: number
  peopleEnriched: number
  artifactsObserved: number
  evidenceItemsProduced: number
  identityAnchorsProduced: number
  deterministicAnchorsProduced: number
  partial: boolean
  durationMs: number
  warnings: string[]
}

export function newRunReport(sourceKey: SourceName): ConnectorRunReport {
  return {
    sourceKey,
    requestsAttempted: 0,
    requestsServedFromCache: 0,
    requestsDeduplicated: 0,
    apiErrors: 0,
    backoffSeconds: 0,
    quotaRemaining: null,
    peopleDiscovered: 0,
    peopleEnriched: 0,
    artifactsObserved: 0,
    evidenceItemsProduced: 0,
    identityAnchorsProduced: 0,
    deterministicAnchorsProduced: 0,
    partial: false,
    durationMs: 0,
    warnings: [],
  }
}

export type ConnectorDiscoveryResult = {
  readonly dossiers: readonly TechnicalDossier[]
  readonly report: ConnectorRunReport
}

/** The interface every V33.3 technical connector implements. */
export type TechnicalConnector = {
  readonly metadata: ConnectorMetadata
  /** Find candidate source profiles matching a retrieval intent. */
  discover(intent: DiscoveryIntent): Promise<ConnectorDiscoveryResult>
  /** Deepen a single already-identified source profile. */
  enrich?(sourceProfileId: string): Promise<ConnectorDiscoveryResult>
}
