import 'server-only'
import type { CandidateDataSearchRequestV36_8, CandidateDataSearchResultV36_8, CandidateProviderObservationV36_8 } from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'contactout' as const
const ENDPOINT = 'https://api.contactout.com/v1/people/search'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function strings(value: unknown, max = 30): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map(str).filter(Boolean) as string[])).slice(0, max) : []
}

export function buildContactOutSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const body: Record<string, unknown> = {
    page: Math.floor(Math.max(0, request.offset || 0) / safeCandidateSearchLimitV36_8(request.limit)) + 1,
    page_size: Math.min(25, safeCandidateSearchLimitV36_8(request.limit)),
    current_titles_only: true,
    include_related_job_titles: false,
    reveal_info: Boolean(request.revealContact),
    detailed_experience: false,
    detailed_education: false,
  }
  if (request.titles?.length) body.job_title = request.titles.slice(0, 50)
  if (request.skills?.length) body.skills = request.skills.slice(0, 50)
  if (request.locations?.length) body.location = request.locations.slice(0, 50)
  if (!request.titles?.length && !request.skills?.length) body.keyword = request.query.slice(0, 300)
  return body
}

function observation(linkedinUrl: string, row: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const title = str(row.title) || str(row.headline)
  const name = str(row.full_name) || str(row.fullName) || str(row.name)
  const vanity = str(row.li_vanity)
  const providerPersonId = vanity || linkedinUrl.split('/').filter(Boolean).pop()
  if (!name || !providerPersonId) return undefined
  const company = record(row.company)
  const availability = record(row.contact_availability)
  const skills = strings(row.skills)
  const github = strings(row.github, 5)
  const twitter = strings(row.twitter, 5)
  const profileUrls = [
    { kind: 'linkedin' as const, url: linkedinUrl },
    ...github.map(handle => ({ kind: 'github' as const, url: handle.startsWith('http') ? handle : `https://github.com/${handle}` })),
    ...twitter.map(handle => ({ kind: 'other' as const, url: handle.startsWith('http') ? handle : `https://x.com/${handle.replace(/^@/, '')}` })),
  ]
  const emailAvailable = availability.personal_email === true || availability.work_email === true
  const phoneAvailable = availability.phone === true
  return {
    provider: PROVIDER,
    providerPersonId,
    displayName: name,
    headline: title,
    currentTitle: title,
    currentEmployer: str(company.name) || str(row.company_name),
    location: str(row.location),
    skills,
    profileUrls,
    contactAvailability: { email: typeof emailAvailable === 'boolean' ? emailAvailable : 'unknown', phone: typeof phoneAvailable === 'boolean' ? phoneAvailable : 'unknown' },
    refreshedAt: str(row.updated_at) || str(row.updatedAt),
    observedAt: new Date().toISOString(),
  }
}

export async function searchContactOutV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.CONTACTOUT_API_KEY
  if (!key) return { observations: [], telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'CONTACTOUT_API_KEY is not configured.' }, warnings: ['ContactOut search unavailable: provider key missing.'] }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { token: key, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(buildContactOutSearchBodyV36_8(request)),
      cache: 'no-store',
    })
    if (!response.ok) return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `ContactOut returned HTTP ${response.status}.` }, warnings: [`ContactOut search failed with status ${response.status}.`] }
    const payload = await response.json() as Record<string, unknown>
    const profiles = record(payload.profiles)
    const observations = Object.entries(profiles).map(([linkedinUrl, value]) => observation(linkedinUrl, record(value))).filter(Boolean) as CandidateProviderObservationV36_8[]
    return {
      observations,
      telemetry: { provider: PROVIDER, status: 'completed', discovered: observations.length, latencyMs: Date.now() - started, estimatedCredits: observations.length, message: 'Search runs with contact reveal off unless enrichment is explicitly requested. Related-title expansion is disabled.' },
      nextOffset: Math.max(0, request.offset || 0) + observations.length,
      warnings: [],
    }
  } catch {
    return { observations: [], telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach ContactOut.' }, warnings: ['Network error reaching ContactOut.'] }
  }
}
