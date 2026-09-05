import 'server-only'
import type {
  CandidateDataSearchRequestV36_8,
  CandidateDataSearchResultV36_8,
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
} from '../types-v36-8'
import { safeCandidateSearchLimitV36_8 } from '../types-v36-8'

const ENDPOINT = 'https://google.serper.dev/search'
const PROVIDER = 'serper' as const

type XrayStrategy = { id: string; query: string }

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function unique(values: string[] = [], max = 8): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, max)
}

function quoted(values: string[], max = 6): string {
  return unique(values, max).map(value => `"${value.replace(/"/g, '')}"`).join(' ')
}

function roleContext(request: CandidateDataSearchRequestV36_8) {
  const titles = unique(request.titles || [], 5)
  const skills = unique(request.skills || [], 8)
  const locations = unique(request.locations || [], 4)
  const companies = unique(request.companies || [], 4)
  const mustHaves = unique((request.requirements || []).filter(item => item.mustHave).map(item => item.text), 6)
  return { titles, skills, locations, companies, mustHaves }
}

/**
 * Generate a bounded portfolio of deterministic X-ray strategies from recruiter-
 * approved structured criteria. The generator does not invent synonyms, titles,
 * clearance, tenure, employers, or other candidate facts.
 */
export function buildSerperXrayQueriesV36_16(request: CandidateDataSearchRequestV36_8): XrayStrategy[] {
  const { titles, skills, locations, companies, mustHaves } = roleContext(request)
  const title = quoted(titles, 3)
  const skill = quoted(skills, 5)
  const location = quoted(locations, 2)
  const company = quoted(companies, 2)
  const required = quoted(mustHaves, 3)
  const core = clean([title, skill, location, company, required].filter(Boolean).join(' '))
  const fallback = clean(request.query).slice(0, 600)
  const terms = core || fallback

  const strategies: XrayStrategy[] = [
    { id: 'linkedin_strict', query: clean(`site:linkedin.com/in/ ${terms}`) },
    { id: 'resume_pdf', query: clean(`(filetype:pdf OR filetype:doc OR filetype:docx) (resume OR CV) ${terms}`) },
    { id: 'github_profile', query: clean(`site:github.com ${title || skill || terms} ${skill} ${location}`) },
    { id: 'portfolio', query: clean(`(site:github.io OR site:notion.site OR site:about.me) ${title || terms} ${skill} ${location}`) },
  ]

  if (companies.length) strategies.splice(1, 0, {
    id: 'linkedin_company',
    query: clean(`site:linkedin.com/in/ ${company} ${title || skill || terms} ${location}`),
  })

  // Engineering-heavy searches get one developer-community lane. This remains
  // retrieval-only and never becomes a proficiency score.
  if (/engineer|developer|architect|devops|sre|software|data|security|linux|rhel/i.test(`${titles.join(' ')} ${skills.join(' ')}`)) {
    strategies.push({ id: 'stackoverflow', query: clean(`site:stackoverflow.com/users ${title || skill || terms} ${skill} ${location}`) })
  }

  const seen = new Set<string>()
  return strategies
    .map(item => ({ ...item, query: item.query.slice(0, 900) }))
    .filter(item => item.query.length > 4 && !seen.has(item.query.toLowerCase()) && seen.add(item.query.toLowerCase()))
    .slice(0, 8)
}

function validHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function normalizedUrlKey(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    const params = [...url.searchParams.entries()].filter(([key]) => !/^utm_/i.test(key) && key !== 'gclid')
    url.search = ''
    for (const [key, val] of params) url.searchParams.append(key, val)
    return url.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return value.toLowerCase()
  }
}

function profileUrl(url: string): CandidateProviderProfileUrlV36_8[] {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'linkedin.com' && /^\/in\//i.test(parsed.pathname)) return [{ kind: 'linkedin', url }]
    if (host === 'github.com' && parsed.pathname.split('/').filter(Boolean).length === 1) return [{ kind: 'github', url }]
    if (host.endsWith('stackoverflow.com') && /^\/users\//i.test(parsed.pathname)) return [{ kind: 'stackoverflow', url }]
    if (host === 'github.io' || host.endsWith('.github.io') || host === 'notion.site' || host.endsWith('.notion.site') || host === 'about.me') return [{ kind: 'personal', url }]
    if (/\.(?:pdf|doc|docx)$/i.test(parsed.pathname)) return [{ kind: 'personal', url }]
    return []
  } catch {
    return []
  }
}

