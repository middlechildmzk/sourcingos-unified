import 'server-only'
import {
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ContactOwnershipConfidence,
  ContactSignal,
  type ContactChannelKind,
  ProviderMatchMetadata,
  ResolvedProfessionalPerson,
  ResolvedProfessionalProfileUrl,
  enrichmentFieldsUsed,
  makeContactSignal,
} from '../types'

const PROVIDER = 'people_data_labs' as const
const PDL_ENDPOINT = 'https://api.peopledatalabs.com/v5/person/enrich'

export const PDL_DATA_INCLUDE_V35 = [
  'id',
  'likelihood',
  'full_name',
  'job_title',
  'job_company_name',
  'job_company_website',
  'location_name',
  'linkedin_url',
  'github_url',
  'website',
  'skills',
  'work_email',
  'recommended_personal_email',
  'emails.address',
  'emails.type',
  'emails.first_seen',
  'emails.last_seen',
  'mobile_phone',
  'phone_numbers',
  'profiles.url',
] as const

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

export function buildPeopleDataLabsParamsV35(request: ContactEnrichmentRequest): URLSearchParams {
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

  const profile = request.linkedinUrl || request.profileUrl || request.githubUrl
  if (profile) params.append('profile', profile)

  params.set('min_likelihood', '6')
  params.set('include_if_matched', 'true')
  params.set('data_include', PDL_DATA_INCLUDE_V35.join(','))
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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function strings(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(stringValue).filter(Boolean) as string[])).slice(0, max)
}

