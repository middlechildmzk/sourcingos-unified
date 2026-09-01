import type { JobFamilyId } from '@/lib/job-family-router-v34'

export type GoldenRoleCaseV34 = {
  id: string
  prompt: string
  expectedTitleText: string
  expectedFamily: JobFamilyId
  expectedMustHaves?: string[]
  expectedClearance?: string
  expectedLocationText?: string
  forbiddenRoleTokens?: string[]
}

/**
 * Permanent cross-domain recruiter-search contracts. Keep these human-readable:
 * when production exposes a new failure, add the exact recruiter wording here
 * before fixing the implementation. The suite is intentionally broader than one
 * taxonomy or source connector so changes cannot improve one role by silently
 * degrading another family.
 */
export const GOLDEN_ROLE_CASES_V34: GoldenRoleCaseV34[] = [
  {
    id: 'infra-rhel-cleared-annapolis',
    prompt: 'RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with a Secret security clearance or higher',
    expectedTitleText: 'rhel admin',
    expectedFamily: 'infrastructure',
    expectedMustHaves: ['RHEL', '5+ years relevant experience'],
    expectedClearance: 'Secret or higher',
    expectedLocationText: 'Annapolis Junction',
    forbiddenRoleTokens: ['TypeScript', 'React', 'TS/SCI or higher'],
  },
  {
    id: 'software-frontend-typescript-react',
    prompt: 'Senior frontend engineer with 5+ years of experience using TypeScript and React, remote',
    expectedTitleText: 'frontend engineer',
    expectedFamily: 'software',
    expectedMustHaves: ['TypeScript', 'React', '5+ years relevant experience'],
    forbiddenRoleTokens: ['RHEL', 'Splunk'],
  },
  {
    id: 'cloud-devops-kubernetes-terraform',
    prompt: 'Senior DevOps engineer with Kubernetes, Terraform and AWS in Reston, VA',
    expectedTitleText: 'devops engineer',
    expectedFamily: 'cloud_devops',
    expectedMustHaves: ['Kubernetes', 'Terraform', 'AWS'],
    expectedLocationText: 'Reston',
    forbiddenRoleTokens: ['TypeScript', 'Epic'],
  },
  {
    id: 'cyber-soc-splunk-secret',
    prompt: 'SOC analyst with Splunk and SIEM in Arlington, VA with a Secret security clearance',
    expectedTitleText: 'soc analyst',
    expectedFamily: 'cybersecurity',
    expectedMustHaves: ['Splunk', 'SIEM'],
    expectedClearance: 'Secret',
    expectedLocationText: 'Arlington',
    forbiddenRoleTokens: ['React', 'RHEL'],
  },
  {
    id: 'cyber-security-engineer-rmf-ts-sci',
    prompt: 'Security engineer with NIST RMF and AWS in Chantilly, VA with TS/SCI clearance',
    expectedTitleText: 'security engineer',
    expectedFamily: 'cybersecurity',
    expectedMustHaves: ['NIST RMF', 'AWS'],
    expectedClearance: 'TS/SCI',
    expectedLocationText: 'Chantilly',
    forbiddenRoleTokens: ['TypeScript', 'Epic'],
  },
  {
    id: 'ai-ml-pytorch-llm',
    prompt: 'Machine learning engineer with PyTorch, LLM and Hugging Face in Austin, TX',
    expectedTitleText: 'machine learning engineer',
    expectedFamily: 'ai_ml',
    expectedMustHaves: ['PyTorch', 'LLM', 'Hugging Face'],
    expectedLocationText: 'Austin',
    forbiddenRoleTokens: ['RHEL', 'Splunk'],
  },
  {
    id: 'data-data-scientist-python',
    prompt: 'Data scientist with Python and TensorFlow in San Francisco, CA',
    expectedTitleText: 'data scientist',
    expectedFamily: 'ai_ml',
    expectedMustHaves: ['Python', 'TensorFlow'],
    expectedLocationText: 'San Francisco',
    forbiddenRoleTokens: ['RHEL', 'Epic'],
  },
  {
    id: 'software-backend-python-aws',
    prompt: 'Backend engineer with Python, REST API and AWS in New York, NY',
    expectedTitleText: 'backend engineer',
    expectedFamily: 'software',
    expectedMustHaves: ['Python', 'REST API', 'AWS'],
    expectedLocationText: 'New York',
    forbiddenRoleTokens: ['RHEL', 'Epic'],
  },
  {
    id: 'cloud-kubernetes-platform',
    prompt: 'Kubernetes engineer with Kubernetes, Terraform and Docker in Washington, DC',
    expectedTitleText: 'kubernetes engineer',
    expectedFamily: 'cloud_devops',
    expectedMustHaves: ['Kubernetes', 'Terraform', 'Docker'],
    expectedLocationText: 'Washington',
    forbiddenRoleTokens: ['React', 'Epic'],
  },
  {
    id: 'clinical-rn-epic',
    prompt: 'Registered nurse with Epic and EMR experience in New York, NY',
    expectedTitleText: 'registered nurse',
    expectedFamily: 'healthcare_clinical',
    expectedMustHaves: ['Epic', 'EMR/EHR'],
    expectedLocationText: 'New York',
    forbiddenRoleTokens: ['TypeScript', 'RHEL'],
  },
  {
    id: 'clinical-epic-analyst',
    prompt: 'Clinical informatics specialist with Epic and EMR/EHR experience in Washington, DC',
    expectedTitleText: 'clinical informatics specialist',
    expectedFamily: 'healthcare_clinical',
    expectedMustHaves: ['Epic', 'EMR/EHR'],
    expectedLocationText: 'Washington',
    forbiddenRoleTokens: ['TypeScript', 'RHEL'],
  },
  {
    id: 'research-publication-scientist',
    prompt: 'Research scientist with Python and a strong publication record in Boston, MA',
    expectedTitleText: 'research scientist',
    expectedFamily: 'research_science',
    expectedMustHaves: ['Python'],
    expectedLocationText: 'Boston',
    forbiddenRoleTokens: ['RHEL', 'Splunk'],
  },
  {
    id: 'federal-program-manager-secret',
    prompt: 'Federal program manager in Washington, DC with a Secret security clearance',
    expectedTitleText: 'federal program manager',
    expectedFamily: 'federal_govcon',
    expectedClearance: 'Secret',
    expectedLocationText: 'Washington',
    forbiddenRoleTokens: ['TypeScript', 'RHEL'],
  },
  {
    id: 'finance-financial-advisor',
    prompt: 'Financial advisor with Series 7 and wealth management experience in New York, NY',
    expectedTitleText: 'financial advisor',
    expectedFamily: 'finance_regulated',
    expectedLocationText: 'New York',
    forbiddenRoleTokens: ['TypeScript', 'RHEL'],
  },
  {
    id: 'aviation-aircraft-mechanic',
    prompt: 'Aircraft mechanic with A&P mechanic experience in Dallas, TX',
    expectedTitleText: 'aircraft mechanic',
    expectedFamily: 'aviation',
    expectedLocationText: 'Dallas',
    forbiddenRoleTokens: ['TypeScript', 'RHEL'],
  },
  {
    id: 'general-product-manager',
    prompt: 'Product manager with roadmapping and stakeholder management experience in Chicago, IL',
    expectedTitleText: 'product manager',
    expectedFamily: 'general',
    expectedLocationText: 'Chicago',
    forbiddenRoleTokens: ['TypeScript', 'RHEL', 'TS/SCI'],
  },
]
