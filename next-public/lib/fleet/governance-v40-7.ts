export type FleetImprovementPodIdV40_7 =
  | 'search_intelligence'
  | 'candidate_intelligence'
  | 'recruiter_ux'
  | 'product_engineering'
  | 'qa_red_team'

export type FleetImprovementPodV40_7 = {
  id: FleetImprovementPodIdV40_7
  label: string
  seats: 10
  mission: string
  workstreams: readonly string[]
}

export type FleetImprovementAgentV40_7 = {
  id: string
  pod: FleetImprovementPodIdV40_7
  podLabel: string
  seat: number
  workstream: string
}

function pod(
  id: FleetImprovementPodIdV40_7,
  label: string,
  mission: string,
  workstreams: readonly string[],
): FleetImprovementPodV40_7 {
  if (workstreams.length !== 10) {
    throw new Error(`V40.7 improvement pod ${id} must define exactly 10 workstreams; found ${workstreams.length}.`)
  }
  return { id, label, seats: 10, mission, workstreams }
}

/**
 * Improvement/build fleet overlay.
 *
 * This is separate from the existing 50 logical talent-intelligence workers in
 * agent-registry-v40-4.ts. It gives research/build agents a deterministic
 * mission catalog without granting them production queue, outreach, or merge
 * authority.
 */
export const FLEET_IMPROVEMENT_PODS_V40_7: readonly FleetImprovementPodV40_7[] = [
  pod('search_intelligence', 'Search Intelligence', 'Improve discovery quality, source mix, and attributable yield.', [
    'Query strategy and search-angle expansion',
    'Provider yield and unique-contribution benchmarking',
    'Public-web URL safety and classification',
    'Duplicate and overlap analysis across sources',
    'Zero-yield root-cause diagnostics',
    'Public ATS and job-market source mapping',
    'Technical-community and registry signal discovery',
    'Academic and research signal discovery',
    'Company and hiring-signal discovery',
    'Source health, latency, cost, and freshness telemetry',
  ]),
  pod('candidate_intelligence', 'Candidate Intelligence', 'Improve evidence quality, identity precision, and profile completeness.', [
    'Evidence graph completeness',
    'Identity-anchor quality and corroboration',
    'Resume/CV identity precision review',
    'Skills evidence and taxonomy normalization',
    'Career trajectory and role-history reasoning',
    'Projects, OSS, publications, and patent evidence',
    'Canonical contact presentation rules',
    'Freshness and stale-signal detection',
    'Candidate profile completeness and next-best research',
    'Requirement-by-requirement match rationale',
  ]),
  pod('recruiter_ux', 'Recruiter UX', 'Turn sourcing intelligence into a fast, evidence-first recruiter review workflow.', [
    'Natural-language brief to structured criteria',
    'Mandatory versus discovery-expansion distinction',
    'Dense candidate list review flow',
    'Candidate 360 resume/profile hierarchy',
    'Why-this-candidate evidence presentation',
    'Canonical contacts and provenance presentation',
    'Previous/next and keyboard review loop',
    'Agent progress and telemetry progressive disclosure',
    'Mobile candidate review flow',
    'Accessibility, readability, and information density',
  ]),
  pod('product_engineering', 'Product / Engineering', 'Convert validated findings into minimal, reusable, production-safe changes.', [
    'Reuse existing /app/search and fleet architecture',
    'Provider adapter contracts and feature flags',
    'Durable orchestration and idempotency',
    'Telemetry and provider attribution',
    'Rate limits, credit budgets, and cache strategy',
    'Identity-resolution integration boundaries',
    'Public ATS and open-signal connector implementation',
    'Preview deployment and GitHub/Vercel feedback loop',
    'Migration and backward-compatibility safety',
    'Implementation docs and exact build sequence',
  ]),
  pod('qa_red_team', 'QA / Red Team', 'Break assumptions before they reach recruiters or production data.', [
    'Public-evidence and restricted-source policy tests',
    'Identity collision and false-merge tests',
    'Provider timeout, zero-yield, and partial-failure tests',
    'Rate-limit, cost, and concurrency abuse tests',
    'Resume/CV canary isolation regression tests',
    'Contact privacy and unattended-enrichment tests',
    'Autonomous outreach and decision-boundary tests',
    'Mobile and responsive regression tests',
    'Provenance and freshness truthfulness tests',
    'CI, preview, release-gate, and rollback verification',
  ]),
]

