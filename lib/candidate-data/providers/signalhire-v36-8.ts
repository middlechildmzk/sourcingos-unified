import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'signalhire' as const
const ENDPOINT = 'https://www.signalhire.com/api/v1/candidate/searchByQuery'

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

function bounded(values: string[] | undefined, max: number): string[] {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean))).slice(0, max)
}

function booleanPhrase(values: string[]): string | undefined {
  if (!values.length) return undefined
  const escaped = values.map(value => `"${value.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()}"`).filter(value => value !== '""')
  return escaped.length ? escaped.join(' OR ') : undefined
}

function yearsFloor(request: CandidateDataSearchRequestV36_8): number | undefined {
  const values = (request.requirements || []).flatMap(item => {
    const match = item.text.match(/(?:at\s+least\s+|minimum\s+(?:of\s+)?|\b)(\d{1,2})\s*(?:\+|\s+or\s+more)?\s*(?:years?|yrs?)/i)
    return match ? [Number(match[1])] : []
  }).filter(value => Number.isFinite(value) && value >= 0 && value <= 60)
  return values.length ? Math.max(...values) : undefined
}

/**
 * SignalHire's Search API is discovery-only and returns no contacts. Build its
 * Boolean filters strictly from recruiter-approved Role Brain fields.
 */
export function buildSignalHireSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const titles = bounded(request.titles, 30)
  const skills = bounded(request.skills, 40)
  const locations = bounded(request.locations, 30)
  const experienceFrom = yearsFloor(request)
  const body: Record<string, unknown> = {
    size: Math.min(100, safeCandidateSearchLimitV36_8(request.limit)),
  }
  const currentTitle = booleanPhrase(titles)
  const keywords = booleanPhrase(skills)
  if (currentTitle) body.currentTitle = currentTitle
  if (keywords) body.keywords = keywords
  if (locations.length === 1) body.location = locations[0]
  else if (locations.length > 1) body.location = locations
  if (experienceFrom !== undefined) body.yearsOfCurrentPastExperienceFrom = experienceFrom
  return body
}

function toObservation(row: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(row.uid)
  const displayName = str(row.fullName)
  if (!providerPersonId || !displayName) return undefined
  const experiences = Array.isArray(row.experience) ? row.experience.map(record) : []
  const current = experiences[0] || {}
  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    headline: str(current.title),
    currentTitle: str(current.title),
    currentEmployer: str(current.company),
    location: str(row.location),
    skills: strings(row.skills),
    // Search API intentionally returns brief profile previews without contacts.
    profileUrls: [],
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    refreshedAt: str(row.contactsFetched),
    observedAt: new Date().toISOString(),
  }
}

export async function searchSignalHireV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.SIGNALHIRE_API_KEY
  if (!key) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'SIGNALHIRE_API_KEY is not configured.' },
      warnings: ['SignalHire Search unavailable: provider key missing.'],
    }
  }

  const body = buildSignalHireSearchBodyV36_8(request)
  if (!body.currentTitle && !body.keywords && !body.location && body.yearsOfCurrentPastExperienceFrom === undefined) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'skipped', discovered: 0, latencyMs: 0, message: 'SignalHire Search skipped because no structured Role Brain filter was supplied.' },
      warnings: ['SignalHire requires at least one non-exclude search filter; raw recruiter prose is not sent as a provider Boolean query.'],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `SignalHire returned HTTP ${response.status}.` },
        warnings: [`SignalHire Search failed with status ${response.status}.`],
      }
    }

    const payload = await response.json() as Record<string, unknown>
    const rows = Array.isArray(payload.profiles) ? payload.profiles.map(record) : []
    const observations = rows.map(toObservation).filter(Boolean) as CandidateProviderObservationV36_8[]
    const scrollId = str(payload.scrollId)
    const requestId = payload.requestId === undefined ? undefined : String(payload.requestId)
    return {
      observations,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: observations.length,
        latencyMs: Date.now() - started,
        message: 'SignalHire Search uses daily search/profile quotas and returns contact-free profile previews. Contact reveal remains a separate explicit Person API action.',
      },
      ...(scrollId && requestId ? { threadId: `${requestId}:${scrollId}` } : {}),
      warnings: scrollId ? ['SignalHire returned a 15-second scroll cursor. The current gateway intentionally does not auto-drain it; Continue sourcing should consume provider cursors in a bounded follow-up pass.'] : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach SignalHire.' },
      warnings: ['Network error reaching SignalHire Search.'],
    }
  }
}
