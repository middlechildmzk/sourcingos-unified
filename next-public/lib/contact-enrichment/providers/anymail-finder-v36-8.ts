import 'server-only'
import type { ContactEnrichmentRequest, ContactEnrichmentResult } from '../types'
import { enrichmentFieldsUsed, makeContactSignal } from '../types'

const PROVIDER = 'anymail_finder' as const
const ENDPOINT = 'https://api.anymailfinder.com/v5.1/find-email/person'

function empty(request: ContactEnrichmentRequest, message: string, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(process.env.ANYMAILFINDER_API_KEY),
    message,
    signals: [],
    match: { matchState: 'no_match', matchedOn: [] },
    log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0, warnings, persistenceMode: 'none' },
  }
}

function linkedin(request: ContactEnrichmentRequest): string | undefined {
  const candidate = request.linkedinUrl || (request.profileUrl?.includes('linkedin.com/') ? request.profileUrl : undefined)
  return candidate?.trim() || undefined
}

export function canUseAnyMailFinderV36_8(request: ContactEnrichmentRequest): boolean {
  const hasName = Boolean(request.fullName || (request.firstName && request.lastName))
  return Boolean(linkedin(request) || (hasName && (request.companyDomain || request.currentCompany)))
}

export function buildAnyMailFinderBodyV36_8(request: ContactEnrichmentRequest) {
  const body: Record<string, string> = {}
  if (request.companyDomain) body.domain = request.companyDomain.trim()
  else if (request.currentCompany) body.company_name = request.currentCompany.trim()
  if (request.fullName) body.full_name = request.fullName.trim()
  else {
    if (request.firstName) body.first_name = request.firstName.trim()
    if (request.lastName) body.last_name = request.lastName.trim()
  }
  const profile = linkedin(request)
  if (profile) body.linkedin_url = profile
  return body
}

export async function enrichWithAnyMailFinderV36_8(request: ContactEnrichmentRequest): Promise<ContactEnrichmentResult> {
  const key = process.env.ANYMAILFINDER_API_KEY
  if (!key) return empty(request, 'AnyMail Finder is not configured.', ['ANYMAILFINDER_API_KEY not set.'])
  if (!canUseAnyMailFinderV36_8(request)) return empty(request, 'AnyMail Finder needs a LinkedIn URL or a grounded name plus company/domain.')

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildAnyMailFinderBodyV36_8(request)),
      cache: 'no-store',
    })
    if (response.status === 401 || response.status === 403) return empty(request, 'AnyMail Finder rejected the request.', ['Provider auth error.'])
    if (response.status === 429) return empty(request, 'AnyMail Finder is rate limited.', ['Provider rate limited.'])
    if (!response.ok) return empty(request, 'AnyMail Finder lookup failed.', [`Provider status ${response.status}.`])

    const data = await response.json() as Record<string, unknown>
    const email = typeof data.valid_email === 'string' && data.valid_email.trim()
      ? data.valid_email.trim()
      : typeof data.email === 'string' && data.email.trim()
        ? data.email.trim()
        : undefined
    const status = typeof data.email_status === 'string' ? data.email_status : 'unknown'
    if (!email || status === 'not_found' || status === 'blacklisted') return empty(request, 'AnyMail Finder did not return a usable work email.')

    const valid = status === 'valid'
    const signals = [makeContactSignal({
      type: 'email',
      value: email,
      sourceProvider: PROVIDER,
      confidence: valid ? 'high' : 'medium',
      ownershipConfidence: linkedin(request) ? 'strong' : 'moderate',
      deliverability: valid ? 'valid' : status === 'risky' ? 'risky' : 'unknown',
      providerStatusRaw: status,
      rawSource: 'anymailfinder:person_email',
      notes: `Real-time AnyMail Finder result. credits_charged=${String(data.credits_charged ?? 'unknown')}; contact permission remains unknown.`,
    })]

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: valid ? 'Found a provider-validated email.' : 'Found an email with non-final provider status.',
      signals,
      match: {
        matchState: linkedin(request) ? 'exact_anchor' : 'strong',
        matchedOn: linkedin(request) ? ['linkedin_url'] : [request.companyDomain ? 'name+domain' : 'name+company'],
      },
      log: { provider: PROVIDER, attemptedAt: new Date().toISOString(), fieldsUsed: enrichmentFieldsUsed(request), resultCount: signals.length, warnings: valid ? [] : [`Provider returned ${status}.`], persistenceMode: 'none' },
    }
  } catch {
    return empty(request, 'Could not reach AnyMail Finder.', ['Network error reaching provider.'])
  }
}
