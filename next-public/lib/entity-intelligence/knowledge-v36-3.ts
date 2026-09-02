import type {
  EntityKind,
  EntityProvenance,
  EntityRelationship,
  EntityRelationshipType,
  IntelligenceEntity,
} from './types-v35'

/**
 * V36.3 reviewed recruiting knowledge overlay.
 *
 * This module deliberately overrides a small number of legacy taxonomy entries
 * by reusing their stable ids with narrower, reviewed aliases. Broad discovery
 * adjacency is represented as typed relationships instead of alias-equivalence.
 * Nothing in this file is candidate evidence by itself.
 */
const CURATED_V36_3: EntityProvenance = {
  source: 'v35_curated',
  sourceRef: 'entity-intelligence/knowledge-v36-3',
  version: 'v36.3',
  reviewState: 'reviewed',
  note: 'Reviewed recruiting/search intelligence. Search expansion is not candidate evidence or qualification proof.',
}

function entity(
  id: string,
  kind: EntityKind,
  canonicalLabel: string,
  aliases: string[] = [],
  metadata: Record<string, unknown> = {},
): IntelligenceEntity {
  return {
    id,
    kind,
    canonicalLabel,
    aliases: Array.from(new Set([canonicalLabel.toLowerCase(), ...aliases.map(alias => alias.toLowerCase())])),
    provenance: [CURATED_V36_3],
    metadata: { knowledgePack: 'v36.3', ...metadata },
  }
}

function relationship(
  fromEntityId: string,
  toEntityId: string,
  type: EntityRelationshipType,
  note: string,
  direction: EntityRelationship['direction'] = 'directed',
): EntityRelationship {
  return {
    id: `rel:v36-3:${type.toLowerCase()}:${fromEntityId}:${toEntityId}`,
    fromEntityId,
    toEntityId,
    type,
    direction,
    provenance: [CURATED_V36_3],
    confidence: 'strong',
    note,
  }
}

