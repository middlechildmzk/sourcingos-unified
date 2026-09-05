import 'server-only'
import { searchResumeCvWithSerperV40_5I } from './serper-resume-v40-5i'
import { buildExaResumeQueryV40_5I, searchResumeCvWithExaV40_5I } from './exa-resume-v40-5i'
import { searchResumeCvWithBrightDataFallbackV40_5I } from './brightdata-resume-fallback-v40-5i'
import { classifyResumeCvUrlV40_5I, normalizeResumeCvUrlV40_5I, type ResumeCvUrlClassificationV40_5I } from './url-safety-v40-5i'
import type {
  ResumeCvCandidateSeedV40_5I,
  ResumeCvProviderNameV40_5I,
  ResumeCvProviderRecordV40_5I,
  ResumeCvProviderTelemetryV40_5I,
} from './types-v40-5i'

export type ResumeCvDiscoveredUrlV40_5I = {
  url: string
  classification: ResumeCvUrlClassificationV40_5I
  provider: ResumeCvProviderNameV40_5I
  query: string
  title?: string
  snippet?: string
}

export type ResumeCvDiscoveryRunV40_5I = {
  urls: ResumeCvDiscoveredUrlV40_5I[]
  providerTelemetry: ResumeCvProviderTelemetryV40_5I[]
  warnings: string[]
}

/**
 * Provider-agnostic Resume/CV discovery.
 *
 *   Serper (exact/Google-style document search, one request per selected
 *   query) -> Exa (one semantic/public-web expansion request) -> Bright
 *   Data (bounded fallback, only if the first two returned zero usable
 *   records combined, and only if Bright Data is actually configured).
 *
 * Every provider's raw URLs are normalized and classified through the same
 * safety gate before being considered further -- no provider gets a
 * downstream shortcut. Bright Data is deliberately no longer a required
 * lane: SourcingOS does not provision or pay for it, and this orchestrator
 * only reaches for it when the primary public-web providers found nothing.
 */
export async function discoverResumeCvUrlsV40_5I(input: {
  candidate: ResumeCvCandidateSeedV40_5I
  serperQueries: string[]
  allowBrightDataFallback?: boolean
}): Promise<ResumeCvDiscoveryRunV40_5I> {
  const warnings: string[] = []
  const providerTelemetry: ResumeCvProviderTelemetryV40_5I[] = []
  const byUrl = new Map<string, ResumeCvDiscoveredUrlV40_5I>()

  function admit(records: ResumeCvProviderRecordV40_5I[]) {
    for (const record of records) {
      const normalized = normalizeResumeCvUrlV40_5I(record.url)
      if (!normalized || byUrl.has(normalized)) continue
      byUrl.set(normalized, {
        url: normalized,
        classification: classifyResumeCvUrlV40_5I(normalized),
        provider: record.provider,
        query: record.query,
        title: record.title,
        snippet: record.snippet,
      })
    }
  }

  const serperQueries = input.serperQueries.filter(Boolean).slice(0, 4)
  const serperResults = await Promise.all(serperQueries.map(query => searchResumeCvWithSerperV40_5I(query)))
  for (const result of serperResults) {
    providerTelemetry.push(result.telemetry)
    if (result.telemetry.status === 'failed') warnings.push(`serper: ${result.telemetry.message}`)
    admit(result.records)
  }

  const exaQuery = buildExaResumeQueryV40_5I(input.candidate)
  const exaResult = await searchResumeCvWithExaV40_5I(exaQuery)
  providerTelemetry.push(exaResult.telemetry)
  if (exaResult.telemetry.status === 'failed') warnings.push(`exa: ${exaResult.telemetry.message}`)
  admit(exaResult.records)

  const totalUrlsSoFar = providerTelemetry.reduce((sum, item) => sum + item.urlsReturned, 0)
  if (totalUrlsSoFar === 0 && input.allowBrightDataFallback !== false) {
    const fallbackQuery = serperQueries[0] || exaQuery
    const brightDataResult = await searchResumeCvWithBrightDataFallbackV40_5I(fallbackQuery)
    providerTelemetry.push(brightDataResult.telemetry)
    if (brightDataResult.telemetry.status === 'failed') warnings.push(`brightdata: ${brightDataResult.telemetry.message}`)
    admit(brightDataResult.records)
  }

  return { urls: Array.from(byUrl.values()), providerTelemetry, warnings }
}
