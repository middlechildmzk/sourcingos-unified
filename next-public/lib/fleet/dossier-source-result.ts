import type { TechnicalDossier } from '@/lib/connectors/contract-v33-3'
import type { DeterministicIdentityAnchorSignal, EvidenceItem, IdentitySignal, SourceResult } from '@/lib/source-types'

const ALLOWED_AUTOMATIC_ANCHORS = new Set([
  'npi_number',
  'orcid',
  'github_login',
  'personal_domain',
  'explicit_profile_link',
])

function evidenceFromDossier(dossier: TechnicalDossier): EvidenceItem[] {
  const items: EvidenceItem[] = []
  for (const artifact of dossier.artifacts) {
    const detail = artifact.statement || artifact.description || artifact.name
    if (!detail) continue
    items.push({
      id: `${dossier.source}:${dossier.person.sourceProfileId}:artifact:${artifact.artifactId}`,
      label: artifact.type.replace(/_/g, ' '),
      detail,
      source: dossier.source,
      confidence: 'high',
      url: artifact.url,
      observedAt: artifact.observedAt,
    })
  }
  return items
}

function identitySignals(dossier: TechnicalDossier): IdentitySignal[] {
  const out: IdentitySignal[] = [
    { type: 'name', value: dossier.person.displayName, weight: 5, source: dossier.source },
    { type: 'source_url', value: dossier.person.profileUrl, weight: 5, source: dossier.source },
  ]
  if (dossier.person.statedLocation) out.push({ type: 'location', value: dossier.person.statedLocation, weight: 2, source: dossier.source })
  if (dossier.person.statedOrganization) out.push({ type: 'organization', value: dossier.person.statedOrganization, weight: 2, source: dossier.source })
  return out
}

function deterministicAnchors(dossier: TechnicalDossier): DeterministicIdentityAnchorSignal[] {
  return dossier.anchors
    .filter(anchor => anchor.strength === 'deterministic' && ALLOWED_AUTOMATIC_ANCHORS.has(anchor.kind))
    // Public email belongs to contact governance and is deliberately absent from
    // this allowlist even when a source publishes one.
    .map(anchor => ({
      kind: anchor.kind as DeterministicIdentityAnchorSignal['kind'],
      value: anchor.value,
      normalized: anchor.normalized,
      source: dossier.source,
    }))
}

/**
 * Convert the richer TechnicalDossier into the canonical SourceResult envelope
 * used by Candidate Graph persistence. Retrieval terms never enter this object.
 * Public email/phone/fax values are excluded from unattended capture.
 */
export function technicalDossierToSourceResultV40(dossier: TechnicalDossier): SourceResult {
  const sanitizedPerson = {
    source: dossier.person.source,
    sourceProfileId: dossier.person.sourceProfileId,
    profileUrl: dossier.person.profileUrl,
    displayName: dossier.person.displayName,
    headline: dossier.person.headline,
    statedOrganization: dossier.person.statedOrganization,
    statedLocation: dossier.person.statedLocation,
    websites: [...dossier.person.websites],
    avatarUrl: dossier.person.avatarUrl,
    accountCreatedAt: dossier.person.accountCreatedAt,
  }

  const sanitizedAnchors = dossier.anchors.filter(anchor => anchor.kind !== 'public_email')

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
    skills: Array.from(new Set(dossier.technologies.map(item => item.value).filter(Boolean))),
    evidence: evidenceFromDossier(dossier),
    contactSignals: [],
    identitySignals: identitySignals(dossier),
    deterministicIdentityAnchors: deterministicAnchors(dossier),
    refreshedAt: dossier.observedAt,
    raw: {
      resolver: 'fleet_public_person_v40_2',
      source: dossier.source,
      person: sanitizedPerson,
      artifacts: dossier.artifacts,
      technologies: dossier.technologies,
      anchors: sanitizedAnchors,
      activity: dossier.activity,
      limits: dossier.limits,
      observedAt: dossier.observedAt,
      sourceSummary: dossier.raw,
      contactValuesCaptured: false,
    },
  }
}