function safeHttp(value: unknown): string | undefined {
  const raw = stringValue(value)
  if (!raw) return undefined
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function resolvedPerson(person: Record<string, unknown>, match: ProviderMatchMetadata): ResolvedProfessionalPerson | undefined {
  const displayName = stringValue(person.full_name)
  if (!displayName) return undefined
  const profileUrls: ResolvedProfessionalProfileUrl[] = []
  const add = (kind: ResolvedProfessionalProfileUrl['kind'], value: unknown) => {
    const url = safeHttp(value)
    if (!url || profileUrls.some(item => item.url === url)) return
    profileUrls.push({ kind, url })
  }
  add('linkedin', person.linkedin_url)
  add('github', person.github_url)
  add('personal', person.website)
  for (const item of Array.isArray(person.profiles) ? person.profiles : []) {
    const profile = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    add('other', profile.url)
  }
  return {
    ...(match.providerPersonId ? { providerPersonId: match.providerPersonId } : {}),
    displayName,
    currentTitle: stringValue(person.job_title),
    currentEmployer: stringValue(person.job_company_name),
    location: stringValue(person.location_name),
    skills: strings(person.skills),
    profileUrls: profileUrls.slice(0, 12),
  }
}

function emailKind(value: unknown): ContactChannelKind {
  const type = String(value || '').toLowerCase()
  if (/work|professional|business/.test(type)) return 'work_email'
  if (/personal|private/.test(type)) return 'personal_email'
  return 'other_email'
}

function phoneKind(value: unknown): ContactChannelKind {
  const type = String(value || '').toLowerCase()
  if (/mobile|cell/.test(type)) return 'mobile_phone'
  if (/work|office|business/.test(type)) return 'work_phone'
  if (/home|residential/.test(type)) return 'home_phone'
  return 'other_phone'
}

function mapSignals(person: Record<string, unknown>, match: ProviderMatchMetadata): ContactSignal[] {
  const signals: ContactSignal[] = []
  const ownershipConfidence = ownershipFor(match)
  const providerRef = match.providerPersonId ? `pdl_person:${match.providerPersonId}` : undefined
  const confidence = match.matchState === 'strong' || match.matchState === 'exact_anchor' ? 'high' : 'medium'

  const addEmail = (value: unknown, channelKind: ContactChannelKind, notes: string) => {
    const email = stringValue(value)
    if (!email) return
    signals.push(makeContactSignal({
      type: 'email', channelKind, value: email, sourceProvider: PROVIDER,
      confidence, ownershipConfidence, deliverability: 'unknown', rawSource: providerRef, notes,
    }))
  }
  const addPhone = (value: unknown, channelKind: ContactChannelKind, notes: string) => {
    const phone = stringValue(value)
    if (!phone) return
    signals.push(makeContactSignal({
      type: 'phone', channelKind, value: phone, sourceProvider: PROVIDER,
      confidence: channelKind === 'mobile_phone' ? confidence : 'low', ownershipConfidence,
      deliverability: 'unknown', rawSource: providerRef, notes,
    }))
  }

  // Direct normalized fields are intentionally admitted first so a later less-
  // specific array duplicate cannot downgrade their channel semantics.
  addEmail(person.work_email, 'work_email', 'People Data Labs explicitly returned work_email. Identity ownership, deliverability, and permission remain separate.')
  addEmail(person.recommended_personal_email, 'personal_email', 'People Data Labs explicitly returned recommended_personal_email. Provider recommendation does not imply verification or outreach permission.')
  addPhone(person.mobile_phone, 'mobile_phone', 'People Data Labs explicitly returned mobile_phone. Permission remains unknown.')

  for (const e of Array.isArray(person.emails) ? person.emails : []) {
    const row = e && typeof e === 'object' ? e as Record<string, unknown> : {}
    const value = typeof e === 'string' ? e : row.address
    addEmail(value, emailKind(row.type), 'People Data Labs email-array observation. Provider type is preserved when supplied; permission remains unknown.')
  }

  for (const p of Array.isArray(person.phone_numbers) ? person.phone_numbers : []) {
    const row = p && typeof p === 'object' ? p as Record<string, unknown> : {}
    const value = typeof p === 'string' ? p : row.number || row.value
    addPhone(value, phoneKind(row.type || row.sub_type || row.subType), 'People Data Labs phone-array observation. Provider subtype is preserved when supplied; permission remains unknown.')
  }

  if (typeof person.linkedin_url === 'string') {
    signals.push(makeContactSignal({
      type: 'social_url', channelKind: 'professional_profile', value: person.linkedin_url,
      sourceProvider: PROVIDER, confidence: ownershipConfidence === 'strong' ? 'high' : 'medium',
      ownershipConfidence, rawSource: providerRef,
    }))
  }
  if (typeof person.github_url === 'string') {
    signals.push(makeContactSignal({
      type: 'profile_url', channelKind: 'professional_profile', value: person.github_url,
      sourceProvider: PROVIDER, confidence: ownershipConfidence === 'strong' ? 'high' : 'medium',
      ownershipConfidence, rawSource: providerRef,
    }))
  }
  const jobDomain = person.job_company_website as string | undefined
  if (jobDomain) {
    signals.push(makeContactSignal({
      type: 'company_domain', channelKind: 'company_domain', value: jobDomain,
      sourceProvider: PROVIDER, confidence: 'low', ownershipConfidence, rawSource: providerRef,
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

  const params = buildPeopleDataLabsParamsV35(request)

  try {
    const res = await fetch(`${PDL_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (res.status === 404) {
      return emptyResult('No contact signal found from People Data Labs. Try adding a company domain or source profile URL.', request)
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

    const json = await res.json() as { data?: Record<string, unknown>; likelihood?: number; matched?: unknown }
    const person = json.data
    if (!person) return emptyResult('No contact signal found from People Data Labs.', request)

    const match = pdlMatchMetadata(person, json.likelihood, json.matched)
    const signals = mapSignals(person, match)
    const professionalPerson = resolvedPerson(person, match)

    return {
      provider: PROVIDER,
      providerConfigured: true,
      message: professionalPerson
        ? `${professionalPerson.displayName} resolved from People Data Labs${signals.length ? ` with ${signals.length} unverified contact/profile signal${signals.length === 1 ? '' : 's'}` : ''}.`
        : signals.length > 0
          ? `Found ${signals.length} unverified contact signal${signals.length !== 1 ? 's' : ''}.`
          : 'A profile match was found but no contact signals were available.',
      signals,
      match,
      person: professionalPerson,
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
