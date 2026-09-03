import type { EntityKind, EntitySuggestion } from './types-v35'
import { ENTITY_REGISTRY_V35, entityByIdV35, matchEntitiesV35, suggestRelatedEntitiesV35 } from './registry-v35'
import { matchLocationEntitiesV35, resolveLocationIntentV35 } from './location-v35'

export type EntitySuggestionRequestV35 = {
  query: string
  allowedKinds?: EntityKind[]
  includeRelated?: boolean
  maxSuggestions?: number
}

export type EntitySuggestionResponseV35 = {
  query: string
  matches: EntitySuggestion[]
  related: EntitySuggestion[]
  locationIntent?: ReturnType<typeof resolveLocationIntentV35>
  notes: string[]
  version: 'v35.2'
}

function incomingRelationshipSuggestions(entityId: string): EntitySuggestion[] {
  return ENTITY_REGISTRY_V35.relationships
    .filter(relationship =>
      relationship.toEntityId === entityId
      && ['CREDENTIAL_FOR', 'RELATED_TECHNOLOGY', 'ADJACENT_TO', 'COMMON_MARKET_VARIANT'].includes(relationship.type))
    .flatMap(relationship => {
      const entity = entityByIdV35(relationship.fromEntityId)
      if (!entity) return []
      const credential = relationship.type === 'CREDENTIAL_FOR'
      const titleVariant = relationship.type === 'ADJACENT_TO' || relationship.type === 'COMMON_MARKET_VARIANT'
      return [{
        entity,
        matchedText: entity.canonicalLabel,
        matchType: titleVariant ? 'market_variant' as const : 'adjacent' as const,
        relationship,
        explanation: relationship.note || (credential
          ? `${entity.canonicalLabel} is a credential signal related to the search concept.`
          : titleVariant
            ? `${entity.canonicalLabel} is an inactive adjacent/market-title discovery variant, not an exact equivalent.`
            : `${entity.canonicalLabel} is a related technology that may broaden discovery.`),
        rank: credential ? 1.1 : titleVariant ? 1.25 : 1.3,
        activation: 'suggested_inactive' as const,
      }]
    })
}

export function suggestEntitiesV35(request: EntitySuggestionRequestV35): EntitySuggestionResponseV35 {
  const rawMatches = matchEntitiesV35(request.query, request.allowedKinds)
  const matches = rawMatches.filter(item => item.activation !== 'suggested_inactive')
  const legacyVariants = rawMatches.filter(item => item.activation === 'suggested_inactive')
  const max = Math.max(1, Math.min(request.maxSuggestions ?? 20, 50))
  const related = request.includeRelated === false
    ? legacyVariants
    : [
        ...legacyVariants,
        ...matches.flatMap(match => [
          ...suggestRelatedEntitiesV35(match.entity.id),
          ...incomingRelationshipSuggestions(match.entity.id),
        ]),
      ]

  const seen = new Set<string>()
  const dedupedRelated = related.filter(item => {
    if (matches.some(match => match.entity.id === item.entity.id)) return false
    if (seen.has(item.entity.id)) return false
    seen.add(item.entity.id)
    return true
  }).slice(0, max)

  const locationMatches = matchLocationEntitiesV35(request.query)
  const locationIntent = locationMatches.length || /\b(?:near|nearby|within\s+\d+\s*(?:mi|mile)|remote|hybrid|dmv|metro)\b/i.test(request.query)
    ? resolveLocationIntentV35(request.query)
    : undefined

  const notes = [
    'Suggestions are recruiter search intelligence, not candidate facts.',
    'Adjacent and related entities may expand discovery but never satisfy a must-have without candidate evidence.',
    'Legacy broad aliases are inactive search variants until reviewed into a typed equivalence or adjacency relationship.',
    'Credentials are typed as credential signals; they never prove current hands-on experience by themselves.',
  ]
  if (locationIntent?.suggestedExpansionIds.length) {
    notes.push('Nearby and regional locations are inactive suggestions until the recruiter approves expansion.')
  }
  if (locationIntent?.ambiguousCandidateIds?.length) {
    notes.push('Ambiguous location detected; no location was silently selected.')
  }

  return {
    query: request.query,
    matches: matches.slice(0, max),
    related: dedupedRelated,
    ...(locationIntent ? { locationIntent } : {}),
    notes,
    version: 'v35.2',
  }
}
