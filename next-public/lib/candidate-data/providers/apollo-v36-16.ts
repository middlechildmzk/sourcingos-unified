import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'apollo' as const
const ENDPOINT = 'https://api.apollo.io/api/v1/mixed_people/api_search'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function unique(values: Array<string | undefined>, max = 50): string[] {
  return Array.from(new Set(values.filter(Boolean).map(value => value!.trim()).filter(Boolean))).slice(0, max)
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function companyMatches(actual: string | undefined, expected: string[]): boolean {
  if (!expected.length) return true
  const actualNormalized = normalized(actual || '')
  if (!actualNormalized) return false
  return expected.some(company => {
    const wanted = normalized(company)
    return Boolean(wanted && (actualNormalized === wanted || actualNormalized.includes(wanted) || wanted.includes(actualNormalized)))
  })
}

export function buildApolloPeopleSearchUrlV36_16(request: CandidateDataSearchRequestV36_8): string {
  const params = new URLSearchParams()
  const limit = safeCandidateSearchLimitV36_8(request.limit)
  const page = Math.max(1, Math.floor(Math.max(0, request.offset || 0) / Math.max(1, limit)) + 1)

  for (const title of unique(request.titles || [], 25)) params.append('person_titles[]', title)
  if ((request.titles || []).length) params.set('include_similar_titles', 'false')
  for (const location of unique(request.locations || [], 25)) params.append('person_locations[]', location)
  if (request.names?.length === 1) params.set('q_person_name', request.names[0])

  const keywordParts = unique([
    ...(request.skills || []),
    ...(request.requirements || []).filter(item => item.mustHave).map(item => item.text),
    ...(request.companies || []),
  ], 40)
  if (keywordParts.length) params.set('q_keywords', keywordParts.join(' '))

  params.set('page', String(page))
  params.set('per_page', String(limit))
  return `${ENDPOINT}?${params.toString()}`
}

function profileUrls(person: JsonRecord): CandidateProviderProfileUrlV36_8[] {
  const candidates = [person.linkedin_url, person.linkedin_url_status ? undefined : person.profile_url]
  const out: CandidateProviderProfileUrlV36_8[] = []
  for (const candidate of candidates) {
    const raw = str(candidate)
    if (!raw) continue
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      const host = url.hostname.toLowerCase()
      const kind: CandidateProviderProfileUrlV36_8['kind'] = host.includes('linkedin.com') ? 'linkedin' : 'other'
      if (!out.some(item => item.url === url.toString())) out.push({ kind, url: url.toString() })
    } catch { /* malformed provider URL ignored */ }
  }
  return out
}

function displayName(person: JsonRecord): string | undefined {
  const direct = str(person.name)
  if (direct) return direct
  const first = str(person.first_name)
  const last = str(person.last_name) || str(person.last_name_obfuscated)
  return unique([first, last], 2).join(' ') || undefined
}

function location(person: JsonRecord): string | undefined {
  return unique([str(person.city), str(person.state), str(person.country)], 3).join(', ') || undefined
}

function toObservation(person: JsonRecord): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(person.id) || str(person.person_id)
  const name = displayName(person)
  if (!providerPersonId || !name) return undefined
  const organization = record(person.organization)
  const currentEmployer = str(organization.name) || str(person.organization_name)
  const hasEmail = bool(person.has_email)
  const directPhoneRaw = person.has_direct_phone
  const hasPhone = typeof directPhoneRaw === 'boolean' ? directPhoneRaw : str(directPhoneRaw) ? true : undefined

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName: name,
    headline: str(person.headline) || str(person.title),
    currentTitle: str(person.title),
    currentEmployer,
    location: location(person),
    skills: [],
    profileUrls: profileUrls(person),
    // Search only exposes availability indicators. Actual values require an explicit enrichment call.
    contactAvailability: { email: hasEmail ?? 'unknown', phone: hasPhone ?? 'unknown' },
    refreshedAt: str(person.last_refreshed_at),
    providerExplanation: 'Apollo People API Search is a zero-credit discovery lane. Search does not return email or phone values; skills/keywords are retrieval criteria, not candidate evidence.',
    observedAt: new Date().toISOString(),
  }
}

export async function searchApolloPeopleV36_16(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.APOLLO_API_KEY
  if (!key) return {
    observations: [],
    telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, estimatedCredits: 0, message: 'APOLLO_API_KEY is not configured.' },
    warnings: ['Apollo People Search unavailable: provider key missing.'],
  }

  try {
    const response = await fetch(buildApolloPeopleSearchUrlV36_16(request), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-api-key': key,
      },
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, estimatedCredits: 0, message: `Apollo returned HTTP ${response.status}.` },
        warnings: [`Apollo People Search failed with status ${response.status}. Check scoped API access/work-email account requirements before escalating permissions.`],
      }
    }

    const payload = record(await response.json())
    const people = Array.isArray(payload.people) ? payload.people.map(record) : []
    const expectedCompanies = unique(request.companies || [], 20)
    const observations = people
      .map(toObservation)
      .filter(Boolean)
      .filter(item => companyMatches(item!.currentEmployer, expectedCompanies)) as CandidateProviderObservationV36_8[]

    const warnings: string[] = []
    if (expectedCompanies.length && observations.length < people.length) {
      warnings.push('Apollo has no direct people-search company-name filter in this contract; SourcingOS applied a current-employer post-filter so company constraints were not silently weakened.')
    }
    if (request.highFreshness) warnings.push('Apollo People Search is indexed discovery. Freshness refresh and contact enrichment remain separate explicit tools.')

    return {
      observations,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: observations.length,
        latencyMs: Date.now() - started,
        estimatedCredits: 0,
        message: `Apollo People Search returned ${observations.length} retained discovery observation${observations.length === 1 ? '' : 's'} without revealing contact values.`,
      },
      nextOffset: Math.max(0, Math.trunc(request.offset || 0)) + observations.length,
      warnings,
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, estimatedCredits: 0, message: 'Could not reach Apollo People Search.' },
      warnings: ['Network or response error reaching Apollo People Search.'],
    }
  }
}
