import 'server-only'
import type { CandidateDataProviderStatusV36_8 } from './types-v36-8'

function configured(key: string | undefined): boolean {
  return Boolean(key && key.trim())
}

export function candidateDataProviderStatusesV36_8(): CandidateDataProviderStatusV36_8[] {
  const pe = configured(process.env.PEARCH_API_KEY)
  const pdl = configured(process.env.PDL_API_KEY)
  const cs = configured(process.env.CORESIGNAL_API_KEY)
  const dv = configured(process.env.DATAVERTEX_API_KEY)
  const co = configured(process.env.CONTACTOUT_API_KEY)
  const own = configured(process.env.OPENWEBNINJA_API_KEY)

  return [
    {
      provider: 'pearch', label: 'Pearch', state: pe ? 'configured' : 'missing_key', executable: pe,
      capabilities: ['candidate_search', 'profile_enrichment', 'contact_enrichment', 'freshness_refresh'],
      message: pe ? 'Pearch candidate search is configured.' : 'PEARCH_API_KEY is not configured.',
    },
    {
      provider: 'people_data_labs', label: 'People Data Labs', state: pdl ? 'configured' : 'missing_key', executable: pdl,
      capabilities: ['candidate_search', 'profile_enrichment', 'contact_enrichment'],
      message: pdl ? 'People Data Labs is configured.' : 'PDL_API_KEY is not configured.',
    },
    {
      provider: 'coresignal', label: 'Coresignal', state: cs ? 'configured' : 'missing_key', executable: cs,
      capabilities: ['candidate_search', 'profile_enrichment', 'contact_enrichment'],
      message: cs ? 'Coresignal is configured.' : 'CORESIGNAL_API_KEY is not configured.',
    },
    {
      provider: 'data_vertex', label: 'DataVertex', state: dv ? 'configured' : 'missing_key', executable: dv,
      capabilities: ['candidate_search', 'profile_enrichment', 'contact_enrichment'],
      message: dv ? 'DataVertex candidate search is configured.' : 'DATAVERTEX_API_KEY is not configured.',
    },
    {
      provider: 'contactout', label: 'ContactOut', state: co ? 'configured' : 'missing_key', executable: co,
      capabilities: ['candidate_search', 'profile_enrichment', 'contact_enrichment'],
      message: co ? 'ContactOut is configured.' : 'CONTACTOUT_API_KEY is not configured.',
    },
    {
      provider: 'openweb_ninja', label: 'OpenWeb Ninja', state: own ? 'configured' : 'missing_key', executable: own,
      capabilities: ['contact_enrichment', 'public_web_corroboration'],
      message: own ? 'OpenWeb Ninja public-web enrichment is configured.' : 'OPENWEBNINJA_API_KEY is not configured.',
    },
  ]
}

export function executableCandidateSearchProvidersV36_8() {
  return candidateDataProviderStatusesV36_8().filter(item => item.executable && item.capabilities.includes('candidate_search'))
}
