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
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function strings(value: unknown, max = 30): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.flatMap(item => {
    if (typeof item === 'string') return [item.trim()]
    const row = record(item)
    return [str(row.name), str(row.label), str(row.skill), str(row.canonical_name)].filter(Boolean) as string[]
  }).filter(Boolean))).slice(0, max)
}
function urlKind(url: string): CandidateProviderProfileUrlV36_8['kind'] {
  const lower = url.toLowerCase()
  if (lower.includes('linkedin.com/')) return 'linkedin'
  if (lower.includes('github.com/')) return 'github'
  if (lower.includes('stackoverflow.com/')) return 'stackoverflow'
  return 'other'
}
function urlsFromRecord(profile: Record<string, unknown>): CandidateProviderProfileUrlV36_8[] {
  const linkedinSlug = str(profile.linkedin_slug)
  const candidates = [
    profile.linkedin_url,
    linkedinSlug ? `https://www.linkedin.com/in/${linkedinSlug}` : undefined,
    profile.github_url,
    profile.profile_url,
    profile.url,
    profile.website,
    profile.personal_website,
    ...(Array.isArray(profile.social_urls) ? profile.social_urls : []),
  ]
  const seen = new Set<string>()
  const out: CandidateProviderProfileUrlV36_8[] = []
  for (const item of candidates) {
    const value = str(item)
    if (!value || seen.has(value)) continue
    try {
      const parsed = new URL(value)
      if (!['https:', 'http:'].includes(parsed.protocol)) continue
      seen.add(value)
      out.push({ kind: urlKind(value), url: parsed.toString() })
    } catch { /* malformed provider URL ignored */ }
  }
  return out.slice(0, 12)
}

function searchResultRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(payload.search_results)
    ? payload.search_results.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
    : []
}

function toObservation(result: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const profile = record(result.profile)
  const providerPersonId = str(result.docid) || str(profile.docid)
  const firstName = str(profile.first_name)
  const middleName = str(profile.middle_name)
  const lastName = str(profile.last_name)
  const displayName = str(profile.full_name) || [firstName, middleName, lastName].filter(Boolean).join(' ') || str(profile.name)
  if (!providerPersonId || !displayName) return undefined

  const emails = Array.isArray(profile.emails) ? profile.emails : []
  const phones = Array.isArray(profile.phone_numbers) ? profile.phone_numbers : Array.isArray(profile.phones) ? profile.phones : []
  const hasEmail = typeof profile.has_email === 'boolean' ? profile.has_email : emails.length ? true : 'unknown'
  const hasPhone = typeof profile.has_phone_numbers === 'boolean' ? profile.has_phone_numbers : phones.length ? true : 'unknown'
  const currentExperience = Array.isArray(profile.experience)
    ? profile.experience.find(item => record(item).is_current === true) as Record<string, unknown> | undefined
    : undefined
  const current = record(currentExperience)
  const currentCompany = record(current.company)
  const insights = record(result.insights)

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    headline: str(profile.title) || str(profile.headline) || str(profile.summary),
    currentTitle: str(current.title) || str(profile.current_title) || str(profile.title),
    currentEmployer: str(current.company_name) || str(currentCompany.name) || str(profile.current_company),
    location: str(profile.location) || str(profile.location_name),
    skills: strings(profile.skills || profile.canonical_skills),
    profileUrls: urlsFromRecord(profile),
    contactAvailability: { email: hasEmail, phone: hasPhone },
    providerRetrievalScore: num(result.score),
    providerScoreScale: num(result.score) === undefined ? undefined : '0-100 provider relevance',
    providerExplanation: str(insights.short_rationale) || str(insights.rationale) || str(insights.overall_summary),
    refreshedAt: str(profile.updated_at) || str(profile.refreshed_at),
    observedAt: new Date().toISOString(),
  }
}

export function buildPearchSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const body: Record<string, unknown> = {
    type: 'fast',
    limit: safeCandidateSearchLimitV36_8(request.limit),
    offset: Math.max(0, Math.trunc(request.offset || 0)),
    insights: false,
    profile_scoring: true,
    high_freshness: Boolean(request.highFreshness),
    reveal_emails: Boolean(request.revealContact),
    reveal_phones: Boolean(request.revealContact),
    fill_with_low_confidence_results: false,
  }
  if (request.requirements?.length) {
    body.search_requirements = request.requirements.slice(0, 30).map(item => ({
      search_requirement: item.text.slice(0, 300),
      must_have: item.mustHave,
    }))
  } else {
    body.query = request.query.slice(0, 3000)
  }
  if (request.locations?.length) {
    body.custom_filters = { locations: request.locations.slice(0, 20) }
    body.custom_filters_mode = 'exact'
  }
  if (request.providerPersonBlacklist?.length) body.docid_blacklist = request.providerPersonBlacklist.slice(0, 1000)
  return body
}

export async function searchPearchV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.PEARCH_API_KEY
  if (!key) return { observations: [], telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'PEARCH_API_KEY is not configured.' }, warnings: ['Pearch search unavailable: provider key missing.'] }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPearchSearchBodyV36_8(request)), cache: 'no-store',
    })
    if (!response.ok) return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `Pearch returned HTTP ${response.status}.` }, warnings: [`Pearch search failed with status ${response.status}.`] }

    const payload = await response.json() as Record<string, unknown>
    const observations = searchResultRecords(payload).map(toObservation).filter(Boolean) as CandidateProviderObservationV36_8[]
    return {
      observations,
      telemetry: { provider: PROVIDER, status: 'completed', discovered: observations.length, latencyMs: Date.now() - started, message: 'Provider retrieval only; Pearch scores do not establish SourcingOS qualification.' },
      nextOffset: Math.max(0, Math.trunc(request.offset || 0)) + observations.length,
      threadId: str(payload.thread_id) || str(payload.uuid),
      warnings: [],
    }
  } catch {
    return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach Pearch.' }, warnings: ['Network error reaching Pearch.'] }
  }
}