export const RECRUITING_KNOWLEDGE_ENTITIES_V36_3: IntelligenceEntity[] = [
  // Infrastructure / platform — reviewed overrides remove unsafe legacy equivalence.
  entity('entity:skill:kubernetes', 'skill', 'Kubernetes', ['k8s']),
  entity('entity:skill:terraform', 'skill', 'Terraform', ['hashicorp terraform']),
  entity('entity:skill:aws', 'skill', 'AWS', ['amazon web services']),
  entity('entity:skill:azure', 'skill', 'Azure', ['microsoft azure']),
  entity('entity:skill:gcp', 'skill', 'GCP', ['google cloud platform', 'google cloud']),
  entity('entity:skill:docker', 'skill', 'Docker', ['dockerfile']),
  entity('entity:technology:openshift', 'technology', 'OpenShift', ['red hat openshift']),
  entity('entity:technology:eks', 'technology', 'AWS EKS', ['amazon eks', 'elastic kubernetes service']),
  entity('entity:technology:aks', 'technology', 'Azure AKS', ['azure kubernetes service']),
  entity('entity:technology:gke', 'technology', 'Google GKE', ['google kubernetes engine']),
  entity('entity:technology:pulumi', 'technology', 'Pulumi'),
  entity('entity:technology:crossplane', 'technology', 'Crossplane'),
  entity('entity:technology:systemd', 'technology', 'systemd'),
  entity('entity:skill:bash', 'skill', 'Bash', ['bourne again shell']),
  entity('entity:skill:linux', 'skill', 'Linux', ['gnu/linux']),
  entity('entity:credential:rhcsa', 'credential', 'RHCSA', ['red hat certified system administrator']),
  entity('entity:title:devops-engineer', 'occupation', 'DevOps Engineer', ['devops engineer']),
  entity('entity:title:platform-engineer', 'occupation', 'Platform Engineer', ['platform engineer']),
  entity('entity:title:cloud-engineer', 'occupation', 'Cloud Engineer', ['cloud infrastructure engineer']),
  entity('entity:title:systems-engineer', 'occupation', 'Systems Engineer', ['systems engineer']),
  // Narrow the legacy mixed title. DevOps, Platform and SRE remain adjacent, never aliases.
  entity('entity:title:devsecops-engineer', 'occupation', 'DevSecOps Engineer', ['devsecops', 'devsecops engineer']),

  // Software engineering.
  entity('entity:title:software-engineer', 'occupation', 'Software Engineer', ['software engineer', 'software developer', 'swe']),
  entity('entity:title:backend-engineer', 'occupation', 'Backend Engineer', ['backend engineer', 'backend developer', 'back-end engineer']),
  entity('entity:title:frontend-engineer', 'occupation', 'Frontend Engineer', ['frontend engineer', 'frontend developer', 'front-end engineer']),
  entity('entity:title:full-stack-engineer', 'occupation', 'Full Stack Engineer', ['full stack engineer', 'full-stack engineer', 'full stack developer']),
  entity('entity:title:staff-software-engineer', 'occupation', 'Staff Software Engineer', ['staff software engineer']),
  entity('entity:skill:typescript', 'skill', 'TypeScript', ['typescript']),
  entity('entity:skill:javascript', 'skill', 'JavaScript', ['javascript', 'ecmascript']),
  entity('entity:skill:python', 'skill', 'Python', ['python']),
  entity('entity:skill:go', 'skill', 'Go', ['golang', 'go language']),
  entity('entity:skill:rust', 'skill', 'Rust', ['rustlang']),
  entity('entity:skill:java', 'skill', 'Java', ['java language']),
  entity('entity:skill:react', 'skill', 'React', ['reactjs', 'react.js']),
  entity('entity:technology:nextjs', 'technology', 'Next.js', ['nextjs', 'next.js']),
  entity('entity:technology:nodejs', 'technology', 'Node.js', ['nodejs', 'node.js']),
  entity('entity:technology:postgresql', 'technology', 'PostgreSQL', ['postgres']),

  // Cybersecurity.
  entity('entity:title:cybersecurity-engineer', 'occupation', 'Cybersecurity Engineer', ['cybersecurity engineer', 'cyber engineer']),
  entity('entity:title:security-engineer', 'occupation', 'Security Engineer', ['security engineer', 'information security engineer', 'infosec engineer']),
  entity('entity:title:soc-analyst', 'occupation', 'SOC Analyst', ['soc analyst', 'security operations center analyst']),
  entity('entity:title:incident-responder', 'occupation', 'Incident Responder', ['incident response analyst', 'incident responder']),
  entity('entity:title:cloud-security-engineer', 'occupation', 'Cloud Security Engineer', ['cloud security engineer']),
  entity('entity:certification:cissp', 'credential', 'CISSP', ['certified information systems security professional']),
  entity('entity:certification:security', 'credential', 'Security+', ['security plus', 'comptia security+']),
  entity('entity:credential:ccsp', 'credential', 'CCSP', ['certified cloud security professional']),
  entity('entity:credential:oscp', 'credential', 'OSCP', ['offensive security certified professional']),
  entity('entity:tool:splunk', 'technology', 'Splunk', ['splunk']),
  entity('entity:skill:siem', 'skill', 'SIEM', ['security information and event management']),
  entity('entity:skill:edr', 'skill', 'EDR', ['endpoint detection and response']),
  entity('entity:skill:iam', 'skill', 'Identity and Access Management', ['iam', 'identity access management']),

  // Data / AI. Reviewed titles remain distinct occupations.
  entity('entity:title:data-engineer', 'occupation', 'Data Engineer', ['data engineer']),
  entity('entity:title:analytics-engineer', 'occupation', 'Analytics Engineer', ['analytics engineer']),
  entity('entity:title:data-scientist', 'occupation', 'Data Scientist', ['data scientist']),
  entity('entity:title:ml-engineer', 'occupation', 'Machine Learning Engineer', ['machine learning engineer', 'ml engineer']),
  entity('entity:title:ai-engineer', 'occupation', 'AI Engineer', ['ai engineer', 'artificial intelligence engineer']),
  entity('entity:title:mlops-engineer', 'occupation', 'MLOps Engineer', ['mlops engineer', 'ml ops engineer']),
  entity('entity:title:applied-scientist', 'occupation', 'Applied Scientist', ['applied scientist']),
  entity('entity:title:research-scientist', 'occupation', 'Research Scientist', ['research scientist']),
  entity('entity:tool:pytorch', 'technology', 'PyTorch', ['pytorch', 'torch']),
  entity('entity:tool:tensorflow', 'technology', 'TensorFlow', ['tensorflow']),
  entity('entity:tool:hugging-face', 'technology', 'Hugging Face', ['hugging face', 'huggingface']),
  entity('entity:skill:llm', 'skill', 'Large Language Models', ['llm', 'large language model', 'large language models']),
  entity('entity:skill:nlp', 'skill', 'Natural Language Processing', ['nlp', 'natural language processing']),
  entity('entity:technology:spark', 'technology', 'Apache Spark', ['spark', 'apache spark']),
  entity('entity:technology:dbt', 'technology', 'dbt', ['data build tool']),
  entity('entity:technology:airflow', 'technology', 'Apache Airflow', ['airflow', 'apache airflow']),

  // Healthcare — licenses, occupations and platforms remain distinct.
  entity('entity:title:registered-nurse', 'occupation', 'Registered Nurse', ['registered nurse']),
  entity('entity:title:nurse-practitioner', 'occupation', 'Nurse Practitioner', ['nurse practitioner']),
  entity('entity:title:physician-assistant', 'occupation', 'Physician Assistant', ['physician assistant', 'physician associate']),
  entity('entity:certification:rn', 'credential', 'RN License', ['rn license', 'registered nurse license']),
  entity('entity:credential:aprn', 'credential', 'APRN', ['advanced practice registered nurse']),
  entity('entity:credential:pa-c', 'credential', 'PA-C', ['physician assistant-certified', 'physician assistant certified']),
  entity('entity:tool:epic', 'technology', 'Epic', ['epic systems', 'epic emr', 'epic ehr']),
  entity('entity:tool:cerner', 'technology', 'Oracle Health / Cerner', ['cerner', 'cerner millennium', 'oracle health']),
  entity('entity:technology:hl7', 'technology', 'HL7', ['health level seven']),
  entity('entity:technology:fhir', 'technology', 'FHIR', ['fast healthcare interoperability resources']),

  // Federal / cleared. No adjacency edges intentionally broaden clearance levels.
  entity('entity:clearance:secret', 'clearance', 'Secret', ['secret clearance', 'dod secret']),
  entity('entity:clearance:top-secret', 'clearance', 'Top Secret', ['top secret', 'top secret clearance']),
  entity('entity:clearance:public-trust', 'clearance', 'Public Trust', ['public trust']),
  entity('entity:clearance:polygraph', 'clearance', 'Polygraph', ['polygraph', 'ci polygraph', 'full scope polygraph']),

  // Research, finance, aviation and general business breadth.
  entity('entity:title:computational-scientist', 'occupation', 'Computational Scientist', ['computational scientist']),
  entity('entity:title:financial-analyst', 'occupation', 'Financial Analyst', ['financial analyst']),
  entity('entity:title:quantitative-analyst', 'occupation', 'Quantitative Analyst', ['quantitative analyst', 'quant analyst']),
  entity('entity:title:risk-analyst', 'occupation', 'Risk Analyst', ['risk analyst']),
  entity('entity:credential:cfa', 'credential', 'CFA', ['chartered financial analyst']),
  entity('entity:credential:cpa', 'credential', 'CPA', ['certified public accountant']),
  entity('entity:title:pilot', 'occupation', 'Pilot', ['airline pilot', 'commercial pilot']),
  entity('entity:title:aircraft-maintenance-technician', 'occupation', 'Aircraft Maintenance Technician', ['aircraft maintenance technician', 'aircraft mechanic']),
  entity('entity:title:avionics-technician', 'occupation', 'Avionics Technician', ['avionics technician']),
  entity('entity:credential:faa-ap', 'credential', 'FAA A&P', ['a&p', 'airframe and powerplant', 'airframe and powerplant mechanic certificate']),
  entity('entity:title:project-manager', 'occupation', 'Project Manager', ['project manager']),
  entity('entity:title:product-manager', 'occupation', 'Product Manager', ['product manager']),
  entity('entity:title:business-analyst', 'occupation', 'Business Analyst', ['business analyst']),
  entity('entity:certification:pmp', 'credential', 'PMP', ['project management professional']),

  // Industries/context used for search strategy, never candidate facts unless evidenced separately.
  entity('entity:industry:healthcare', 'industry', 'Healthcare', ['healthcare', 'health care']),
  entity('entity:industry:govcon', 'industry', 'Federal Government Contracting', ['govcon', 'government contracting', 'federal contracting']),
  entity('entity:industry:financial-services', 'industry', 'Financial Services', ['financial services', 'finserv']),
  entity('entity:industry:aviation-aerospace', 'industry', 'Aviation / Aerospace', ['aviation', 'aerospace']),
  entity('entity:industry:software-saas', 'industry', 'Software / SaaS', ['saas', 'software as a service']),
  entity('entity:industry:ai-ml', 'industry', 'AI / ML', ['ai/ml', 'artificial intelligence', 'machine learning']),
]

