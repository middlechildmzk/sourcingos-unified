import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
  CandidateProviderRichProfileV36_14,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'people_data_labs' as const
const ENDPOINT = 'https://api.peopledatalabs.com/v5/person/search'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function bounded(value: unknown, max = 1200): string | undefined {
  const valueString = str(value)
  return valueString ? valueString.replace(/\s+/g, ' ').trim().slice(0, max) : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function strings(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(str).filter(Boolean) as string[])).slice(0, max)
}

function nestedText(value: unknown, ...keys: string[]): string | undefined {
  const direct = bounded(value, 240)
  if (direct) return direct
  const row = record(value)
  for (const key of keys) {
    const candidate = bounded(row[key], 240)
    if (candidate) return candidate
  }
  return undefined
}

function firstArrayText(value: unknown, maxItems = 6): string | undefined {
  if (!Array.isArray(value)) return nestedText(value, 'name', 'display_name')
  const values = value.slice(0, maxItems).flatMap(item => {
    const text = nestedText(item, 'name', 'display_name', 'value')
    return text ? [text] : []
  })
  return values.length ? Array.from(new Set(values)).join(', ') : undefined
}

function normalizeTerms(values: string[] | undefined, max: number): string[] {
  return Array.from(new Set((values || []).map(value => value.trim().toLowerCase()).filter(Boolean))).slice(0, max)
}

