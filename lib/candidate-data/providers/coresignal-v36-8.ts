import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
  CandidateProviderRichProfileV36_14,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'coresignal' as const
const ENDPOINT = 'https://api.coresignal.com/cdapi/v2/agentic_search/fast'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function bounded(value: unknown, max = 1200): string | undefined {
  const valueString = str(value)
  return valueString ? valueString.replace(/\s+/g, ' ').trim().slice(0, max) : undefined
}

function num(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function strings(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.flatMap(item => {
    if (typeof item === 'string') return [item.trim()]
    const row = record(item)
    return [str(row.name), str(row.skill), str(row.label)].filter(Boolean) as string[]
  }).filter(Boolean))).slice(0, max)
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

function firstArrayText(value: unknown): string | undefined {
  if (!Array.isArray(value)) return nestedText(value, 'name', 'label')
  const values = value.slice(0, 8).flatMap(item => {
    const candidate = nestedText(item, 'name', 'label', 'value')
    return candidate ? [candidate] : []
  })
  return values.length ? Array.from(new Set(values)).join(', ') : undefined
}

function boundedTerms(values: string[] | undefined, max: number): string[] {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean))).slice(0, max)
}

/** Build a controlled natural-language prompt from recruiter-approved Role Brain fields. */
export function buildCoresignalAgenticPromptV36_8(request: CandidateDataSearchRequestV36_8): string {
  const titles = boundedTerms(request.titles, 30)
  const skills = boundedTerms(request.skills, 40)
  const locations = boundedTerms(request.locations, 30)
  const requirements = (request.requirements || []).filter(item => item.mustHave).map(item => item.text.trim()).filter(Boolean).slice(0, 20)
  const parts = [
    titles.length ? `Current role/title should match one of: ${titles.join('; ')}.` : '',
    skills.length ? `Skills or professional capabilities should include: ${skills.join('; ')}.` : '',
    locations.length ? `Location should be in or near one of these recruiter-approved markets: ${locations.join('; ')}.` : '',
    requirements.length ? `Additional recruiter-approved requirements: ${requirements.join('; ')}.` : '',
  ].filter(Boolean)

  return parts.length
    ? `Find employee/professional profiles matching these recruiter-approved criteria. ${parts.join(' ')}`.slice(0, 3500)
    : request.query.slice(0, 3000)
}

export function buildCoresignalSearchBodyV36_8(request: CandidateDataSearchRequestV36_8) {
  return {
    prompt: buildCoresignalAgenticPromptV36_8(request),
    return_data: true,
    threshold: 0.97,
    entity: 'employee',
  }
}

