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
  | 'pearch'
  | 'people_data_labs'
  | 'coresignal'
  | 'data_vertex'
  | 'contactout'
  | 'signalhire'
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
  refreshedAt: string
  raw?: unknown
}
