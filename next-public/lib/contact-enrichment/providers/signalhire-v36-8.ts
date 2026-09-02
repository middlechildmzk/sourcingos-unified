import 'server-only'
import type { ContactEnrichmentRequest, ContactEnrichmentResult, ContactSignalType } from '../types'
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

function identifier(request: ContactEnrichmentRequest): string | undefined {
  if (request.providerName === PROVIDER && request.providerPersonId) return request.providerPersonId.trim()
  return linkedin(request)?.trim()
}

export function canUseSignalHireLookupV36_8(request: ContactEnrichmentRequest): boolean {
  return Boolean(identifier(request))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
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

export async function enrichWithSignalHireV36_8(request: ContactEnrichmentRequest): Promise<ContactEnrichmentResult> {
  const key = process.env.SIGNALHIRE_API_KEY
  const item = identifier(request)
  if (!key) return empty(request, 'SignalHire is not configured.', ['SIGNALHIRE_API_KEY not set.'])
  if (!item) return empty(request, 'SignalHire contact lookup requires a same-provider UID or observed LinkedIn profile URL.')

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [item], withoutWaterfall: true }),
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
        ownershipConfidence: request.providerName === PROVIDER && request.providerPersonId ? 'deterministic' : 'strong',
        deliverability: 'unknown',
        providerStatusRaw: Number.isFinite(rating) ? `rating:${rating}` : undefined,
        rawSource: providerPersonId ? `signalhire:${providerPersonId}` : 'signalhire:person',
        notes: `SignalHire synchronous internal-data contact lookup${typeof row.subType === 'string' ? ` (${row.subType})` : ''}; permission remains unknown.`,
      }))
    }

    for (const socialValue of Array.isArray(candidate.social) ? candidate.social : []) {
      const row = record(socialValue)
      const link = typeof row.link === 'string' ? validHttp(row.link) : undefined
      if (!link) continue
      const platform = typeof row.type === 'string' ? row.type : 'social'
      signals.push(makeContactSignal({
        type: platform === 'gh' || platform === 'so' ? 'profile_url' : 'social_url',
        value: link,
        sourceProvider: PROVIDER,
        confidence: 'medium',
        ownershipConfidence: request.providerName === PROVIDER && request.providerPersonId ? 'deterministic' : 'strong',
        rawSource: providerPersonId ? `signalhire:${providerPersonId}` : 'signalhire:person',
        notes: `SignalHire social profile (${platform}); permission remains unknown.`,
      }))
    }

    const unique = Array.from(new Map(signals.map(signal => [`${signal.type}:${signal.value.toLowerCase()}`, signal])).values())
    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: unique.length ? `SignalHire returned ${unique.length} contact/profile signal${unique.length === 1 ? '' : 's'}.` : 'SignalHire matched the profile but returned no contact signals in synchronous mode.',
      signals: unique,
      match: {
        matchState: request.providerName === PROVIDER && request.providerPersonId ? 'exact_anchor' : 'strong',
        ...(providerPersonId ? { providerPersonId } : {}),
        matchedOn: request.providerName === PROVIDER && request.providerPersonId ? ['same_provider_uid'] : ['linkedin_url'],
      },
      log: {
        provider: PROVIDER,
        attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request),
        resultCount: unique.length,
        warnings: ['SignalHire withoutWaterfall is synchronous/internal-only and may have lower or older contact coverage than its async external-provider waterfall.'],
        persistenceMode: 'none',
      },
    }
  } catch {
    return empty(request, 'Could not reach SignalHire.', ['Network error reaching provider.'])
  }
}
