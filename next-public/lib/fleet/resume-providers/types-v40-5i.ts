import 'server-only'

/**
 * V40.5i provider-agnostic Resume/CV discovery contract. Every provider
 * adapter (Serper, Exa, the optional Bright Data fallback, and any future
 * source) returns this same shape so the discovery pipeline, URL safety
 * gates, and telemetry never need to know which provider produced a result.
 */
export type ResumeCvProviderNameV40_5I = 'serper' | 'exa' | 'brightdata'

export type ResumeCvProviderRecordV40_5I = {
  provider: ResumeCvProviderNameV40_5I
  url: string
  title?: string
  snippet?: string
  query: string
  /** Rank/provider score if available. Retrieval ordering context only. */
  rank?: number
  retrievedAt: string
}

export type ResumeCvProviderStatusV40_5I = 'completed' | 'unavailable' | 'failed'

export type ResumeCvProviderTelemetryV40_5I = {
  provider: ResumeCvProviderNameV40_5I
  status: ResumeCvProviderStatusV40_5I
  requests: number
  errors: number
  urlsReturned: number
  latencyMs: number
  message: string
}

export type ResumeCvProviderResultV40_5I = {
  telemetry: ResumeCvProviderTelemetryV40_5I
  records: ResumeCvProviderRecordV40_5I[]
}

export type ResumeCvCandidateSeedV40_5I = {
  id: string
  canonical_name: string
  current_company?: string | null
  current_title?: string | null
  location?: string | null
}
