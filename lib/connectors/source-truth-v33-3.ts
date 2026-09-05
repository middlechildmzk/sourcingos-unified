/**
 * Runtime enforcement of the SourcingOS source-truth boundary, plus the bridge
 * from a Technical Dossier into the canonical `SourceResult` the Candidate
 * Graph and Identity Brain already consume.
 *
 * The type system in `contract-v33-3.ts` makes contamination hard to express.
 * This module makes it detectable at runtime, because connectors read from
 * untyped JSON and a careless `as string` can still smuggle a retrieval term
 * into an observed field.
 */

import type {
  ContactSignal,
  EvidenceItem,
  IdentitySignal,
  SourceResult,
} from '../source-types'
import {
  type DiscoveryIntent,
  type IdentityAnchor,
  type ObservedTechnology,
  type TechnicalArtifact,
  type TechnicalDossier,
  observedTechnologyValues,
  retrievalTermText,
} from './contract-v33-3'

export type RetrievalLeak = {
  readonly field: string
  readonly value: string
  readonly reason: string
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Detect observed technologies that cannot be justified by their own recorded
 * provenance, or that exactly reproduce a retrieval term without an artifact
 * behind them.
 *
 * A retrieval term *may* legitimately also be an observed technology. Searching
 * for Kubernetes and then finding a repository with the `kubernetes` topic is
 * the system working correctly. What is forbidden is a technology whose only
 * support is the search box. That is what the provenance check catches: a real
 * observation always names a source field and an artifact id.
 */
export function findRetrievalLeaks(
  dossier: TechnicalDossier,
  intent: DiscoveryIntent,
): RetrievalLeak[] {
  const leaks: RetrievalLeak[] = []
  const retrievalValues = new Set(
    [intent.hypothesis, ...intent.capabilityTerms].flatMap(term =>
      retrievalTermText(term)
        .toLowerCase()
        .split(/[^a-z0-9+#.-]+/)
        .filter(token => token.length > 1),
    ),
  )

  const artifactIds = new Set(dossier.artifacts.map(artifact => artifact.artifactId))

  const check = (technology: ObservedTechnology, field: string) => {
    const { provenance } = technology
    if (!provenance || !provenance.sourceField || !provenance.sourceRecordId) {
      leaks.push({
        field,
        value: technology.value,
        reason: 'Observed technology carries no provenance.',
      })
      return
    }
    if (provenance.basis === 'model_inference') {
      leaks.push({
        field,
        value: technology.value,
        reason: 'Model inference cannot be stored as observed technology.',
      })
      return
    }
    if (provenance.sourceField.startsWith('intent.')) {
      leaks.push({
        field,
        value: technology.value,
        reason: 'Provenance points at the retrieval intent rather than a source record.',
      })
      return
    }
    const isRetrievalToken = retrievalValues.has(normalize(technology.value))
    const hasArtifact =
      provenance.sourceRecordId === dossier.person.sourceProfileId ||
      artifactIds.has(provenance.sourceRecordId)
    if (isRetrievalToken && !hasArtifact) {
      leaks.push({
        field,
        value: technology.value,
        reason:
          'Value matches a retrieval term and its provenance record is not a known artifact or the person record.',
      })
    }
  }

  dossier.technologies.forEach((technology, index) => check(technology, `technologies[${index}]`))
  dossier.artifacts.forEach((artifact, artifactIndex) => {
    artifact.technologies.forEach((technology, index) =>
      check(technology, `artifacts[${artifactIndex}].technologies[${index}]`),
    )
  })

  return leaks
}

/** Drop anything `findRetrievalLeaks` flags. Used at the connector boundary. */
export function enforceRetrievalBoundary(
  dossier: TechnicalDossier,
  intent: DiscoveryIntent,
): { dossier: TechnicalDossier; removed: RetrievalLeak[] } {
  const removed = findRetrievalLeaks(dossier, intent)
  if (!removed.length) return { dossier, removed }

  const banned = new Set(removed.map(leak => normalize(leak.value)))
  const keep = (technology: ObservedTechnology) => !banned.has(normalize(technology.value))

  return {
    removed,
    dossier: {
      ...dossier,
      technologies: dossier.technologies.filter(keep),
      artifacts: dossier.artifacts.map(artifact => ({
        ...artifact,
        technologies: artifact.technologies.filter(keep),
      })),
    },
  }
}

/* ------------------------------------------------------------------ *
 * Dossier -> SourceResult bridge
 * ------------------------------------------------------------------ */

function artifactEvidence(artifact: TechnicalArtifact): EvidenceItem {
  const technologies = observedTechnologyValues(artifact.technologies)
  const metrics = artifact.metrics.map(metric => `${metric.label} ${metric.value}`).join(', ')
  const relationship: Record<TechnicalArtifact['relationship'], string> = {
    owner_maintainer: 'owns or maintains',
    substantial_contributor: 'contributed substantially to',
    activity_participant: 'appears in the public activity history of',
    author: 'authored',
    unknown: 'is publicly associated with',
  }

  // A connector-supplied statement is the most precise description of what the
  // source returned. Otherwise fall back to the relationship sentence and
  // append the source's own description of the artifact.
  const parts = [
    artifact.statement ||
      `${artifact.source} record shows this account ${relationship[artifact.relationship]} ${artifact.name}.`,
    !artifact.statement && artifact.description ? `Source description: ${artifact.description}` : '',
    artifact.derivative ? 'This record is a fork or derivative rather than original authorship.' : '',
    artifact.archived ? 'The record is archived.' : '',
    technologies.length ? `Observed technologies: ${technologies.join(', ')}.` : '',
    metrics ? `Source metrics: ${metrics}.` : '',
    artifact.updatedAt ? `Last updated ${artifact.updatedAt}.` : '',
  ].filter(Boolean)

  return {
    id: `${artifact.source}-${artifact.artifactId}`,
    label: `${artifact.type.replace(/_/g, ' ')} evidence`,
    detail: parts.join(' '),
    source: artifact.source,
    // Directly observed artifacts are the strongest thing a public source can
    // offer. They are still not verified employment history, which is why the
    // detail text describes the artifact rather than asserting a career fact.
    confidence: artifact.relationship === 'activity_participant' ? 'medium' : 'high',
    url: artifact.url,
    observedAt: artifact.observedAt,
  }
}

function anchorContactSignals(dossier: TechnicalDossier): ContactSignal[] {
  const signals: ContactSignal[] = [
    {
      type: 'profile_url',
      value: dossier.person.profileUrl,
      source: dossier.source,
      verified: false,
      note: `Public ${dossier.source} profile URL.`,
    },
  ]

  // The Identity Brain reads the *first* website contact signal, so personal
  // domains are emitted ahead of any other link.
  const personalDomains = dossier.anchors.filter(anchor => anchor.kind === 'personal_domain')
  for (const anchor of personalDomains) {
    signals.push({
      type: 'website',
      value: anchor.value,
      source: dossier.source,
      verified: false,
      note: `Personal website published on the ${dossier.source} profile.`,
    })
  }

  const email = dossier.anchors.find(anchor => anchor.kind === 'public_email')
  if (email) {
    signals.push({
      type: 'public_email',
      value: email.value,
      source: dossier.source,
      verified: false,
      note: 'Public email exposed by the source. Unverified; confirm accuracy and permission before use.',
    })
  }

  if (dossier.person.statedOrganization) {
    signals.push({
      type: 'organization',
      value: dossier.person.statedOrganization,
      source: dossier.source,
      verified: false,
      note: 'Employer as stated by the account holder on the source profile. Not verified.',
    })
  }

  if (dossier.person.statedLocation) {
    signals.push({
      type: 'location',
      value: dossier.person.statedLocation,
      source: dossier.source,
      verified: false,
      note: 'Location as stated by the account holder on the source profile. Not verified.',
    })
  }

  return signals
}

function anchorIdentitySignals(dossier: TechnicalDossier): IdentitySignal[] {
  const signals: IdentitySignal[] = [
    { type: 'name', value: dossier.person.displayName, weight: 15, source: dossier.source },
  ]

  for (const anchor of dossier.anchors) {
    if (anchor.kind === 'personal_domain') {
      signals.push({ type: 'website', value: anchor.value, weight: 25, source: dossier.source })
    } else if (anchor.kind === 'public_email') {
      signals.push({ type: 'email', value: anchor.value, weight: 30, source: dossier.source })
    } else if (anchor.kind === 'explicit_profile_link' || anchor.kind === 'github_login') {
      signals.push({ type: 'source_url', value: anchor.value, weight: 25, source: dossier.source })
    }
  }

  if (dossier.person.statedLocation) {
    signals.push({ type: 'location', value: dossier.person.statedLocation, weight: 12, source: dossier.source })
  }
  if (dossier.person.statedOrganization) {
    signals.push({ type: 'organization', value: dossier.person.statedOrganization, weight: 10, source: dossier.source })
  }

  // Observed technologies may support an existing proposal but are weak: two
  // unrelated people found by the same search share topics by construction.
  for (const value of observedTechnologyValues(dossier.technologies).slice(0, 5)) {
    signals.push({ type: 'skill', value, weight: 3, source: dossier.source })
  }

  return signals
}

/**
 * Convert a dossier into the canonical `SourceResult`.
 *
 * `skills` is populated exclusively from observed technologies. There is no
 * code path in this function that can read the discovery intent.
 */
export function dossierToSourceResult(dossier: TechnicalDossier): SourceResult {
  const evidence: EvidenceItem[] = dossier.artifacts.map(artifactEvidence)

  for (const limit of dossier.limits) {
    evidence.push({
      id: `${dossier.source}-limit-${limit.topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      label: `Not established by ${dossier.source}`,
      detail: limit.explanation,
      source: dossier.source,
      confidence: 'low',
      url: dossier.person.profileUrl,
      observedAt: dossier.observedAt,
    })
  }

  return {
    id: `${dossier.source}:${dossier.person.sourceProfileId}`,
    source: dossier.source,
    sourceProfileId: dossier.person.sourceProfileId,
    entityKind: 'person',
    displayName: dossier.person.displayName,
    headline: dossier.person.headline,
    location: dossier.person.statedLocation,
    organization: dossier.person.statedOrganization,
    profileUrl: dossier.person.profileUrl,
    avatarUrl: dossier.person.avatarUrl,
    skills: observedTechnologyValues(dossier.technologies),
    evidence,
    contactSignals: anchorContactSignals(dossier),
    identitySignals: anchorIdentitySignals(dossier),
    refreshedAt: dossier.observedAt,
    raw: {
      ...dossier.raw,
      technicalTalentGraph: {
        version: 'v33.3a',
        artifacts: dossier.artifacts,
        technologies: dossier.technologies,
        anchors: dossier.anchors,
        activity: dossier.activity,
        limits: dossier.limits,
      },
    },
  }
}

/** Deterministic anchors are the only ones allowed to trigger a proposal. */
export function deterministicAnchors(anchors: readonly IdentityAnchor[]): IdentityAnchor[] {
  return anchors.filter(anchor => anchor.strength === 'deterministic')
}
