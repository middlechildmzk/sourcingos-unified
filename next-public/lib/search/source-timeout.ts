// ─────────────────────────────────────────────────────────────────────────────
// lib/search/source-timeout.ts - fetch with independent per-source timeout.
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

/**
 * POST with an independent timeout and an optional parent search signal.
 * A parent cancellation is distinguishable from a source timeout so stale
 * search runs can stop without being reported as failed lanes.
 */
export async function fetchWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<{ timedOut: boolean; cancelled: boolean; data: unknown }> {
  const controller = new AbortController()
  const abortFromParent = () => controller.abort()
  if (parentSignal?.aborted) controller.abort()
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true })

  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = await response.json()
    return { timedOut: false, cancelled: false, data }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      const cancelled = Boolean(parentSignal?.aborted)
      return { timedOut: !cancelled, cancelled, data: null }
    }
    throw error
  } finally {
    clearTimeout(timer)
    parentSignal?.removeEventListener('abort', abortFromParent)
  }
}

// Manual-safe lanes never hit a live API - they open a guided workflow instead.
export const MANUAL_SAFE_LANES = [
  { id: 'linkedin_xray', label: 'LinkedIn X-Ray', href: '/tools/xray-search' },
  { id: 'clearancejobs', label: 'ClearanceJobs / manual', href: '/tools/jd-search-strategy' },
  { id: 'google_xray', label: 'Google X-Ray', href: '/tools/xray-search' },
  { id: 'resume_xray', label: 'Public resume X-Ray', href: '/tools/xray-search' },
]
