/**
 * Page fetching for sources with no official API.
 *
 * The port is deliberately narrow. There is no proxy option, no stealth flag,
 * no persistent browser profile, no cookie jar, and no user-script hook,
 * because the guardrail is not "we choose not to bypass access controls", it
 * is "the wrapper cannot express that request". Crawl4AI supports all of those
 * capabilities. None of them are reachable from this type.
 *
 * robots.txt handling is fail-closed here, which differs from the underlying
 * library. Crawl4AI's documented behaviour is that an unfetchable robots.txt
 * permits the crawl. For an unattended fleet that is the wrong default: a
 * transient 500 on robots.txt would silently convert a disallowed path into an
 * allowed one. This adapter treats an unreadable robots.txt as a skip.
 */

/** Outcome of a single page fetch. Never throws for an expected refusal. */
export type FetchOutcome =
  | { kind: 'ok'; url: string; finalUrl: string; markdown: string; fetchedAt: string }
  | { kind: 'robots_disallowed'; url: string; detail: string }
  | { kind: 'robots_unreadable'; url: string; detail: string }
  | { kind: 'not_found'; url: string }
  | { kind: 'error'; url: string; detail: string }

export type PageFetcher = {
  readonly key: string
  /** Fetch one public page as clean markdown. */
  fetch(url: string): Promise<FetchOutcome>
}

/** Only http(s), and no credentials embedded in the URL. */
export function isFetchableUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  // A URL carrying a username or password is an access-controlled resource.
  if (parsed.username || parsed.password) return false
  return true
}

export const FLEET_USER_AGENT =
  'SourcingOS/33.4 (+https://getsourcingos.com/crawler) recruiter-controlled-talent-intelligence'

/**
 * Crawl4AI adapter, talking to a self-hosted Docker instance.
 *
 * Deployment notes that matter:
 *   - Crawl4AI is Python plus Playwright and cannot run on Vercel serverless.
 *     Host it separately and reach it over the network.
 *   - Never expose its port publicly. The project shipped critical Docker API
 *     vulnerabilities through v0.8.7 (RCE, SSRF, auth bypass, hardcoded JWT
 *     secret) before hardening the server by default in v0.9.0. Treat it as an
 *     internal service, pin the image, and keep auth on.
 */
export type Crawl4AiOptions = {
  baseUrl: string
  authToken?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

type Crawl4AiResult = {
  success?: boolean
  status_code?: number
  url?: string
  redirected_url?: string
  error_message?: string
  markdown?: string | { raw_markdown?: string; fit_markdown?: string }
}

export function readMarkdown(result: Crawl4AiResult): string {
  const markdown = result.markdown
  if (typeof markdown === 'string') return markdown
  if (markdown && typeof markdown === 'object') {
    // `fit_markdown` is the noise-filtered variant, which is what a profile
    // page wants. Fall back to raw when the filter produced nothing.
    return markdown.fit_markdown || markdown.raw_markdown || ''
  }
  return ''
}

export function createCrawl4AiFetcher(options: Crawl4AiOptions): PageFetcher {
  const doFetch = options.fetchImpl || fetch
  const timeoutMs = options.timeoutMs ?? 20_000

  return {
    key: 'fetcher.crawl4ai',

    async fetch(url: string): Promise<FetchOutcome> {
      if (!isFetchableUrl(url)) {
        return { kind: 'error', url, detail: 'URL is not a credential-free http(s) address.' }
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await doFetch(`${options.baseUrl.replace(/\/$/, '')}/crawl`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            ...(options.authToken ? { authorization: `Bearer ${options.authToken}` } : {}),
          },
          body: JSON.stringify({
            urls: [url],
            crawler_config: {
              // Non-negotiable, and not parameterised. These three lines are
              // the entire compliance posture of the no-API lane.
              check_robots_txt: true,
              user_agent: FLEET_USER_AGENT,
              cache_mode: 'ENABLED',
            },
          }),
        })

        if (!response.ok) {
          return {
            kind: 'error',
            url,
            detail: `Crawl4AI service returned HTTP ${response.status}.`,
          }
        }

        const payload = (await response.json()) as { results?: Crawl4AiResult[] }
        const result = payload.results?.[0]

        if (!result) {
          return { kind: 'error', url, detail: 'Crawl4AI returned no result for this URL.' }
        }

        // 403 is how Crawl4AI signals a robots.txt disallow.
        if (result.status_code === 403) {
          return {
            kind: 'robots_disallowed',
            url,
            detail: result.error_message || 'Disallowed by robots.txt.',
          }
        }

        if (result.status_code === 404) {
          return { kind: 'not_found', url }
        }

        if (!result.success) {
          const detail = result.error_message || 'Unknown fetch failure.'
          // Fail closed. The library permits the crawl when robots.txt cannot
          // be read; an unattended fleet must not.
          if (/robots/i.test(detail)) {
            return { kind: 'robots_unreadable', url, detail }
          }
          return { kind: 'error', url, detail }
        }

        const markdown = readMarkdown(result)
        if (!markdown.trim()) {
          return { kind: 'error', url, detail: 'Page fetched but produced no readable content.' }
        }

        return {
          kind: 'ok',
          url,
          finalUrl: result.redirected_url || result.url || url,
          markdown,
          fetchedAt: new Date().toISOString(),
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        return { kind: 'error', url, detail }
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
