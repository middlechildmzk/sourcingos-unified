import 'server-only'
import type { ResumeCvCandidateSeedV40_5I, ResumeCvProviderRecordV40_5I, ResumeCvProviderResultV40_5I } from './types-v40-5i'

const ENDPOINT = 'https://api.exa.ai/search'

function clean(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/**
 * Exa is the semantic/public-web expansion lane: personal sites, portfolio
 * pages, university/conference profiles, technical blogs, GitHub-linked
 * sites, and explicitly public PDF/DOC/DOCX Resume/CV resources that a
 * keyword SERP can miss. This is prose, not a boolean query -- Exa's search
 * is natural-language.
 */
export function buildExaResumeQueryV40_5I(candidate: ResumeCvCandidateSeedV40_5I): string {
  const name = clean(candidate.canonical_name, 180)
  const context = [clean(candidate.current_title, 120), clean(candidate.current_company, 120), clean(candidate.location, 120)]
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
  const suffix = context ? ` (${context})` : ''
  return `Public resume, CV, personal website, portfolio, or professional bio page for ${name}${suffix}.`.slice(0, 900)
}

export async function searchResumeCvWithExaV40_5I(query: string, opts: { numResults?: number } = {}): Promise<ResumeCvProviderResultV40_5I> {
  const started = Date.now()
  const key = process.env.EXA_API_KEY?.trim()
  if (!key) {
    return {
      telemetry: { provider: 'exa', status: 'unavailable', requests: 0, errors: 0, urlsReturned: 0, latencyMs: 0, message: 'EXA_API_KEY is not configured.' },
      records: [],
    }
  }
  const cleanQuery = String(query || '').trim().slice(0, 900)
  if (!cleanQuery) {
    return {
      telemetry: { provider: 'exa', status: 'failed', requests: 0, errors: 0, urlsReturned: 0, latencyMs: 0, message: 'A Resume/CV search query is required.' },
      records: [],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: cleanQuery, type: 'auto', numResults: Math.max(5, Math.min(20, opts.numResults || 10)) }),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        telemetry: { provider: 'exa', status: 'failed', requests: 1, errors: 1, urlsReturned: 0, latencyMs: Date.now() - started, message: `Exa returned HTTP ${response.status}.` },
        records: [],
      }
    }
    const payload = await response.json() as Record<string, unknown>
    const results = Array.isArray(payload.results) ? payload.results.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
    const retrievedAt = new Date().toISOString()
    const records: ResumeCvProviderRecordV40_5I[] = []
    results.forEach((item, index) => {
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      if (!url) return
      const highlights = Array.isArray(item.highlights) ? item.highlights.filter((value): value is string => typeof value === 'string') : []
      records.push({
        provider: 'exa',
        url,
        title: typeof item.title === 'string' ? item.title.slice(0, 300) : undefined,
        snippet: highlights[0]?.slice(0, 500),
        query: cleanQuery,
        rank: typeof item.score === 'number' ? item.score : index + 1,
        retrievedAt,
      })
    })

    return {
      telemetry: {
        provider: 'exa',
        status: 'completed',
        requests: 1,
        errors: 0,
        urlsReturned: records.length,
        latencyMs: Date.now() - started,
        message: `Exa returned ${records.length} semantic public-web result${records.length === 1 ? '' : 's'}.`,
      },
      records,
    }
  } catch {
    return {
      telemetry: { provider: 'exa', status: 'failed', requests: 1, errors: 1, urlsReturned: 0, latencyMs: Date.now() - started, message: 'Network error reaching Exa.' },
      records: [],
    }
  }
}
