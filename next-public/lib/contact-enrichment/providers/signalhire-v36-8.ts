import 'server-only'
import type { ContactEnrichmentRequest, ContactEnrichmentResult, ContactSignalType, ResolvedProfessionalPerson, ResolvedProfessionalProfileUrl } from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'signalhire' as const
const ENDPOINT = 'https://www.signalhire.com/api/v1/candidate/search'

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(process.env.SIGNALHIRE_API_KEY),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

function linkedin(request: ContactEnrichmentRequest): string | undefined {
  return request.linkedinUrl || (request.profileUrl?.includes('linkedin.com/') ? request.profileUrl : undefined)
}

function validEmail(value?: string): string | undefined {
  const email = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email) ? email : undefined
}

function validPhone(value?: string): string | undefined {
  const phone = String(value || '').trim()
  if (!phone || !/^[+()\-\.\s\d]+$/.test(phone)) return undefined
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? phone : undefined
}

function identifier(request: ContactEnrichmentRequest): { value: string; kind: 'provider_uid' | 'linkedin_url' | 'email' | 'phone' } | undefined {
  if (request.providerName === PROVIDER && request.providerPersonId) return { value: request.providerPersonId.trim(), kind: 'provider_uid' }
  const linkedinUrl = linkedin(request)?.trim()
  if (linkedinUrl) return { value: linkedinUrl, kind: 'linkedin_url' }
  const email = validEmail(request.email)
  if (email) return { value: email, kind: 'email' }
  const phone = validPhone(request.phone)
  if (phone) return { value: phone, kind: 'phone' }
  return undefined
}

export function canUseSignalHireLookupV36_8(request: ContactEnrichmentRequest): boolean {
  return Boolean(identifier(request))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function strings(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(stringValue).filter(Boolean) as string[])).slice(0, max)
}

function contactType(value: string): ContactSignalType {
  if (value === 'email') return 'email'
  if (value === 'phone') return 'phone'
  if (value === 'link') return 'social_url'
  return 'unknown'
}

