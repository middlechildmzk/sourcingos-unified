import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'people_data_labs' as const
const ENDPOINT = 'https://api.peopledatalabs.com/v5/person/search'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function strings(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(str).filter(Boolean) as string[])).slice(0, max)
}

function normalizeTerms(values: string[] | undefined, max: number): string[] {
  return Array.from(new Set((values || []).map(value => value.trim().toLowerCase()).filter(Boolean))).slice(0, max)
}

function simplePersonName(value: string): string | undefined {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  const tokens = cleaned.split(' ').filter(Boolean)
  if (tokens.length < 2 || tokens.length > 4) return undefined
  if (!tokens.every(token => /^[\p{L}][\p{L}'’.\-]*$/u.test(token))) return undefined
  return cleaned.toLowerCase()
}

function oneOfMatch(field: string, values: string[]) {
  return {
    bool: {
      should: values.map(value => ({ match_phrase: { [field]: value } })),
      minimum_should_match: 1,
    },
  }
}

/**
 * PDL Search executes Elasticsearch directly against its dataset with no query
 * cleaning. SourcingOS therefore sends only bounded structured fields. A plain
 * 2-4 token person name is also safe to map to the documented full_name field.
 */
export function buildPeopleDataLabsSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const names = normalizeTerms(request.names, 20)
  const inferredName = !names.length ? simplePersonName(request.query) : undefined
  const titles = normalizeTerms(request.titles, 30)
  const skills = normalizeTerms(request.skills, 40)
  const locations = normalizeTerms(request.locations, 30)
  const must: Record<string, unknown>[] = []

  if (names.length || inferredName) must.push(oneOfMatch('full_name', names.length ? names : [inferredName!]))
  if (titles.length) must.push(oneOfMatch('job_title', titles))
  if (skills.length) must.push(oneOfMatch('skills', skills))
  if (locations.length) must.push(oneOfMatch('location_name', locations))

  const query = must.length
    ? { bool: { must } }
    : { match_none: {} }

  return {
    size: safeCandidateSearchLimitV36_8(request.limit),
    dataset: 'resume',
    titlecase: true,
    query,
  }
}

function profileUrls(row: Record<string, unknown>): CandidateProviderProfileUrlV36_8[] {
  const candidates: CandidateProviderProfileUrlV36_8[] = []
  const add = (kind: CandidateProviderProfileUrlV36_8['kind'], value: unknown) => {
    const raw = str(value)
    if (!raw) return
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`
    try {
      const parsed = new URL(normalized)
      if (!['http:', 'https:'].includes(parsed.protocol)) return
      if (!candidates.some(item => item.url === parsed.toString())) candidates.push({ kind, url: parsed.toString() })
    } catch { /* malformed provider URL ignored */ }
  }

  add('linkedin', row.linkedin_url)
  add('github', row.github_url)
  add('other', row.twitter_url)
  for (const item of Array.isArray(row.profiles) ? row.profiles : []) {
    const profile = record(item)
    const network = (str(profile.network) || '').toLowerCase()
    const kind: CandidateProviderProfileUrlV36_8['kind'] = network === 'linkedin'
      ? 'linkedin'
      : network === 'github'
        ? 'github'
        : network === 'stackoverflow'
          ? 'stackoverflow'
          : 'other'
    add(kind, profile.url)
  }
  return candidates.slice(0, 12)
}

function toObservation(row: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(row.id)
  const displayName = str(row.full_name)
  if (!providerPersonId || !displayName) return undefined

  const personalEmails = Array.isArray(row.personal_emails) ? row.personal_emails : []
  const phoneNumbers = Array.isArray(row.phone_numbers) ? row.phone_numbers : []
  const emailAvailable = Boolean(str(row.work_email) || str(row.recommended_personal_email) || personalEmails.length)
  const phoneAvailable = Boolean(str(row.mobile_phone) || phoneNumbers.length)

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    headline: str(row.job_title),
    currentTitle: str(row.job_title),
    currentEmployer: str(row.job_company_name),
    location: str(row.location_name),
    skills: strings(row.skills),
    profileUrls: profileUrls(row),
    contactAvailability: { email: emailAvailable, phone: phoneAvailable },
    refreshedAt: str(row.job_last_verified) || str(row.location_last_updated),
    observedAt: new Date().toISOString(),
  }
}

function safeProviderError(payload: unknown): string | undefined {
  const root = record(payload)
  const error = root.error
  const nested = record(error)
  const candidate = str(root.message) || str(nested.message) || str(root.detail) || str(error)
  if (!candidate) return undefined
  return candidate.replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]').slice(0, 240)
}

export async function searchPeopleDataLabsV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.PDL_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY
  if (!key) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'PDL_API_KEY is not configured.' },
      warnings: ['People Data Labs Person Search unavailable: provider key missing.'],
    }
  }

  const body = buildPeopleDataLabsSearchBodyV36_8(request)
  if ('match_none' in body.query) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'skipped', discovered: 0, latencyMs: 0, message: 'PDL Search skipped because no safe person-name, title, skill, or location anchor was supplied.' },
      warnings: ['PDL Search needs a person name or structured professional fields; arbitrary recruiter prose is not forwarded as Elasticsearch syntax.'],
    }
  }

  try {
    // PDL's current Person Search contract documents GET with the Elasticsearch
    // query serialized in the `query` request parameter. Do not POST a legacy
    // body or send the unsupported legacy `from` offset field.
    const url = new URL(ENDPOINT)
    url.searchParams.set('query', JSON.stringify(body.query))
    url.searchParams.set('size', String(body.size))
    url.searchParams.set('dataset', body.dataset)
    url.searchParams.set('titlecase', String(body.titlecase))

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => undefined)
      const reason = safeProviderError(payload)
      const suffix = reason ? ` ${reason}` : ''
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `People Data Labs returned HTTP ${response.status}.${suffix}`.trim() },
        warnings: [`PDL Person Search failed with status ${response.status}.${suffix}`.trim()],
      }
    }

    const payload = await response.json() as Record<string, unknown>
    const rows = Array.isArray(payload.data) ? payload.data.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
    const observations = rows.map(toObservation).filter(Boolean) as CandidateProviderObservationV36_8[]
    const scrollToken = str(payload.scroll_token)
    return {
      observations,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: observations.length,
        latencyMs: Date.now() - started,
        estimatedCredits: observations.length,
        message: 'PDL Person Search completed. Results are retrieval observations, not qualification decisions.',
      },
      ...(scrollToken ? { threadId: scrollToken } : {}),
      warnings: request.offset && request.offset > 0 ? ['PDL uses scroll_token cursor pagination; legacy numeric offset is intentionally not forwarded.'] : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach People Data Labs.' },
      warnings: ['Network error reaching PDL Person Search.'],
    }
  }
}
