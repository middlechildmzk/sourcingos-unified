import 'server-only'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

const ACTOR_ID = 'apify~website-content-crawler'
const ENDPOINT = `https://api.apify.com/v2/actors/${ACTOR_ID}/run-sync-get-dataset-items`

function token(): string | undefined {
  return process.env.APIFY_API_TOKEN?.trim() || undefined
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function textFromRow(row: Record<string, unknown>): string | undefined {
  const candidates = [row.markdown, row.text, row.content, row.pageContent]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

export function buildApifyPublicPageInputV36_16(rawUrl: string) {
  const url = publicDeepRefreshUrlV36_16(rawUrl)
  return {
    startUrls: [{ url }],
    crawlerType: 'playwright:adaptive',
    includeUrlGlobs: [],
    excludeUrlGlobs: [],
    maxCrawlDepth: 0,
    maxCrawlPages: 1,
    useSitemaps: false,
    useLlmsTxt: false,
    respectRobotsTxtFile: true,
    proxyConfiguration: { useApifyProxy: true },
    initialCookies: [],
    customHttpHeaders: {},
    signHttpRequests: false,
    blockMedia: true,
    summarize: false,
  }
}

export type ApifyPublicWebResultV36_16 = {
  provider: 'apify'
  transport: 'rest'
  actor: 'apify/website-content-crawler'
  url: string
  text: string
  observedAt: string
  freshness: 'live'
  trust: {
    externalContentIsUntrusted: true
    becomesCandidateFact: false
    loginOrCookieScrapingAllowed: false
  }
}

/**
 * One-page explicit public refresh only. The model cannot choose an Actor,
 * cookies, proxy settings, crawl depth, or arbitrary input. Broader crawls belong
 * on the async job plane with a separately audited actor catalog.
 */
export async function refreshPublicUrlWithApifyV36_16(rawUrl: string): Promise<ApifyPublicWebResultV36_16> {
  const apiToken = token()
  if (!apiToken) throw new Error('Apify is not configured.')
  const input = buildApifyPublicPageInputV36_16(rawUrl)
  const url = input.startUrls[0].url
  const endpoint = new URL(ENDPOINT)
  endpoint.searchParams.set('token', apiToken)
  endpoint.searchParams.set('timeout', '45')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 47_000)
  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) throw new Error('Apify rejected the public-page refresh request.')
    if (response.status === 429) throw new Error('Apify is rate limited.')
    if (!response.ok) throw new Error(`Apify Website Content Crawler returned HTTP ${response.status}.`)
    const payload = await response.json() as unknown
    const rows = Array.isArray(payload) ? payload.map(record) : []
    const row = rows.find(item => textFromRow(item))
    const text = row ? textFromRow(row) : undefined
    if (!text) throw new Error('Apify completed but returned no readable public-page text.')
    return {
      provider: 'apify',
      transport: 'rest',
      actor: 'apify/website-content-crawler',
      url,
      text: text.slice(0, 120_000),
      observedAt: new Date().toISOString(),
      freshness: 'live',
      trust: {
        externalContentIsUntrusted: true,
        becomesCandidateFact: false,
        loginOrCookieScrapingAllowed: false,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}