function validHttp(value: string): string | undefined {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function socialProfileUrls(candidate: Record<string, unknown>): ResolvedProfessionalProfileUrl[] {
  const profiles: ResolvedProfessionalProfileUrl[] = []
  for (const socialValue of Array.isArray(candidate.social) ? candidate.social : []) {
    const row = record(socialValue)
    const link = typeof row.link === 'string' ? validHttp(row.link) : undefined
    if (!link) continue
    const platform = typeof row.type === 'string' ? row.type.toLowerCase() : ''
    const kind: ResolvedProfessionalProfileUrl['kind'] = platform === 'li'
      ? 'linkedin'
      : platform === 'gh'
        ? 'github'
        : platform === 'so'
          ? 'stackoverflow'
          : 'other'
    if (!profiles.some(item => item.url === link)) profiles.push({ kind, url: link })
  }
  return profiles.slice(0, 12)
}

function resolvedPerson(candidate: Record<string, unknown>, providerPersonId?: string): ResolvedProfessionalPerson | undefined {
  const displayName = stringValue(candidate.fullName) || stringValue(candidate.name)
  if (!displayName) return undefined
  const experiences = Array.isArray(candidate.experience) ? candidate.experience.map(record) : []
  const current = experiences[0] || {}
  return {
    ...(providerPersonId ? { providerPersonId } : {}),
    displayName,
    currentTitle: stringValue(current.title),
    currentEmployer: stringValue(current.company),
    location: stringValue(candidate.location),
    skills: strings(candidate.skills),
    profileUrls: socialProfileUrls(candidate),
  }
}

export async function enrichWithSignalHireV36_8(request: ContactEnrichmentRequest): Promise<ContactEnrichmentResult> {
  const key = process.env.SIGNALHIRE_API_KEY
  const lookup = identifier(request)
  if (!key) return empty(request, 'SignalHire is not configured.', ['SIGNALHIRE_API_KEY not set.'])
  if (!lookup) return empty(request, 'SignalHire identity/contact lookup requires a same-provider UID, observed LinkedIn profile URL, exact email, or exact phone identifier.')

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [lookup.value], withoutWaterfall: true }),
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) return empty(request, 'SignalHire rejected the request.', ['Provider auth error.'])
    if (response.status === 402) return empty(request, 'SignalHire credits are exhausted.', ['Provider credits exhausted.'])
    if (response.status === 429) return empty(request, 'SignalHire is rate limited.', ['Provider rate limited.'])
    if (!response.ok) return empty(request, 'SignalHire lookup failed.', [`Provider status ${response.status}.`])

    const payload = await response.json() as unknown
    const first = Array.isArray(payload) ? record(payload[0]) : {}
    if (first.status !== 'success') return empty(request, 'SignalHire did not return a matching profile.', [typeof first.status === 'string' ? `Provider status: ${first.status}` : 'Provider returned no successful match.'])
    const candidate = record(first.candidate)
    const providerPersonId = typeof candidate.uid === 'string' ? candidate.uid : request.providerName === PROVIDER ? request.providerPersonId : undefined
    const signals = [] as ReturnType<typeof makeContactSignal>[]

    for (const itemValue of Array.isArray(candidate.contacts) ? candidate.contacts : []) {
      const row = record(itemValue)
      const typeRaw = typeof row.type === 'string' ? row.type.toLowerCase() : ''
      const value = typeof row.value === 'string' ? row.value.trim() : ''
      if (!value) continue
      const type = contactType(typeRaw)
      if (type === 'unknown') continue
      const rating = typeof row.rating === 'number' ? row.rating : Number(row.rating)
      signals.push(makeContactSignal({
        type,
        value,
        sourceProvider: PROVIDER,
        confidence: Number.isFinite(rating) && rating >= 100 ? 'high' : Number.isFinite(rating) && rating >= 70 ? 'medium' : 'low',
        ownershipConfidence: lookup.kind === 'provider_uid' ? 'deterministic' : 'strong',
        deliverability: 'unknown',
        providerStatusRaw: Number.isFinite(rating) ? `rating:${rating}` : undefined,
        rawSource: providerPersonId ? `signalhire:${providerPersonId}` : 'signalhire:person',
        notes: `SignalHire synchronous internal-data contact lookup${typeof row.subType === 'string' ? ` (${row.subType})` : ''}; permission remains unknown.`,
      }))
    }

    for (const profile of socialProfileUrls(candidate)) {
      signals.push(makeContactSignal({
        type: profile.kind === 'github' || profile.kind === 'stackoverflow' ? 'profile_url' : 'social_url',
        value: profile.url,
        sourceProvider: PROVIDER,
        confidence: 'medium',
        ownershipConfidence: lookup.kind === 'provider_uid' ? 'deterministic' : 'strong',
        rawSource: providerPersonId ? `signalhire:${providerPersonId}` : 'signalhire:person',
        notes: `SignalHire professional/social profile (${profile.kind}); permission remains unknown.`,
      }))
    }

    const unique = Array.from(new Map(signals.map(signal => [`${signal.type}:${signal.value.toLowerCase()}`, signal])).values())
    const person = resolvedPerson(candidate, providerPersonId)
    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: person
        ? `SignalHire resolved ${person.displayName}${unique.length ? ` and returned ${unique.length} contact/profile signal${unique.length === 1 ? '' : 's'}` : ''}.`
        : unique.length
          ? `SignalHire returned ${unique.length} contact/profile signal${unique.length === 1 ? '' : 's'}.`
          : 'SignalHire matched the identifier but returned no usable professional identity/contact signals in synchronous mode.',
      signals: unique,
      person,
      match: {
        matchState: lookup.kind === 'provider_uid' ? 'exact_anchor' : 'strong',
        ...(providerPersonId ? { providerPersonId } : {}),
        matchedOn: [lookup.kind],
      },
      log: {
        provider: PROVIDER,
        attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request),
        resultCount: unique.length,
        warnings: ['SignalHire withoutWaterfall is synchronous/internal-only and may have lower or older contact coverage than its async external-provider waterfall. Exact lookup identifiers resolve a provider observation; they do not establish outreach permission.'],
        persistenceMode: 'none',
      },
    }
  } catch {
    return empty(request, 'Could not reach SignalHire.', ['Network error reaching provider.'])
  }
}
