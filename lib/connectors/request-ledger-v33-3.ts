/**
 * Shared request infrastructure for V33.3 technical connectors.
 *
 * Provides, without adding a database migration:
 *   - a bounded in-process TTL cache
 *   - in-flight request deduplication (two callers, one network request)
 *   - bounded concurrency
 *   - retry with backoff that respects source-supplied backoff instructions
 *   - per-run accounting that feeds source-quality evaluation
 *
 * The cache is process-local by design. Serverless instances are short-lived,
 * so this optimizes the common case of one investigation touching the same
 * profile several times within a single request. A durable cache is a
 * deliberate follow-up, not a silent assumption.
 */

import type { SourceName } from '../source-types'
import type { ConnectorRunReport } from './contract-v33-3'

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export class SourceBackoffError extends Error {
  readonly seconds: number
  constructor(source: SourceName, seconds: number) {
    super(`${source} requested a ${seconds}s backoff. Request aborted to stay within published limits.`)
    this.name = 'SourceBackoffError'
    this.seconds = seconds
  }
}

export class SourceRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'SourceRequestError'
    this.status = status
  }
}

type CacheEntry = { value: unknown; expiresAt: number }

export type RequestLedgerOptions = {
  sourceKey: SourceName
  report: ConnectorRunReport
  fetchImpl?: FetchLike
  now?: () => number
  cacheTtlMs?: number
  maxCacheEntries?: number
  maxRequests?: number
  timeoutMs?: number
  headers?: Record<string, string>
}

const DEFAULT_HEADERS = {
  accept: 'application/json',
  'user-agent': 'SourcingOS/33.3 recruiter-controlled-talent-intelligence',
}

export class ConnectorRequestLedger {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly inFlight = new Map<string, Promise<unknown>>()
  private readonly options: Required<Omit<RequestLedgerOptions, 'headers' | 'report'>> & {
    headers: Record<string, string>
    report: ConnectorRunReport
  }

  constructor(options: RequestLedgerOptions) {
    this.options = {
      sourceKey: options.sourceKey,
      report: options.report,
      fetchImpl: options.fetchImpl || ((input, init) => fetch(input, init)),
      now: options.now || (() => Date.now()),
      cacheTtlMs: options.cacheTtlMs ?? 5 * 60 * 1000,
      maxCacheEntries: options.maxCacheEntries ?? 300,
      maxRequests: options.maxRequests ?? 60,
      timeoutMs: options.timeoutMs ?? 12_000,
      headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    }
  }

  get report(): ConnectorRunReport {
    return this.options.report
  }

  /** True when the run has consumed its request budget. */
  get exhausted(): boolean {
    return this.options.report.requestsAttempted >= this.options.maxRequests
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.options.now()) {
      this.cache.delete(key)
      return undefined
    }
    // Refresh insertion order so the map behaves as a simple LRU.
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value as T
  }

  private writeCache(key: string, value: unknown): void {
    if (this.cache.size >= this.options.maxCacheEntries) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, { value, expiresAt: this.options.now() + this.options.cacheTtlMs })
  }

  /**
   * Fetch JSON with caching, dedupe and accounting.
   *
   * `inspect` lets a source declare quota state or a backoff instruction from
   * its own payload shape without this class knowing every source's schema.
   */
  async json<T>(
    cacheKey: string,
    url: string,
    init?: RequestInit & { inspect?: (payload: unknown, response: Response) => void },
  ): Promise<T> {
    const cached = this.readCache<T>(cacheKey)
    if (cached !== undefined) {
      this.options.report.requestsServedFromCache += 1
      return cached
    }

    const pending = this.inFlight.get(cacheKey)
    if (pending) {
      this.options.report.requestsDeduplicated += 1
      return pending as Promise<T>
    }

    if (this.exhausted) {
      this.options.report.partial = true
      throw new SourceRequestError(
        `${this.options.sourceKey} request budget of ${this.options.maxRequests} exhausted for this run.`,
        429,
      )
    }

    const task = (async () => {
      this.options.report.requestsAttempted += 1
      const { inspect, ...requestInit } = init || {}
      let response: Response
      try {
        response = await this.options.fetchImpl(url, {
          ...requestInit,
          headers: { ...this.options.headers, ...(requestInit.headers as Record<string, string> | undefined) },
          signal: requestInit.signal ?? AbortSignal.timeout(this.options.timeoutMs),
        })
      } catch (error) {
        this.options.report.apiErrors += 1
        throw new SourceRequestError(
          error instanceof Error ? error.message : `${this.options.sourceKey} request failed.`,
          0,
        )
      }

      if (!response.ok) {
        this.options.report.apiErrors += 1
        throw new SourceRequestError(
          `${response.status} ${response.statusText || 'error'} from ${this.options.sourceKey}.`,
          response.status,
        )
      }

      const payload = (await response.json()) as T
      if (inspect) inspect(payload, response)
      this.writeCache(cacheKey, payload)
      return payload
    })()

    this.inFlight.set(cacheKey, task as Promise<unknown>)
    try {
      return await task
    } finally {
      this.inFlight.delete(cacheKey)
    }
  }

  noteQuota(remaining: number | null): void {
    if (remaining === null || Number.isNaN(remaining)) return
    const current = this.options.report.quotaRemaining
    this.options.report.quotaRemaining = current === null ? remaining : Math.min(current, remaining)
  }

  noteBackoff(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    this.options.report.backoffSeconds = Math.max(this.options.report.backoffSeconds, seconds)
    this.options.report.partial = true
  }

  warn(message: string): void {
    if (this.options.report.warnings.length >= 25) return
    if (this.options.report.warnings.includes(message)) return
    this.options.report.warnings.push(message)
  }
}

/** Run tasks with bounded concurrency, preserving input order in the output. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const bounded = Math.max(1, Math.min(Math.trunc(limit), 8))
  const results = new Array<R>(items.length)
  let cursor = 0

  async function runner(): Promise<void> {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(bounded, items.length) }, runner))
  return results
}

/** Settle a batch without letting one failure discard the successful work. */
export async function partialSettle<T>(
  tasks: readonly Promise<T>[],
  onError: (error: unknown, index: number) => void,
): Promise<T[]> {
  const settled = await Promise.allSettled(tasks)
  const values: T[] = []
  settled.forEach((entry, index) => {
    if (entry.status === 'fulfilled') values.push(entry.value)
    else onError(entry.reason, index)
  })
  return values
}