function simplePersonName(value: string): string | undefined {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  const tokens = cleaned.split(' ').filter(Boolean)
  // Only infer a raw-query name when it is unambiguously first + last. Three-
  // token inputs such as `Jane Doe Acme` must be structured by People Search so
  // employer context cannot silently become part of an exact PDL full_name.
  if (tokens.length !== 2) return undefined
  if (!tokens.every(token => /^[\p{L}][\p{L}'’.\-]*$/u.test(token))) return undefined
  return cleaned.toLowerCase()
}

function oneOfMatch(field: string, values: string[]) {
  return {
    bool: {
      should: values.map(value => ({ match_phrase: { [field]: value } })),
    },
  }
}

function exactKeywordMatch(field: string, values: string[]) {
  return values.length === 1
    ? { term: { [field]: values[0] } }
    : { terms: { [field]: values } }
}

/**
 * PDL Search executes Elasticsearch directly against its dataset with no query
 * cleaning. SourcingOS sends only bounded structured fields. Person names and
 * company context are separate; company is professional filtering context and
 * never identity authority.
 */
export function buildPeopleDataLabsSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  const names = normalizeTerms(request.names, 20)
  const inferredName = !names.length ? simplePersonName(request.query) : undefined
  const titles = normalizeTerms(request.titles, 30)
  const skills = normalizeTerms(request.skills, 40)
  const companies = normalizeTerms(request.companies, 30)
  const locations = normalizeTerms(request.locations, 30)
  const must: Record<string, unknown>[] = []

  if (names.length || inferredName) must.push(exactKeywordMatch('full_name', names.length ? names : [inferredName!]))
  if (titles.length) must.push(oneOfMatch('job_title', titles))
  if (skills.length) must.push(oneOfMatch('skills', skills))
  if (companies.length) must.push(oneOfMatch('job_company_name', companies))
  if (locations.length) must.push(oneOfMatch('location_name', locations))

  const query = must.length
    ? { bool: { must } }
    : { match_none: {} }

  return {
    size: safeCandidateSearchLimitV36_8(request.limit),
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

function safeUrl(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined
  } catch { return undefined }
}

function pdlRichProfile(row: Record<string, unknown>): CandidateProviderRichProfileV36_14 | undefined {
  const experienceRows = Array.isArray(row.experience) ? row.experience.map(record) : []
  const educationRows = Array.isArray(row.education) ? row.education.map(record) : []
  const rawCertifications = Array.isArray(row.certifications) ? row.certifications : []

  const experience = experienceRows.slice(0, 30).map(item => {
    const title = record(item.title)
    const company = record(item.company)
    const endDate = bounded(item.end_date ?? item.endDate, 80)
    const locations = firstArrayText(item.location_names) || nestedText(item.location, 'name', 'display_name')
    return {
      title: nestedText(title, 'name', 'title') || nestedText(item.title_name, 'name'),
      company: nestedText(company, 'name', 'display_name') || nestedText(item.company_name, 'name'),
      location: locations,
      startDate: bounded(item.start_date ?? item.startDate, 80),
      endDate,
      current: item.is_primary === true || item.current === true || (!endDate && Boolean(item.start_date ?? item.startDate)),
      description: bounded(item.summary ?? item.description, 1200),
    }
  }).filter(item => item.title || item.company || item.description)

  const education = educationRows.slice(0, 20).map(item => {
    const school = record(item.school)
    return {
      school: nestedText(school, 'name', 'display_name') || nestedText(item.school_name, 'name'),
      degree: firstArrayText(item.degrees) || nestedText(item.degree, 'name', 'display_name'),
      field: firstArrayText(item.majors) || firstArrayText(item.fields_of_study) || nestedText(item.field, 'name', 'display_name'),
      startDate: bounded(item.start_date ?? item.startDate, 80),
      endDate: bounded(item.end_date ?? item.endDate, 80),
      description: bounded(item.summary ?? item.description, 800),
    }
  }).filter(item => item.school || item.degree || item.field)

  const certifications = rawCertifications.slice(0, 20).map(item => {
    const cert = record(item)
    const name = nestedText(item, 'name', 'title') || nestedText(cert.name, 'name') || ''
    return {
      name,
      issuer: nestedText(cert.issuer, 'name', 'display_name') || nestedText(cert.organization, 'name'),
      issuedAt: bounded(cert.issue_date ?? cert.issued_at ?? cert.issuedAt, 80),
      expiresAt: bounded(cert.expiration_date ?? cert.expires_at ?? cert.expiresAt, 80),
      credentialUrl: safeUrl(cert.url ?? cert.credential_url ?? cert.credentialUrl),
    }
  }).filter(item => item.name)

  const summary = bounded(row.summary ?? row.bio ?? row.interests, 1800)
  if (!summary && !experience.length && !education.length && !certifications.length) return undefined
  return {
    ...(summary ? { summary } : {}),
    ...(experience.length ? { experience } : {}),
    ...(education.length ? { education } : {}),
    ...(certifications.length ? { certifications } : {}),
  }
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
    richProfile: pdlRichProfile(row),
    refreshedAt: str(row.job_last_verified) || str(row.location_last_updated),
    observedAt: new Date().toISOString(),
  }
}

function safeProviderError(payload: unknown): string | undefined {
  const root = record(payload)
  const error = root.error
  const nested = record(error)
  const candidate = str(root.message) || str(nested.message) || str(root.detail) || str(error)
  if (!candidate) return undefined
  return candidate.replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]').slice(0, 240)
}

export async function searchPeopleDataLabsV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.PDL_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY
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
      telemetry: { provider: PROVIDER, status: 'skipped', discovered: 0, latencyMs: 0, message: 'PDL Search skipped because no safe person-name, title, skill, company, or location anchor was supplied.' },
      warnings: ['PDL Search needs a person name or structured professional fields; arbitrary recruiter prose is not forwarded as Elasticsearch syntax.'],
    }
  }

  try {
    const url = new URL(ENDPOINT)
    url.searchParams.set('query', JSON.stringify(body.query))
    url.searchParams.set('size', String(body.size))
    url.searchParams.set('dataset', body.dataset)
    url.searchParams.set('titlecase', String(body.titlecase))

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': key, Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => undefined)
      const reason = safeProviderError(payload)
      const explicitNoMatch = response.status === 404 && Boolean(reason && /no records were found|no records found|no match/i.test(reason))
      if (explicitNoMatch) {
        return {
          observations: [],
          telemetry: { provider: PROVIDER, status: 'completed', discovered: 0, latencyMs: Date.now() - started, message: `People Data Labs completed with no matching records. ${reason}`.trim() },
          warnings: [],
        }
      }
      const suffix = reason ? ` ${reason}` : ''
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `People Data Labs returned HTTP ${response.status}.${suffix}`.trim() },
        warnings: [`PDL Person Search failed with status ${response.status}.${suffix}`.trim()],
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
        message: 'PDL resume search completed. Structured experience/education/certification fields are preserved when returned; results remain provider observations, not qualification decisions.',
      },
      ...(scrollToken ? { threadId: scrollToken } : {}),
      warnings: request.offset && request.offset > 0 ? ['PDL uses scroll_token cursor pagination; legacy numeric offset is intentionally not forwarded.'] : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach People Data Labs.' },
      warnings: ['Network error reaching PDL Person Search.'],
    }
  }
}
