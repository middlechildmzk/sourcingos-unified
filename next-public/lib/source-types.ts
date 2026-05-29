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
  | 'resume_xray'

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

export type SourceResult = {
  id: string
  source: SourceName
  sourceProfileId: string
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
  refreshedAt: string
  raw?: unknown
}

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
  results: SourceResult[]
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
  'github',
  'stackoverflow',
  'openalex',
  'npi',
  'orcid',
  'semantic_scholar',
  'arxiv',
  'pubmed',
  'huggingface',
  'npm',
  'pypi',
  'kaggle',
  'devto',
  'dockerhub',
  'crates',
  'rubygems',
  'resume_xray'
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
  resume_xray: 'Public Resume X-Ray'
}

export const sourceGroups: Record<string, SourceName[]> = {
  technical: ['github', 'stackoverflow', 'npm', 'pypi', 'dockerhub', 'crates', 'rubygems', 'devto'],
  research: ['openalex', 'orcid', 'semantic_scholar', 'arxiv', 'pubmed'],
  ai: ['github', 'openalex', 'semantic_scholar', 'arxiv', 'huggingface', 'pypi', 'kaggle'],
  healthcare: ['npi', 'pubmed', 'openalex'],
  open_resume: ['resume_xray'],
  default: ['github', 'stackoverflow', 'openalex', 'npi']
}
