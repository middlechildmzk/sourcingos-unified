import type { EntityProvenance, EntityRelationship, IntelligenceEntity } from './types-v35'

const REVIEWED: EntityProvenance = {
  source: 'v35_curated',
  sourceRef: 'entity-intelligence/credentials-clearance-v36-5',
  version: 'v36.5',
  reviewState: 'reviewed',
  note: 'Recruiting vocabulary and verification semantics. Credentials and clearance concepts are not candidate facts without candidate-specific evidence.',
}

function entity(
  id: string,
  kind: IntelligenceEntity['kind'],
  canonicalLabel: string,
  aliases: string[],
  metadata: Record<string, unknown>,
): IntelligenceEntity {
  return {
    id,
    kind,
    canonicalLabel,
    aliases: Array.from(new Set([canonicalLabel.toLowerCase(), ...aliases.map(alias => alias.toLowerCase())])),
    provenance: [REVIEWED],
    metadata: { verificationRequired: true, ...metadata },
  }
}

function credential(id: string, canonicalLabel: string, aliases: string[], vendor: string, family: string, domain: string): IntelligenceEntity {
  return entity(`entity:credential:${id}`, 'credential', canonicalLabel, aliases, {
    conceptType: 'professional_credential', vendor, family, domain,
  })
}

function clearance(
  id: string,
  canonicalLabel: string,
  aliases: string[],
  conceptType: 'clearance_level' | 'access' | 'suitability' | 'polygraph' | 'investigation' | 'status',
  extra: Record<string, unknown> = {},
): IntelligenceEntity {
  return entity(`entity:clearance:${id}`, 'clearance', canonicalLabel, aliases, {
    conceptType,
    candidateFactRequiresExplicitEvidence: true,
    ...extra,
  })
}

