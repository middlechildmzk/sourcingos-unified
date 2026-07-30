import type { SourceName } from '../source-types'
import {
  normalizeDomain,
  normalizeEmail,
  normalizeHandle,
  normalizeOrcid,
  normalizeProfileUrl,
  sensitiveHash,
  stableHash,
  uniqueNormalized,
} from './normalization'
import type { IdentifierType, IdentityIdentifier, IdentityProfile } from './resolver-types'

function profileIdentifierType(source: SourceName): IdentifierType | null {
  if (source === 'github') return 'github_url'
  if (source === 'stackoverflow') return 'stackoverflow_url'
  if (source === 'orcid') return 'orcid'
  return 'profile_url'
}

function linkedIdentifierType(url: string): IdentifierType | null {
  const domain = normalizeDomain(url)
  if (domain === 'github.com') return 'github_url'
  if (domain === 'stackoverflow.com' || domain === 'stackexchange.com') return 'stackoverflow_url'
  if (domain === 'linkedin.com') return 'linkedin_url'
  if (domain === 'orcid.org') return 'orcid'
  return null
}

export function extractObservedIdentifiers(
  profile: Omit<IdentityProfile, 'identifiers'>,
  sensitiveSecret: string,
): IdentityIdentifier[] {
  const observedAt = profile.observedAt
  const result: IdentityIdentifier[] = []
  const seen = new Set<string>()

  const add = (identifier: IdentityIdentifier) => {
    const key = `${identifier.type}:${identifier.hash}`
    if (seen.has(key)) return
    seen.add(key)
    result.push(identifier)
  }

  const stablePlatformId = `${profile.source}:${profile.sourceProfileId.trim()}`
  if (profile.sourceProfileId.trim()) {
    add({
      type: 'platform_id',
      hash: stableHash(stablePlatformId),
      displayValue: profile.sourceProfileId.trim(),
      confidence: 1,
      observedAt,
      sensitive: false,
      source: profile.source,
    })
  }

  const normalizedProfileUrl = profile.profileUrl ? normalizeProfileUrl(profile.profileUrl) : ''
  if (normalizedProfileUrl) {
    const type = profileIdentifierType(profile.source) ?? 'profile_url'
    add({
      type,
      hash: stableHash(normalizedProfileUrl),
      displayValue: normalizedProfileUrl,
      confidence: 1,
      observedAt,
      sensitive: false,
      source: profile.source,
    })
    if (type !== 'profile_url') {
      add({
        type: 'profile_url',
        hash: stableHash(normalizedProfileUrl),
        displayValue: normalizedProfileUrl,
        confidence: 1,
        observedAt,
        sensitive: false,
        source: profile.source,
      })
    }
  }

  for (const handle of uniqueNormalized(profile.handles, normalizeHandle)) {
    add({
      type: 'handle',
      hash: stableHash(handle),
      displayValue: handle,
      confidence: 0.8,
      observedAt,
      sensitive: false,
      source: profile.source,
    })
  }

  for (const email of uniqueNormalized(profile.publicEmails, normalizeEmail)) {
    add({
      type: 'public_email_hash',
      hash: sensitiveHash(email, sensitiveSecret),
      confidence: 0.9,
      observedAt,
      sensitive: true,
      source: profile.source,
    })
  }

  for (const website of uniqueNormalized(profile.websites, normalizeProfileUrl)) {
    const domain = normalizeDomain(website)
    if (!domain) continue
    add({
      type: 'website_domain',
      hash: stableHash(domain),
      displayValue: domain,
      confidence: 0.8,
      observedAt,
      sensitive: false,
      source: profile.source,
    })
  }

  const normalizedOrcid = profile.orcid ? normalizeOrcid(profile.orcid) : ''
  if (normalizedOrcid) {
    add({
      type: 'orcid',
      hash: stableHash(normalizedOrcid),
      displayValue: normalizedOrcid,
      confidence: 1,
      observedAt,
      sensitive: false,
      source: profile.source,
    })
  }

  for (const link of uniqueNormalized(profile.explicitLinks, normalizeProfileUrl)) {
    const type = linkedIdentifierType(link)
    if (!type) continue
    const value = type === 'orcid'
      ? normalizeOrcid(link)
      : link
    if (!value) continue
    add({
      type,
      hash: stableHash(value),
      displayValue: value,
      confidence: 0.95,
      observedAt,
      sensitive: false,
      source: profile.source,
    })
  }

  return result
}
