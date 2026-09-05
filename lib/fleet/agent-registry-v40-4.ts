import type { SourceName } from '@/lib/source-types'

export type FleetAgentTeamV40_4 =
  | 'discovery'
  | 'resume_cv'
  | 'enrichment'
  | 'identity_verification'
  | 'operations_quality'

export type FleetAgentTaskV40_4 =
  | 'source_discovery'
  | 'resume_search'
  | 'resume_fetch_parse'
  | 'resume_identity_verify'
  | 'employment_history'
  | 'skills_evidence'
  | 'education'
  | 'certification'
  | 'professional_urls'
  | 'portfolio_projects'
  | 'publication_patents'
  | 'location_refresh'
  | 'employer_refresh'
  | 'profile_quality'
  | 'stale_refresh'
  | 'identity_corroboration'
  | 'evidence_conflict'
  | 'dedupe_review'
  | 'source_health'
  | 'queue_planning'
  | 'cost_guard'
  | 'quality_audit'

export type FleetAgentDefinitionV40_4 = {
  id: string
  label: string
  team: FleetAgentTeamV40_4
  task: FleetAgentTaskV40_4
  source?: SourceName
  executable: boolean
  notes: string
}

function agent(
  id: string,
  label: string,
  team: FleetAgentTeamV40_4,
  task: FleetAgentTaskV40_4,
  notes: string,
  source?: SourceName,
  executable = true,
): FleetAgentDefinitionV40_4 {
  return { id, label, team, task, source, executable, notes }
}

/**
 * Fifty logical workers, not fifty unrestricted browsers. The scheduler assigns
 * bounded jobs to these roles and reuses deterministic/API implementations.
 */