export const CREDENTIAL_CLEARANCE_ENTITIES_V36_5: IntelligenceEntity[] = [
  // CompTIA / vendor-neutral IT & cyber.
  credential('comptia-a-plus', 'CompTIA A+', ['a+', 'comptia a plus'], 'CompTIA', 'Core', 'IT support'),
  credential('comptia-network-plus', 'CompTIA Network+', ['network+', 'comptia network plus'], 'CompTIA', 'Core', 'networking'),
  credential('comptia-security-plus', 'CompTIA Security+', ['security+', 'security plus', 'comptia security plus'], 'CompTIA', 'Cybersecurity', 'cybersecurity'),
  credential('comptia-cysa-plus', 'CompTIA CySA+', ['cysa+', 'cybersecurity analyst plus'], 'CompTIA', 'Cybersecurity', 'security operations'),
  credential('comptia-pentest-plus', 'CompTIA PenTest+', ['pentest+', 'pentest plus'], 'CompTIA', 'Cybersecurity', 'penetration testing'),
  credential('comptia-securityx', 'CompTIA SecurityX', ['securityx', 'casp+', 'casp plus'], 'CompTIA', 'Cybersecurity', 'advanced cybersecurity'),

  // ISC2 / ISACA.
  credential('isc2-cc', 'ISC2 Certified in Cybersecurity (CC)', ['isc2 cc', 'certified in cybersecurity'], 'ISC2', 'Cybersecurity', 'cybersecurity'),
  credential('isc2-sscp', 'SSCP', ['systems security certified practitioner'], 'ISC2', 'Cybersecurity', 'security administration'),
  credential('isc2-cissp', 'CISSP', ['certified information systems security professional'], 'ISC2', 'Cybersecurity', 'security engineering/leadership'),
  credential('isc2-ccsp', 'CCSP', ['certified cloud security professional'], 'ISC2', 'Cloud Security', 'cloud security'),
  credential('isaca-cisa', 'CISA', ['certified information systems auditor'], 'ISACA', 'Assurance', 'IT audit'),
  credential('isaca-cism', 'CISM', ['certified information security manager'], 'ISACA', 'Security Management', 'security management'),
  credential('isaca-crisc', 'CRISC', ['certified in risk and information systems control'], 'ISACA', 'Risk', 'technology risk'),
  credential('isaca-cgeit', 'CGEIT', ['certified in the governance of enterprise it'], 'ISACA', 'Governance', 'IT governance'),

  // GIAC / SANS-aligned credentials.
  credential('giac-gsec', 'GSEC', ['giac security essentials'], 'GIAC', 'Cyber Defense', 'cybersecurity'),
  credential('giac-gcih', 'GCIH', ['giac certified incident handler'], 'GIAC', 'Incident Response', 'incident response'),
  credential('giac-gcia', 'GCIA', ['giac certified intrusion analyst'], 'GIAC', 'Network Defense', 'network security monitoring'),
  credential('giac-gpen', 'GPEN', ['giac penetration tester'], 'GIAC', 'Offensive Security', 'penetration testing'),
  credential('giac-gcfa', 'GCFA', ['giac certified forensic analyst'], 'GIAC', 'DFIR', 'digital forensics/incident response'),
  credential('giac-grem', 'GREM', ['giac reverse engineering malware'], 'GIAC', 'Malware', 'malware analysis'),
  credential('giac-gwapt', 'GWAPT', ['giac web application penetration tester'], 'GIAC', 'AppSec', 'web application security'),
  credential('giac-gcld', 'GCLD', ['giac cloud security essentials'], 'GIAC', 'Cloud Security', 'cloud security'),

  // Cisco networking/security.
  credential('cisco-ccna', 'CCNA', ['cisco certified network associate'], 'Cisco', 'Networking', 'network engineering'),
  credential('cisco-ccnp-enterprise', 'CCNP Enterprise', ['cisco certified network professional enterprise'], 'Cisco', 'Networking', 'enterprise networking'),
  credential('cisco-ccnp-security', 'CCNP Security', ['cisco certified network professional security'], 'Cisco', 'Security', 'network security'),
  credential('cisco-ccie-enterprise', 'CCIE Enterprise Infrastructure', ['ccie enterprise', 'ccie enterprise infrastructure'], 'Cisco', 'Expert', 'enterprise networking'),
  credential('cisco-ccie-security', 'CCIE Security', ['cisco certified internetwork expert security'], 'Cisco', 'Expert', 'network security'),
  credential('cisco-cyberops-associate', 'Cisco CyberOps Associate', ['cyberops associate'], 'Cisco', 'Cybersecurity', 'security operations'),

  // AWS.
  credential('aws-cloud-practitioner', 'AWS Certified Cloud Practitioner', ['aws cloud practitioner', 'clf-c02'], 'AWS', 'Foundational', 'cloud'),
  credential('aws-solutions-architect-associate', 'AWS Certified Solutions Architect – Associate', ['aws solutions architect associate', 'saa-c03'], 'AWS', 'Architecture', 'cloud architecture'),
  credential('aws-solutions-architect-professional', 'AWS Certified Solutions Architect – Professional', ['aws solutions architect professional', 'sap-c02'], 'AWS', 'Architecture', 'cloud architecture'),
  credential('aws-sysops-associate', 'AWS Certified SysOps Administrator – Associate', ['aws sysops administrator associate'], 'AWS', 'Operations', 'cloud operations'),
  credential('aws-developer-associate', 'AWS Certified Developer – Associate', ['aws developer associate'], 'AWS', 'Development', 'cloud development'),
  credential('aws-devops-professional', 'AWS Certified DevOps Engineer – Professional', ['aws devops professional', 'aws devops engineer professional'], 'AWS', 'DevOps', 'cloud/devops'),
  credential('aws-security-specialty', 'AWS Certified Security – Specialty', ['aws security specialty'], 'AWS', 'Security', 'cloud security'),
  credential('aws-advanced-networking-specialty', 'AWS Certified Advanced Networking – Specialty', ['aws advanced networking specialty'], 'AWS', 'Networking', 'cloud networking'),
  credential('aws-data-engineer-associate', 'AWS Certified Data Engineer – Associate', ['aws data engineer associate'], 'AWS', 'Data', 'data engineering'),
  credential('aws-ai-practitioner', 'AWS Certified AI Practitioner', ['aws ai practitioner'], 'AWS', 'AI', 'AI/cloud'),
  credential('aws-ml-engineer-associate', 'AWS Certified Machine Learning Engineer – Associate', ['aws machine learning engineer associate'], 'AWS', 'AI/ML', 'machine learning'),

  // Microsoft Azure.
  credential('azure-fundamentals', 'Microsoft Azure Fundamentals (AZ-900)', ['az-900', 'azure fundamentals'], 'Microsoft', 'Azure', 'cloud'),
  credential('azure-administrator', 'Microsoft Azure Administrator (AZ-104)', ['az-104', 'azure administrator associate'], 'Microsoft', 'Azure', 'cloud administration'),
  credential('azure-solutions-architect', 'Microsoft Azure Solutions Architect (AZ-305)', ['az-305', 'azure solutions architect expert'], 'Microsoft', 'Azure', 'cloud architecture'),
  credential('azure-devops-engineer', 'Microsoft DevOps Engineer (AZ-400)', ['az-400', 'azure devops engineer expert'], 'Microsoft', 'Azure', 'devops'),
  credential('azure-security-engineer', 'Microsoft Azure Security Engineer (AZ-500)', ['az-500', 'azure security engineer associate'], 'Microsoft', 'Azure', 'cloud security'),
  credential('azure-data-engineer', 'Microsoft Azure Data Engineer (DP-203)', ['dp-203', 'azure data engineer associate'], 'Microsoft', 'Azure Data', 'data engineering'),
  credential('azure-ai-engineer', 'Microsoft Azure AI Engineer (AI-102)', ['ai-102', 'azure ai engineer associate'], 'Microsoft', 'Azure AI', 'AI'),

  // Google Cloud.
  credential('gcp-associate-cloud-engineer', 'Google Cloud Associate Cloud Engineer', ['associate cloud engineer', 'gcp ace'], 'Google Cloud', 'Cloud', 'cloud engineering'),
  credential('gcp-professional-cloud-architect', 'Google Cloud Professional Cloud Architect', ['professional cloud architect', 'gcp pca'], 'Google Cloud', 'Cloud', 'cloud architecture'),
  credential('gcp-professional-data-engineer', 'Google Cloud Professional Data Engineer', ['professional data engineer', 'gcp pde'], 'Google Cloud', 'Data', 'data engineering'),
  credential('gcp-professional-cloud-security-engineer', 'Google Cloud Professional Cloud Security Engineer', ['professional cloud security engineer'], 'Google Cloud', 'Security', 'cloud security'),
  credential('gcp-professional-ml-engineer', 'Google Cloud Professional Machine Learning Engineer', ['professional machine learning engineer', 'gcp ml engineer'], 'Google Cloud', 'AI/ML', 'machine learning'),

  // Red Hat / CNCF / HashiCorp.
  credential('rhcsa', 'RHCSA', ['red hat certified system administrator', 'ex200'], 'Red Hat', 'Linux', 'RHEL administration'),
  credential('rhce', 'RHCE', ['red hat certified engineer', 'ex294'], 'Red Hat', 'Linux', 'RHEL automation/engineering'),
  credential('rhca', 'RHCA', ['red hat certified architect'], 'Red Hat', 'Linux', 'advanced Red Hat'),
  credential('cncf-kcna', 'KCNA', ['kubernetes and cloud native associate'], 'CNCF / Linux Foundation', 'Kubernetes', 'cloud native'),
  credential('cncf-cka', 'CKA', ['certified kubernetes administrator'], 'CNCF / Linux Foundation', 'Kubernetes', 'Kubernetes administration'),
  credential('cncf-ckad', 'CKAD', ['certified kubernetes application developer'], 'CNCF / Linux Foundation', 'Kubernetes', 'Kubernetes application development'),
  credential('cncf-cks', 'CKS', ['certified kubernetes security specialist'], 'CNCF / Linux Foundation', 'Kubernetes', 'Kubernetes security'),
  credential('cncf-kcsa', 'KCSA', ['kubernetes and cloud native security associate'], 'CNCF / Linux Foundation', 'Kubernetes', 'cloud native security'),
  credential('hashicorp-terraform-associate', 'HashiCorp Terraform Associate', ['terraform associate', 'terraform certified associate'], 'HashiCorp', 'Infrastructure Automation', 'Terraform'),
  credential('hashicorp-vault-associate', 'HashiCorp Vault Associate', ['vault associate', 'vault certified associate'], 'HashiCorp', 'Security Automation', 'Vault'),

  // Enterprise platforms.
  credential('servicenow-csa', 'ServiceNow Certified System Administrator', ['servicenow csa'], 'ServiceNow', 'Platform', 'ServiceNow administration'),
  credential('servicenow-cad', 'ServiceNow Certified Application Developer', ['servicenow cad'], 'ServiceNow', 'Platform', 'ServiceNow development'),
  credential('salesforce-administrator', 'Salesforce Certified Administrator', ['salesforce administrator certification'], 'Salesforce', 'Platform', 'Salesforce administration'),
  credential('salesforce-platform-developer-i', 'Salesforce Platform Developer I', ['salesforce pd1', 'platform developer i'], 'Salesforce', 'Platform', 'Salesforce development'),
  credential('splunk-core-power-user', 'Splunk Core Certified Power User', ['splunk power user'], 'Splunk', 'Platform', 'Splunk'),
  credential('splunk-enterprise-admin', 'Splunk Enterprise Certified Admin', ['splunk enterprise admin'], 'Splunk', 'Platform', 'Splunk administration'),

  // Project/agile/business/finance.
  credential('pmi-pmp', 'PMP', ['project management professional'], 'PMI', 'Project Management', 'project management'),
  credential('pmi-capm', 'CAPM', ['certified associate in project management'], 'PMI', 'Project Management', 'project management'),
  credential('pmi-acp', 'PMI-ACP', ['pmi agile certified practitioner'], 'PMI', 'Agile', 'agile delivery'),
  credential('scrum-psm-i', 'Professional Scrum Master I (PSM I)', ['psm i', 'psm 1'], 'Scrum.org', 'Scrum', 'agile/scrum'),
  credential('scrum-csm', 'Certified ScrumMaster (CSM)', ['csm', 'certified scrum master'], 'Scrum Alliance', 'Scrum', 'agile/scrum'),
  credential('cfa', 'CFA', ['chartered financial analyst'], 'CFA Institute', 'Finance', 'investment/finance'),
  credential('cpa', 'CPA', ['certified public accountant'], 'State accountancy boards', 'Accounting', 'accounting'),
  credential('frm', 'FRM', ['financial risk manager'], 'GARP', 'Risk', 'financial risk'),
  credential('finra-sie', 'SIE', ['securities industry essentials'], 'FINRA', 'Securities', 'securities'),
  credential('finra-series-7', 'FINRA Series 7', ['series 7'], 'FINRA', 'Securities', 'securities'),
  credential('finra-series-63', 'FINRA Series 63', ['series 63'], 'FINRA', 'Securities', 'securities'),
  credential('finra-series-65', 'FINRA Series 65', ['series 65'], 'FINRA', 'Securities', 'investment adviser'),
  credential('finra-series-66', 'FINRA Series 66', ['series 66'], 'FINRA', 'Securities', 'investment adviser'),

  // Healthcare licenses/training/platform credentials.
  credential('rn-license', 'RN License', ['registered nurse license', 'rn licensure'], 'State nursing boards', 'Clinical License', 'nursing'),
  credential('aprn-license', 'APRN', ['advanced practice registered nurse', 'aprn license'], 'State nursing boards', 'Advanced Practice', 'advanced practice nursing'),
  credential('fnp-bc', 'FNP-BC', ['family nurse practitioner-board certified'], 'ANCC', 'Advanced Practice', 'family nurse practitioner'),
  credential('fnp-c', 'FNP-C', ['family nurse practitioner certified'], 'AANPCB', 'Advanced Practice', 'family nurse practitioner'),
  credential('ccrn', 'CCRN', ['critical care registered nurse'], 'AACN Certification Corporation', 'Nursing Specialty', 'critical care nursing'),
  credential('bls', 'BLS', ['basic life support'], 'AHA or equivalent training provider', 'Clinical Training', 'basic life support'),
  credential('acls', 'ACLS', ['advanced cardiovascular life support'], 'AHA or equivalent training provider', 'Clinical Training', 'advanced life support'),
  credential('pals', 'PALS', ['pediatric advanced life support'], 'AHA or equivalent training provider', 'Clinical Training', 'pediatric life support'),
  credential('epic-certification', 'Epic Certification', ['epic certified', 'epic certification'], 'Epic', 'Health IT', 'Epic'),

  // Aviation.
  credential('faa-ap', 'FAA A&P', ['a&p', 'airframe and powerplant certificate', 'airframe and powerplant mechanic certificate'], 'FAA', 'Mechanic', 'aircraft maintenance'),
  credential('faa-ia', 'FAA Inspection Authorization (IA)', ['inspection authorization', 'faa ia'], 'FAA', 'Mechanic', 'aircraft inspection'),
  credential('faa-atp', 'FAA Airline Transport Pilot Certificate', ['atp certificate', 'airline transport pilot certificate'], 'FAA', 'Pilot', 'airline transport'),
  credential('faa-commercial-pilot', 'FAA Commercial Pilot Certificate', ['commercial pilot certificate'], 'FAA', 'Pilot', 'commercial aviation'),

  // Clearance levels, access/suitability and statuses. These are intentionally
  // separate concepts; none can be inferred from employer, geography or tech.
  clearance('secret', 'Secret', ['secret clearance', 'dod secret'], 'clearance_level', { system: 'national_security' }),
  clearance('top-secret', 'Top Secret', ['top secret clearance'], 'clearance_level', { system: 'national_security' }),
  clearance('ts-sci', 'TS/SCI', ['ts/sci', 'ts sci', 'tssci', 'top secret sci'], 'access', { baseEligibility: 'Top Secret', compartmentedAccess: true }),
  clearance('sci-access', 'SCI Access', ['sci access', 'sensitive compartmented information access'], 'access', { notStandaloneClearanceLevel: true }),
  clearance('sap-access', 'SAP Access', ['special access program', 'sap access'], 'access', { notStandaloneClearanceLevel: true }),
  clearance('doe-q', 'DOE Q Clearance', ['q clearance', 'doe q'], 'clearance_level', { system: 'DOE' }),
  clearance('doe-l', 'DOE L Clearance', ['l clearance', 'doe l'], 'clearance_level', { system: 'DOE' }),
  clearance('public-trust', 'Public Trust', ['public trust position', 'public trust'], 'suitability', { notSecurityClearance: true }),
  clearance('moderate-risk-public-trust', 'Moderate Risk Public Trust', ['moderate risk public trust', 'mrpt'], 'suitability', { notSecurityClearance: true }),
  clearance('high-risk-public-trust', 'High Risk Public Trust', ['high risk public trust', 'hrpt'], 'suitability', { notSecurityClearance: true }),
  clearance('ci-polygraph', 'CI Polygraph', ['ci poly', 'counterintelligence polygraph'], 'polygraph', { notClearanceLevel: true }),
  clearance('full-scope-polygraph', 'Full Scope Polygraph', ['full scope poly', 'fs polygraph', 'fssp'], 'polygraph', { notClearanceLevel: true }),
  clearance('lifestyle-polygraph', 'Lifestyle Polygraph', ['lifestyle poly'], 'polygraph', { notClearanceLevel: true }),
  clearance('tier-3-investigation', 'Tier 3 Investigation', ['tier 3', 't3 investigation'], 'investigation', { notClearanceLevel: true }),
  clearance('tier-5-investigation', 'Tier 5 Investigation', ['tier 5', 't5 investigation'], 'investigation', { notClearanceLevel: true }),
  clearance('interim', 'Interim Clearance', ['interim secret', 'interim top secret', 'interim clearance'], 'status', { notClearanceLevel: true }),
  clearance('eligible', 'Clearance Eligible', ['clearance eligible', 'eligible for access'], 'status', { doesNotProveCurrentAccess: true }),
  clearance('current', 'Current Clearance', ['active clearance', 'current clearance'], 'status', { requiresUnderlyingLevel: true }),
  clearance('inactive', 'Inactive Clearance', ['inactive clearance', 'expired clearance'], 'status', { doesNotProveCurrentAccess: true }),
]

