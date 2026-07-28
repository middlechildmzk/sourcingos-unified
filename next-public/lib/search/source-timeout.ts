// ─────────────────────────────────────────────────────────────────────────────
// lib/search/source-timeout.ts — fetch with independent per-source timeout.
// One slow source must never block the others, and a newer search can cancel an
// older run before stale results reach the UI.
// ─────────────────────────────────────────────────────────────────────────────

export type SourceStatus =
  | 'queued' | 'searching' | 'found' | 'no_results'
  | 'timed_out' | 'error' | 'manual_safe' | 'planned' | 'skipped'

export const SOURCE_TIMEOUTS_MS: Record<string, number> = {
  github: 8000, npm: 5000, pypi: 5000, crates: 5000, rubygems: 5000,
  openalex: 10000, huggingface: 10000, stackoverflow: 8000,
  npi: 10000, pubmed: 10000, orcid: 10000,
}

export const DEFAULT_TIMEOUT_MS = 8000

export async function fetchWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number,
  options: { signal?: AbortSignal } = {},
): Promise<{ timedOut: boolean; aborted: boolean; data: unknown }> {
  const controller = new AbortController()
  let timedOut = false
  const onExternalAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onExternalAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await response.json()
    return { timedOut: false, aborted: false, data }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { timedOut, aborted: !timedOut, data: null }
    }
    throw error
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }
}

export const MANUAL_SAFE_LANES = [
  { id: 'linkedin_xray', label: 'LinkedIn X-Ray', href: '/tools/xray-search' },
  { id: 'clearancejobs', label: 'ClearanceJobs / manual', href: '/tools/jd-search-strategy' },
  { id: 'google_xray', label: 'Google X-Ray', href: '/tools/xray-search' },
  { id: 'resume_xray', label: 'Public resume X-Ray', href: '/tools/xray-search' },
]