function profileUrls(row: Record<string, unknown>): CandidateProviderProfileUrlV36_8[] {
  const values = [
    row.professional_network_url,
    row.linkedin_url,
    row.linkedin,
    row.profile_url,
    row.url,
    row.website,
  ]
  const out: CandidateProviderProfileUrlV36_8[] = []
  for (const item of values) {
    const value = str(item)
    if (!value) continue
    try {
      const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`)
      if (!['http:', 'https:'].includes(parsed.protocol)) continue
      const lower = parsed.hostname.toLowerCase()
      const kind: CandidateProviderProfileUrlV36_8['kind'] = lower.includes('linkedin.com')
        ? 'linkedin'
        : lower.includes('github.com')
          ? 'github'
          : lower.includes('stackoverflow.com')
            ? 'stackoverflow'
            : 'other'
      if (!out.some(existing => existing.url === parsed.toString())) out.push({ kind, url: parsed.toString() })
    } catch { /* malformed provider URL ignored */ }
  }
  return out.slice(0, 12)
}

function currentExperience(row: Record<string, unknown>): Record<string, unknown> {
  const direct = record(row.active_experience)
  if (Object.keys(direct).length) return direct
  const experiences = Array.isArray(row.experience) ? row.experience.map(record) : []
  return experiences.find(item => item.current === true || item.is_current === true || item.active === true) || experiences[0] || {}
}

function safeUrl(value: unknown): string | undefined {
  const raw = str(value)
  if (!raw) return undefined
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined
  } catch { return undefined }
}

function coresignalRichProfile(row: Record<string, unknown>): CandidateProviderRichProfileV36_14 | undefined {
  const experienceRows = Array.isArray(row.experience)
    ? row.experience.map(record)
    : Array.isArray(row.experiences)
      ? row.experiences.map(record)
      : []
  const educationRows = Array.isArray(row.education)
    ? row.education.map(record)
    : Array.isArray(row.education_details)
      ? row.education_details.map(record)
      : []
  const certificationRows = Array.isArray(row.certifications) ? row.certifications.map(record) : []
  const projectRows = Array.isArray(row.projects) ? row.projects.map(record) : []

  const experience = experienceRows.slice(0, 30).map(item => {
    const endDate = bounded(item.end_date ?? item.date_to ?? item.endDate ?? item.to, 80)
    return {
      title: nestedText(item.title, 'name', 'label') || nestedText(item.position, 'name'),
      company: nestedText(item.company_name, 'name') || nestedText(item.company, 'name', 'display_name'),
      location: nestedText(item.location, 'name', 'display_name') || nestedText(item.location_full, 'name'),
      startDate: bounded(item.start_date ?? item.date_from ?? item.startDate ?? item.from, 80),
      endDate,
      current: item.current === true || item.is_current === true || item.active === true || (!endDate && Boolean(item.start_date ?? item.date_from ?? item.startDate)),
      description: bounded(item.description ?? item.summary ?? item.responsibilities, 1200),
    }
  }).filter(item => item.title || item.company || item.description)

  const education = educationRows.slice(0, 20).map(item => ({
    school: nestedText(item.school, 'name', 'display_name') || nestedText(item.institution, 'name', 'display_name') || nestedText(item.school_name, 'name'),
    degree: firstArrayText(item.degrees) || nestedText(item.degree, 'name', 'display_name') || nestedText(item.degree_name, 'name'),
    field: firstArrayText(item.fields_of_study) || firstArrayText(item.majors) || nestedText(item.field, 'name', 'display_name'),
    startDate: bounded(item.start_date ?? item.date_from ?? item.startDate, 80),
    endDate: bounded(item.end_date ?? item.date_to ?? item.endDate, 80),
    description: bounded(item.description ?? item.summary, 800),
  })).filter(item => item.school || item.degree || item.field)

  const certifications = certificationRows.slice(0, 20).map(item => ({
    name: nestedText(item.name, 'name') || nestedText(item.title, 'name') || '',
    issuer: nestedText(item.issuer, 'name', 'display_name') || nestedText(item.organization, 'name'),
    issuedAt: bounded(item.issued_at ?? item.issue_date ?? item.issuedAt, 80),
    expiresAt: bounded(item.expires_at ?? item.expiration_date ?? item.expiresAt, 80),
    credentialUrl: safeUrl(item.url ?? item.credential_url ?? item.credentialUrl),
  })).filter(item => item.name)

  const projects = projectRows.slice(0, 16).map(item => ({
    name: nestedText(item.name, 'name') || nestedText(item.title, 'name') || '',
    description: bounded(item.description ?? item.summary, 1000),
    url: safeUrl(item.url ?? item.project_url),
    technologies: strings(item.technologies ?? item.skills, 16),
  })).filter(item => item.name)

  const summary = bounded(row.summary ?? row.about ?? row.bio ?? row.description, 1800)
  if (!summary && !experience.length && !education.length && !certifications.length && !projects.length) return undefined
  return {
    ...(summary ? { summary } : {}),
    ...(experience.length ? { experience } : {}),
    ...(education.length ? { education } : {}),
    ...(certifications.length ? { certifications } : {}),
    ...(projects.length ? { projects } : {}),
  }
}

function toObservation(row: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(row.id) || str(row.employee_id) || str(row.member_id) || str(row.profile_id)
  const displayName = str(row.full_name) || str(row.name)
  if (!providerPersonId || !displayName) return undefined

  const experience = currentExperience(row)
  const currentTitle = str(row.active_experience_title) || str(row.current_title) || str(experience.title) || str(experience.position)
  const currentEmployer = str(row.company_name) || str(row.active_experience_company_name) || str(row.current_company_name) || str(experience.company_name) || nestedText(experience.company, 'name', 'display_name')
  const location = str(row.location_full) || str(row.location_name) || str(row.location) || [str(row.location_city), str(row.location_state), str(row.location_country)].filter(Boolean).join(', ') || undefined
  const skills = strings(row.skills).length ? strings(row.skills) : strings(row.inferred_skills)

  return {
    provider: PROVIDER,
    providerPersonId,
    displayName,
    headline: str(row.headline) || currentTitle,
    currentTitle,
    currentEmployer,
    location,
    skills,
    profileUrls: profileUrls(row),
    // Agentic Search is a discovery lane. Strip any returned contact fields and
    // keep reveal as a separate explicit enrichment action.
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    richProfile: coresignalRichProfile(row),
    providerRetrievalScore: num(row._score) ?? num(row.score) ?? num(row.relevance_score),
    providerScoreScale: (num(row._score) ?? num(row.score) ?? num(row.relevance_score)) === undefined ? undefined : 'provider_native',
    refreshedAt: str(row.last_updated) || str(row.updated_at) || str(row.last_seen_at),
    observedAt: new Date().toISOString(),
  }
}

function collectRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.flatMap(item => collectRecords(item))
  const root = record(payload)
  for (const key of ['records', 'results', 'data', 'items', 'employees', 'profiles']) {
    const value = root[key]
    if (Array.isArray(value)) return value.flatMap(item => collectRecords(item))
  }
  if (str(root.id) || str(root.employee_id) || str(root.member_id) || str(root.profile_id)) return [root]
  return []
}

function parseJsonOrJsonl(text: string): unknown[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  try { return [JSON.parse(trimmed)] } catch { /* fall through to JSONL */ }
  const rows: unknown[] = []
  for (const line of trimmed.split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
    try { rows.push(JSON.parse(line)) } catch { /* ignore non-JSON transport lines */ }
  }
  return rows
}

export async function searchCoresignalV36_8(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.CORESIGNAL_API_KEY
  if (!key) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'CORESIGNAL_API_KEY is not configured.' },
      warnings: ['Coresignal Agentic Search unavailable: provider key missing.'],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json, application/jsonl, text/plain' },
      body: JSON.stringify(buildCoresignalSearchBodyV36_8(request)),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        observations: [],
        telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: `Coresignal returned HTTP ${response.status}.` },
        warnings: [`Coresignal Agentic Search failed with status ${response.status}.`],
      }
    }

    const payloads = parseJsonOrJsonl(await response.text())
    const observations = payloads.flatMap(collectRecords).map(toObservation).filter(Boolean) as CandidateProviderObservationV36_8[]
    const limited = observations.slice(0, safeCandidateSearchLimitV36_8(request.limit))
    return {
      observations: limited,
      telemetry: {
        provider: PROVIDER,
        status: 'completed',
        discovered: limited.length,
        latencyMs: Date.now() - started,
        message: 'Coresignal /fast retrieval preserves bounded structured profile history when returned. Provider ranking and generated query semantics do not establish SourcingOS qualification truth.',
      },
      nextOffset: Math.max(0, Math.trunc(request.offset || 0)) + limited.length,
      warnings: request.offset ? ['Coresignal Agentic Search does not use the gateway offset; Continue sourcing should use provider-native pagination/blacklisting once the provider exposes a stable cursor in this contract.'] : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach Coresignal.' },
      warnings: ['Network error reaching Coresignal Agentic Search.'],
    }
  }
}
