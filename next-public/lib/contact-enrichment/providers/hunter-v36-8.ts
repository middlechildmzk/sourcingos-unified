import 'server-only'
import type { EnrichmentPurposeV35 } from '../orchestrator-v35'
import type { ContactDeliverabilityStatus, ContactEnrichmentRequest, ContactEnrichmentResult } from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'hunter' as const
const BASE = 'https://api.hunter.io/v2'

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(process.env.HUNTER_API_KEY),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

function linkedinHandle(request: ContactEnrichmentRequest): string | undefined {
  const raw = request.linkedinUrl || (request.profileUrl?.includes('linkedin.com/') ? request.profileUrl : undefined)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts[0]?.toLowerCase() === 'in' && parts[1] ? parts[1] : undefined
  } catch {
    return undefined
  }
}

function hasName(request: ContactEnrichmentRequest): boolean {
  return Boolean(request.fullName || (request.firstName && request.lastName))
}

function nameParts(request: ContactEnrichmentRequest): { first?: string; last?: string } {
  if (request.firstName || request.lastName) return { first: request.firstName, last: request.lastName }
  const parts = (request.fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return {}
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export function canUseHunterV36_8(request: ContactEnrichmentRequest, purpose: EnrichmentPurposeV35): boolean {
  if (purpose === 'email_verification') return Boolean(request.email)
  if (purpose === 'work_email_finder' || purpose === 'identity_enrichment') {
    return Boolean(linkedinHandle(request) || (hasName(request) && request.companyDomain))
  }
  return false
}

function statusToDeliverability(value: unknown): ContactDeliverabilityStatus {
  const status = typeof value === 'string' ? value.toLowerCase() : ''
  if (status === 'valid') return 'valid'
  if (status === 'accept_all') return 'accept_all'
  if (status === 'invalid') return 'invalid'
  if (status === 'risky') return 'risky'
  return 'unknown'
}

function firstSourceUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const raw = typeof row.uri === 'string' ? row.uri : typeof row.domain === 'string' ? row.domain : undefined
    if (!raw) continue
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      if (['http:', 'https:'].includes(url.protocol)) return url.toString()
    } catch { /* ignore */ }
  }
  return undefined
}

export async function enrichWithHunterV36_8(request: ContactEnrichmentRequest, purpose: EnrichmentPurposeV35): Promise<ContactEnrichmentResult> {
  const key = process.env.HUNTER_API_KEY
  if (!key) return empty(request, 'Hunter is not configured.', ['HUNTER_API_KEY not set.'])
  if (!canUseHunterV36_8(request, purpose)) return empty(request, `Hunter cannot run the ${purpose.replace(/_/g, ' ')} lane with the available fields.`)

  const verify = purpose === 'email_verification'
  const params = new URLSearchParams({ api_key: key })
  if (verify) {
    params.set('email', request.email!)
  } else {
    const handle = linkedinHandle(request)
    if (handle) params.set('linkedin_handle', handle)
    else {
      params.set('domain', request.companyDomain!)
      const parts = nameParts(request)
      if (parts.first) params.set('first_name', parts.first)
      if (parts.last) params.set('last_name', parts.last)
    }
  }

  try {
    const response = await fetch(`${BASE}/${verify ? 'email-verifier' : 'email-finder'}?${params.toString()}`, { method: 'GET', cache: 'no-store' })
    if (response.status === 401 || response.status === 403) return empty(request, 'Hunter rejected the request.', ['Provider auth error.'])
    if (response.status === 429) return empty(request, 'Hunter is rate limited.', ['Provider rate limited.'])
    if (!response.ok) return empty(request, 'Hunter lookup failed.', [`Provider status ${response.status}.`])

    const payload = await response.json() as Record<string, unknown>
    const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
    const email = verify ? request.email : typeof data.email === 'string' ? data.email : undefined
    if (!email) return empty(request, 'Hunter did not return an email.')
    const verification = data.verification && typeof data.verification === 'object' ? data.verification as Record<string, unknown> : {}
    const rawStatus = typeof data.status === 'string' ? data.status : typeof verification.status === 'string' ? verification.status : 'unknown'
    const deliverability = statusToDeliverability(rawStatus)
    const score = typeof data.score === 'number' ? data.score : undefined
    const source = firstSourceUrl(data.sources)

    const signal = makeContactSignal({
      type: 'email',
      value: email,
      sourceProvider: PROVIDER,
      confidence: deliverability === 'valid' || (score !== undefined && score >= 80) ? 'high' : score !== undefined && score >= 60 ? 'medium' : 'low',
      ownershipConfidence: verify ? 'unknown' : linkedinHandle(request) ? 'strong' : 'moderate',
      deliverability,
      providerStatusRaw: rawStatus,
      rawSource: source || `hunter:${verify ? 'email_verifier' : 'email_finder'}`,
      notes: source ? 'Hunter returned the public URL where this email was observed; permission remains unknown.' : 'Hunter email result; permission remains unknown.',
    })

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: verify ? `Hunter verification status: ${rawStatus}.` : 'Hunter returned a professional email signal.',
      signals: [signal],
      match: {
        matchState: verify ? 'unknown' : linkedinHandle(request) ? 'exact_anchor' : 'strong',
        ...(score !== undefined ? { providerScore: score, providerScoreScale: '0-100' } : {}),
        matchedOn: verify ? ['email'] : [linkedinHandle(request) ? 'linkedin_handle' : 'name+domain'],
      },
      log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 1, warnings: [], persistenceMode: 'none' },
    }
  } catch {
    return empty(request, 'Could not reach Hunter.', ['Network error reaching provider.'])
  }
}
