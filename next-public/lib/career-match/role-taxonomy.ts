import type { RecruitingRoleFamily, RecruitingRoleTaxonomyEntry } from './types'

export const recruitingRoleTaxonomy: Record<RecruitingRoleFamily, RecruitingRoleTaxonomyEntry> = {
  recruiter: {
    id: 'recruiter',
    label: 'Recruiter',
    jobSearchCategory: 'recruiter',
    searchTerms: ['recruiter', 'talent acquisition specialist', 'full cycle recruiter', 'corporate recruiter'],
    titleSignals: ['recruiter', 'talent acquisition specialist', 'talent partner', 'corporate recruiter', 'full cycle recruiter'],
    skillSignals: ['full cycle', 'screening', 'interview coordination', 'stakeholder management', 'offer', 'candidate experience'],
    toolSignals: ['greenhouse', 'lever', 'workday', 'icims', 'ashby', 'smartrecruiters'],
    industrySignals: ['corporate', 'agency', 'startup', 'enterprise'],
    adjacentFamilies: ['sourcer', 'remote-recruiter', 'recruiting-ops', 'rpo-recruiter'],
    resumeAngle: 'Emphasize req ownership, stakeholder partnership, funnel metrics, offer work, and candidate experience.',
  },
  sourcer: {
    id: 'sourcer',
    label: 'Talent Sourcer',
    jobSearchCategory: 'sourcer',
    searchTerms: ['sourcer', 'talent sourcer', 'recruiting researcher', 'candidate researcher'],
    titleSignals: ['sourcer', 'talent sourcer', 'candidate researcher', 'recruiting researcher', 'sourcing specialist'],
    skillSignals: ['sourcing', 'boolean', 'x-ray', 'market mapping', 'pipeline generation', 'outreach', 'candidate research'],
    toolSignals: ['linkedin recruiter', 'seekout', 'hireez', 'hiretual', 'gem', 'eightfold', 'github'],
    industrySignals: ['corporate', 'agency', 'startup', 'enterprise'],
    adjacentFamilies: ['technical-sourcer', 'talent-intelligence', 'recruiting-ops', 'remote-recruiter'],
    resumeAngle: 'Lead with sourcing channels, search strategy, response rates, pipeline quality, and hard-to-find talent examples.',
  },
  'technical-sourcer': {
    id: 'technical-sourcer',
    label: 'Technical Sourcer / Technical Recruiter',
    jobSearchCategory: 'technical-recruiter-jobs',
    searchTerms: ['technical sourcer', 'technical recruiter', 'engineering recruiter', 'tech sourcer'],
    titleSignals: ['technical sourcer', 'technical recruiter', 'engineering recruiter', 'tech recruiter', 'software recruiter'],
    skillSignals: ['engineering', 'software', 'developer', 'github', 'stack overflow', 'cloud', 'security', 'data', 'devops'],
    toolSignals: ['linkedin recruiter', 'seekout', 'hireez', 'github', 'greenhouse', 'lever', 'gem'],
    industrySignals: ['software', 'saas', 'fintech', 'cybersecurity', 'cloud', 'data', 'ai', 'machine learning'],
    adjacentFamilies: ['ai-recruiter', 'sourcer', 'talent-intelligence', 'govcon-recruiter'],
    resumeAngle: 'Translate technical searches into stacks, domains, seniority levels, and evidence of engineering hiring outcomes.',
  },
  'remote-recruiter': {
    id: 'remote-recruiter',
    label: 'Remote Recruiter',
    jobSearchCategory: 'remote-recruiter-jobs',
    searchTerms: ['remote recruiter', 'remote sourcer', 'distributed talent acquisition', 'global recruiter'],
    titleSignals: ['remote recruiter', 'remote sourcer', 'global recruiter', 'distributed recruiter'],
    skillSignals: ['remote hiring', 'distributed teams', 'global hiring', 'async', 'virtual interviewing', 'timezone'],
    toolSignals: ['greenhouse', 'lever', 'ashby', 'slack', 'zoom', 'gem', 'linkedin recruiter'],
    industrySignals: ['remote', 'global', 'startup', 'saas'],
    adjacentFamilies: ['recruiter', 'sourcer', 'rpo-recruiter', 'recruiting-ops'],
    resumeAngle: 'Show remote hiring scope, distributed stakeholder work, virtual interview process, and global pipeline experience.',
  },
  'recruiting-ops': {
    id: 'recruiting-ops',
    label: 'Recruiting Operations',
    jobSearchCategory: 'recruiting-operations-jobs',
    searchTerms: ['recruiting operations', 'recruiting ops', 'talent operations', 'TA operations'],
    titleSignals: ['recruiting operations', 'recruiting ops', 'talent operations', 'talent acquisition operations', 'program manager'],
    skillSignals: ['process', 'workflow', 'analytics', 'reporting', 'dashboard', 'ats configuration', 'enablement', 'program management'],
    toolSignals: ['greenhouse', 'lever', 'ashby', 'workday', 'icims', 'tableau', 'looker', 'excel', 'google sheets'],
    industrySignals: ['hrtech', 'people ops', 'operations', 'enterprise'],
    adjacentFamilies: ['talent-intelligence', 'recruiter', 'sourcer', 'remote-recruiter'],
    resumeAngle: 'Reframe recruiting work as systems, workflow, analytics, enablement, reporting, and process improvement.',
  },
  'healthcare-recruiter': {
    id: 'healthcare-recruiter',
    label: 'Healthcare Recruiter',
    jobSearchCategory: 'healthcare-recruiter-jobs',
    searchTerms: ['healthcare recruiter', 'nurse recruiter', 'provider recruiter', 'clinical recruiter'],
    titleSignals: ['healthcare recruiter', 'nurse recruiter', 'clinical recruiter', 'provider recruiter', 'physician recruiter'],
    skillSignals: ['clinical', 'nursing', 'provider', 'credentialing', 'licensure', 'rn', 'lpn', 'cna', 'physician'],
    toolSignals: ['workday', 'icims', 'linkedin recruiter', 'indeed', 'bullhorn', 'greenhouse'],
    industrySignals: ['healthcare', 'hospital', 'clinical', 'digital health', 'nursing'],
    adjacentFamilies: ['recruiter', 'rpo-recruiter', 'remote-recruiter', 'recruiting-ops'],
    resumeAngle: 'Highlight clinical roles recruited, license-heavy searches, high-volume hiring, credentialing awareness, and hiring manager partnership.',
  },
  'govcon-recruiter': {
    id: 'govcon-recruiter',
    label: 'Federal / Cleared Recruiter',
    jobSearchCategory: 'govcon-recruiter-jobs',
    searchTerms: ['cleared recruiter', 'federal recruiter', 'govcon recruiter', 'defense recruiter'],
    titleSignals: ['cleared recruiter', 'federal recruiter', 'govcon recruiter', 'defense recruiter', 'security clearance recruiter'],
    skillSignals: ['clearance', 'secret', 'top secret', 'ts/sci', 'polygraph', 'dod', 'federal', 'govcon', 'defense'],
    toolSignals: ['clearancejobs', 'linkedin recruiter', 'seekout', 'hireez', 'dice', 'greenhouse', 'icims'],
    industrySignals: ['federal', 'govcon', 'defense', 'aerospace', 'cybersecurity', 'public sector'],
    adjacentFamilies: ['technical-sourcer', 'sourcer', 'recruiter', 'ai-recruiter'],
    resumeAngle: 'Be precise about public clearance breadcrumbs and GovCon hiring exposure. Do not imply active clearance unless it is explicitly true.',
  },
  'ai-recruiter': {
    id: 'ai-recruiter',
    label: 'AI / ML Recruiter',
    jobSearchCategory: 'ai-recruiter-jobs',
    searchTerms: ['AI recruiter', 'machine learning recruiter', 'research recruiter', 'ML sourcer'],
    titleSignals: ['ai recruiter', 'ml recruiter', 'machine learning recruiter', 'research recruiter', 'ai sourcer'],
    skillSignals: ['machine learning', 'artificial intelligence', 'research', 'llm', 'nlp', 'computer vision', 'data science'],
    toolSignals: ['linkedin recruiter', 'seekout', 'github', 'semantic scholar', 'google scholar', 'greenhouse', 'lever'],
    industrySignals: ['ai', 'machine learning', 'research', 'data', 'deep learning', 'startup'],
    adjacentFamilies: ['technical-sourcer', 'talent-intelligence', 'govcon-recruiter', 'sourcer'],
    resumeAngle: 'Make AI and research searches concrete: roles, stacks, labs, publications, open-source signals, and technical calibration.',
  },
  'talent-intelligence': {
    id: 'talent-intelligence',
    label: 'Talent Intelligence Analyst',
    jobSearchCategory: 'recruiting-operations-jobs',
    searchTerms: ['talent intelligence', 'talent research', 'market intelligence', 'workforce intelligence'],
    titleSignals: ['talent intelligence', 'talent researcher', 'market intelligence', 'talent research analyst', 'workforce intelligence'],
    skillSignals: ['market mapping', 'competitor analysis', 'talent mapping', 'labor market', 'research', 'insights', 'analytics'],
    toolSignals: ['linkedin talent insights', 'seekout', 'hireez', 'excel', 'google sheets', 'tableau', 'looker'],
    industrySignals: ['analytics', 'strategy', 'research', 'enterprise', 'talent'],
    adjacentFamilies: ['sourcer', 'technical-sourcer', 'recruiting-ops', 'ai-recruiter'],
    resumeAngle: 'Reframe sourcing work as research, market mapping, competitor intelligence, funnel insight, and decision support.',
  },
  'rpo-recruiter': {
    id: 'rpo-recruiter',
    label: 'RPO Recruiter',
    jobSearchCategory: 'recruiter',
    searchTerms: ['RPO recruiter', 'contract recruiter', 'client embedded recruiter', 'recruitment consultant'],
    titleSignals: ['rpo recruiter', 'contract recruiter', 'recruitment consultant', 'client recruiter', 'embedded recruiter'],
    skillSignals: ['client', 'req load', 'sla', 'high volume', 'agency', 'vendor', 'stakeholder', 'delivery'],
    toolSignals: ['bullhorn', 'icims', 'workday', 'greenhouse', 'linkedin recruiter', 'indeed'],
    industrySignals: ['rpo', 'agency', 'staffing', 'enterprise', 'consulting'],
    adjacentFamilies: ['recruiter', 'remote-recruiter', 'healthcare-recruiter', 'sourcer'],
    resumeAngle: 'Show client delivery, req volume, SLA discipline, funnel conversion, and cross-client adaptability.',
  },
}

export const roleFamilyOrder: RecruitingRoleFamily[] = Object.keys(recruitingRoleTaxonomy) as RecruitingRoleFamily[]

export function getRoleFamilyLabel(family: RecruitingRoleFamily): string {
  return recruitingRoleTaxonomy[family]?.label || family
}

export function getAdjacentFamilies(family: RecruitingRoleFamily): RecruitingRoleFamily[] {
  return recruitingRoleTaxonomy[family]?.adjacentFamilies || []
}

export function normalizeFamily(value: string | null | undefined): RecruitingRoleFamily | null {
  if (!value) return null
  const normalized = value.toLowerCase().trim().replace(/\s+/g, '-')
  if (normalized in recruitingRoleTaxonomy) return normalized as RecruitingRoleFamily
  const byLabel = roleFamilyOrder.find(family => recruitingRoleTaxonomy[family].label.toLowerCase() === value.toLowerCase().trim())
  return byLabel || null
}
