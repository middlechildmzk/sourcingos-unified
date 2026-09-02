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
 * cleaning. SourcingOS therefore sends only bounded Role Brain fields instead
 * of forwarding raw recruiter prose as an Elasticsearch query.
 */
export function buildPeopleDataLabsSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const titles = normalizeTerms(request.titles, 30)
  const skills = normalizeTerms(request.skills, 40)
  const locations = normalizeTerms(request.locations, 30)
  const must: Record<string, unknown>[] = []

  if (titles.length) must.push(oneOfMatch('job_title', titles))
  if (skills.length) must.push(oneOfMatch('skills', skills))
  if (locations.length) must.push(oneOfMatch('location_name', locations))

  // The provider lane is intentionally unavailable when Role Brain has no
  // structured professional search terms. Do not reinterpret arbitrary prose
  // as Elasticsearch syntax or silently broaden it here.
  const query = must.length
    ? { bool: { must } }
    : { match_none: {} }

  return {
    size: safeCandidateSearchLimitV36_8(request.limit),
    from: Math.max(0, Math.min(9999, Math.trunc(request.offset || 0))),
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

export async function searchPeopleDataLabsV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.PDL_API_KEY
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
      telemetry: { provider: PROVIDER, status: 'skipped', discovered: 0, latencyMs: 0, message: 'PDL Search skipped because no structured Role Brain title, skill, or location terms were supplied.' },
      warnings: ['PDL Search requires structured Role Brain fields; raw recruiter prose is not sent as an Elasticsearch query.'],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `People Data Labs returned HTTP ${response.status}.` },
        warnings: [`PDL Person Search failed with status ${response.status}.`],
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
        message: 'PDL Person Search charges per returned profile. Results are retrieval observations, not qualification decisions.',
      },
      nextOffset: Math.max(0, Math.trunc(request.offset || 0)) + observations.length,
      ...(scrollToken ? { threadId: scrollToken } : {}),
      warnings: request.offset && request.offset > 0 ? ['PDL returned a scroll token; the current gateway still uses bounded legacy offset pagination and should migrate to provider cursors before deep paging.'] : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach People Data Labs.' },
      warnings: ['Network error reaching PDL Person Search.'],
    }
  }
}
