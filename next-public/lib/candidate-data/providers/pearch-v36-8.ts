import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const ENDPOINT = 'https://api.pearch.ai/v2/search'
const PROVIDER = 'pearch' as const

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function strings(value: unknown, max = 30): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.flatMap(item => {
    if (typeof item === 'string') return [item.trim()]
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      return [str(record.name), str(record.label), str(record.skill)].filter(Boolean) as string[]
    }
    return []
  }).filter(Boolean))).slice(0, max)
}

function urlKind(url: string): CandidateProviderProfileUrlV36_8['kind'] {
  const lower = url.toLowerCase()
  if (lower.includes('linkedin.com/')) return 'linkedin'
  if (lower.includes('github.com/')) return 'github'
  if (lower.includes('stackoverflow.com/')) return 'stackoverflow'
  return 'other'
}

function urlsFromRecord(record: Record<string, unknown>): CandidateProviderProfileUrlV36_8[] {
  const candidates = [
    record.linkedin_url, record.linkedin, record.github_url, record.github,
    record.profile_url, record.url, record.website, record.personal_website,
    ...(Array.isArray(record.social_urls) ? record.social_urls : []),
    ...(Array.isArray(record.profiles) ? record.profiles.flatMap(item => item && typeof item === 'object' ? [(item as Record<string, unknown>).url] : [item]) : []),
  ]
  const seen = new Set<string>()
  const out: CandidateProviderProfileUrlV36_8[] = []
  for (const item of candidates) {
    const value = str(item)
    if (!value || seen.has(value)) continue
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
      seen.add(value)
      out.push({ kind: urlKind(value), url: parsed.toString() })
    } catch {
      // Ignore malformed provider URLs rather than passing them to the client.
    }
  }
  return out.slice(0, 12)
}

function profileRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
  const candidates = [payload.profiles, payload.results, payload.data]
  for (const value of candidates) {
    if (Array.isArray(value)) return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>
      for (const nestedValue of [nested.profiles, nested.results, nested.items]) {
        if (Array.isArray(nestedValue)) return nestedValue.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
      }
    }
  }
  return []
}

function toObservation(record: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(record.docid) || str(record.id) || str(record.profile_id) || str(record.person_id)
  const displayName = str(record.name) || str(record.full_name) || str(record.display_name)
  if (!providerPersonId || !displayName) return undefined

  const emails = Array.isArray(record.emails) ? record.emails : []
  const phones = Array.isArray(record.phone_numbers) ? record.phone_numbers : Array.isArray(record.phones) ? record.phones : []
  const hasEmail = typeof record.has_email === 'boolean' ? record.has_email : emails.length ? true : 'unknown'
  const hasPhone = typeof record.has_phone_numbers === 'boolean' ? record.has_phone_numbers : phones.length ? true : 'unknown'

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    headline: str(record.headline) || str(record.summary),
    currentTitle: str(record.current_title) || str(record.job_title) || str(record.title),
    currentEmployer: str(record.current_company) || str(record.current_employer) || str(record.company),
    location: str(record.location) || str(record.location_name),
    skills: strings(record.skills),
    profileUrls: urlsFromRecord(record),
    contactAvailability: { email: hasEmail, phone: hasPhone },
    providerRetrievalScore: num(record.score),
    providerScoreScale: num(record.score) === undefined ? undefined : 'provider_native',
    providerExplanation: str(record.short_rationale) || str(record.rationale) || str(record.overall_summary),
    refreshedAt: str(record.refreshed_at) || str(record.updated_at),
    observedAt: new Date().toISOString(),
  }
}

export function buildPearchSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const limit = safeCandidateSearchLimitV36_8(request.limit)
  const body: Record<string, unknown> = {
    type: 'fast',
    limit,
    offset: Math.max(0, Math.trunc(request.offset || 0)),
    insights: false,
    profile_scoring: true,
    high_freshness: Boolean(request.highFreshness),
    reveal_emails: Boolean(request.revealContact),
    reveal_phones: Boolean(request.revealContact),
    fill_with_low_confidence_results: false,
  }
  if (request.requirements?.length) {
    body.search_requirements = request.requirements.slice(0, 30).map(item => ({ requirement: item.text.slice(0, 300), must_have: item.mustHave }))
  } else {
    body.query = request.query.slice(0, 3000)
  }
  if (request.locations?.length) body.custom_filters = { locations: request.locations.slice(0, 20) }
  if (request.providerPersonBlacklist?.length) body.docid_blacklist = request.providerPersonBlacklist.slice(0, 1000)
  return body
}

export async function searchPearchV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.PEARCH_API_KEY
  if (!key) {
    return { observations: [], telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'PEARCH_API_KEY is not configured.' }, warnings: ['Pearch search unavailable: provider key missing.'] }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPearchSearchBodyV36_8(request)),
      cache: 'no-store',
    })
    if (!response.ok) {
      return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `Pearch returned HTTP ${response.status}.` }, warnings: [`Pearch search failed with status ${response.status}.`] }
    }

    const payload = await response.json() as Record<string, unknown>
    const observations = profileRecords(payload).map(toObservation).filter(Boolean) as CandidateProviderObservationV36_8[]
    const credits = num(payload.credits_charged) || num((payload.usage as Record<string, unknown> | undefined)?.credits)
    return {
      observations,
      telemetry: { provider: PROVIDER, status: 'completed', discovered: observations.length, latencyMs: Date.now() - started, ...(credits !== undefined ? { estimatedCredits: credits } : {}), message: 'Provider retrieval only; Pearch scores do not establish SourcingOS qualification.' },
      nextOffset: Math.max(0, Math.trunc(request.offset || 0)) + observations.length,
      threadId: str(payload.thread_id),
      warnings: [],
    }
  } catch {
    return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach Pearch.' }, warnings: ['Network error reaching Pearch.'] }
  }
}
