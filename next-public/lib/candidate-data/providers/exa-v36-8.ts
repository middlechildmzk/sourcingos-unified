import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const ENDPOINT = 'https://api.exa.ai/search'
const PROVIDER = 'exa' as const

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validHttpUrl(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function unique(values: string[], max: number): string[] {
  return Array.from(new Set(values.map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, max)
}

/** Exa People Search is natural-language only, so Role Brain owns all expansion. */
export function buildExaPeopleQueryV36_8(request: CandidateDataSearchRequestV36_8): string {
  const titles = unique(request.titles || [], 8)
  const skills = unique(request.skills || [], 12)
  const locations = unique(request.locations || [], 8)
  const mustHaves = unique((request.requirements || []).filter(item => item.mustHave).map(item => item.text), 8)
  const parts = [
    titles.length ? `Current role: ${titles.join(' OR ')}` : '',
    skills.length ? `Professional capabilities: ${skills.join(', ')}` : '',
    locations.length ? `Location: ${locations.join(' OR ')}` : '',
    mustHaves.length ? `Requirements to retrieve evidence for: ${mustHaves.join('; ')}` : '',
  ].filter(Boolean)
  // Raw recruiter prose is a fallback only when no approved structured Role Brain
  // fields exist; otherwise provider retrieval stays bound to approved structure.
  return (parts.length ? parts.join('. ') : request.query.replace(/\s+/g, ' ').trim()).slice(0, 1200)
}

export function buildExaPeopleSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  return {
    query: buildExaPeopleQueryV36_8(request),
    category: 'people' as const,
    type: 'auto' as const,
    numResults: safeCandidateSearchLimitV36_8(request.limit),
    contents: { highlights: true },
  }
}

function currentWork(properties: Record<string, unknown>): Record<string, unknown> | undefined {
  const history = Array.isArray(properties.workHistory)
    ? properties.workHistory.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
    : []
  return history.find(item => {
    const dates = item.dates && typeof item.dates === 'object' ? item.dates as Record<string, unknown> : {}
    return dates.to === null || dates.to === undefined
  }) || history[0]
}

function profileUrl(urlValue: unknown): CandidateProviderProfileUrlV36_8[] {
  const url = validHttpUrl(urlValue)
  if (!url) return []
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (hostname === 'linkedin.com' && /^\/in\//i.test(parsed.pathname)) return [{ kind: 'linkedin', url }]
    if (hostname === 'github.com') return [{ kind: 'github', url }]
    if (hostname.endsWith('stackoverflow.com')) return [{ kind: 'stackoverflow', url }]
    return [{ kind: 'personal', url }]
  } catch {
    return []
  }
}

function observation(result: Record<string, unknown>, observedAt: string): CandidateProviderObservationV36_8 | undefined {
  const entities = Array.isArray(result.entities) ? result.entities.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
  const person = entities.find(item => item.type === 'person')
  if (!person) return undefined
  const providerPersonId = str(person.id)
  const properties = person.properties && typeof person.properties === 'object' ? person.properties as Record<string, unknown> : {}
  const displayName = str(properties.name)
  if (!providerPersonId || !displayName) return undefined
  const work = currentWork(properties)
  const company = work?.company && typeof work.company === 'object' ? work.company as Record<string, unknown> : {}
  const currentTitle = str(work?.title)
  const resultTitle = str(result.title)

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    currentTitle,
    headline: currentTitle || resultTitle,
    currentEmployer: str(company.name),
    location: str(properties.location) || str(work?.location),
    // Exa's typed people entity currently exposes identity/work/education fields;
    // do not promote search terms or free-text highlights into candidate skills.
    skills: [],
    profileUrls: profileUrl(result.url),
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    providerExplanation: 'Exa People typed-entity observation. Free-text highlights are discovery context only and are not promoted into verified skills.',
    observedAt,
  }
}

export async function searchExaPeopleV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.EXA_API_KEY
  if (!key) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'EXA_API_KEY is not configured.' },
      warnings: ['Exa People Search unavailable: provider key missing.'],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(buildExaPeopleSearchBodyV36_8(request)),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `Exa returned HTTP ${response.status}.` },
        warnings: [`Exa People Search failed with status ${response.status}.`],
      }
    }

    const payload = await response.json() as Record<string, unknown>
    const records = Array.isArray(payload.results) ? payload.results.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
    const observedAt = new Date().toISOString()
    const observations = records.map(item => observation(item, observedAt)).filter(Boolean) as CandidateProviderObservationV36_8[]

    return {
      observations,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: observations.length,
        latencyMs: Date.now() - started,
        message: 'Exa People Search contributed typed person entities only. Query/highlight text remains retrieval context, not candidate qualification evidence.',
      },
      warnings: records.length > observations.length
        ? [`${records.length - observations.length} Exa result${records.length - observations.length === 1 ? '' : 's'} did not resolve to a typed person entity and were excluded from Candidate Graph admission.`]
        : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach Exa.' },
      warnings: ['Network error reaching Exa People Search.'],
    }
  }
}
