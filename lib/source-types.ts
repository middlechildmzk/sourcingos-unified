export type SourceName =
  | 'github'
  | 'stackoverflow'
  | 'openalex'
  | 'npi'
  | 'orcid'
  | 'semantic_scholar'
  | 'arxiv'
  | 'pubmed'
  | 'huggingface'
  | 'npm'
  | 'pypi'
  | 'kaggle'
  | 'devto'
  | 'dockerhub'
  | 'crates'
  | 'rubygems'
  // Stack Exchange network sites beyond Stack Overflow retain site-level provenance.
  | 'serverfault'
  | 'security_se'
  | 'devops_se'
  | 'unix_se'
  | 'dba_se'
  | 'networkeng_se'
  | 'resume_xray'
  | 'pearch'
  | 'people_data_labs'
  | 'coresignal'
  | 'data_vertex'
  | 'contactout'
  | 'signalhire'
  | 'linkup'
  | 'exa'
  | 'openweb_ninja'

/** The real-world subject represented by a source result. */
export type EntityKind =
  | 'person'
  | 'organization'
  | 'artifact'
  | 'publication'
  | 'search_lane'
  | 'unknown'

export type EvidenceConfidence = 'high' | 'medium' | 'low'

export type EvidenceItem = {
  id: string
  label: string
  detail: string
  source: SourceName
  confidence: EvidenceConfidence
  url?: string
  observedAt: string
}

export type ContactSignal = {
  type: 'public_email' | 'website' | 'profile_url' | 'location' | 'organization'
  value: string
  source: SourceName
  verified: false
  note: string
}

export type IdentitySignal = {
  type: 'name' | 'location' | 'website' | 'email' | 'skill' | 'organization' | 'source_url'
  value: string
  weight: number
  source: SourceName
}

export type DeterministicIdentityAnchorSignal = {
  kind: 'npi_number' | 'orcid' | 'github_login' | 'personal_domain' | 'explicit_profile_link'
  value: string
  normalized: string
  source: SourceName
}

/** Every connector must explicitly identify the subject it returns. */
export type SourceResult = {
  id: string
  source: SourceName
  sourceProfileId: string
  entityKind: EntityKind
  displayName: string
  headline?: string
  location?: string
  organization?: string
  profileUrl?: string
  avatarUrl?: string
  skills: string[]
  evidence: EvidenceItem[]
  contactSignals: ContactSignal[]
  identitySignals: IdentitySignal[]
  /** Source-native hard anchors may queue identity review; never auto-merge. */
  deterministicIdentityAnchors?: DeterministicIdentityAnchorSignal[]
  refreshedAt: string
  raw?: unknown
}

export type ClassifiedSourceResult = SourceResult

export type SourceSearchRequest = {
  query: string
  location?: string
  roleMode?: string
  sources?: SourceName[]
  limit?: number
}

export type SourceSearchResponse = {
  ok: boolean
  query: string
  searchedSources: SourceName[]
  results: ClassifiedSourceResult[]
  warnings: string[]
  generatedAt: string
}

export type MergeStatus = 'needs_review' | 'linked' | 'rejected'

export type RefreshPolicy = {
  cadenceHours: number
  staleAfterHours: number
  sourceNames: SourceName[]
  enabled: boolean
}

export const allSourceNames: SourceName[] = [
  'github', 'stackoverflow', 'openalex', 'npi', 'orcid',
  'semantic_scholar', 'arxiv', 'pubmed', 'huggingface', 'npm',
  'pypi', 'kaggle', 'devto', 'dockerhub', 'crates', 'rubygems',
  'serverfault', 'security_se', 'devops_se', 'unix_se', 'dba_se', 'networkeng_se',
  'resume_xray', 'pearch', 'people_data_labs', 'coresignal', 'data_vertex',
  'contactout', 'signalhire', 'linkup', 'exa', 'openweb_ninja',
]

export const sourceLabels: Record<SourceName, string> = {
  github: 'GitHub',
  stackoverflow: 'Stack Overflow',
  openalex: 'OpenAlex',
  npi: 'NPI Registry',
  orcid: 'ORCID',
  semantic_scholar: 'Semantic Scholar',
  arxiv: 'arXiv',
  pubmed: 'PubMed',
  huggingface: 'Hugging Face',
  npm: 'npm',
  pypi: 'PyPI',
  kaggle: 'Kaggle',
  devto: 'DEV Community',
  dockerhub: 'Docker Hub',
  crates: 'crates.io',
  rubygems: 'RubyGems',
  serverfault: 'Server Fault',
  security_se: 'Information Security Stack Exchange',
  devops_se: 'DevOps Stack Exchange',
  unix_se: 'Unix & Linux Stack Exchange',
  dba_se: 'Database Administrators Stack Exchange',
  networkeng_se: 'Network Engineering Stack Exchange',
  resume_xray: 'Public Resume X-Ray',
  pearch: 'Pearch',
  people_data_labs: 'People Data Labs',
  coresignal: 'Coresignal',
  data_vertex: 'DataVertex',
  contactout: 'ContactOut',
  signalhire: 'SignalHire',
  linkup: 'LinkUpAPI',
  exa: 'Exa People',
  openweb_ninja: 'OpenWeb Ninja',
}

export const sourceGroups: Record<string, SourceName[]> = {
  technical: ['github', 'stackoverflow', 'npm', 'pypi', 'dockerhub', 'crates', 'rubygems', 'devto'],
  infrastructure: ['serverfault', 'unix_se', 'devops_se', 'networkeng_se', 'dba_se', 'github'],
  security: ['security_se', 'serverfault', 'github', 'stackoverflow'],
  research: ['openalex', 'orcid', 'semantic_scholar', 'arxiv', 'pubmed'],
  ai: ['github', 'openalex', 'semantic_scholar', 'arxiv', 'huggingface', 'pypi', 'kaggle'],
  healthcare: ['npi', 'orcid', 'pubmed', 'openalex'],
  people_data: ['pearch', 'people_data_labs', 'coresignal', 'data_vertex', 'contactout', 'signalhire', 'linkup', 'exa'],
  public_web_enrichment: ['openweb_ninja'],
  open_resume: ['resume_xray'],
  default: ['github', 'stackoverflow', 'openalex', 'npi'],
}
