import type { EntityKind, SourceName } from '../source-types'

export type SourceRole = 'person_anchor' | 'evidence_artifact' | 'organization' | 'unresolved_identity' | 'discovery_lane'

export type IdentifierType =
  | 'platform_id'
  | 'profile_url'
  | 'handle'
  | 'public_email_hash'
  | 'website_domain'
  | 'orcid'
  | 'phone_hash'
  | 'linkedin_url'
  | 'github_url'
  | 'stackoverflow_url'

export type BlockType =
  | 'platform_identifier'
  | 'profile_url'
  | 'public_email_hash'
  | 'orcid'
  | 'personal_domain'
  | 'uncommon_handle'
  | 'name_location'
  | 'name_organization'

export type DecisionClass =
  | 'exact_source_reuse'
  | 'deterministic_attach'
  | 'high_priority_review'
  | 'standard_review'
  | 'create_new_candidate'
  | 'do_not_link'

export type ConflictSeverity = 'blocking' | 'material' | 'informational'

export type IdentityIdentifier = {
  type: IdentifierType
  hash: string
  displayValue?: string
  confidence: number
  observedAt: string
  sensitive: boolean
  source: SourceName
}

export type IdentityBlockKey = {
  type: BlockType
  hash: string
  reason: string
}

export type IdentityProfile = {
  id: string
  ownerId: string
  source: SourceName
  sourceProfileId: string
  entityKind: EntityKind
  sourceRole: SourceRole
  displayName: string
  headline?: string
  location?: string
  organization?: string
  profileUrl?: string
  websites: string[]
  handles: string[]
  publicEmails: string[]
  orcid?: string
  explicitLinks: string[]
  identifiers: IdentityIdentifier[]
  observedAt: string
  chronology?: Array<{
    organization?: string
    title?: string
    startYear?: number
    endYear?: number
  }>
}

export type CandidateIdentity = {
  id: string
  ownerId: string
  canonicalName: string
  headline?: string
  location?: string
  currentCompany?: string
  currentTitle?: string
  sourceProfiles: IdentityProfile[]
}

export type DeterministicRuleResult = {
  ruleId:
    | 'same_source_stable_id'
    | 'explicit_cross_profile_link'
    | 'same_observed_public_email_and_compatible_name'
    | 'same_authenticated_or_imported_orcid'
    | 'same_personal_site_explicitly_linking_both_profiles'
    | 'same_authorized_resume_profile_url'
  passed: boolean
  evidence: Record<string, unknown>
}

export type IdentityConflict = {
  type: string
  severity: ConflictSeverity
  explanation: string
  evidence: Record<string, unknown>
}

export type SimilarityComponents = {
  name: number | null
  handle: number | null
  location: number | null
  organization: number | null
  personalDomain: number | null
  externalLink: number | null
  chronology: number | null
}

export type CandidateComparison = {
  candidateId: string
  score: number
  deterministicRules: DeterministicRuleResult[]
  similarityComponents: SimilarityComponents
  supportingEvidence: Array<Record<string, unknown>>
  conflicts: IdentityConflict[]
  blockingKeysUsed: string[]
}

export type IdentityResolutionResult = {
  incomingSourceProfileId: string
  proposedCandidateId: string | null
  decisionClass: DecisionClass
  score: number | null
  deterministicRules: DeterministicRuleResult[]
  similarityComponents: SimilarityComponents
  supportingEvidence: Array<Record<string, unknown>>
  conflicts: IdentityConflict[]
  blockingKeysUsed: string[]
  resolverVersion: string
  reviewRequired: boolean
  safeToAttach: boolean
}

export type ResolveIdentityInput = {
  incoming: IdentityProfile
  candidates: CandidateIdentity[]
  comparisonLimit?: number
}
