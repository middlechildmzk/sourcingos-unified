import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
  CandidateProviderRichProfileV36_14,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'crustdata' as const
const ENDPOINT = 'https://api.crustdata.com/person/search'
const API_VERSION = '2025-11-01'

type JsonRecord = Record<string, unknown>
type FilterCondition = { field: string; type: string; value: unknown }
type FilterGroup = { op: 'and' | 'or'; conditions: Array<FilterCondition | FilterGroup> }

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function rows(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(record).filter(item => Object.keys(item).length)
  const one = record(value)
  return Object.keys(one).length ? [one] : []
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function idString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return str(value)
}

function bounded(value: unknown, max = 1200): string | undefined {
  const out = str(value)
  return out ? out.replace(/\s+/g, ' ').trim().slice(0, max) : undefined
}

function unique(values: Array<string | undefined>, max = 50): string[] {
  return Array.from(new Set(values.filter(Boolean).map(value => value!.trim()).filter(Boolean))).slice(0, max)
}

function stringList(value: unknown, max = 50): string[] {
  if (!Array.isArray(value)) return []
  return unique(value.flatMap(item => {
    if (typeof item === 'string') return [item]
    const row = record(item)
    return [str(row.name), str(row.skill), str(row.value), str(row.label)].filter(Boolean) as string[]
  }), max)
}

function nestedText(value: unknown, ...keys: string[]): string | undefined {
  const direct = bounded(value, 300)
  if (direct) return direct
  const row = record(value)
  for (const key of keys) {
    const candidate = bounded(row[key], 300)
    if (candidate) return candidate
  }
  return undefined
}

function values(requestValues: string[] | undefined, max: number): string[] {
  return unique((requestValues || []).map(item => item.trim()), max)
}

function orGroup(field: string, items: string[], type = '(.)'): FilterCondition | FilterGroup | undefined {
  if (!items.length) return undefined
  const conditions = items.map(value => ({ field, type, value }))
  return conditions.length === 1 ? conditions[0] : { op: 'or', conditions }
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Crustdata lets SourcingOS enforce structured recruiter constraints as filters
 * while using hybrid semantic search only to rank inside that constrained set.
 * Provider `fit` remains retrieval metadata, never qualification truth.
 */
export function buildCrustdataPersonSearchBodyV36_16(request: CandidateDataSearchRequestV36_8) {
  const conditions: Array<FilterCondition | FilterGroup> = []
  const names = values(request.names, 10)
  const titles = values(request.titles, 25)
  const skills = values(request.skills, 30)
  const companies = values(request.companies, 20)
  const locations = values(request.locations, 20)
  const hardRequirements = new Set((request.requirements || []).filter(item => item.mustHave).map(item => normalized(item.text)))

  const nameCondition = orGroup('basic_profile.name', names, '=')
  if (nameCondition) conditions.push(nameCondition)
  const titleCondition = orGroup('experience.employment_details.current.title', titles)
  if (titleCondition) conditions.push(titleCondition)
  const companyCondition = orGroup('experience.employment_details.current.company_name', companies)
  if (companyCondition) conditions.push(companyCondition)
  const locationCondition = orGroup('basic_profile.location.full_location', locations)
  if (locationCondition) conditions.push(locationCondition)

  // Only skills explicitly marked must-have become hard provider filters.
  // Soft/discovery skills remain semantic ranking context below.
  const hardSkills = skills.filter(skill => hardRequirements.has(normalized(skill)))
  for (const skill of hardSkills) conditions.push({ field: 'skills.professional_network_skills', type: '(.)', value: skill })

  const semanticParts = unique([
    ...titles,
    ...skills.filter(skill => !hardSkills.includes(skill)),
    ...((request.requirements || []).filter(item => !item.mustHave).map(item => item.text)),
  ], 50)
  const semanticQuery = (semanticParts.length ? semanticParts.join(' ') : request.query)
    .replace(/^find(?:\s+me)?\s+/i, '')
    .trim()
    .slice(0, 1000)

  const body: Record<string, unknown> = {
    limit: safeCandidateSearchLimitV36_8(request.limit),
    fields: ['crustdata_person_id', 'fit', 'basic_profile', 'social_handles', 'experience', 'education', 'skills'],
  }
  if (conditions.length) {
    body.filters = conditions.length === 1 ? conditions[0] : { op: 'and', conditions }
    body.mode = 'exact'
  }
  if (semanticQuery) body.search = { query: semanticQuery, mode: 'hybrid' }
  return body
}

function locationText(value: unknown): string | undefined {
  const direct = bounded(value, 300)
  if (direct) return direct
  const row = record(value)
  return bounded(row.raw ?? row.full_location ?? row.fullLocation, 300)
    || unique([str(row.city), str(row.state), str(row.region), str(row.country)], 4).join(', ')
    || undefined
}

function safeUrl(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined
  } catch { return undefined }
}

function profileUrls(profile: JsonRecord): CandidateProviderProfileUrlV36_8[] {
  const social = record(profile.social_handles)
  const professionalIdentifier = record(social.professional_network_identifier)
  const developerIdentifier = record(social.dev_platform_identifier)
  const candidates: unknown[] = [
    professionalIdentifier.profile_url,
    developerIdentifier.profile_url,
    profile.linkedin_url,
    profile.profile_url,
  ]
  const out: CandidateProviderProfileUrlV36_8[] = []
  for (const candidate of candidates) {
    const url = safeUrl(candidate)
    if (!url || out.some(item => item.url === url)) continue
    const host = new URL(url).hostname.toLowerCase()
    const kind: CandidateProviderProfileUrlV36_8['kind'] = host.includes('linkedin.com')
      ? 'linkedin'
      : host.includes('github.com')
        ? 'github'
        : host.includes('stackoverflow.com')
          ? 'stackoverflow'
          : 'other'
    out.push({ kind, url })
  }
  return out.slice(0, 12)
}