export const FLEET_IMPROVEMENT_AGENTS_V40_7: readonly FleetImprovementAgentV40_7[] =
  FLEET_IMPROVEMENT_PODS_V40_7.flatMap(current =>
    current.workstreams.map((workstream, index) => ({
      id: `${current.id}-${String(index + 1).padStart(2, '0')}`,
      pod: current.id,
      podLabel: current.label,
      seat: index + 1,
      workstream,
    })),
  )

if (FLEET_IMPROVEMENT_AGENTS_V40_7.length !== 50) {
  throw new Error(`V40.7 improvement fleet must contain exactly 50 seats; found ${FLEET_IMPROVEMENT_AGENTS_V40_7.length}.`)
}

export type FleetCapabilityActivationV40_7 =
  | 'current'
  | 'staged'
  | 'preview_challenger'
  | 'post_canary'
  | 'contract_gate'
  | 'blocked'

export type FleetCapabilityCategoryV40_7 =
  | 'search'
  | 'fetch'
  | 'technical_signal'
  | 'research_signal'
  | 'job_market'
  | 'people_foundation'
  | 'contact_enrichment'
  | 'identity_resolution'
  | 'retrieval_quality'
  | 'orchestration'

export type FleetCapabilityV40_7 = {
  id: string
  label: string
  category: FleetCapabilityCategoryV40_7
  activation: FleetCapabilityActivationV40_7
  publicOnly: boolean
  requiresExplicitApproval: boolean
  note: string
}

/**
 * Capability catalog, not an execution registry. A provider appearing here
 * never means that it executed or that a credential exists.
 */
export const FLEET_CAPABILITIES_V40_7: readonly FleetCapabilityV40_7[] = [
  { id: 'github', label: 'GitHub API', category: 'technical_signal', activation: 'current', publicOnly: true, requiresExplicitApproval: false, note: 'Official/public technical contribution evidence.' },
  { id: 'stack_exchange', label: 'Stack Exchange APIs', category: 'technical_signal', activation: 'current', publicOnly: true, requiresExplicitApproval: false, note: 'Official APIs for Stack Overflow and specialist Stack Exchange sites.' },
  { id: 'npm_crates', label: 'npm + crates.io', category: 'technical_signal', activation: 'current', publicOnly: true, requiresExplicitApproval: false, note: 'Public package-registry maintainer and artifact signals.' },
  { id: 'nppes_orcid', label: 'NPPES + ORCID', category: 'research_signal', activation: 'current', publicOnly: true, requiresExplicitApproval: false, note: 'Public professional/research identity signals with source-specific provenance.' },
  { id: 'exa', label: 'Exa', category: 'search', activation: 'current', publicOnly: true, requiresExplicitApproval: false, note: 'Existing semantic/public-web discovery capability; evidence rules still apply.' },
  { id: 'openalex_arxiv', label: 'OpenAlex + arXiv', category: 'research_signal', activation: 'staged', publicOnly: true, requiresExplicitApproval: false, note: 'High-signal academic discovery; preserve authorship/affiliation provenance.' },
  { id: 'huggingface_pypi', label: 'Hugging Face + PyPI', category: 'technical_signal', activation: 'staged', publicOnly: true, requiresExplicitApproval: false, note: 'Public model/package authorship and maintenance signals.' },
  { id: 'public_ats', label: 'Greenhouse + Lever + Ashby public job APIs', category: 'job_market', activation: 'staged', publicOnly: true, requiresExplicitApproval: false, note: 'Prefer direct public ATS feeds to fragile board scraping.' },
  { id: 'serper', label: 'Serper', category: 'search', activation: 'post_canary', publicOnly: true, requiresExplicitApproval: false, note: 'Exact-name/Google-style public search lane; V40.5i Resume/CV release remains separately gated.' },
  { id: 'firecrawl', label: 'Firecrawl', category: 'fetch', activation: 'preview_challenger', publicOnly: true, requiresExplicitApproval: false, note: 'Evaluate for permitted public pages and clean extraction; no auth/paywall bypass.' },
  { id: 'parallel', label: 'Parallel', category: 'search', activation: 'post_canary', publicOnly: true, requiresExplicitApproval: true, note: 'Provider benchmark candidate from issue #171; do not purchase without approval.' },
  { id: 'tavily', label: 'Tavily', category: 'search', activation: 'preview_challenger', publicOnly: true, requiresExplicitApproval: false, note: 'Independent search challenger for benchmark use only until validated.' },
  { id: 'apify', label: 'Apify', category: 'fetch', activation: 'preview_challenger', publicOnly: true, requiresExplicitApproval: true, note: 'Authorized/public actors only. LinkedIn/account-gated scraping is prohibited.' },
  { id: 'bright_data', label: 'Bright Data', category: 'fetch', activation: 'staged', publicOnly: true, requiresExplicitApproval: true, note: 'Optional public/authorized fallback only; never an anti-access-control bypass.' },
  { id: 'splink', label: 'Splink', category: 'identity_resolution', activation: 'staged', publicOnly: true, requiresExplicitApproval: false, note: 'May score/propose cross-source linkage; cannot silently merge identities.' },
  { id: 'voyage_cohere', label: 'Voyage + Cohere rerank', category: 'retrieval_quality', activation: 'staged', publicOnly: true, requiresExplicitApproval: true, note: 'Evaluate embeddings/reranking only after evidence and hard-filter correctness.' },
  { id: 'upstash', label: 'Upstash Redis / QStash', category: 'orchestration', activation: 'staged', publicOnly: true, requiresExplicitApproval: false, note: 'Optional idempotency, dedupe cache, rate limiting, and queue decoupling.' },
  { id: 'inngest', label: 'Inngest', category: 'orchestration', activation: 'staged', publicOnly: true, requiresExplicitApproval: false, note: 'Thin durable adapter over the framework-neutral work contract; not a second search architecture.' },
  { id: 'pdl_coresignal_crustdata', label: 'PDL / Coresignal / Crustdata', category: 'people_foundation', activation: 'contract_gate', publicOnly: false, requiresExplicitApproval: true, note: 'Commodity foundation/enrichment providers; contract and compliance review required before expansion.' },
  { id: 'managed_contact_waterfalls', label: 'FullEnrich / Cleanlist and paid contact providers', category: 'contact_enrichment', activation: 'contract_gate', publicOnly: false, requiresExplicitApproval: true, note: 'Explicit recruiter-initiated contact resolution only; no unattended harvesting.' },
  { id: 'linkedin_scraping', label: 'LinkedIn/account-gated scraping', category: 'fetch', activation: 'blocked', publicOnly: false, requiresExplicitApproval: true, note: 'Blocked regardless of provider, proxy, actor, or browser implementation.' },
]

