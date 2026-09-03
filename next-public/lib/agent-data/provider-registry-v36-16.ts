import 'server-only'

export type AgentProviderTransportV36_16 = 'rest' | 'mcp' | 'webhook' | 'cache'
export type AgentProviderCostClassV36_16 = 'free' | 'breadth' | 'paid_enrichment' | 'live' | 'external_system'
export type AgentProviderFreshnessV36_16 = 'cached' | 'indexed' | 'fresh' | 'live' | 'event_driven' | 'not_applicable'
export type AgentProviderCapabilityV36_16 =
  | 'search_people'
  | 'enrich_person'
  | 'find_contacts'
  | 'verify_email'
  | 'search_companies'
  | 'enrich_company'
  | 'search_jobs'
  | 'search_web'
  | 'refresh_entity'
  | 'watch_entities'
  | 'semantic_memory'
  | 'ats_read'
  | 'ats_write'

export type AgentProviderStatusV36_16 = {
  id: string
  label: string
  configured: boolean
  executableNow: boolean
  transports: AgentProviderTransportV36_16[]
  capabilities: AgentProviderCapabilityV36_16[]
  costClass: AgentProviderCostClassV36_16
  freshness: AgentProviderFreshnessV36_16
  note: string
}

function has(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

export function agentProviderStatusesV36_16(): AgentProviderStatusV36_16[] {
  const status = (
    id: string,
    label: string,
    configured: boolean,
    executableNow: boolean,
    transports: AgentProviderTransportV36_16[],
    capabilities: AgentProviderCapabilityV36_16[],
    costClass: AgentProviderCostClassV36_16,
    freshness: AgentProviderFreshnessV36_16,
    note: string,
  ): AgentProviderStatusV36_16 => ({ id, label, configured, executableNow, transports, capabilities, costClass, freshness, note })

  return [
    status('people_data_labs', 'People Data Labs', has(process.env.PDL_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY), true, ['rest'], ['search_people', 'enrich_person', 'find_contacts', 'search_companies', 'enrich_company'], 'breadth', 'indexed', 'Existing core structured people source; contact reveal remains an explicit enrichment action.'),
    status('coresignal', 'Coresignal', has(process.env.CORESIGNAL_API_KEY), true, ['rest'], ['search_people', 'enrich_person', 'search_companies', 'enrich_company', 'search_jobs', 'refresh_entity'], 'breadth', 'fresh', 'Existing people adapter is live; company/jobs entitlement should be probed separately.'),
    status('crustdata', 'Crustdata', has(process.env.CRUSTDATA_API_KEY), true, ['rest', 'mcp', 'webhook'], ['search_people', 'enrich_person', 'find_contacts', 'search_companies', 'enrich_company', 'search_jobs', 'search_web', 'refresh_entity', 'watch_entities'], 'breadth', 'indexed', 'V36.16 starts with indexed REST search; live endpoints/watchers stay plan-gated and explicit.'),
    status('apollo', 'Apollo', has(process.env.APOLLO_API_KEY), true, ['rest', 'webhook'], ['search_people', 'enrich_person', 'find_contacts', 'search_companies', 'enrich_company', 'search_jobs'], 'breadth', 'indexed', 'People Search is discovery-only; synchronous email enrichment and asynchronous phone reveal are separate paid actions.'),
    status('serper', 'Serper X-Ray', has(process.env.SERPER_API_KEY), true, ['rest'], ['search_people', 'search_web'], 'breadth', 'live', 'Executes bounded Google X-ray strategy portfolios. SERP snippets are retrieval context only and are never promoted to candidate facts.'),
    status('lusha', 'Lusha', has(process.env.LUSHA_API_KEY || process.env.LUSA_API_KEY), true, ['rest'], ['enrich_person', 'find_contacts'], 'paid_enrichment', 'fresh', 'V3 search then reveal is wired into the SourcingOS-controlled waterfall. Nested Lusha Waterfall Reveal is intentionally not requested so provenance and spend remain visible.'),
    status('apify', 'Apify', has(process.env.APIFY_API_TOKEN), true, ['rest'], ['refresh_entity'], 'live', 'live', 'Allowlisted one-page public refresh uses only Apify Website Content Crawler with depth 0, robots respected, no cookies/login state, and restricted social/login hosts blocked.'),
    status('wiza', 'Wiza', has(process.env.WIZA_API_KEY), true, ['rest', 'webhook'], ['enrich_person', 'find_contacts'], 'paid_enrichment', 'fresh', 'Individual reveals run on the durable async enrichment job plane. Work/personal email and phone goals are requested only when still missing; Wiza webhook authentication is verified server-side.'),
    status('fullenrich', 'FullEnrich', has(process.env.FULLENRICH_API_KEY), true, ['rest', 'webhook'], ['search_people', 'enrich_person', 'find_contacts', 'search_companies'], 'paid_enrichment', 'fresh', 'Contact enrichment runs asynchronously through provider webhooks; only still-missing work email, personal email, or phone fields are requested.'),
    status('brightdata', 'Bright Data', has(process.env.BRIGHTDATA_API_KEY), true, ['mcp'], ['search_web', 'refresh_entity'], 'live', 'live', 'Rapid hosted MCP is wired through a server allowlist and exposes only search_engine + scrape_as_markdown behind SourcingOS web tools.'),
    status('coldiq', 'ColdIQ', has(process.env.COLDIQ_API_KEY), true, ['rest'], ['search_people', 'enrich_person', 'find_contacts', 'search_companies', 'enrich_company', 'search_web'], 'paid_enrichment', 'fresh', 'Used only as the final broker fallback with a per-record spend cap. SourcingOS retains broker, underlying-provider (when returned), credit, latency, and hit/miss telemetry.'),
    status('exa', 'Exa', has(process.env.EXA_API_KEY), true, ['rest'], ['search_people', 'search_web', 'refresh_entity'], 'breadth', 'fresh', 'Existing public-web/person discovery source.'),
    status('pearch', 'Pearch', has(process.env.PEARCH_API_KEY), true, ['rest'], ['search_people', 'enrich_person', 'find_contacts'], 'breadth', 'indexed', 'Existing candidate discovery source.'),
    status('contactout', 'ContactOut', has(process.env.CONTACTOUT_API_KEY), true, ['rest'], ['search_people', 'enrich_person', 'find_contacts'], 'paid_enrichment', 'indexed', 'Existing search provider; contact values remain an explicit enrichment action.'),
    status('signalhire', 'SignalHire', has(process.env.SIGNALHIRE_API_KEY), true, ['rest'], ['search_people', 'enrich_person', 'find_contacts', 'refresh_entity'], 'paid_enrichment', 'fresh', 'Existing search/contact source.'),
    status('hunter', 'Hunter', has(process.env.HUNTER_API_KEY), true, ['rest'], ['find_contacts', 'verify_email'], 'paid_enrichment', 'fresh', 'Existing work-email and verification lane.'),
    status('anymail_finder', 'AnyMail Finder', has(process.env.ANYMAILFINDER_API_KEY), true, ['rest'], ['find_contacts'], 'paid_enrichment', 'fresh', 'Existing work-email lane.'),
    status('tomba', 'Tomba', has(process.env.TOMBA_API_KEY) && has(process.env.TOMBA_SECRET_KEY), true, ['rest'], ['find_contacts', 'verify_email'], 'paid_enrichment', 'fresh', 'Existing work-email and verification lane.'),
    status('openweb_ninja', 'OpenWebNinja', has(process.env.OPENWEBNINJA_API_KEY), false, ['rest'], ['search_jobs', 'search_companies', 'search_web'], 'breadth', 'fresh', 'Credential is recognized; Careers/company intelligence integration is tracked separately.'),
    status('adzuna', 'Adzuna', has(process.env.ADZUNA_APP_ID) && has(process.env.ADZUNA_APP_KEY), false, ['rest'], ['search_jobs'], 'breadth', 'fresh', 'Credential is recognized; recruiter-careers aggregation is tracked separately.'),
    status('qdrant', 'Qdrant', has(process.env.QDRANT_URL) && has(process.env.QDRANT_API_KEY), false, ['rest'], ['semantic_memory'], 'external_system', 'not_applicable', 'Reserved for V36.17 semantic recruiter memory and similarity; not a candidate source of record.'),
    status('merge', 'Merge', has(process.env.MERGE_API_KEY), false, ['rest', 'webhook'], ['ats_read', 'ats_write'], 'external_system', 'event_driven', 'ATS writes remain separately approval-gated; customer linked-account tokens are not global environment variables.'),
  ].map(item => item.configured ? item : { ...item, executableNow: false })
}

export function connectedAgentProvidersV36_16() {
  return agentProviderStatusesV36_16().filter(item => item.configured)
}