function candidateLabel(title: unknown, urls: CandidateProviderProfileUrlV36_8[]): string | undefined {
  if (typeof title !== 'string') return undefined
  let value = clean(title)
  if (!value) return undefined
  // Common SERP title suffixes are retrieval decoration, not part of identity.
  value = value.replace(/\s*[|–—-]\s*(LinkedIn|GitHub|Stack Overflow).*$/i, '').trim()
  if (urls.some(item => item.kind === 'linkedin')) value = value.split(/\s+[|–—-]\s+/)[0]?.trim() || value
  if (value.length < 2 || value.length > 160) return undefined
  return value
}

function candidateObservation(
  item: Record<string, unknown>,
  strategy: XrayStrategy,
  observedAt: string,
): CandidateProviderObservationV36_8 | undefined {
  const url = validHttpUrl(item.link)
  if (!url) return undefined
  const urls = profileUrl(url)
  if (!urls.length) return undefined
  const displayName = candidateLabel(item.title, urls)
  if (!displayName) return undefined
  const snippet = typeof item.snippet === 'string' ? clean(item.snippet).slice(0, 480) : undefined
  const key = normalizedUrlKey(url)

  return {
    provider: PROVIDER,
    providerPersonId: key,
    displayName,
    skills: [],
    profileUrls: urls,
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    providerExplanation: `Serper Google X-ray discovery via ${strategy.id}. SERP title/snippet are retrieval context only${snippet ? `: ${snippet}` : '.'} They are not candidate qualification evidence until corroborated by a person-linked source.`,
    observedAt,
  }
}

export async function searchSerperXrayV36_16(request: CandidateDataSearchRequestV36_8): Promise<CandidateDataSearchResultV36_8> {
  const started = Date.now()
  const key = process.env.SERPER_API_KEY
  if (!key) {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'unavailable', discovered: 0, latencyMs: 0, message: 'SERPER_API_KEY is not configured.' },
      warnings: ['Serper X-ray unavailable: provider key missing.'],
    }
  }

  const strategies = buildSerperXrayQueriesV36_16(request)
  const perQuery = Math.max(3, Math.min(10, Math.ceil(safeCandidateSearchLimitV36_8(request.limit) / Math.max(1, strategies.length)) + 2))
  try {
    const settled = await Promise.all(strategies.map(async strategy => {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ q: strategy.query, num: perQuery }),
        cache: 'no-store',
      })
      if (!response.ok) return { strategy, records: [] as Record<string, unknown>[], status: response.status }
      const payload = await response.json() as Record<string, unknown>
      const records = Array.isArray(payload.organic) ? payload.organic.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
      return { strategy, records, status: response.status }
    }))

    const observedAt = new Date().toISOString()
    const observations: CandidateProviderObservationV36_8[] = []
    const seen = new Set<string>()
    for (const batch of settled) {
      for (const record of batch.records) {
        const observation = candidateObservation(record, batch.strategy, observedAt)
        if (!observation) continue
        const key = observation.providerPersonId
        if (seen.has(key)) continue
        seen.add(key)
        observations.push(observation)
      }
    }

    const failed = settled.filter(item => item.status < 200 || item.status >= 300)
    return {
      observations: observations.slice(0, Math.max(safeCandidateSearchLimitV36_8(request.limit), 20)),
      telemetry: {
        provider: PROVIDER,
        status: observations.length || failed.length < settled.length ? 'completed' : 'failed',
        discovered: observations.length,
        latencyMs: Date.now() - started,
        message: `Serper executed ${strategies.length} bounded X-ray strateg${strategies.length === 1 ? 'y' : 'ies'}; only candidate-like public URLs were admitted. SERP snippets remain retrieval context, not candidate evidence.`,
      },
      warnings: failed.length ? [`${failed.length} of ${settled.length} Serper X-ray strategies returned a non-success status.`] : [],
    }
  } catch {
    return {
      observations: [],
      telemetry: { provider: PROVIDER, status: 'failed', discovered: 0, latencyMs: Date.now() - started, message: 'Could not reach Serper.' },
      warnings: ['Network error reaching Serper X-ray Search.'],
    }
  }
}
