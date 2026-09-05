import 'server-only'
import type { ResumeCvProviderRecordV40_5I, ResumeCvProviderResultV40_5I } from './types-v40-5i'

const ENDPOINT = 'https://google.serper.dev/search'

/**
 * Serper is the deterministic, exact/Google-style Resume/CV search lane.
 * Query planning (broad name-only first, then bounded site: lanes) lives in
 * resumeSprintQueriesV40_5; this adapter only executes one already-built
 * query string and normalizes the raw response into the shared provider
 * contract.
 */
export async function searchResumeCvWithSerperV40_5I(query: string, opts: { num?: number } = {}): Promise<ResumeCvProviderResultV40_5I> {
  const started = Date.now()
  const key = process.env.SERPER_API_KEY?.trim()
  if (!key) {
    return {
      telemetry: { provider: 'serper', status: 'unavailable', requests: 0, errors: 0, urlsReturned: 0, latencyMs: 0, message: 'SERPER_API_KEY is not configured.' },
      records: [],
    }
  }
  const clean = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 900)
  if (!clean) {
    return {
      telemetry: { provider: 'serper', status: 'failed', requests: 0, errors: 0, urlsReturned: 0, latencyMs: 0, message: 'A Resume/CV search query is required.' },
      records: [],
    }
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ q: clean, num: Math.max(5, Math.min(20, opts.num || 10)) }),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        telemetry: { provider: 'serper', status: 'failed', requests: 1, errors: 1, urlsReturned: 0, latencyMs: Date.now() - started, message: `Serper returned HTTP ${response.status}.` },
        records: [],
      }
    }
    const payload = await response.json() as Record<string, unknown>
    const organic = Array.isArray(payload.organic) ? payload.organic.filter(item => item && typeof item === 'object') as Record<string, unknown>[] : []
    const retrievedAt = new Date().toISOString()
    const records: ResumeCvProviderRecordV40_5I[] = []
    organic.forEach((item, index) => {
      const url = typeof item.link === 'string' ? item.link.trim() : ''
      if (!url) return
      records.push({
        provider: 'serper',
        url,
        title: typeof item.title === 'string' ? item.title.slice(0, 300) : undefined,
        snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 500) : undefined,
        query: clean,
        rank: index + 1,
        retrievedAt,
      })
    })

    return {
      telemetry: {
        provider: 'serper',
        status: 'completed',
        requests: 1,
        errors: 0,
        urlsReturned: records.length,
        latencyMs: Date.now() - started,
        message: `Serper returned ${records.length} organic result${records.length === 1 ? '' : 's'} for one exact-document query.`,
      },
      records,
    }
  } catch {
    return {
      telemetry: { provider: 'serper', status: 'failed', requests: 1, errors: 1, urlsReturned: 0, latencyMs: Date.now() - started, message: 'Network error reaching Serper.' },
      records: [],
    }
  }
}
