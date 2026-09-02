// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/providers/people-data-labs.ts — Live PDL adapter.
//
// SERVER-ONLY. Never import in a client component.
//   - Reads PDL_API_KEY from process.env (never NEXT_PUBLIC_)
//   - API key sent via X-Api-Key header, never logged, never returned to client
//   - Conservative professional-field request only — no protected attributes
//   - Ownership, deliverability, and outreach permission remain separate
//   - Raw provider errors and full payloads never reach the client
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import {
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ContactOwnershipConfidence,
  ContactSignal,
  ProviderMatchMetadata,
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
    match: { matchState: 'no_match', matchedOn: [] },
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
  if (request.companyDomain) params.set('company', request.companyDomain)
  if (request.location) params.set('location', request.location)
  if (request.title) params.set('title', request.title)
  const profile = request.linkedinUrl || request.profileUrl || request.githubUrl
  if (profile) params.append('profile', profile)
  params.set('min_likelihood', '6')
  // Ask PDL which supplied field categories participated in the match. We retain
  // field names only, not a full raw payload or unnecessary matched values.
  params.set('include_if_matched', 'true')
  return params
}

function matchedFieldNames(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean))).slice(0, 12)
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, matched]) => matched !== false && matched !== null && matched !== undefined && matched !== '')
      .map(([field]) => field.trim())
      .filter(Boolean)
      .slice(0, 12)
  }
  return []
}

function safeScore(value: unknown): number | undefined {
  const score = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(score) ? score : undefined
}

function pdlMatchMetadata(
  person: Record<string, unknown>,
  likelihoodValue: unknown,
  matchedValue: unknown,
): ProviderMatchMetadata {
  const providerScore = safeScore(likelihoodValue)
  const matchedOn = matchedFieldNames(matchedValue)
  const profileMatched = matchedOn.some(field => /profile|linkedin|github/i.test(field))
  const matchState: ProviderMatchMetadata['matchState'] = profileMatched && (providerScore ?? 0) >= 6
    ? 'exact_anchor'
    : (providerScore ?? 0) >= 8
      ? 'strong'
      : (providerScore ?? 0) >= 6
        ? 'possible'
        : providerScore === undefined
          ? 'unknown'
          : 'no_match'
  const providerPersonId = typeof person.id === 'string' ? person.id.trim().slice(0, 200) : undefined
  return {
    matchState,
    ...(providerPersonId ? { providerPersonId } : {}),
    ...(providerScore !== undefined ? { providerScore, providerScoreScale: '1-10' } : {}),
    matchedOn,
  }
}

function ownershipFor(match: ProviderMatchMetadata): ContactOwnershipConfidence {
  if (match.matchState === 'exact_anchor' || match.matchState === 'strong') return 'strong'
  if (match.matchState === 'possible') return 'moderate'
  if (match.matchState === 'conflict' || match.matchState === 'no_match') return 'unknown'
  return 'weak'
}

/** Map a PDL person record to normalized, compliant ContactSignal[]. */
function mapSignals(person: Record<string, unknown>, match: ProviderMatchMetadata): ContactSignal[] {
  const signals: ContactSignal[] = []
  const ownershipConfidence = ownershipFor(match)
  const providerRef = match.providerPersonId ? `pdl_person:${match.providerPersonId}` : undefined

  const emails = person.emails
  if (Array.isArray(emails)) {
    for (const e of emails) {
      const value = typeof e === 'string' ? e : (e?.address as string | undefined)
      if (value) {
        signals.push(makeContactSignal({
          type: 'email',
          value,
          sourceProvider: PROVIDER,
          confidence: match.matchState === 'strong' || match.matchState === 'exact_anchor' ? 'high' : 'medium',
          ownershipConfidence,
          deliverability: 'unknown',
          rawSource: providerRef,
          notes: 'Discovered via People Data Labs. Identity-match confidence and email deliverability are separate; permission remains unknown.',
        }))
      }
    }
  }

  const phones = person.phone_numbers
  if (Array.isArray(phones)) {
    for (const p of phones) {
      const value = typeof p === 'string' ? p : (p?.number as string | undefined)
      if (value) {
        signals.push(makeContactSignal({
          type: 'phone',
          value,
          sourceProvider: PROVIDER,
          confidence: 'low',
          ownershipConfidence,
          deliverability: 'unknown',
          rawSource: providerRef,
          notes: 'Discovered via People Data Labs. Unverified phone signal; permission remains unknown.',
        }))
      }
    }
  }

  if (typeof person.linkedin_url === 'string') {
    signals.push(makeContactSignal({
      type: 'social_url',
      value: person.linkedin_url,
      sourceProvider: PROVIDER,
      confidence: ownershipConfidence === 'strong' ? 'high' : 'medium',
      ownershipConfidence,
      rawSource: providerRef,
    }))
  }
  if (typeof person.github_url === 'string') {
    signals.push(makeContactSignal({
      type: 'profile_url',
      value: person.github_url,
      sourceProvider: PROVIDER,
      confidence: ownershipConfidence === 'strong' ? 'high' : 'medium',
      ownershipConfidence,
      rawSource: providerRef,
    }))
  }
  const jobDomain = person.job_company_website as string | undefined
  if (jobDomain) {
    signals.push(makeContactSignal({
      type: 'company_domain',
      value: jobDomain,
      sourceProvider: PROVIDER,
      confidence: 'low',
      ownershipConfidence,
      rawSource: providerRef,
    }))
  }

  const seen = new Set<string>()
  return signals.filter(signal => {
    const key = `${signal.type}:${signal.value.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function enrichWithPeopleDataLabs(
  request: ContactEnrichmentRequest,
): Promise<ContactEnrichmentResult> {
  const key = process.env.PDL_API_KEY

  if (!key) {
    return {
      provider: PROVIDER,
      providerConfigured: false,
      message: 'Contact enrichment provider not configured yet.',
      signals: [],
      match: { matchState: 'unknown', matchedOn: [] },
      log: {
        provider: PROVIDER,
        attemptedAt: new Date().toISOString(),
        fieldsUsed: enrichmentFieldsUsed(request),
        resultCount: 0,
        warnings: ['PDL_API_KEY not set.'],
        persistenceMode: 'none',
      },
    }
  }

  const params = buildParams(request)

  try {
    const res = await fetch(`${PDL_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (res.status === 404) {
      return emptyResult(
        'No contact signal found from People Data Labs. Try adding a company domain or source profile URL.',
        request,
      )
    }

    if (res.status === 401 || res.status === 403) {
      return emptyResult('Contact enrichment provider rejected the request. Check provider configuration.', request, ['Provider auth error.'])
    }

    if (res.status === 429) {
      return emptyResult('Contact enrichment rate limit reached. Try again shortly.', request, ['Provider rate limited.'])
    }

    if (!res.ok) {
      return emptyResult('Contact enrichment service is unavailable right now. Try again later.', request, [`Provider status ${res.status}.`])
    }

    const json = await res.json() as {
      data?: Record<string, unknown>
      likelihood?: number
      matched?: unknown
    }
    const person = json.data
    if (!person) {
      return emptyResult('No contact signal found from People Data Labs.', request)
    }

    const match = pdlMatchMetadata(person, json.likelihood, json.matched)
    const signals = mapSignals(person, match)

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: signals.length > 0
        ? `Found ${signals.length} unverified contact signal${signals.length !== 1 ? 's' : ''}.`
        : 'A profile match was found but no contact signals were available.',
      signals,
      match,
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
    return emptyResult('Could not reach the contact enrichment provider. Try again later.', request, ['Network error reaching provider.'])
  }
}