export const FLEET_AGENTS_V40_4: FleetAgentDefinitionV40_4[] = [
  agent('disc-github', 'GitHub Scout', 'discovery', 'source_discovery', 'Official GitHub API talent discovery.', 'github'),
  agent('disc-stackoverflow', 'Stack Overflow Scout', 'discovery', 'source_discovery', 'Official Stack Exchange API.', 'stackoverflow'),
  agent('disc-serverfault', 'Server Fault Scout', 'discovery', 'source_discovery', 'Infrastructure specialist.', 'serverfault'),
  agent('disc-security', 'Security SE Scout', 'discovery', 'source_discovery', 'Security specialist.', 'security_se'),
  agent('disc-devops', 'DevOps SE Scout', 'discovery', 'source_discovery', 'DevOps specialist.', 'devops_se'),
  agent('disc-unix', 'Unix & Linux Scout', 'discovery', 'source_discovery', 'Linux specialist.', 'unix_se'),
  agent('disc-dba', 'DBA SE Scout', 'discovery', 'source_discovery', 'Database specialist.', 'dba_se'),
  agent('disc-network', 'Network Engineering Scout', 'discovery', 'source_discovery', 'Network specialist.', 'networkeng_se'),
  agent('disc-npm', 'npm Scout', 'discovery', 'source_discovery', 'Official registry API.', 'npm'),
  agent('disc-crates', 'crates.io Scout', 'discovery', 'source_discovery', 'Official registry API.', 'crates'),
  agent('disc-npi', 'NPPES Scout', 'discovery', 'source_discovery', 'CMS public NPPES API, NPI-1 people only.', 'npi'),
  agent('disc-orcid', 'ORCID Scout', 'discovery', 'source_discovery', 'ORCID public API.', 'orcid'),
  agent('disc-openalex', 'OpenAlex Scout', 'discovery', 'source_discovery', 'Research discovery adapter; scheduled wiring follows existing acquisition connector.', 'openalex', false),
  agent('disc-pubmed', 'PubMed Scout', 'discovery', 'source_discovery', 'Biomedical research discovery adapter.', 'pubmed', false),
  agent('disc-huggingface', 'Hugging Face Scout', 'discovery', 'source_discovery', 'AI/ML public profile and artifact discovery adapter.', 'huggingface', false),
  agent('disc-pypi', 'PyPI Scout', 'discovery', 'source_discovery', 'Python package-maintainer discovery adapter.', 'pypi', false),
  agent('disc-devto', 'DEV Community Scout', 'discovery', 'source_discovery', 'Public technical writing discovery adapter.', 'devto', false),
  agent('disc-dockerhub', 'Docker Hub Scout', 'discovery', 'source_discovery', 'Container artifact discovery adapter.', 'dockerhub', false),

  agent('resume-query-general', 'Resume Search — General', 'resume_cv', 'resume_search', 'Search-engine-indexed resume/CV discovery.'),
  agent('resume-query-pdf', 'Resume Search — PDF', 'resume_cv', 'resume_search', 'PDF/CV query variants.'),
  agent('resume-query-drive', 'Resume Search — Public Drive', 'resume_cv', 'resume_search', 'Only already-public Google Drive/Docs results; never guesses IDs.'),
  agent('resume-query-s3', 'Resume Search — Public Object Links', 'resume_cv', 'resume_search', 'Only public object URLs returned by search; never enumerates buckets.'),
  agent('resume-query-portfolio', 'Resume Search — Portfolio Sites', 'resume_cv', 'resume_search', 'Personal and portfolio domains.'),
  agent('resume-query-academic', 'CV Search — Academic', 'resume_cv', 'resume_search', 'University/research CVs.'),
  agent('resume-query-github', 'Resume Search — GitHub', 'resume_cv', 'resume_search', 'Public repositories/pages that expose resume/CV links.'),
  agent('resume-validator', 'Public Document Validator', 'resume_cv', 'resume_fetch_parse', 'Public-access and file-type validation before parsing.'),
  agent('resume-parser', 'Resume/CV Parser', 'resume_cv', 'resume_fetch_parse', 'Extracts provenance-backed structured claims.'),
  agent('resume-identity', 'Resume Identity Verifier', 'resume_cv', 'resume_identity_verify', 'Requires exact name plus corroborating anchor(s) before auto-attachment.'),
  agent('resume-dedupe', 'Resume Fingerprint/Dedupe', 'resume_cv', 'resume_fetch_parse', 'Content/URL fingerprinting prevents repeat attachments.'),
  agent('resume-rights', 'Resume Rights/Retention Guard', 'resume_cv', 'resume_fetch_parse', 'No login/paywall bypass; restricted hosts remain metadata-only.'),

  agent('enrich-employment-1', 'Employment Research A', 'enrichment', 'employment_history', 'Current and prior employer/title evidence.'),
  agent('enrich-employment-2', 'Employment Research B', 'enrichment', 'employment_history', 'Career timeline corroboration.'),
  agent('enrich-skills-1', 'Skills Evidence A', 'enrichment', 'skills_evidence', 'Artifact-backed technology evidence.'),
  agent('enrich-skills-2', 'Skills Evidence B', 'enrichment', 'skills_evidence', 'Recency-aware technology evidence.'),
  agent('enrich-education', 'Education Research', 'enrichment', 'education', 'Degree/school evidence.'),
  agent('enrich-certifications', 'Credential Research', 'enrichment', 'certification', 'Distinguishes verified vs source-stated credentials.'),
  agent('enrich-urls', 'Professional Footprint', 'enrichment', 'professional_urls', 'Finds public professional/profile URLs.'),
  agent('enrich-projects', 'Project Intelligence', 'enrichment', 'portfolio_projects', 'Maintainer/contributor/project evidence.'),
  agent('enrich-publications', 'Publication & Patent Research', 'enrichment', 'publication_patents', 'Research/publication/patent evidence.'),
  agent('enrich-location', 'Location Refresh', 'enrichment', 'location_refresh', 'Refreshes stale public location evidence.'),

  agent('identity-corroboration-1', 'Identity Corroboration A', 'identity_verification', 'identity_corroboration', 'Cross-source evidence; proposal-only.'),
  agent('identity-corroboration-2', 'Identity Corroboration B', 'identity_verification', 'identity_corroboration', 'Cross-source evidence; proposal-only.'),
  agent('identity-conflicts', 'Evidence Conflict Resolver', 'identity_verification', 'evidence_conflict', 'Flags conflicting employer/location/identity claims.'),
  agent('identity-dedupe', 'Duplicate Prevention', 'identity_verification', 'dedupe_review', 'Prevents duplicate candidate/source creation.'),
  agent('identity-freshness', 'Identity Freshness', 'identity_verification', 'stale_refresh', 'Rechecks stale identity anchors.'),
  agent('identity-review-router', 'Identity Review Router', 'identity_verification', 'dedupe_review', 'Routes ambiguous cross-source matches to recruiter review.'),

  agent('ops-planner', 'Fleet Planner', 'operations_quality', 'queue_planning', 'Ranks work by demand × profile gap × staleness × probability ÷ cost.'),
  agent('ops-quality', 'Profile Quality Auditor', 'operations_quality', 'profile_quality', 'Computes profile completeness/freshness and next-best action.'),
  agent('ops-source-health', 'Source Health Monitor', 'operations_quality', 'source_health', 'Tracks yield/errors/empty runs.'),
  agent('ops-cost', 'Cost & Rate Guard', 'operations_quality', 'cost_guard', 'Enforces credit and source-rate budgets.'),
]

if (FLEET_AGENTS_V40_4.length !== 50) {
  throw new Error(`V40.4 fleet registry must contain exactly 50 logical agents; found ${FLEET_AGENTS_V40_4.length}.`)
}

export function fleetAgentSummaryV40_4() {
  const byTeam = FLEET_AGENTS_V40_4.reduce<Record<string, number>>((acc, item) => {
    acc[item.team] = (acc[item.team] || 0) + 1
    return acc
  }, {})
  return {
    total: FLEET_AGENTS_V40_4.length,
    executable: FLEET_AGENTS_V40_4.filter(item => item.executable).length,
    byTeam,
  }
}
