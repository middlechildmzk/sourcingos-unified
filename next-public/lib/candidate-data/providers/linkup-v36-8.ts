import 'server-only'
import { createHash } from 'node:crypto'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const ENDPOINT = 'https://api.linkupapi.com/v1/data/search/profiles'
const PROVIDER = 'linkup' as const

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str).filter(Boolean) as string[] : []
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

/**
 * LinkUp currently exposes one string each for title and location, so V36.8
 * sends the first recruiter-approved value rather than inventing provider-side
 * expansion. Remaining capability terms are carried in the keyword field.
 */
export function buildLinkUpSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const title = request.titles?.map(item => item.trim()).find(Boolean)
  const location = request.locations?.map(item => item.trim()).find(Boolean)
  const keyword = Array.from(new Set((request.skills || []).map(item => item.trim()).filter(Boolean))).slice(0, 8).join(' ')
  return {
    ...(keyword ? { keyword } : {}),
    ...(title ? { job_title: title } : {}),
    ...(location ? { location } : {}),
    total_results: safeCandidateSearchLimitV36_8(request.limit),
  }
}

function stableLinkUpId(linkedin: string): string {
  return createHash('sha256').update(`linkup:${linkedin.toLowerCase()}`).digest('hex').slice(0, 32)
}

function observation(record: Record<string, unknown>, observedAt: string): CandidateProviderObservationV36_8 | undefined {
  const displayName = str(record.full_name)
  const social = record.social_profiles && typeof record.social_profiles === 'object'
    ? record.social_profiles as Record<string, unknown>
    : {}
  const linkedin = validHttpUrl(social.linkedin)
  // LinkUp's public response example does not expose a provider-native person id.
  // Require its returned LinkedIn URL so the observation has a deterministic
  // professional identity anchor instead of synthesizing identity from name text.
  if (!displayName || !linkedin) return undefined
  const company = record.company && typeof record.company === 'object' ? record.company as Record<string, unknown> : {}
  const profileUrls: CandidateProviderProfileUrlV36_8[] = [{ kind: 'linkedin', url: linkedin }]
  return {
    provider: PROVIDER,
    providerPersonId: stableLinkUpId(linkedin),
    displayName,
    currentTitle: str(record.title),
    headline: str(record.title),
    currentEmployer: str(company.name),
    location: str(record.location),
    skills: strings(record.skills).slice(0, 30),
    profileUrls,
    // The endpoint can return contact data, but SourcingOS deliberately ignores
    // it during discovery. Contact reveal remains a separate explicit action.
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    providerExplanation: 'LinkUp professional-profile observation anchored to the provider-returned LinkedIn URL. Contact fields were not admitted during candidate discovery.',
    observedAt,
  }
}

export async function searchLinkUpV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.LINKUP_API_KEY
  if (!key) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'LINKUP_API_KEY is not configured.' },
      warnings: ['LinkUp People Search unavailable: provider key missing.'],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(buildLinkUpSearchBodyV36_8(request)),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `LinkUp returned HTTP ${response.status}.` },
        warnings: [`LinkUp People Search failed with status ${response.status}.`],
      }
    }

    const payload = await response.json() as Record<string, unknown>
    const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
    const records = Array.isArray(data.results) ? data.results.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
    const observedAt = new Date().toISOString()
    const observations = records.map(item => observation(item, observedAt)).filter(Boolean) as CandidateProviderObservationV36_8[]
    const credits = num(payload.credits_used)

    return {
      observations,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: observations.length,
        latencyMs: Date.now() - started,
        ...(credits !== undefined ? { estimatedCredits: credits } : {}),
        message: 'LinkUp discovery retained professional profile fields and LinkedIn identity anchors only; endpoint contact fields are deliberately ignored during search.',
      },
      warnings: records.length > observations.length
        ? [`${records.length - observations.length} LinkUp result${records.length - observations.length === 1 ? '' : 's'} lacked a deterministic LinkedIn identity anchor and were held out of Candidate Graph admission.`]
        : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach LinkUp.' },
      warnings: ['Network error reaching LinkUp People Search.'],
    }
  }
}
