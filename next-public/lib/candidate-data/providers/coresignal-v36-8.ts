import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const PROVIDER = 'coresignal' as const
const ENDPOINT = 'https://api.coresignal.com/cdapi/v2/agentic_search/fast'

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

function strings(value: unknown, max = 40): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.flatMap(item => {
    if (typeof item === 'string') return [item.trim()]
    const row = record(item)
    return [str(row.name), str(row.skill), str(row.label)].filter(Boolean) as string[]
  }).filter(Boolean))).slice(0, max)
}

function bounded(values: string[] | undefined, max: number): string[] {
  return Array.from(new Set((values || []).map(value => value.trim()).filter(Boolean))).slice(0, max)
}

/** Build a controlled natural-language prompt from recruiter-approved Role Brain fields. */
export function buildCoresignalAgenticPromptV36_8(request: CandidateDataSearchRequestV36_8): string {
  const titles = bounded(request.titles, 30)
  const skills = bounded(request.skills, 40)
  const locations = bounded(request.locations, 30)
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
  return experiences.find(item => item.current === true || item.is_current === true) || experiences[0] || {}
}

function toObservation(row: Record<string, unknown>): CandidateProviderObservationV36_8 | undefined {
  const providerPersonId = str(row.id) || str(row.employee_id) || str(row.member_id) || str(row.profile_id)
  const displayName = str(row.full_name) || str(row.name)
  if (!providerPersonId || !displayName) return undefined

  const experience = currentExperience(row)
  const currentTitle = str(row.active_experience_title) || str(row.current_title) || str(experience.title) || str(experience.position)
  const currentEmployer = str(row.company_name) || str(row.active_experience_company_name) || str(row.current_company_name) || str(experience.company_name) || str(experience.company)
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
        message: 'Coresignal /fast retrieval only. Provider ranking and generated query semantics do not establish SourcingOS qualification truth.',
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
