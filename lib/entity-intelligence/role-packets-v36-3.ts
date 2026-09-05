import { ENTITY_REGISTRY_V35 } from './registry-v35'
import type { EntityKind } from './types-v35'

export interface RolePacketSourceStrategyV36_3 {
  sourceId: string
  discoveryEntityIds: string[]
  publicTechnicalSource: boolean
  rationale: string
  executionClaim: false
}

export interface RoleIntelligencePacketV36_3 {
  id: string
  family: string
  archetype: string
  titleEntityIds: string[]
  capabilityEntityIds: string[]
  technologyEntityIds: string[]
  credentialEntityIds: string[]
  verificationGateEntityIds: string[]
  adjacentRoleEntityIds: string[]
  sourceStrategies: RolePacketSourceStrategyV36_3[]
  guardrails: string[]
}

const GITHUB = 'github'
const STACK = 'stack_overflow'
const INFRA_STACK = 'stack_exchange_infrastructure'
const HF = 'hugging_face'
const DEVTO = 'devto'
const ORCID = 'orcid'
const CLEARANCEJOBS = 'clearancejobs'
const LINKEDIN_GUIDED = 'linkedin_guided'
const NPPES = 'nppes'

function strategy(sourceId: string, discoveryEntityIds: string[], rationale: string, publicTechnicalSource = true): RolePacketSourceStrategyV36_3 {
  return { sourceId, discoveryEntityIds, publicTechnicalSource, rationale, executionClaim: false }
}

const COMMON_GUARDRAILS = [
  'Role-packet terms are search intelligence only; they do not become candidate facts.',
  'Adjacent titles and technologies can broaden discovery but cannot satisfy a must-have without candidate evidence.',
  'Credentials, clearance, citizenship and regulated eligibility require verification.',
  'Source activity or popularity is not proficiency, employment, clearance or hiring recommendation evidence.',
]

