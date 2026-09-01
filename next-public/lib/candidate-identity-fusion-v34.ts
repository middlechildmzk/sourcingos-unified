import type { CandidateDbSnapshot } from './candidate-db-v18'

export type Candidate360IdentityProfileV34 = {
  source: string
  sourceProfileId: string
  displayName: string
  profileUrl?: string
  headline?: string
  location?: string
  organization?: string
  lastSeenAt?: string
}

export type Candidate360ContactSignalV34 = {
  type: 'public_email' | 'website' | 'profile_url'
  value: string
  source: string
  verified: boolean
  permissionStatus: string
  confidence?: string
  observedAt?: string
}

export type Candidate360IdentityFusionV34 = {
  profiles: Candidate360IdentityProfileV34[]
  contacts: Candidate360ContactSignalV34[]
  sourceCount: number
  sources: string[]
  fusedProfileCount: number
  contactSignalCount: number
}

const ENRICHMENT_PROVIDER_SOURCES = new Set([
  'people_data_labs',
  'pdl',
  'hunter',
  'apollo',
])

function clean(value: unknown, max = 1200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function safeHttpUrl(value: unknown): string | undefined {
  const raw = clean(value)
  if (!raw) return undefined
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch {
    return undefined
  }
}

function canonicalContactType(value: unknown): Candidate360ContactSignalV34['type'] | '' {
  const type = clean(value, 80).toLowerCase()
  if (type === 'public_email' || type === 'email') return 'public_email'
  if (type === 'website') return 'website'
  if (type === 'profile_url' || type === 'social_url') return 'profile_url'
  return ''
}

function normalizedContactValue(type: Candidate360ContactSignalV34['type'], value: unknown): string {
  const raw = clean(value)
  if (!raw) return ''
  if (type === 'public_email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw.toLowerCase() : ''
  return safeHttpUrl(raw) || ''
}

/**
 * Fuse source-profile identity and normalized contact provenance for a canonical
 * candidate after the Candidate Graph has already decided which source rows are
 * linked to that candidate. This function NEVER performs identity resolution and
 * NEVER moves/merges source rows. It simply renders confirmed/persisted linkage.
 *
 * Contact policy:
 * - linked source-profile contact signals may be shown;
 * - candidate-level signals from known enrichment providers may be shown;
 * - arbitrary candidate-level/manual rows are not surfaced as though they were
 *   public-source or enrichment provenance;
 * - do-not-contact/blocked signals are excluded from the actionable identity view;
 * - phone is intentionally not included in this public/professional profile view
 *   until the UI has a dedicated phone/permission treatment.
 */
export function fuseCandidateIdentityV34(snapshot: CandidateDbSnapshot, candidateId: string): Candidate360IdentityFusionV34 {
  const linkedProfiles = snapshot.sourceProfiles.filter(profile => profile.candidateId === candidateId)
  const profileIds = new Set(linkedProfiles.map(profile => profile.id))

  const profileRows = linkedProfiles.map(profile => ({
    source: String(profile.source || 'public_source'),
    sourceProfileId: String(profile.sourceProfileId || ''),
    displayName: String(profile.displayName || profile.sourceProfileId || profile.source || 'Public profile'),
    profileUrl: safeHttpUrl(profile.profileUrl),
    headline: clean(profile.headline, 500) || undefined,
    location: clean(profile.location, 300) || undefined,
    organization: clean(profile.organization, 300) || undefined,
    lastSeenAt: clean(profile.lastSeenAt, 100) || undefined,
  })).filter(profile => profile.sourceProfileId || profile.profileUrl)

  const profiles = Array.from(new Map(
    profileRows.map(profile => [`${profile.source.toLowerCase()}:${profile.sourceProfileId.toLowerCase()}:${profile.profileUrl || ''}`, profile]),
  ).values()).slice(0, 20)

  const contactRows = snapshot.contactSignals.flatMap(signal => {
    const source = String(signal.source || 'public_source')
    const sourceKey = source.toLowerCase()
    const attachedToLinkedProfile = Boolean(signal.sourceProfileId && profileIds.has(signal.sourceProfileId))
    const candidateLevelEnrichment = signal.candidateId === candidateId && ENRICHMENT_PROVIDER_SOURCES.has(sourceKey)
    if (!attachedToLinkedProfile && !candidateLevelEnrichment) return []

    const permissionStatus = String(signal.permissionStatus || 'unknown')
    if (['blocked', 'do_not_contact'].includes(permissionStatus)) return []
    const type = canonicalContactType(signal.type)
    if (!type) return []
    const value = normalizedContactValue(type, signal.value)
    if (!value) return []

    return [{
      type,
      value,
      source,
      verified: Boolean(signal.verified),
      permissionStatus,
      confidence: clean(signal.confidence, 40) || undefined,
      observedAt: clean(signal.createdAt, 100) || undefined,
    } satisfies Candidate360ContactSignalV34]
  })

  const contacts = Array.from(new Map(
    contactRows.map(signal => [`${signal.type}:${signal.value.toLowerCase()}`, signal]),
  ).values()).slice(0, 20)
  const sources = Array.from(new Set([
    ...profiles.map(profile => profile.source),
    ...contacts.map(contact => contact.source),
  ])).sort((a, b) => a.localeCompare(b))

  return {
    profiles,
    contacts,
    sourceCount: sources.length,
    sources,
    fusedProfileCount: profiles.length,
    contactSignalCount: contacts.length,
  }
}
