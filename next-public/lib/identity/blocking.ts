import {
  foldForComparison,
  normalizeDomain,
  normalizeHandle,
  normalizeLocation,
  normalizeOrganization,
  normalizeProfileUrl,
  stableHash,
} from './normalization'
import type { BlockType, IdentityBlockKey, IdentityProfile } from './resolver-types'

const COMMON_HANDLES = new Set([
  'admin', 'support', 'info', 'contact', 'developer', 'engineer', 'user', 'official',
])

function blockHash(ownerId: string, type: BlockType, value: string): string {
  return stableHash(`${ownerId}|${type}|${value}`)
}

export function buildIdentityBlockKeys(profile: IdentityProfile, limit = 16): IdentityBlockKey[] {
  const result: IdentityBlockKey[] = []
  const seen = new Set<string>()

  const add = (type: BlockType, value: string, reason: string) => {
    if (!value || result.length >= limit) return
    const hash = blockHash(profile.ownerId, type, value)
    const key = `${type}:${hash}`
    if (seen.has(key)) return
    seen.add(key)
    result.push({ type, hash, reason })
  }

  const platform = profile.identifiers.find(identifier => identifier.type === 'platform_id')
  if (platform) add('platform_identifier', `${profile.source}:${platform.hash}`, 'Exact stable platform identifier')

  const profileUrl = profile.profileUrl ? normalizeProfileUrl(profile.profileUrl) : ''
  if (profileUrl) add('profile_url', profileUrl, 'Exact normalized profile URL')
  for (const linkedUrl of profile.explicitLinks.map(normalizeProfileUrl).filter(Boolean)) {
    add('profile_url', linkedUrl, 'Explicitly observed linked profile URL')
  }

  for (const identifier of profile.identifiers) {
    if (identifier.type === 'public_email_hash') {
      add('public_email_hash', identifier.hash, 'Exact observed public email hash')
    }
    if (identifier.type === 'orcid') {
      add('orcid', identifier.hash, 'Exact validated ORCID identifier')
    }
  }

  for (const website of profile.websites) {
    const domain = normalizeDomain(website)
    if (domain) add('personal_domain', domain, 'Observed personal website domain')
  }

  for (const handleValue of profile.handles) {
    const handle = normalizeHandle(handleValue)
    if (handle.length >= 5 && !/^\d+$/.test(handle) && !COMMON_HANDLES.has(handle)) {
      add('uncommon_handle', handle, 'Uncommon normalized handle')
    }
  }

  const name = foldForComparison(profile.displayName)
  const location = profile.location ? normalizeLocation(profile.location) : ''
  const organization = profile.organization ? normalizeOrganization(profile.organization) : ''
  if (name && location) add('name_location', `${name}|${location}`, 'Name and coarse location comparison block')
  if (name && organization) add('name_organization', `${name}|${organization}`, 'Name and organization comparison block')

  return result
}

export function sharedBlockingKeys(a: IdentityProfile, b: IdentityProfile): string[] {
  const bKeys = new Set(buildIdentityBlockKeys(b).map(key => `${key.type}:${key.hash}`))
  return buildIdentityBlockKeys(a)
    .map(key => `${key.type}:${key.hash}`)
    .filter(key => bKeys.has(key))
}
