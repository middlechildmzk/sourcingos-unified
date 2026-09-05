/**
 * Raw landing zone for the discovery fleet.
 *
 * Every record a scout retrieves is written here verbatim before anything
 * interprets it. This is what makes provenance replay possible: if a promoted
 * fact is ever challenged, the exact payload and the exact retrieval terms
 * that produced it can be re-read.
 *
 * Partitioning is `{source}/{YYYY-MM-DD}/{runId}.jsonl` so a single run can be
 * quarantined or re-processed without touching neighbouring runs.
 */

import type { SourceName } from '../source-types'
import type { LandingZone, RawDiscoveryRecord } from './types'

export function landingPath(source: SourceName, runId: string, at: Date): string {
  const day = at.toISOString().slice(0, 10)
  const safeRun = runId.replace(/[^a-zA-Z0-9_-]/g, '')
  return `sourcingos-raw/${source}/${day}/${safeRun}.jsonl`
}

export function serializeRecords(records: readonly RawDiscoveryRecord[]): string {
  return records.map(record => JSON.stringify(record)).join('\n') + (records.length ? '\n' : '')
}

/**
 * In-memory landing zone. Used by tests and by local-first operation, where a
 * run should be fully exercisable with no cloud storage configured.
 */
export class MemoryLandingZone implements LandingZone {
  readonly writes: Array<{ path: string; records: RawDiscoveryRecord[] }> = []

  async append(source: SourceName, records: readonly RawDiscoveryRecord[]): Promise<string> {
    const runId = records[0]?.runId || 'empty'
    const path = landingPath(source, runId, new Date())
    this.writes.push({ path, records: [...records] })
    return path
  }

  all(): RawDiscoveryRecord[] {
    return this.writes.flatMap(write => write.records)
  }
}

/**
 * Vercel Blob landing zone.
 *
 * The `put` implementation is injected rather than imported so this module
 * compiles and tests without `@vercel/blob` installed. Wire the real client at
 * the composition root:
 *
 *   import { put } from '@vercel/blob'
 *   new BlobLandingZone(async (path, body) => {
 *     const res = await put(path, body, { access: 'public', addRandomSuffix: false })
 *     return res.pathname
 *   })
 */
export type BlobPutFn = (path: string, body: string) => Promise<string>

export class BlobLandingZone implements LandingZone {
  constructor(private readonly put: BlobPutFn) {}

  async append(source: SourceName, records: readonly RawDiscoveryRecord[]): Promise<string> {
    if (!records.length) return ''
    const runId = records[0].runId
    const path = landingPath(source, runId, new Date())
    await this.put(path, serializeRecords(records))
    return path
  }
}
