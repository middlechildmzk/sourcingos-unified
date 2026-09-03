import 'server-only'
import type { EnrichmentPurposeV35 } from '../orchestrator-v35'
import type { ContactDeliverabilityStatus, ContactEnrichmentRequest, ContactEnrichmentResult } from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'tomba' as const
const BASE = 'https://api.tomba.io/v1'

function configured(): boolean {
  return Boolean(process.env.TOMBA_API_KEY && process.env.TOMBA_SECRET_KEY)
}

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: configured(),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

function linkedin(request: ContactEnrichmentRequest): string | undefined {
  return request.linkedinUrl || (request.profileUrl?.includes('linkedin.com/') ? request.profileUrl : undefined)
}

function hasName(request: ContactEnrichmentRequest): boolean {
  return Boolean(request.fullName || (request.firstName && request.lastName))
}

export function canUseTombaV36_8(request: ContactEnrichmentRequest, purpose: EnrichmentPurposeV35): boolean {
  if (purpose === 'email_verification') return Boolean(request.email)
  if (purpose === 'work_email_finder' || purpose === 'identity_enrichment') {
    return Boolean(linkedin(request) || (hasName(request) && (request.companyDomain || request.currentCompany)))
  }
  return false
}

function statusToDeliverability(status: string): ContactDeliverabilityStatus {
  const normalized = status.toLowerCase()
  if (normalized === 'valid' || normalized === 'deliverable') return 'valid'
  if (normalized.includes('accept')) return 'accept_all'
  if (normalized.includes('risk')) return 'risky'
  if (normalized === 'invalid' || normalized === 'undeliverable') return 'invalid'
  return 'unknown'
}

function sourceUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const raw = typeof row.uri === 'string' ? row.uri : typeof row.website_url === 'string' ? row.website_url : undefined
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (['http:', 'https:'].includes(url.protocol)) return url.toString()
    } catch { /* ignore */ }
  }
  return undefined
}

function finderParams(request: ContactEnrichmentRequest): { endpoint: string; params: URLSearchParams; matchedOn: string[] } {
  const profile = linkedin(request)
  if (profile) {
    return { endpoint: '/linkedin', params: new URLSearchParams({ url: profile }), matchedOn: ['linkedin_url'] }
  }
  const params = new URLSearchParams()
  if (request.companyDomain) params.set('domain', request.companyDomain)
  if (request.currentCompany) params.set('company', request.currentCompany)
  if (request.fullName) params.set('full_name', request.fullName)
  else {
    if (request.firstName) params.set('first_name', request.firstName)
    if (request.lastName) params.set('last_name', request.lastName)
  }
  return { endpoint: '/email-finder', params, matchedOn: [request.companyDomain ? 'name+domain' : 'name+company'] }
}

export async function enrichWithTombaV36_8(request: ContactEnrichmentRequest, purpose: EnrichmentPurposeV35): Promise<ContactEnrichmentResult> {
  const key = process.env.TOMBA_API_KEY
  const secret = process.env.TOMBA_SECRET_KEY
  if (!key || !secret) return empty(request, 'Tomba is not configured.', ['TOMBA_API_KEY/TOMBA_SECRET_KEY not set.'])
  if (!canUseTombaV36_8(request, purpose)) return empty(request, `Tomba cannot run the ${purpose.replace(/_/g, ' ')} lane with the available identity fields.`)

  const isVerify = purpose === 'email_verification'
  const finder = isVerify ? undefined : finderParams(request)
  const endpoint = isVerify ? '/email-verifier' : finder!.endpoint
  const params = isVerify ? new URLSearchParams({ email: request.email! }) : finder!.params

  try {
    const response = await fetch(`${BASE}${endpoint}?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-Tomba-Key': key, 'X-Tomba-Secret': secret, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) return empty(request, 'Tomba rejected the request.', ['Provider auth error.'])
    if (response.status === 429) return empty(request, 'Tomba is rate limited.', ['Provider rate limited.'])
    if (!response.ok) return empty(request, 'Tomba lookup failed.', [`Provider status ${response.status}.`])

    const payload = await response.json() as Record<string, unknown>
    const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
    const emailRecord = isVerify && data.email && typeof data.email === 'object' ? data.email as Record<string, unknown> : data
    const email = isVerify ? request.email : typeof data.email === 'string' ? data.email : undefined
    const verification = !isVerify && data.verification && typeof data.verification === 'object' ? data.verification as Record<string, unknown> : emailRecord
    const rawStatus = typeof verification.status === 'string'
      ? verification.status
      : typeof emailRecord.result === 'string'
        ? emailRecord.result
        : 'unknown'
    const deliverability = statusToDeliverability(rawStatus)
    if (!email) return empty(request, 'Tomba did not return an email.')

    const source = sourceUrl(data.sources)
    const score = typeof data.score === 'number' ? data.score : typeof emailRecord.score === 'number' ? emailRecord.score : undefined
    const signal = makeContactSignal({
      type: 'email',
      channelKind: isVerify ? 'other_email' : 'work_email',
      value: email,
      sourceProvider: PROVIDER,
      confidence: deliverability === 'valid' ? 'high' : score !== undefined && score >= 70 ? 'medium' : 'low',
      ownershipConfidence: isVerify ? 'unknown' : linkedin(request) ? 'strong' : 'moderate',
      deliverability,
      providerStatusRaw: rawStatus,
      rawSource: source || `tomba:${isVerify ? 'email_verifier' : endpoint.replace('/', '')}`,
      notes: source ? 'Tomba returned a public source URL for this contact signal; permission remains unknown.' : 'Tomba contact signal; permission remains unknown.',
    })

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: isVerify ? `Tomba verification status: ${rawStatus}.` : 'Tomba returned a professional work-email signal.',
      signals: [signal],
      match: {
        matchState: isVerify ? 'unknown' : linkedin(request) ? 'exact_anchor' : 'strong',
        ...(score !== undefined ? { providerScore: score, providerScoreScale: '0-100' } : {}),
        matchedOn: isVerify ? ['email'] : finder!.matchedOn,
      },
      log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 1, warnings: [], persistenceMode: 'none' },
    }
  } catch {
    return empty(request, 'Could not reach Tomba.', ['Network error reaching provider.'])
  }
}