const RHEL = 'entity:skill:rhel'
const RHCE = 'entity:credential:rhce'
const SRE = 'entity:occupation:site-reliability-engineer'
const TSSCI = 'entity:clearance:ts-sci'

export const RECRUITING_KNOWLEDGE_RELATIONSHIPS_V36_3: EntityRelationship[] = [
  // Infrastructure capability graph.
  relationship('entity:credential:rhcsa', RHEL, 'CREDENTIAL_FOR', 'RHCSA is a Red Hat credential signal; it does not prove current RHEL proficiency.'),
  relationship('entity:skill:kubernetes', 'entity:technology:eks', 'RELATED_TECHNOLOGY', 'EKS is a managed Kubernetes service, not an exact equivalent to Kubernetes.'),
  relationship('entity:skill:kubernetes', 'entity:technology:aks', 'RELATED_TECHNOLOGY', 'AKS is a managed Kubernetes service, not an exact equivalent to Kubernetes.'),
  relationship('entity:skill:kubernetes', 'entity:technology:gke', 'RELATED_TECHNOLOGY', 'GKE is a managed Kubernetes service, not an exact equivalent to Kubernetes.'),
  relationship('entity:skill:kubernetes', 'entity:technology:openshift', 'RELATED_TECHNOLOGY', 'OpenShift is Kubernetes-based technology, not an exact equivalent to Kubernetes.'),
  relationship('entity:skill:terraform', 'entity:technology:pulumi', 'RELATED_TECHNOLOGY', 'Pulumi is adjacent infrastructure-as-code technology, not Terraform evidence.'),
  relationship('entity:skill:terraform', 'entity:technology:crossplane', 'RELATED_TECHNOLOGY', 'Crossplane is adjacent infrastructure-as-code/platform technology, not Terraform evidence.'),
  relationship('entity:title:devsecops-engineer', 'entity:title:devops-engineer', 'ADJACENT_TO', 'Adjacent market title; DevOps does not automatically satisfy DevSecOps requirements.'),
  relationship('entity:title:devsecops-engineer', 'entity:title:platform-engineer', 'ADJACENT_TO', 'Adjacent market title for discovery only.'),
  relationship('entity:title:devsecops-engineer', SRE, 'ADJACENT_TO', 'Adjacent market title for discovery only.'),
  relationship('entity:title:platform-engineer', SRE, 'ADJACENT_TO', 'Platform and SRE work can overlap, but titles are not equivalent.'),
  relationship('entity:title:cloud-engineer', 'entity:title:platform-engineer', 'ADJACENT_TO', 'Adjacent infrastructure occupation for discovery only.'),
  relationship('entity:skill:linux', RHEL, 'RELATED_TECHNOLOGY', 'Linux is broader than RHEL. Linux evidence alone does not prove RHEL experience.'),

  // Software stack and title adjacency.
  relationship('entity:title:software-engineer', 'entity:title:backend-engineer', 'ADJACENT_TO', 'Backend Engineer is an adjacent/specialized software title, not an exact synonym.'),
  relationship('entity:title:software-engineer', 'entity:title:frontend-engineer', 'ADJACENT_TO', 'Frontend Engineer is an adjacent/specialized software title, not an exact synonym.'),
  relationship('entity:title:software-engineer', 'entity:title:full-stack-engineer', 'ADJACENT_TO', 'Full Stack Engineer is an adjacent/specialized software title, not an exact synonym.'),
  relationship('entity:skill:react', 'entity:technology:nextjs', 'RELATED_TECHNOLOGY', 'Next.js is a React framework; one is not proof of the other without observed evidence.'),
  relationship('entity:skill:javascript', 'entity:skill:typescript', 'RELATED_TECHNOLOGY', 'TypeScript extends JavaScript but JavaScript experience is not automatically TypeScript experience.'),

  // Cybersecurity.
  relationship('entity:title:cybersecurity-engineer', 'entity:title:security-engineer', 'COMMON_MARKET_VARIANT', 'Common market-title variant; evaluate role scope and evidence before treating as equivalent.'),
  relationship('entity:title:soc-analyst', 'entity:title:incident-responder', 'ADJACENT_TO', 'SOC and incident response responsibilities can overlap; discovery only.'),
  relationship('entity:certification:cissp', 'entity:title:cybersecurity-engineer', 'CREDENTIAL_FOR', 'CISSP is a credential signal, not proof of role-specific hands-on capability.'),
  relationship('entity:certification:security', 'entity:title:cybersecurity-engineer', 'CREDENTIAL_FOR', 'Security+ is a credential signal, not proof of role-specific hands-on capability.'),
  relationship('entity:credential:ccsp', 'entity:title:cloud-security-engineer', 'CREDENTIAL_FOR', 'CCSP is a cloud-security credential signal, not proof of current role scope.'),
  relationship('entity:credential:oscp', 'entity:title:incident-responder', 'ADJACENT_TO', 'OSCP can be useful discovery context for offensive/security work but does not prove incident-response experience.'),
  relationship('entity:tool:splunk', 'entity:skill:siem', 'RELATED_TECHNOLOGY', 'Splunk can be used for SIEM workflows; product mention alone does not prove SIEM proficiency.'),

  // Data / AI — titles stay separate.
  relationship('entity:title:data-engineer', 'entity:title:analytics-engineer', 'ADJACENT_TO', 'Adjacent data occupation; search expansion only.'),
  relationship('entity:title:data-scientist', 'entity:title:applied-scientist', 'ADJACENT_TO', 'Adjacent science occupation; not an exact title equivalence.'),
  relationship('entity:title:data-scientist', 'entity:title:research-scientist', 'ADJACENT_TO', 'Adjacent research occupation; not an exact title equivalence.'),
  relationship('entity:title:ml-engineer', 'entity:title:ai-engineer', 'COMMON_MARKET_VARIANT', 'Commonly overlapping market titles; qualification still depends on role-specific evidence.'),
  relationship('entity:title:ml-engineer', 'entity:title:mlops-engineer', 'ADJACENT_TO', 'MLOps is adjacent to ML engineering but is not equivalent.'),
  relationship('entity:tool:pytorch', 'entity:title:ml-engineer', 'RELATED_TECHNOLOGY', 'PyTorch is useful ML discovery evidence; popularity or usage alone does not establish proficiency.'),
  relationship('entity:tool:tensorflow', 'entity:title:ml-engineer', 'RELATED_TECHNOLOGY', 'TensorFlow is useful ML discovery evidence; usage alone does not establish proficiency.'),
  relationship('entity:tool:hugging-face', 'entity:skill:llm', 'RELATED_TECHNOLOGY', 'Hugging Face activity can surface LLM practitioners; it is not candidate-fit proof.'),
  relationship('entity:technology:spark', 'entity:title:data-engineer', 'RELATED_TECHNOLOGY', 'Spark is a data-engineering discovery technology.'),
  relationship('entity:technology:dbt', 'entity:title:analytics-engineer', 'RELATED_TECHNOLOGY', 'dbt is an analytics-engineering discovery technology.'),
  relationship('entity:technology:airflow', 'entity:title:data-engineer', 'RELATED_TECHNOLOGY', 'Airflow is a data-orchestration discovery technology.'),

  // Healthcare separation and credential semantics.
  relationship('entity:certification:rn', 'entity:title:registered-nurse', 'CREDENTIAL_FOR', 'RN licensure is a credential requirement/signal; verification remains required.'),
  relationship('entity:credential:aprn', 'entity:title:nurse-practitioner', 'CREDENTIAL_FOR', 'APRN is a credential signal; scope and state licensure must be verified.'),
  relationship('entity:credential:pa-c', 'entity:title:physician-assistant', 'CREDENTIAL_FOR', 'PA-C is a credential signal; it does not make Physician Assistant equivalent to Nurse Practitioner.'),
  relationship('entity:technology:hl7', 'entity:technology:fhir', 'RELATED_TECHNOLOGY', 'FHIR is an HL7 standard family technology; mentions are not interchangeable evidence.'),
  relationship('entity:tool:epic', 'entity:technology:hl7', 'RELATED_TECHNOLOGY', 'Epic may participate in interoperability workflows; Epic experience does not automatically prove HL7 expertise.'),
  relationship('entity:tool:cerner', 'entity:technology:hl7', 'RELATED_TECHNOLOGY', 'Oracle Health/Cerner may participate in interoperability workflows; product experience does not automatically prove HL7 expertise.'),
  relationship('entity:title:nurse-practitioner', 'entity:title:physician-assistant', 'DO_NOT_INFER_FROM', 'NP and PA are distinct professions and credentials; never infer one from the other.'),
  relationship('entity:title:physician-assistant', 'entity:title:nurse-practitioner', 'DO_NOT_INFER_FROM', 'PA and NP are distinct professions and credentials; never infer one from the other.'),

  // Research / finance / aviation / project credentials.
  relationship('entity:title:research-scientist', 'entity:title:computational-scientist', 'ADJACENT_TO', 'Adjacent research title; domain and evidence determine relevance.'),
  relationship('entity:title:financial-analyst', 'entity:title:quantitative-analyst', 'ADJACENT_TO', 'Adjacent finance occupation; quantitative scope is not implied by Financial Analyst title.'),
  relationship('entity:credential:cfa', 'entity:title:financial-analyst', 'CREDENTIAL_FOR', 'CFA is a credential signal, not proof of current job scope.'),
  relationship('entity:credential:cpa', 'entity:title:financial-analyst', 'ADJACENT_TO', 'CPA may be useful finance/accounting discovery context but is not Financial Analyst evidence by itself.'),
  relationship('entity:credential:faa-ap', 'entity:title:aircraft-maintenance-technician', 'CREDENTIAL_FOR', 'FAA A&P is a credential signal; status and applicability must be verified.'),
  relationship('entity:certification:pmp', 'entity:title:project-manager', 'CREDENTIAL_FOR', 'PMP is a credential signal, not proof of project-management performance.'),

  // Existing RHEL relationships retained/strengthened without duplicate equivalence.
  relationship(RHCE, RHEL, 'CREDENTIAL_FOR', 'RHCE is a Red Hat credential signal; it does not prove current hands-on RHEL experience.'),

  // Explicit ambiguity firewall. Bare TS is intentionally absent from reviewed aliases.
  relationship('entity:skill:typescript', TSSCI, 'CONFUSABLE_WITH', 'TS can be shorthand for TypeScript in software contexts; TS/SCI is a clearance concept. Never cross-infer.', 'symmetric'),
  relationship('entity:skill:typescript', TSSCI, 'DO_NOT_INFER_FROM', 'TypeScript evidence cannot satisfy a clearance requirement.'),
  relationship(TSSCI, 'entity:skill:typescript', 'DO_NOT_INFER_FROM', 'Clearance terminology cannot satisfy a TypeScript requirement.'),
]

export const RECRUITING_KNOWLEDGE_VERSION_V36_3 = 'v36.3' as const