export const ROLE_INTELLIGENCE_PACKETS_V36_3: RoleIntelligencePacketV36_3[] = [
  {
    id: 'rhel-linux-admin', family: 'infrastructure', archetype: 'RHEL / Linux Administrator',
    titleEntityIds: ['entity:occupation:linux-systems-administrator'],
    capabilityEntityIds: ['entity:skill:rhel', 'entity:skill:linux', 'entity:skill:selinux', 'entity:skill:bash'],
    technologyEntityIds: ['entity:technology:ansible', 'entity:technology:red-hat-satellite', 'entity:technology:systemd'],
    credentialEntityIds: ['entity:credential:rhce', 'entity:credential:rhcsa'],
    verificationGateEntityIds: ['entity:clearance:secret', 'entity:clearance:ts-sci'],
    adjacentRoleEntityIds: ['entity:title:systems-engineer', 'entity:title:cloud-engineer'],
    sourceStrategies: [
      strategy(INFRA_STACK, ['entity:skill:rhel', 'entity:skill:linux', 'entity:skill:selinux', 'entity:technology:ansible'], 'Infrastructure Q&A can expose public RHEL/Linux capability artifacts.'),
      strategy(GITHUB, ['entity:skill:linux', 'entity:skill:bash', 'entity:technology:ansible'], 'Use artifact→contributors→person discovery; never treat repository popularity as proficiency.'),
      strategy(CLEARANCEJOBS, ['entity:occupation:linux-systems-administrator', 'entity:skill:rhel'], 'Authorized cleared-market lane can combine role criteria with verification workflow.', false),
    ],
    guardrails: [...COMMON_GUARDRAILS, 'Never send clearance terms to public technical connectors.'],
  },
  {
    id: 'site-reliability-engineer', family: 'infrastructure', archetype: 'Site Reliability Engineer',
    titleEntityIds: ['entity:occupation:site-reliability-engineer'],
    capabilityEntityIds: ['entity:skill:kubernetes', 'entity:skill:terraform', 'entity:skill:linux'],
    technologyEntityIds: ['entity:technology:eks', 'entity:technology:gke', 'entity:technology:aks'], credentialEntityIds: [], verificationGateEntityIds: [],
    adjacentRoleEntityIds: ['entity:title:platform-engineer', 'entity:title:devops-engineer'],
    sourceStrategies: [strategy(GITHUB, ['entity:skill:kubernetes', 'entity:skill:terraform', 'entity:skill:linux'], 'Search public infrastructure artifacts and contributors.'), strategy(INFRA_STACK, ['entity:skill:kubernetes', 'entity:skill:linux'], 'Use infrastructure Q&A as public capability evidence.')],
    guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'platform-engineer', family: 'infrastructure', archetype: 'Platform Engineer', titleEntityIds: ['entity:title:platform-engineer'],
    capabilityEntityIds: ['entity:skill:kubernetes', 'entity:skill:terraform', 'entity:skill:docker'], technologyEntityIds: ['entity:technology:crossplane', 'entity:technology:pulumi'], credentialEntityIds: [], verificationGateEntityIds: [],
    adjacentRoleEntityIds: ['entity:occupation:site-reliability-engineer', 'entity:title:devops-engineer', 'entity:title:cloud-engineer'],
    sourceStrategies: [strategy(GITHUB, ['entity:skill:kubernetes', 'entity:skill:terraform', 'entity:technology:crossplane'], 'Discover platform engineering through public infrastructure artifacts.'), strategy(INFRA_STACK, ['entity:skill:kubernetes', 'entity:skill:terraform'], 'Use infrastructure Q&A for technical discovery.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'cloud-engineer', family: 'cloud', archetype: 'Cloud Engineer', titleEntityIds: ['entity:title:cloud-engineer'], capabilityEntityIds: ['entity:skill:aws', 'entity:skill:azure', 'entity:skill:gcp', 'entity:skill:terraform'], technologyEntityIds: ['entity:technology:eks', 'entity:technology:aks', 'entity:technology:gke'], credentialEntityIds: [], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:platform-engineer', 'entity:title:systems-engineer'],
    sourceStrategies: [strategy(GITHUB, ['entity:skill:aws', 'entity:skill:azure', 'entity:skill:gcp', 'entity:skill:terraform'], 'Search cloud/IaC artifacts rather than inferring proficiency from account activity.'), strategy(INFRA_STACK, ['entity:skill:aws', 'entity:skill:azure', 'entity:skill:gcp'], 'Cloud Q&A can provide capability discovery signals.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'software-engineer', family: 'software', archetype: 'Software Engineer', titleEntityIds: ['entity:title:software-engineer'], capabilityEntityIds: ['entity:skill:typescript', 'entity:skill:javascript', 'entity:skill:python', 'entity:skill:go', 'entity:skill:java'], technologyEntityIds: ['entity:technology:nodejs', 'entity:technology:postgresql'], credentialEntityIds: [], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:backend-engineer', 'entity:title:frontend-engineer', 'entity:title:full-stack-engineer'],
    sourceStrategies: [strategy(GITHUB, ['entity:skill:typescript', 'entity:skill:javascript', 'entity:skill:python', 'entity:skill:go'], 'Use code/artifact contribution for discovery; repository stars are not candidate quality.'), strategy(STACK, ['entity:skill:typescript', 'entity:skill:python', 'entity:skill:java'], 'Use public technical Q&A for evidence-bearing discovery.'), strategy(DEVTO, ['entity:skill:typescript', 'entity:skill:javascript'], 'Use authored technical content as a discovery signal.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'cybersecurity-engineer', family: 'cybersecurity', archetype: 'Cybersecurity Engineer', titleEntityIds: ['entity:title:cybersecurity-engineer', 'entity:title:security-engineer'], capabilityEntityIds: ['entity:skill:siem', 'entity:skill:edr', 'entity:skill:iam'], technologyEntityIds: ['entity:tool:splunk'], credentialEntityIds: ['entity:certification:cissp', 'entity:certification:security', 'entity:credential:ccsp'], verificationGateEntityIds: ['entity:clearance:secret', 'entity:clearance:ts-sci'], adjacentRoleEntityIds: ['entity:title:cloud-security-engineer', 'entity:title:soc-analyst'],
    sourceStrategies: [strategy(GITHUB, ['entity:skill:iam'], 'Use public security tooling/artifacts only for discovery, never clearance.'), strategy(CLEARANCEJOBS, ['entity:title:cybersecurity-engineer', 'entity:skill:siem'], 'Authorized cleared-market lane is appropriate when the recruiter requested clearance.', false)], guardrails: [...COMMON_GUARDRAILS, 'Employer, geography, military service and security tooling never imply clearance.'],
  },
  {
    id: 'soc-incident-response', family: 'cybersecurity', archetype: 'SOC / Incident Response', titleEntityIds: ['entity:title:soc-analyst', 'entity:title:incident-responder'], capabilityEntityIds: ['entity:skill:siem', 'entity:skill:edr'], technologyEntityIds: ['entity:tool:splunk'], credentialEntityIds: ['entity:certification:security', 'entity:credential:oscp'], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:cybersecurity-engineer'], sourceStrategies: [strategy(GITHUB, ['entity:skill:edr'], 'Public artifacts are discovery signals only.'), strategy(DEVTO, ['entity:skill:siem'], 'Authored security content can surface practitioners.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'data-engineer', family: 'data', archetype: 'Data Engineer', titleEntityIds: ['entity:title:data-engineer'], capabilityEntityIds: ['entity:skill:python'], technologyEntityIds: ['entity:technology:spark', 'entity:technology:airflow', 'entity:technology:dbt', 'entity:technology:postgresql'], credentialEntityIds: [], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:analytics-engineer', 'entity:title:software-engineer'], sourceStrategies: [strategy(GITHUB, ['entity:skill:python', 'entity:technology:spark', 'entity:technology:airflow'], 'Use data pipeline artifacts and contributors.'), strategy(STACK, ['entity:skill:python', 'entity:technology:spark'], 'Public Q&A can provide data-engineering discovery evidence.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'data-scientist', family: 'data-ai', archetype: 'Data Scientist', titleEntityIds: ['entity:title:data-scientist'], capabilityEntityIds: ['entity:skill:python', 'entity:skill:nlp'], technologyEntityIds: ['entity:tool:pytorch', 'entity:tool:tensorflow'], credentialEntityIds: [], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:applied-scientist', 'entity:title:research-scientist', 'entity:title:ml-engineer'], sourceStrategies: [strategy(GITHUB, ['entity:skill:python', 'entity:tool:pytorch'], 'Use public analytic/model artifacts as discovery.'), strategy(HF, ['entity:tool:hugging-face', 'entity:tool:pytorch'], 'Use model/dataset authorship as a discovery signal, not fit proof.'), strategy(ORCID, ['entity:title:research-scientist'], 'Research identity can support discovery when role context warrants it.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'ml-ai-engineer', family: 'data-ai', archetype: 'ML / AI Engineer', titleEntityIds: ['entity:title:ml-engineer', 'entity:title:ai-engineer'], capabilityEntityIds: ['entity:skill:llm', 'entity:skill:nlp', 'entity:skill:python'], technologyEntityIds: ['entity:tool:pytorch', 'entity:tool:tensorflow', 'entity:tool:hugging-face'], credentialEntityIds: [], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:mlops-engineer', 'entity:title:applied-scientist'], sourceStrategies: [strategy(HF, ['entity:skill:llm', 'entity:tool:hugging-face', 'entity:tool:pytorch'], 'Model/dataset contribution can surface practitioners.'), strategy(GITHUB, ['entity:skill:python', 'entity:tool:pytorch'], 'Use artifact→contributors→person discovery.'), strategy(ORCID, ['entity:title:applied-scientist'], 'Research identity can broaden discovery for research-heavy roles.')], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'federal-cleared-infrastructure', family: 'federal-infrastructure', archetype: 'Federal / Cleared Infrastructure', titleEntityIds: ['entity:occupation:linux-systems-administrator', 'entity:title:systems-engineer', 'entity:title:cloud-engineer'], capabilityEntityIds: ['entity:skill:rhel', 'entity:skill:linux', 'entity:skill:aws'], technologyEntityIds: ['entity:technology:ansible'], credentialEntityIds: ['entity:credential:rhce'], verificationGateEntityIds: ['entity:clearance:secret', 'entity:clearance:top-secret', 'entity:clearance:ts-sci'], adjacentRoleEntityIds: ['entity:title:platform-engineer'], sourceStrategies: [strategy(INFRA_STACK, ['entity:skill:rhel', 'entity:skill:linux', 'entity:skill:aws'], 'Public technical sources receive capability terms only.'), strategy(GITHUB, ['entity:skill:linux', 'entity:technology:ansible'], 'Public GitHub search receives no clearance terms.'), strategy(CLEARANCEJOBS, ['entity:occupation:linux-systems-administrator', 'entity:skill:rhel'], 'Use cleared-market search lane for clearance-aware discovery/verification.', false)], guardrails: [...COMMON_GUARDRAILS, 'Clearance is never inferred from defense employer, military history, location, job title or public technical activity.'],
  },
  {
    id: 'healthcare-it', family: 'healthcare-it', archetype: 'Healthcare IT / Interoperability', titleEntityIds: ['entity:title:business-analyst'], capabilityEntityIds: [], technologyEntityIds: ['entity:tool:epic', 'entity:tool:cerner', 'entity:technology:hl7', 'entity:technology:fhir'], credentialEntityIds: [], verificationGateEntityIds: [], adjacentRoleEntityIds: [], sourceStrategies: [strategy(STACK, ['entity:technology:hl7', 'entity:technology:fhir'], 'Public technical Q&A can surface interoperability expertise.'), strategy(LINKEDIN_GUIDED, ['entity:tool:epic', 'entity:tool:cerner'], 'Guided professional search can target vendor/application experience.', false)], guardrails: [...COMMON_GUARDRAILS, 'Epic, Oracle Health/Cerner, HL7 and FHIR are related but not interchangeable evidence.'],
  },
  {
    id: 'clinical-provider', family: 'healthcare', archetype: 'Clinical Provider', titleEntityIds: ['entity:title:registered-nurse', 'entity:title:nurse-practitioner', 'entity:title:physician-assistant'], capabilityEntityIds: [], technologyEntityIds: [], credentialEntityIds: ['entity:certification:rn', 'entity:credential:aprn', 'entity:credential:pa-c'], verificationGateEntityIds: ['entity:certification:rn', 'entity:credential:aprn', 'entity:credential:pa-c'], adjacentRoleEntityIds: [], sourceStrategies: [strategy(NPPES, ['entity:title:nurse-practitioner', 'entity:title:physician-assistant'], 'Use NPPES/NPI public registry evidence for provider identity/discovery where appropriate.', false), strategy(LINKEDIN_GUIDED, ['entity:title:registered-nurse'], 'Professional search may broaden clinical discovery.', false)], guardrails: [...COMMON_GUARDRAILS, 'RN, NP and PA are distinct occupations/licensure paths; never normalize one into another.'],
  },
  {
    id: 'finance-analytics', family: 'finance', archetype: 'Finance Analytics', titleEntityIds: ['entity:title:financial-analyst', 'entity:title:quantitative-analyst', 'entity:title:risk-analyst'], capabilityEntityIds: ['entity:skill:python'], technologyEntityIds: [], credentialEntityIds: ['entity:credential:cfa', 'entity:credential:cpa'], verificationGateEntityIds: [], adjacentRoleEntityIds: ['entity:title:data-scientist'], sourceStrategies: [strategy(GITHUB, ['entity:skill:python'], 'Use public quantitative/code artifacts only when relevant to the role.'), strategy(LINKEDIN_GUIDED, ['entity:title:financial-analyst', 'entity:title:quantitative-analyst'], 'Professional title/context search for finance discovery.', false)], guardrails: COMMON_GUARDRAILS,
  },
  {
    id: 'aviation-maintenance', family: 'aviation', archetype: 'Aircraft / Avionics Maintenance', titleEntityIds: ['entity:title:aircraft-maintenance-technician', 'entity:title:avionics-technician'], capabilityEntityIds: [], technologyEntityIds: [], credentialEntityIds: ['entity:credential:faa-ap'], verificationGateEntityIds: ['entity:credential:faa-ap'], adjacentRoleEntityIds: [], sourceStrategies: [strategy(LINKEDIN_GUIDED, ['entity:title:aircraft-maintenance-technician', 'entity:title:avionics-technician'], 'Professional search for aviation maintenance titles and employer context.', false)], guardrails: [...COMMON_GUARDRAILS, 'FAA credential status must be verified; title or employer never substitutes for certification evidence.'],
  },
]

export function rolePacketByIdV36_3(id: string): RoleIntelligencePacketV36_3 | undefined {
  return ROLE_INTELLIGENCE_PACKETS_V36_3.find(packet => packet.id === id)
}

const LOCATION_KINDS = new Set<EntityKind>(['location', 'place', 'metro', 'region', 'postal_area', 'country', 'state', 'county'])
const PUBLIC_FORBIDDEN_KINDS = new Set<EntityKind>(['clearance'])

/**
 * Resolves only reviewed entity labels for a packet/source. Public technical
 * sources are filtered again by entity kind even if a packet was misconfigured.
 */
export function buildRolePacketSourceTermsV36_3(packetId: string, sourceId: string): {
  terms: string[]
  omittedEntityIds: string[]
  publicTechnicalSource: boolean
  executionClaim: false
  note: string
} {
  const packet = rolePacketByIdV36_3(packetId)
  const source = packet?.sourceStrategies.find(item => item.sourceId === sourceId)
  if (!packet || !source) return { terms: [], omittedEntityIds: [], publicTechnicalSource: false, executionClaim: false, note: 'No configured role/source strategy. Nothing was executed.' }

  const terms: string[] = []
  const omittedEntityIds: string[] = []
  for (const entityId of source.discoveryEntityIds) {
    const entity = ENTITY_REGISTRY_V35.entities.find(item => item.id === entityId)
    if (!entity) {
      omittedEntityIds.push(entityId)
      continue
    }
    if (source.publicTechnicalSource && (PUBLIC_FORBIDDEN_KINDS.has(entity.kind) || LOCATION_KINDS.has(entity.kind))) {
      omittedEntityIds.push(entityId)
      continue
    }
    terms.push(entity.canonicalLabel)
  }

  return {
    terms: Array.from(new Set(terms)),
    omittedEntityIds,
    publicTechnicalSource: source.publicTechnicalSource,
    executionClaim: false,
    note: source.publicTechnicalSource
      ? 'Capability/discovery terms only. Clearance, citizenship and geography are not sent as public technical evidence queries.'
      : 'Configured search strategy only; this function does not claim the source executed.',
  }
}