function rel(fromEntityId: string, toEntityId: string, type: EntityRelationship['type'], note: string): EntityRelationship {
  return {
    id: `rel:v36-5:${type.toLowerCase()}:${fromEntityId}:${toEntityId}`,
    fromEntityId,
    toEntityId,
    type,
    direction: 'directed',
    provenance: [REVIEWED],
    confidence: 'strong',
    note,
  }
}

export const CREDENTIAL_CLEARANCE_RELATIONSHIPS_V36_5: EntityRelationship[] = [
  rel('entity:credential:rhcsa', 'entity:skill:rhel', 'CREDENTIAL_FOR', 'RHCSA is a credential signal for RHEL administration; verify current hands-on experience independently.'),
  rel('entity:credential:rhce', 'entity:skill:rhel', 'CREDENTIAL_FOR', 'RHCE is a credential signal for Red Hat engineering/automation; it is not proof of current role proficiency by itself.'),
  rel('entity:credential:cncf-cka', 'entity:skill:kubernetes', 'CREDENTIAL_FOR', 'CKA is a Kubernetes credential signal, not proof of current production experience.'),
  rel('entity:credential:cncf-ckad', 'entity:skill:kubernetes', 'CREDENTIAL_FOR', 'CKAD is a Kubernetes development credential signal.'),
  rel('entity:credential:cncf-cks', 'entity:skill:kubernetes', 'CREDENTIAL_FOR', 'CKS is a Kubernetes security credential signal.'),
  rel('entity:credential:hashicorp-terraform-associate', 'entity:skill:terraform', 'CREDENTIAL_FOR', 'Terraform Associate is a credential signal; candidate Terraform experience still requires evidence.'),
  rel('entity:credential:isc2-cissp', 'entity:title:security-engineer', 'CREDENTIAL_FOR', 'CISSP may support security-domain discovery but does not prove Security Engineer experience.'),
  rel('entity:credential:giac-gcih', 'entity:title:incident-responder', 'CREDENTIAL_FOR', 'GCIH is an incident-response credential signal.'),
  rel('entity:credential:cisco-ccna', 'entity:title:network-engineer', 'CREDENTIAL_FOR', 'CCNA is a network credential signal; verify actual networking experience.'),
  rel('entity:credential:aws-solutions-architect-associate', 'entity:title:cloud-engineer', 'CREDENTIAL_FOR', 'AWS architecture credential supports discovery, not candidate qualification by itself.'),
  rel('entity:credential:gcp-associate-cloud-engineer', 'entity:title:cloud-engineer', 'CREDENTIAL_FOR', 'Google Cloud credential supports discovery, not candidate qualification by itself.'),
  rel('entity:credential:azure-administrator', 'entity:title:cloud-engineer', 'CREDENTIAL_FOR', 'Azure credential supports discovery, not candidate qualification by itself.'),

  // Explicit federal semantics: these concepts cannot substitute for each other.
  rel('entity:clearance:public-trust', 'entity:clearance:secret', 'DO_NOT_INFER_FROM', 'Public Trust is a suitability/risk designation, not a Secret national-security clearance.'),
  rel('entity:clearance:sci-access', 'entity:clearance:ts-sci', 'DO_NOT_INFER_FROM', 'An SCI reference alone does not prove current TS/SCI eligibility/access.'),
  rel('entity:clearance:sap-access', 'entity:clearance:top-secret', 'DO_NOT_INFER_FROM', 'SAP access terminology is not a standalone clearance-level claim.'),
  rel('entity:clearance:ci-polygraph', 'entity:clearance:ts-sci', 'DO_NOT_INFER_FROM', 'Polygraph terminology does not independently prove TS/SCI.'),
  rel('entity:clearance:full-scope-polygraph', 'entity:clearance:ts-sci', 'DO_NOT_INFER_FROM', 'Polygraph terminology does not independently prove TS/SCI.'),
  rel('entity:clearance:tier-3-investigation', 'entity:clearance:secret', 'DO_NOT_INFER_FROM', 'Investigation tier alone is not proof of a current clearance.'),
  rel('entity:clearance:tier-5-investigation', 'entity:clearance:top-secret', 'DO_NOT_INFER_FROM', 'Investigation tier alone is not proof of a current clearance.'),
  rel('entity:clearance:eligible', 'entity:clearance:current', 'DO_NOT_INFER_FROM', 'Eligibility does not prove active/current access.'),
  rel('entity:clearance:inactive', 'entity:clearance:current', 'DO_NOT_INFER_FROM', 'Inactive/expired status cannot satisfy a current-clearance requirement without new verification.'),
]

