import type { EntityKind, EntitySuggestion } from './types-v35'
import { matchEntitiesV35, suggestRelatedEntitiesV35 } from './registry-v35'
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

export function suggestEntitiesV35(request: EntitySuggestionRequestV35): EntitySuggestionResponseV35 {
  const matches = matchEntitiesV35(request.query, request.allowedKinds)
  const max = Math.max(1, Math.min(request.maxSuggestions ?? 20, 50))
  const related = request.includeRelated === false
    ? []
    : matches.flatMap(match => suggestRelatedEntitiesV35(match.entity.id))

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
