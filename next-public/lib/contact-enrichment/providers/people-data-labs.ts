// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/providers/people-data-labs.ts — Live PDL adapter.
//
// SERVER-ONLY. Never import in a client component.
//   - Reads PDL_API_KEY from process.env (never NEXT_PUBLIC_)
//   - API key sent via X-Api-Key header, never logged, never returned to client
//   - Conservative professional-field request only — no protected attributes
//   - Provider response is minimized with data_include; full person payload is not requested
//   - Provider identity-match metadata is retained separately from contact verification
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

// PDL returns the full matched person record when data_include is omitted.
// Request only fields this adapter maps, plus the provider person ID used for provenance.
const PDL_DATA_INCLUDE = [
  'id',
  'emails.address',
  'phone_numbers',
  'linkedin_url',
  'github_url',
  'job_company_website',
].join(',')

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
  // PDL accepts a company name/domain/URL in the company match input; prefer explicit domain.
  if (request.companyDomain) params.set('company', request.companyDomain)
  if (request.location) params.set('location', request.location)
  // Do not send request.title. PDL Person Enrichment does not document title as a match input.
  const profile = request.linkedinUrl || request.profileUrl || request.githubUrl
  if (profile) params.append('profile', profile)

  // Conservative match threshold — PDL recommends >= 6 for high-accuracy use cases.
  params.set('min_likelihood', '6')
  // Retain only names of request inputs PDL says matched; never their raw values in audit metadata.
  params.set('include_if_matched', 'true')
  // Data minimization: PDL otherwise returns the full person record.
  params.set('data_include', PDL_DATA_INCLUDE)
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

    const json = await res.json() as {
      data?: Record<string, unknown>
      likelihood?: number
      matched?: string[]
    }
    const person = json.data
    if (!person) {
      return emptyResult('No contact signal found from People Data Labs.', request)
    }

    const signals = mapSignals(person)
    const providerRecordId = typeof person.id === 'string' ? person.id : undefined
    const providerMatchLikelihood = Number.isFinite(json.likelihood) ? json.likelihood : undefined
    const providerMatchedFields = Array.isArray(json.matched)
      ? json.matched.filter(field => typeof field === 'string').slice(0, 24)
      : undefined

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
        providerRecordId,
        providerMatchLikelihood,
        providerMatchedFields,
        persistenceMode: 'none',
      },
    }
  } catch {
    // Never surface raw network/provider errors
    return emptyResult('Could not reach the contact enrichment provider. Try again later.', request, ['Network error reaching provider.'])
  }
}