function richProfile(profile: JsonRecord): CandidateProviderRichProfileV36_14 | undefined {
  const basic = record(profile.basic_profile)
  const experience = record(profile.experience)
  const employment = record(experience.employment_details)
  const current = rows(employment.current)
  const past = rows(employment.past)
  const education = record(profile.education)
  const schools = rows(education.schools)

  const mappedExperience = [...current, ...past].slice(0, 30).map((item, index) => {
    const endDate = bounded(item.end_date ?? item.end_at ?? item.endDate, 80)
    return {
      title: nestedText(item.title, 'name', 'value'),
      company: nestedText(item.company_name ?? item.name ?? item.company, 'name', 'value'),
      location: locationText(item.location),
      startDate: bounded(item.start_date ?? item.start_at ?? item.startDate, 80),
      endDate,
      current: index < current.length || item.current === true || item.is_current === true,
      description: bounded(item.description ?? item.summary, 1400),
    }
  }).filter(item => item.title || item.company || item.description)

  const mappedEducation = schools.slice(0, 20).map(item => ({
    school: nestedText(item.school ?? item.school_name ?? item.institution, 'name', 'value'),
    degree: nestedText(item.degree, 'name', 'value'),
    field: nestedText(item.field_of_study ?? item.field, 'name', 'value'),
    startDate: bounded(item.start_date ?? item.start_at, 80),
    endDate: bounded(item.end_date ?? item.end_at, 80),
    description: bounded(item.description, 900),
  })).filter(item => item.school || item.degree || item.field)

  const summary = bounded(basic.summary ?? basic.about ?? profile.summary, 1800)
  if (!summary && !mappedExperience.length && !mappedEducation.length) return undefined
  return {
    ...(summary ? { summary } : {}),
    ...(mappedExperience.length ? { experience: mappedExperience } : {}),
    ...(mappedEducation.length ? { education: mappedEducation } : {}),
  }
}

function toObservation(profile: JsonRecord): CandidateProviderObservationV36_8 | undefined {
  const basic = record(profile.basic_profile)
  const experience = record(profile.experience)
  const employment = record(experience.employment_details)
  const current = rows(employment.current)[0] || {}
  const urls = profileUrls(profile)
  const providerPersonId = idString(profile.crustdata_person_id)
    || idString(profile.person_id)
    || idString(profile.id)
    || urls.find(item => item.kind === 'linkedin')?.url
  const displayName = str(basic.name) || str(profile.full_name) || str(profile.name)
  if (!providerPersonId || !displayName) return undefined

  const skillSection = record(profile.skills)
  const skills = unique([
    ...stringList(skillSection.professional_network_skills, 60),
    ...stringList(profile.skills, 60),
  ], 60)
  const currentTitle = str(basic.current_title) || nestedText(current.title, 'name', 'value')
  const currentEmployer = nestedText(current.company_name ?? current.name ?? current.company, 'name', 'value')
  const location = locationText(basic.location) || locationText(profile.location)
  const fit = str(profile.fit)

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    headline: str(basic.headline) || str(profile.headline) || currentTitle,
    currentTitle,
    currentEmployer,
    location,
    skills,
    profileUrls: urls,
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    richProfile: richProfile(profile),
    providerScoreScale: fit ? `crustdata_fit:${fit}` : undefined,
    providerExplanation: `Crustdata indexed Person Search discovery${fit ? `; provider retrieval tier: ${fit}` : ''}. Structured recruiter filters are enforced before hybrid semantic ranking. Contact values and live refresh remain separate explicit operations.`,
    observedAt: new Date().toISOString(),
  }
}

export async function searchCrustdataV36_16(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.CRUSTDATA_API_KEY
  if (!key) return {
    observations: [],
    telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'CRUSTDATA_API_KEY is not configured.' },
    warnings: ['Crustdata Person Search unavailable: provider key missing.'],
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-version': API_VERSION,
      },
      body: JSON.stringify(buildCrustdataPersonSearchBodyV36_16(request)),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `Crustdata returned HTTP ${response.status}.` },
        warnings: [`Crustdata Person Search failed with status ${response.status}; 403 may indicate plan/credit entitlement rather than a bad key.`],
      }
    }

    const payload = record(await response.json())
    const profiles = Array.isArray(payload.profiles) ? payload.profiles.map(record) : []
    const observations = profiles.map(toObservation).filter(Boolean) as CandidateProviderObservationV36_8[]
    const limited = observations.slice(0, safeCandidateSearchLimitV36_8(request.limit))
    const warnings: string[] = []
    if (request.offset) warnings.push('Crustdata uses cursor pagination; the universal numeric offset is not forwarded in this first adapter slice.')
    if (request.highFreshness) warnings.push('This Crustdata adapter uses indexed Person Search. Live/fresh retrieval is a separate plan-gated tool and was not silently substituted.')

    return {
      observations: limited,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: limited.length,
        latencyMs: Date.now() - started,
        estimatedCredits: Number((limited.length * 0.03).toFixed(2)),
        message: 'Crustdata indexed Person Search executed with structured filters plus semantic ranking. Provider fit is retrieval metadata, not a qualification score.',
      },
      nextOffset: Math.max(0, Math.trunc(request.offset || 0)) + limited.length,
      warnings,
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach Crustdata Person Search.' },
      warnings: ['Network or response error reaching Crustdata Person Search.'],
    }
  }
}
