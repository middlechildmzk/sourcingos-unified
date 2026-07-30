import {
  foldForComparison,
  normalizeDomain,
  normalizeEmail,
  normalizeOrganization,
} from './normalization'
import { jaroWinkler } from './similarity'
import type { CandidateIdentity, IdentityConflict, IdentityProfile } from './resolver-types'

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function candidateProfiles(candidate: CandidateIdentity): IdentityProfile[] {
  return candidate.sourceProfiles
}

function valuesFromProfiles(candidate: CandidateIdentity, select: (profile: IdentityProfile) => string[]): string[] {
  return unique(candidateProfiles(candidate).flatMap(select))
}

function incompatibleChronology(incoming: IdentityProfile, existing: IdentityProfile): boolean {
  const left = incoming.chronology ?? []
  const right = existing.chronology ?? []
  for (const a of left) {
    for (const b of right) {
      if (!a.organization || !b.organization) continue
      if (normalizeOrganization(a.organization) === normalizeOrganization(b.organization)) continue
      if (!a.startYear || !a.endYear || !b.startYear || !b.endYear) continue
      const overlap = Math.max(a.startYear, b.startYear) <= Math.min(a.endYear, b.endYear)
      if (overlap && Math.min(a.endYear - a.startYear, b.endYear - b.startYear) >= 3) return true
    }
  }
  return false
}

export function detectIdentityConflicts(incoming: IdentityProfile, candidate: CandidateIdentity): IdentityConflict[] {
  const conflicts: IdentityConflict[] = []

  if (incoming.ownerId !== candidate.ownerId) {
    conflicts.push({
      type: 'cross_owner_candidate',
      severity: 'blocking',
      explanation: 'The incoming source profile and proposed candidate belong to different owners.',
      evidence: { incomingOwnerId: incoming.ownerId, candidateOwnerId: candidate.ownerId },
    })
    return conflicts
  }

  if (incoming.sourceRole !== 'person_anchor' || incoming.entityKind !== 'person') {
    conflicts.push({
      type: 'non_person_source',
      severity: 'blocking',
      explanation: 'Only classified person anchors may enter candidate identity resolution.',
      evidence: { sourceRole: incoming.sourceRole, entityKind: incoming.entityKind, source: incoming.source },
    })
  }

  const sameSourceProfiles = candidate.sourceProfiles.filter(profile => profile.source === incoming.source)
  if (sameSourceProfiles.some(profile => profile.sourceProfileId !== incoming.sourceProfileId)) {
    conflicts.push({
      type: 'different_same_platform_id',
      severity: 'blocking',
      explanation: 'The candidate already has a different stable identifier for this same platform.',
      evidence: {
        source: incoming.source,
        incomingSourceProfileId: incoming.sourceProfileId,
        existingSourceProfileIds: sameSourceProfiles.map(profile => profile.sourceProfileId),
      },
    })
  }

  const incomingOrcid = incoming.identifiers.find(identifier => identifier.type === 'orcid')?.hash
  const candidateOrcids = valuesFromProfiles(candidate, profile =>
    profile.identifiers.filter(identifier => identifier.type === 'orcid').map(identifier => identifier.hash),
  )
  if (incomingOrcid && candidateOrcids.length && !candidateOrcids.includes(incomingOrcid)) {
    conflicts.push({
      type: 'different_orcid',
      severity: 'blocking',
      explanation: 'The profiles expose different validated ORCID identifiers.',
      evidence: { incomingOrcidHash: incomingOrcid, candidateOrcidHashes: candidateOrcids },
    })
  }

  const incomingName = foldForComparison(incoming.displayName)
  const candidateNames = unique([
    foldForComparison(candidate.canonicalName),
    ...candidate.sourceProfiles.map(profile => foldForComparison(profile.displayName)),
  ])
  const bestName = candidateNames.reduce((best, name) => Math.max(best, jaroWinkler(incomingName, name)), 0)
  if (incomingName && candidateNames.length && bestName < 0.58) {
    conflicts.push({
      type: 'different_authoritative_name',
      severity: 'material',
      explanation: 'The observed names are materially different and require human review.',
      evidence: { incomingName: incoming.displayName, candidateNames, similarity: bestName },
    })
  }

  const incomingEmails = unique(incoming.publicEmails.map(normalizeEmail).filter(Boolean))
  const candidateEmails = valuesFromProfiles(candidate, profile => profile.publicEmails.map(normalizeEmail).filter(Boolean))
  if (incomingEmails.length && candidateEmails.length && !incomingEmails.some(email => candidateEmails.includes(email))) {
    conflicts.push({
      type: 'different_public_emails',
      severity: 'material',
      explanation: 'The profiles expose different public email addresses. This is negative evidence, not proof of different people.',
      evidence: { incomingEmailCount: incomingEmails.length, candidateEmailCount: candidateEmails.length },
    })
  }

  const incomingDomains = unique(incoming.websites.map(normalizeDomain).filter(Boolean))
  const candidateDomains = valuesFromProfiles(candidate, profile => profile.websites.map(normalizeDomain).filter(Boolean))
  if (incomingDomains.length && candidateDomains.length && !incomingDomains.some(domain => candidateDomains.includes(domain))) {
    conflicts.push({
      type: 'different_personal_websites',
      severity: 'material',
      explanation: 'The profiles expose different personal website domains without corroborating cross-links.',
      evidence: { incomingDomains, candidateDomains },
    })
  }

  if (candidate.sourceProfiles.some(profile => incompatibleChronology(incoming, profile))) {
    conflicts.push({
      type: 'incompatible_employment_chronology',
      severity: 'material',
      explanation: 'Long overlapping employment claims at different organizations appear inconsistent.',
      evidence: { incomingChronology: incoming.chronology ?? [] },
    })
  }

  if (incomingName && candidateNames.includes(incomingName)) {
    const corroboratingAnchors = [
      incomingEmails.some(email => candidateEmails.includes(email)),
      incomingDomains.some(domain => candidateDomains.includes(domain)),
      Boolean(incomingOrcid && candidateOrcids.includes(incomingOrcid)),
    ].filter(Boolean).length
    if (!corroboratingAnchors) {
      conflicts.push({
        type: 'sparse_common_name_collision',
        severity: 'informational',
        explanation: 'An exact name match has no strong corroborating identity anchor.',
        evidence: { normalizedName: incomingName },
      })
    }
  }

  return conflicts
}

export function hasBlockingConflict(conflicts: IdentityConflict[]): boolean {
  return conflicts.some(conflict => conflict.severity === 'blocking')
}