export type ClearanceConceptTypeV36_5 = 'clearance_level' | 'access' | 'suitability' | 'polygraph' | 'investigation' | 'status'

export function clearanceConceptTypeV36_5(entity: IntelligenceEntity): ClearanceConceptTypeV36_5 | null {
  if (entity.kind !== 'clearance') return null
  const value = entity.metadata?.conceptType
  return value === 'clearance_level' || value === 'access' || value === 'suitability' || value === 'polygraph' || value === 'investigation' || value === 'status'
    ? value
    : null
}

/**
 * Recruitment UI helper only. It never declares a candidate qualified; it tells
 * the UI how a recognized federal term should be presented/verified.
 */
export function federalTermSemanticsV36_5(entity: IntelligenceEntity): {
  verificationRequired: true
  canBeTreatedAsClearanceLevel: boolean
  warning?: string
} {
  const type = clearanceConceptTypeV36_5(entity)
  const canBeTreatedAsClearanceLevel = type === 'clearance_level'
  const warning = type === 'suitability'
    ? 'Suitability/Public Trust is not a national-security clearance level.'
    : type === 'polygraph'
      ? 'Polygraph is a screening/access condition, not a clearance level.'
      : type === 'investigation'
        ? 'Investigation tier does not prove a current clearance.'
        : type === 'access'
          ? 'Access/compartment terminology must not be reduced to a standalone clearance level.'
          : type === 'status'
            ? 'Status language requires an underlying clearance/access level and current verification.'
            : undefined
  return { verificationRequired: true, canBeTreatedAsClearanceLevel, ...(warning ? { warning } : {}) }
}
