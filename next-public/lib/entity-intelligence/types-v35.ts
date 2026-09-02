import type { EntityType } from '@/data/search-taxonomy'

export type EntityKind =
  | EntityType
  | 'occupation'
  | 'technology'
  | 'credential'
  | 'place'
  | 'metro'
  | 'region'
  | 'postal_area'
  | 'country'
  | 'state'
  | 'county'

export type EntityReviewState = 'reviewed' | 'needs_review' | 'quarantined'

export type EntityRelationshipType =
  | 'EXACT_EQUIVALENT'
  | 'ALIAS_OF'
  | 'ABBREVIATION_OF'
  | 'COMMON_MARKET_VARIANT'
  | 'SUBTYPE_OF'
  | 'ADJACENT_TO'
  | 'TRANSFERABLE_TO'
  | 'RELATED_TECHNOLOGY'
  | 'CREDENTIAL_FOR'
  | 'CONFUSABLE_WITH'
  | 'DO_NOT_INFER_FROM'
  | 'LOCATED_IN'
  | 'METRO_MEMBER_OF'
  | 'PART_OF_REGION'
  | 'NEAR'
  | 'SOURCE_USEFUL_FOR'

export type EntityProvenance = {
  source: 'legacy_search_taxonomy' | 'legacy_search_expansions' | 'cleared_market_adjacency' | 'v35_curated' | 'onet' | 'esco' | 'other'
  sourceRef?: string
  version: string
  reviewState: EntityReviewState
  note?: string
}

export type EntityLocationMetadata = {
  placeType?: 'country' | 'state' | 'county' | 'city' | 'town' | 'municipality' | 'metro' | 'region' | 'postal_area' | 'neighborhood' | 'corridor' | 'installation'
  countryCode?: string
  stateCode?: string
  postalCode?: string
  latitude?: number
  longitude?: number
}

export type IntelligenceEntity = {
  id: string
  kind: EntityKind
  canonicalLabel: string
  aliases: string[]
  provenance: EntityProvenance[]
  metadata?: EntityLocationMetadata & Record<string, unknown>
}

export type EntityRelationship = {
  id: string
  fromEntityId: string
  toEntityId: string
  type: EntityRelationshipType
  provenance: EntityProvenance[]
  direction: 'directed' | 'symmetric'
  confidence?: 'deterministic' | 'strong' | 'moderate' | 'weak'
  note?: string
}

export type EntityMatchType = 'exact' | 'alias' | 'acronym' | 'market_variant' | 'adjacent' | 'confusable'

export type EntitySuggestion = {
  entity: IntelligenceEntity
  matchedText: string
  matchType: EntityMatchType
  relationship?: EntityRelationship
  explanation: string
  rank: number
  activation: 'original' | 'normalized' | 'suggested_inactive' | 'suggested_active'
}

export type LocationIntentMode = 'exact' | 'nearby' | 'radius' | 'metro' | 'region' | 'state' | 'remote' | 'hybrid' | 'unknown'

export type LocationIntentV35 = {
  mode: LocationIntentMode
  rawText: string
  anchorLocationId?: string
  anchorLabel?: string
  radiusMiles?: number
  recruiterApprovedExpansionIds: string[]
  suggestedExpansionIds: string[]
  ambiguousCandidateIds?: string[]
  explanation: string[]
  version: 'v35.2'
}

export type EntityRegistryV35 = {
  version: 'v35.2'
  entities: IntelligenceEntity[]
  relationships: EntityRelationship[]
}
