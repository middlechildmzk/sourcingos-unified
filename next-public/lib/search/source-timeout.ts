// ─────────────────────────────────────────────────────────────────────────────
// lib/search/source-timeout.ts — fetch with independent per-source timeout.
// One slow source must never block the others.
// ─────────────────────────────────────────────────────────────────────────────

export type SourceStatus =
  | 'queued' | 'searching' | 'found' | 'no_results'
  | 'timed_out' | 'error' | 'manual_safe' | 'planned' | 'skipped'

// Faster APIs get a shorter leash; slower ones a longer one.
export const SOURCE_TIMEOUTS_MS: Record<string, number> = {
  github: 8000, npm: 5000, pypi: 5000, crates: 5000, rubygems: 5000,
  openalex: 10000, huggingface: 10000, stackoverflow: 8000,
  npi: 10000, pubmed: 10000, orcid: 10000,
}

export const DEFAULT_TIMEOUT_MS = 8000

/** POST with an AbortController-backed timeout. Resolves to parsed JSON or throws 'timeout'. */
export async function fetchWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<{ timedOut: boolean; data: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json()
    return { timedOut: false, data }
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { timedOut: true, data: null }
    }
    throw err
  }
}

// Manual-safe lanes never hit a live API — they open a guided workflow instead.
export const MANUAL_SAFE_LANES = [
  { id: 'linkedin_xray', label: 'LinkedIn X-Ray', href: '/tools/xray-search' },
  { id: 'clearancejobs', label: 'ClearanceJobs / manual', href: '/tools/jd-search-strategy' },
  { id: 'google_xray', label: 'Google X-Ray', href: '/tools/xray-search' },
  { id: 'resume_xray', label: 'Public resume X-Ray', href: '/tools/xray-search' },
]
