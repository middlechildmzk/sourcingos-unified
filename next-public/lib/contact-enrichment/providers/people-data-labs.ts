// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/providers/people-data-labs.ts — Live PDL adapter.
//
// SERVER-ONLY. Never import in a client component.
//   - Reads PDL_API_KEY from process.env (never NEXT_PUBLIC_)
//   - API key sent via X-Api-Key header, never logged, never returned to client
//   - Conservative professional-field request only — no protected attributes
//   - All signals: verified=false, permissionStatus='unknown', provider='people_data_labs'
//   - Raw provider errors and payloads never reach the client
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import {
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ContactSignal,
  enrichmentFieldsUsed,
  makeContactSignal,
} from '../types'

const PROVIDER = 'people_data_labs' as const
const PDL_ENDPOINT = 'https://api.peopledatalabs.com/v5/person/enrich'

function emptyResult(message: string, request: ContactEnrichmentRequest, warnings: string[] = []): ContactEnrichmentResult {
  return {
    provider: PROVIDER,
    providerConfigured: Boolean(process.env.PDL_API_KEY),
    message,
    signals: [],
    log: {
      provider: PROVIDER,
      attemptedAt: new Date().toISOString(),
      fieldsUsed: enrichmentFieldsUsed(request),
      resultCount: 0,
      warnings,
      persistenceMode: 'none',
    },
  }
}

/** Build conservative PDL query params. Professional identity fields only. */
function buildParams(request: ContactEnrichmentRequest): URLSearchParams {
  const params = new URLSearchParams()
  if (request.fullName) {
    params.set('name', request.fullName)
  } else {
    if (request.firstName) params.set('first_name', request.firstName)
    if (request.lastName) params.set('last_name', request.lastName)
  }
  if (request.currentCompany) params.set('company', request.currentCompany)
  // PDL accepts a company domain in the same 'company' param family; prefer explicit domain
  if (request.companyDomain) params.set('company', request.companyDomain)
  if (request.location) params.set('location', request.location)
  if (request.title) params.set('title', request.title)
  // Profile URLs improve match precision
  const profile = request.linkedinUrl || request.profileUrl || request.githubUrl
  if (profile) params.append('profile', profile)
  // Conservative match threshold — reduce false matches
  params.set('min_likelihood', '6')
  // Only request the fields we map — never sensitive/protected attributes
  return params
}

/** Map a PDL person record to normalized, compliant ContactSignal[]. */
function mapSignals(person: Record<string, unknown>): ContactSignal[] {
  const signals: ContactSignal[] = []

  // Emails
  const emails = person.emails
  if (Array.isArray(emails)) {
    for (const e of emails) {
      const value = typeof e === 'string' ? e : (e?.address as string | undefined)
      if (value) {
        signals.push(makeContactSignal({
          type: 'email', value, sourceProvider: PROVIDER, confidence: 'medium',
          notes: 'Discovered via People Data Labs. Unverified. Confirm before outreach.',
        }))
      }
    }
  }

  // Phone numbers
  const phones = person.phone_numbers
  if (Array.isArray(phones)) {
    for (const p of phones) {
      const value = typeof p === 'string' ? p : (p?.number as string | undefined)
      if (value) {
        signals.push(makeContactSignal({
          type: 'phone', value, sourceProvider: PROVIDER, confidence: 'low',
          notes: 'Discovered via People Data Labs. Unverified.',
        }))
      }
    }
  }

  // Professional profile URLs
  if (typeof person.linkedin_url === 'string') {
    signals.push(makeContactSignal({ type: 'social_url', value: person.linkedin_url, sourceProvider: PROVIDER, confidence: 'medium' }))
  }
  if (typeof person.github_url === 'string') {
    signals.push(makeContactSignal({ type: 'profile_url', value: person.github_url, sourceProvider: PROVIDER, confidence: 'medium' }))
  }
  const jobDomain = (person.job_company_website as string | undefined)
  if (jobDomain) {
    signals.push(makeContactSignal({ type: 'company_domain', value: jobDomain, sourceProvider: PROVIDER, confidence: 'low' }))
  }

  // Dedupe within this result by type+value
  const seen = new Set<string>()
  return signals.filter(s => {
    const key = `${s.type}:${s.value.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function enrichWithPeopleDataLabs(
  request: ContactEnrichmentRequest
): Promise<ContactEnrichmentResult> {
  const key = process.env.PDL_API_KEY

  if (!key) {
    return {
      provider: PROVIDER,
      providerConfigured: false,
      message: 'Contact enrichment provider not configured yet.',
      signals: [],
      log: {
        provider: PROVIDER, attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request), resultCount: 0,
        warnings: ['PDL_API_KEY not set.'], persistenceMode: 'none',
      },
    }
  }

  const params = buildParams(request)

  try {
    const res = await fetch(`${PDL_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
      // Don't cache enrichment lookups
      cache: 'no-store',
    })

    // 404 = no match found (PDL convention)
    if (res.status === 404) {
      return emptyResult(
        'No contact signal found from People Data Labs. Try adding a company domain or source profile URL.',
        request
      )
    }

    if (res.status === 401 || res.status === 403) {
      // Auth/key problem — never leak which. Generic UI-safe message.
      return emptyResult('Contact enrichment provider rejected the request. Check provider configuration.', request, ['Provider auth error.'])
    }

    if (res.status === 429) {
      return emptyResult('Contact enrichment rate limit reached. Try again shortly.', request, ['Provider rate limited.'])
    }

    if (!res.ok) {
      // Generic — never expose provider internals
      return emptyResult('Contact enrichment service is unavailable right now. Try again later.', request, [`Provider status ${res.status}.`])
    }

    const json = await res.json() as { data?: Record<string, unknown> }
    const person = json.data
    if (!person) {
      return emptyResult('No contact signal found from People Data Labs.', request)
    }

    const signals = mapSignals(person)

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: signals.length > 0
        ? `Found ${signals.length} unverified contact signal${signals.length !== 1 ? 's' : ''}.`
        : 'A profile match was found but no contact signals were available.',
      signals,
      log: {
        provider: PROVIDER,
        attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request),
        resultCount: signals.length,
        warnings: [],
        persistenceMode: 'none',
      },
    }
  } catch {
    // Never surface raw network/provider errors
    return emptyResult('Could not reach the contact enrichment provider. Try again later.', request, ['Network error reaching provider.'])
  }
}
