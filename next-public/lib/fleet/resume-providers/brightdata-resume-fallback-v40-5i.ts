import 'server-only'
import { searchWebWithBrightDataV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'
import { extractUrlsFromTextV40_5I } from './url-safety-v40-5i'
import type { ResumeCvProviderRecordV40_5I, ResumeCvProviderResultV40_5I } from './types-v40-5i'

/**
 * Bright Data is now an OPTIONAL fallback for the Resume/CV lane, attempted
 * only when Serper and Exa both return zero usable records for a candidate.
 * It stays gated behind the account's own configured Bright Data credentials
 * and active SERP zone -- SourcingOS never provisions, buys, or activates a
 * paid Bright Data zone on its own. When Bright Data is not configured (or
 * has no active SERP zone), this reports 'unavailable' rather than 'failed'
 * so operators can tell "not configured" apart from "provider error."
 */
export async function searchResumeCvWithBrightDataFallbackV40_5I(query: string): Promise<ResumeCvProviderResultV40_5I> {
  const started = Date.now()
  try {
    const result = await searchWebWithBrightDataV36_16(query)
    const retrievedAt = new Date().toISOString()
    const urls = extractUrlsFromTextV40_5I(result.text)
    const records: ResumeCvProviderRecordV40_5I[] = urls.map((url, index) => ({
      provider: 'brightdata',
      url,
      query,
      rank: index + 1,
      retrievedAt,
    }))
    return {
      telemetry: {
        provider: 'brightdata',
        status: 'completed',
        requests: 1,
        errors: 0,
        urlsReturned: records.length,
        latencyMs: Date.now() - started,
        message: `Bright Data fallback returned ${records.length} candidate URL${records.length === 1 ? '' : 's'} via ${result.tool}.`,
      },
      records,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bright Data fallback failed.'
    // "Not configured" / "no active SERP zone" are configuration states, not
    // provider errors -- keep those distinguishable in telemetry so a broken
    // Bright Data account is never confused with a genuine zero-yield search.
    const unavailable = /not configured|no active serp zone/i.test(message)
    return {
      telemetry: {
        provider: 'brightdata',
        status: unavailable ? 'unavailable' : 'failed',
        requests: unavailable ? 0 : 1,
        errors: unavailable ? 0 : 1,
        urlsReturned: 0,
        latencyMs: Date.now() - started,
        message,
      },
      records: [],
    }
  }
}