export const FLEET_PROTECTED_TARGETS_V40_7 = [
  '/api/cron/resume-sprint',
  'claim_resume_sprint_tasks_v40_5',
  'resume_sprint_release_mode=scaled',
  'mass_requeue_resume_sprint',
] as const

export function isProtectedFleetTargetV40_7(target: string): boolean {
  const normalized = String(target || '').trim().toLowerCase()
  return FLEET_PROTECTED_TARGETS_V40_7.some(item => normalized.includes(item))
}

function enabled(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase() === 'true'
}

export type FleetExperimentalProviderIdV40_7 =
  | 'firecrawl'
  | 'parallel'
  | 'tavily'
  | 'apify'

/**
 * Experimental providers are double-gated: one global flag plus the provider
 * flag. All defaults are false. This function is governance telemetry only;
 * it does not itself dispatch provider traffic.
 */
export function experimentalProviderFlagsV40_7(
  env: Record<string, string | undefined> = process.env,
): Record<FleetExperimentalProviderIdV40_7, boolean> {
  const global = enabled(env.AGENT_FLEET_EXPERIMENTAL_PROVIDERS)
  return {
    firecrawl: global && enabled(env.AGENT_FLEET_PROVIDER_FIRECRAWL),
    parallel: global && enabled(env.AGENT_FLEET_PROVIDER_PARALLEL),
    tavily: global && enabled(env.AGENT_FLEET_PROVIDER_TAVILY),
    apify: global && enabled(env.AGENT_FLEET_PROVIDER_APIFY),
  }
}

export function fleetCapabilitySummaryV40_7() {
  const byActivation = FLEET_CAPABILITIES_V40_7.reduce<Record<string, number>>((acc, item) => {
    acc[item.activation] = (acc[item.activation] || 0) + 1
    return acc
  }, {})

  return {
    version: 'V40.7',
    improvementAgents: FLEET_IMPROVEMENT_AGENTS_V40_7.length,
    pods: FLEET_IMPROVEMENT_PODS_V40_7.map(item => ({
      id: item.id,
      label: item.label,
      seats: item.seats,
      mission: item.mission,
    })),
    byActivation,
    resumeSprintIsolation: 'protected' as const,
    linkedinScraping: 'blocked' as const,
    autonomousOutreach: false,
    silentIdentityMerge: false,
  }
}
