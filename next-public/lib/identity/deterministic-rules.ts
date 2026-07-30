import { foldForComparison, normalizeDomain, normalizeProfileUrl } from './normalization'
import { jaroWinkler } from './similarity'
import type {
  CandidateIdentity,
  DeterministicRuleResult,
  IdentityProfile,
} from './resolver-types'

function candidateProfiles(candidate: CandidateIdentity): IdentityProfile[] {
  return candidate.sourceProfiles
}

function normalizedProfileUrls(profile: IdentityProfile): string[] {
  return [...new Set([
    profile.profileUrl ?? '',
    ...profile.explicitLinks,
  ].map(normalizeProfileUrl).filter(Boolean))]
}

function identifierHashes(profile: IdentityProfile, type: string): string[] {
  return profile.identifiers
    .filter(identifier => identifier.type === type)
    .map(identifier => identifier.hash)
}

function candidateIdentifierHashes(candidate: CandidateIdentity, type: string): string[] {
  return [...new Set(candidate.sourceProfiles.flatMap(profile => identifierHashes(profile, type)))]
}

function compatibleName(incoming: IdentityProfile, candidate: CandidateIdentity): boolean {
  const incomingName = foldForComparison(incoming.displayName)
  const names = [candidate.canonicalName, ...candidate.sourceProfiles.map(profile => profile.displayName)]
    .map(foldForComparison)
    .filter(Boolean)
  return names.some(name => jaroWinkler(incomingName, name) >= 0.86)
}

export function evaluateDeterministicRules(
  incoming: IdentityProfile,
  candidate: CandidateIdentity,
): DeterministicRuleResult[] {
  const profiles = candidateProfiles(candidate)

  const sameSource = profiles.find(profile =>
    profile.source === incoming.source
    && profile.sourceProfileId === incoming.sourceProfileId,
  )

  const incomingUrls = normalizedProfileUrls(incoming)
  const existingUrls = [...new Set(profiles.flatMap(normalizedProfileUrls))]
  const incomingExplicit = new Set(incoming.explicitLinks.map(normalizeProfileUrl).filter(Boolean))
  const existingExplicit = new Set(profiles.flatMap(profile => profile.explicitLinks.map(normalizeProfileUrl).filter(Boolean)))
  const explicitCrossLink = existingUrls.some(url => incomingExplicit.has(url))
    || incomingUrls.some(url => existingExplicit.has(url))

  const incomingEmails = identifierHashes(incoming, 'public_email_hash')
  const candidateEmails = candidateIdentifierHashes(candidate, 'public_email_hash')
  const sharedObservedEmail = incomingEmails.some(hash => candidateEmails.includes(hash))

  const incomingOrcids = identifierHashes(incoming, 'orcid')
  const candidateOrcids = candidateIdentifierHashes(candidate, 'orcid')
  const sharedOrcid = incomingOrcids.some(hash => candidateOrcids.includes(hash))

  const incomingDomains = [...new Set(incoming.websites.map(normalizeDomain).filter(Boolean))]
  const candidateDomains = [...new Set(profiles.flatMap(profile => profile.websites.map(normalizeDomain).filter(Boolean)))]
  const sharedDomain = incomingDomains.find(domain => candidateDomains.includes(domain))
  const profileUrls = [incoming.profileUrl ?? '', ...profiles.map(profile => profile.profileUrl ?? '')]
    .map(normalizeProfileUrl)
    .filter(Boolean)
  const siteLinksBothProfiles = Boolean(sharedDomain)
    && profileUrls.filter(url =>
      incoming.explicitLinks.map(normalizeProfileUrl).includes(url)
      || existingExplicit.has(url),
    ).length >= 2

  const resumeProfiles = [incoming, ...profiles].filter(profile =>
    profile.source === 'resume_xray' && profile.sourceRole === 'person_anchor',
  )
  const nonResumeProfiles = [incoming, ...profiles].filter(profile => profile.source !== 'resume_xray')
  const resumeLinksExactProfile = resumeProfiles.some(resume => {
    const links = new Set(resume.explicitLinks.map(normalizeProfileUrl).filter(Boolean))
    return nonResumeProfiles.some(profile => {
      const url = profile.profileUrl ? normalizeProfileUrl(profile.profileUrl) : ''
      return Boolean(url && links.has(url))
    })
  })

  return [
    {
      ruleId: 'same_source_stable_id',
      passed: Boolean(sameSource),
      evidence: sameSource
        ? { source: incoming.source, sourceProfileId: incoming.sourceProfileId }
        : { source: incoming.source },
    },
    {
      ruleId: 'explicit_cross_profile_link',
      passed: explicitCrossLink,
      evidence: { matchedNormalizedProfileLink: explicitCrossLink },
    },
    {
      ruleId: 'same_observed_public_email_and_compatible_name',
      passed: sharedObservedEmail && compatibleName(incoming, candidate),
      evidence: {
        sharedObservedPublicEmailHash: sharedObservedEmail,
        compatibleName: compatibleName(incoming, candidate),
      },
    },
    {
      ruleId: 'same_authenticated_or_imported_orcid',
      passed: sharedOrcid,
      evidence: { sharedValidatedOrcidHash: sharedOrcid },
    },
    {
      ruleId: 'same_personal_site_explicitly_linking_both_profiles',
      passed: siteLinksBothProfiles,
      evidence: { sharedPersonalDomain: sharedDomain ?? null, explicitProfileLinkCount: profileUrls.length },
    },
    {
      ruleId: 'same_authorized_resume_profile_url',
      passed: resumeLinksExactProfile,
      evidence: { authorizedResumeContainsExactProfileUrl: resumeLinksExactProfile },
    },
  ]
}

export function hasCrossSourceDeterministicAnchor(rules: DeterministicRuleResult[]): boolean {
  return rules.some(rule => rule.passed && rule.ruleId !== 'same_source_stable_id')
}
