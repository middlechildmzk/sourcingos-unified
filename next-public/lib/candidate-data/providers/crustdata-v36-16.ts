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

function bounded(value: unknown, max = 1200): string | undefined {
  const out = str(value)
  return out ? out.replace(/\s+/g, ' ').trim().slice(0, max) : undefined
}

function numberValue(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
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

export function buildCrustdataPersonSearchBodyV36_16(request: CandidateDataSearchRequestV36_8) {
  const conditions: Array<FilterCondition | FilterGroup> = []
  const names = values(request.names, 10)
  const titles = values(request.titles, 25)
  const skills = values(request.skills, 30)
  const companies = values(request.companies, 20)
  const locations = values(request.locations, 20)
  const hardRequirements = new Set((request.requirements || []).filter(item => item.mustHave).map(item => normalized(item.text)))

  const nameCondition = orGroup('basic_profile.name', names)
  if (nameCondition) conditions.push(nameCondition)
  const titleCondition = orGroup('experience.employment_details.current.title', titles)
  if (titleCondition) conditions.push(titleCondition)
  const companyCondition = orGroup('experience.employment_details.current.name', companies)
  if (companyCondition) conditions.push(companyCondition)
  const locationCondition = orGroup('basic_profile.location.raw', locations)
  if (locationCondition) conditions.push(locationCondition)

  const hardSkills = skills.filter(skill => hardRequirements.has(normalized(skill)))
  const softSkills = skills.filter(skill => !hardRequirements.has(normalized(skill)))
  for (const skill of hardSkills) conditions.push({ field: 'skills.professional_network_skills', type: '(.)', value: skill })
  const softSkillCondition = orGroup('skills.professional_network_skills', softSkills)
  if (softSkillCondition) conditions.push(softSkillCondition)

  if (!conditions.length) {
    const fallback = request.query.replace(/^find(?:\s+me)?\s+/i, '').trim().slice(0, 220)
    if (fallback) conditions.push({ field: 'basic_profile.headline', type: '(.)', value: fallback })
  }

  return {
    filters: conditions.length === 1 ? conditions[0] : { op: 'and', conditions },
    limit: safeCandidateSearchLimitV36_8(request.limit),
  }
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
  const basic = record(profile.basic_profile)
  const professionalNetwork = record(profile.professional_network)
  const social = record(profile.social_handles)
  const dev = rows(profile.dev_platform_profiles)
  const candidates: unknown[] = [
    profile.professional_network_profile_url,
    profile.linkedin_url,
    profile.profile_url,
    basic.professional_network_profile_url,
    professionalNetwork.profile_url,
    professionalNetwork.url,
    record(social.dev_platform_identifier).profile_url,
    ...dev.flatMap(item => [item.profile_url, item.url]),
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
  const experienceRows = [...current, ...past]
  const education = record(profile.education)
  const schools = rows(education.schools)
  const certificationRows = rows(profile.certifications)
  const devRows = rows(profile.dev_platform_profiles)

  const mappedExperience = experienceRows.slice(0, 30).map(item => {
    const endDate = bounded(item.end_date ?? item.end_at ?? item.endDate, 80)
    return {
      title: nestedText(item.title, 'name', 'value'),
      company: nestedText(item.company_name ?? item.name ?? item.company, 'name', 'value'),
      location: locationText(item.location),
      startDate: bounded(item.start_date ?? item.start_at ?? item.startDate, 80),
      endDate,
      current: current.includes(item) || item.current === true || item.is_current === true,
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

  const certifications = certificationRows.slice(0, 20).map(item => ({
    name: nestedText(item.name ?? item.title, 'name') || '',
    issuer: nestedText(item.issuing_organization ?? item.issuer, 'name', 'value'),
    issuedAt: bounded(item.issued_at ?? item.issue_date, 80),
    expiresAt: bounded(item.expires_at ?? item.expiration_date, 80),
    credentialUrl: safeUrl(item.credential_url ?? item.url),
  })).filter(item => item.name)

  const projects = devRows.slice(0, 16).map(item => ({
    name: nestedText(item.name ?? item.platform ?? item.username, 'name') || '',
    description: bounded(item.description ?? item.bio, 1000),
    url: safeUrl(item.profile_url ?? item.url),
    technologies: stringList(item.languages ?? item.skills, 16),
  })).filter(item => item.name)

  const summary = bounded(basic.summary ?? basic.about ?? profile.summary, 1800)
  if (!summary && !mappedExperience.length && !mappedEducation.length && !certifications.length && !projects.length) return undefined
  return {
    ...(summary ? { summary } : {}),
    ...(mappedExperience.length ? { experience: mappedExperience } : {}),
    ...(mappedEducation.length ? { education: mappedEducation } : {}),
    ...(certifications.length ? { certifications } : {}),
    ...(projects.length ? { projects } : {}),
  }
}

function toObservation(profile: JsonRecord): CandidateProviderObservationV36_8 | undefined {
  const basic = record(profile.basic_profile)
  const experience = record(profile.experience)
  const employment = record(experience.employment_details)
  const current = rows(employment.current)[0] || {}
  const urls = profileUrls(profile)
  const providerPersonId = str(profile.crustdata_person_id)
    || str(profile.person_id)
    || str(profile.id)
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
    providerRetrievalScore: numberValue(profile.score ?? profile._score ?? profile.relevance_score),
    providerScoreScale: numberValue(profile.score ?? profile._score ?? profile.relevance_score) === undefined ? undefined : 'provider_native',
    refreshedAt: str(basic.last_updated) || str(profile.last_updated) || str(profile.updated_at),
    providerExplanation: 'Crustdata indexed Person Search discovery. Contact values are not revealed during search; fresh/live profile retrieval remains a separate explicit operation.',
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
    const limit = safeCandidateSearchLimitV36_8(request.limit)
    const limited = observations.slice(0, limit)
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
        message: 'Crustdata indexed Person Search executed. Provider records remain observations and its retrieval metadata is not a qualification score.',
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
