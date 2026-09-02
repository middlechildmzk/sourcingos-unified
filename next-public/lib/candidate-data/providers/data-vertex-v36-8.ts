import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const ENDPOINT = 'https://api.data-vertex.com/v1/search'
const PROVIDER = 'data_vertex' as const

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function buildDataVertexSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const limit = safeCandidateSearchLimitV36_8(request.limit)
  const query = request.query.replace(/\s+/g, ' ').trim().slice(0, 300)
  const searchCriteria: Record<string, string[]> = {}
  if (request.locations?.length) searchCriteria.location = request.locations.slice(0, 20)

  return {
    free_text_search: query,
    ...(Object.keys(searchCriteria).length ? { search_criteria: searchCriteria } : {}),
    page_size: limit,
    start: Math.max(1, Math.trunc(request.offset || 0) + 1),
    // Search expansion belongs to SourcingOS and must be recruiter-controlled.
    include_similar_titles: false,
  }
}

function observation(record: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(record.id)
  const displayName = str(record.name)
  if (!providerPersonId || !displayName) return undefined
  const linkedin = str(record.linkedin_url)
  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    currentTitle: str(record.current_title),
    headline: str(record.headline) || str(record.current_title),
    currentEmployer: str(record.current_employer),
    location: str(record.location),
    skills: [],
    profileUrls: linkedin ? [{ kind: 'linkedin', url: linkedin }] : [],
    // Candidate Search does not reveal contacts; Lookup is an explicit paid lane.
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    observedAt: new Date().toISOString(),
  }
}

export async function searchDataVertexV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.DATAVERTEX_API_KEY
  if (!key) {
    return { observations: [], telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'DATAVERTEX_API_KEY is not configured.' }, warnings: ['DataVertex search unavailable: provider key missing.'] }
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDataVertexSearchBodyV36_8(request)),
      cache: 'no-store',
    })
    if (!response.ok) {
      return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `DataVertex returned HTTP ${response.status}.` }, warnings: [`DataVertex search failed with status ${response.status}.`] }
    }

    const payload = await response.json() as Record<string, unknown>
    const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
    const records = Array.isArray(data.profiles) ? data.profiles.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
    const observations = records.map(observation).filter(Boolean) as CandidateProviderObservationV36_8[]
    const pagination = data.pagination && typeof data.pagination === 'object' ? data.pagination as Record<string, unknown> : {}
    const nextStart = num(pagination.next_start)
    const credits = payload.credits && typeof payload.credits === 'object' ? num((payload.credits as Record<string, unknown>).used) : undefined

    return {
      observations,
      telemetry: { provider: PROVIDER, status: 'completed', discovered: observations.length, latencyMs: Date.now() - started, ...(credits !== undefined ? { estimatedCredits: credits } : {}), message: 'DataVertex search results are retrieval observations; contact lookup is a separate explicit enrichment action.' },
      ...(nextStart !== undefined ? { nextOffset: Math.max(0, nextStart - 1) } : {}),
      warnings: [],
    }
  } catch {
    return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach DataVertex.' }, warnings: ['Network error reaching DataVertex.'] }
  }
}
