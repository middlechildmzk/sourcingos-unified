import type { AgenticConnectorKey } from './agentic-search-v30'

export type SourceCapabilityV36_7 = {
  source: AgenticConnectorKey
  personSearch: boolean
  nativeLocation: boolean
  observedLocation: boolean
  avatar: boolean
  profileUrl: boolean
  publicContactSignals: boolean
  identitySignals: boolean
  capabilityEvidence: boolean
  bestFor: string[]
  notes: string[]
}

export const SOURCE_CAPABILITIES_V36_7: Partial<Record<AgenticConnectorKey, SourceCapabilityV36_7>> = {
  github: {
    source: 'github', personSearch: true, nativeLocation: true, observedLocation: true, avatar: true, profileUrl: true,
    publicContactSignals: true, identitySignals: true, capabilityEvidence: true,
    bestFor: ['software', 'platform', 'devops', 'sre', 'data', 'ml', 'security', 'linux'],
    notes: ['Public profile/repository evidence can support technical discovery. Popularity is not proficiency.'],
  },
  stackoverflow: {
    source: 'stackoverflow', personSearch: true, nativeLocation: true, observedLocation: true, avatar: true, profileUrl: true,
    publicContactSignals: true, identitySignals: true, capabilityEvidence: true,
    bestFor: ['software', 'platform', 'data', 'security'],
    notes: ['Public profile/tags/activity can support discovery. Reputation is not proficiency.'],
  },
  devto: {
    source: 'devto', personSearch: true, nativeLocation: false, observedLocation: true, avatar: true, profileUrl: true,
    publicContactSignals: true, identitySignals: true, capabilityEvidence: true,
    bestFor: ['software', 'devops', 'cloud', 'data'],
    notes: ['Geography is evaluated from observed profile evidence downstream.'],
  },
  huggingface: {
    source: 'huggingface', personSearch: true, nativeLocation: false, observedLocation: false, avatar: true, profileUrl: true,
    publicContactSignals: false, identitySignals: true, capabilityEvidence: true,
    bestFor: ['ml', 'ai', 'data science'],
    notes: ['Model/dataset activity supports AI/ML discovery, not candidate location or employment.'],
  },
  npi: {
    source: 'npi', personSearch: true, nativeLocation: true, observedLocation: true, avatar: false, profileUrl: false,
    publicContactSignals: false, identitySignals: true, capabilityEvidence: true,
    bestFor: ['healthcare', 'clinical'],
    notes: ['Registry evidence supports licensure/provider identity; it is not an employment-status feed.'],
  },
  openalex: {
    source: 'openalex', personSearch: true, nativeLocation: false, observedLocation: false, avatar: false, profileUrl: true,
    publicContactSignals: false, identitySignals: true, capabilityEvidence: true,
    bestFor: ['research', 'data science', 'ml', 'biomedical'],
    notes: ['Publication evidence is research evidence, not current employment or residence.'],
  },
  orcid: {
    source: 'orcid', personSearch: true, nativeLocation: false, observedLocation: false, avatar: false, profileUrl: true,
    publicContactSignals: false, identitySignals: true, capabilityEvidence: true,
    bestFor: ['research', 'science', 'academic'],
    notes: ['ORCID is a strong public identity anchor when explicitly observed.'],
  },
  pubmed: {
    source: 'pubmed', personSearch: false, nativeLocation: false, observedLocation: false, avatar: false, profileUrl: true,
    publicContactSignals: false, identitySignals: false, capabilityEvidence: true,
    bestFor: ['clinical research', 'biomedical'],
    notes: ['Publication records are artifacts; authors require separate identity resolution.'],
  },
}

export function sourceCapabilityV36_7(source: AgenticConnectorKey): SourceCapabilityV36_7 | undefined {
  return SOURCE_CAPABILITIES_V36_7[source]
}
