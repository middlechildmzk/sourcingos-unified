import type { EntityType } from '@/data/search-taxonomy'
import { containsBoundedTerm } from '@/lib/evidence-span'
import { ENTITY_REGISTRY_V35 } from './registry-v35'
import type { EntityKind, IntelligenceEntity } from './types-v35'

export type QualificationConceptV35 = {
  canonical: string
  entityType?: EntityType
  aliases: string[]
}

/**
 * Explicitly reviewed equivalence aliases allowed to participate in candidate
 * requirement assessment. This is intentionally narrower than the legacy Search
 * Composer dictionary, whose `aliases` mix synonyms, adjacent technologies and
 * substitutes. Search recall can use the broader graph; qualification cannot.
 *
 * These are migration seeds for future typed EXACT_EQUIVALENT / ALIAS_OF edges.
 */
const REVIEWED_EQUIVALENCE_ALIASES_V35: Record<string, string[]> = {
  'Red Hat Enterprise Linux': ['red hat enterprise linux', 'rhel', 'red hat linux'],
  Kubernetes: ['kubernetes', 'k8s'],
  TypeScript: ['typescript'],
  React: ['react', 'reactjs', 'react.js'],
  'NIST RMF': ['nist rmf', 'rmf', 'risk management framework'],
  'EMR/EHR': ['emr/ehr', 'emr', 'ehr', 'electronic medical record', 'electronic health record'],
  'TS/SCI': ['ts/sci', 'ts sci', 'tssci', 'top secret sci'],
  'Top Secret': ['top secret', 'top secret clearance'],
  Secret: ['secret clearance', 'active secret', 'dod secret', 'secret-level clearance'],
  'Public Trust': ['public trust', 'moderate background investigation'],
  'Site Reliability Engineer': ['site reliability engineer', 'sre'],
}

function entityTypeForKind(kind: EntityKind): EntityType | undefined {
  if (kind === 'occupation') return 'title'
  if (kind === 'technology') return 'tool'
  if (kind === 'credential') return 'certification'
  if (kind === 'place' || kind === 'metro' || kind === 'region' || kind === 'postal_area' || kind === 'country' || kind === 'state' || kind === 'county') return 'location'
  if (kind === 'title' || kind === 'skill' || kind === 'tool' || kind === 'certification' || kind === 'location' || kind === 'clearance' || kind === 'company' || kind === 'industry' || kind === 'seniority' || kind === 'employment-signal' || kind === 'source') return kind
  return undefined
}

function reviewedAliases(entity: IntelligenceEntity): string[] {
  const explicit = REVIEWED_EQUIVALENCE_ALIASES_V35[entity.canonicalLabel]
  if (explicit?.length) return explicit

  const fullyReviewed = entity.provenance.length > 0 && entity.provenance.every(item => item.reviewState === 'reviewed')
  return fullyReviewed
    ? Array.from(new Set([entity.canonicalLabel.toLowerCase(), ...entity.aliases.map(alias => alias.toLowerCase())]))
    : [entity.canonicalLabel.toLowerCase()]
}

function ambiguousBareAcronymConcepts(requirementText: string): QualificationConceptV35[] | undefined {
  if (requirementText.trim().toLowerCase() !== 'ts') return undefined
  return [
    { canonical: 'TypeScript', entityType: 'skill', aliases: ['typescript'] },
    { canonical: 'Top Secret', entityType: 'clearance', aliases: ['top secret', 'top secret clearance'] },
  ]
}

export function qualificationConceptsV35(requirementText: string): QualificationConceptV35[] {
  const ambiguous = ambiguousBareAcronymConcepts(requirementText)
  if (ambiguous) return ambiguous

  const concepts = ENTITY_REGISTRY_V35.entities.flatMap(entity => {
    const entityType = entityTypeForKind(entity.kind)
    if (!entityType || entityType === 'location') return []
    const aliases = reviewedAliases(entity)
    if (!aliases.some(alias => containsBoundedTerm(requirementText, alias))
      && !containsBoundedTerm(requirementText, entity.canonicalLabel)) return []
    return [{ canonical: entity.canonicalLabel, entityType, aliases }]
  })

  const byKey = new Map<string, QualificationConceptV35>()
  for (const concept of concepts) {
    const key = `${concept.entityType || 'unknown'}:${concept.canonical.toLowerCase()}`
    const previous = byKey.get(key)
    byKey.set(key, previous
      ? { ...previous, aliases: Array.from(new Set([...previous.aliases, ...concept.aliases])) }
      : concept)
  }

  if (!byKey.size) {
    const exact = requirementText.trim()
    return [{ canonical: exact, aliases: [exact] }]
  }
  return Array.from(byKey.values())
}

export function reviewedQualificationAliasesV35(canonical: string): string[] {
  const entity = ENTITY_REGISTRY_V35.entities.find(item => item.canonicalLabel.toLowerCase() === canonical.toLowerCase())
  return entity ? reviewedAliases(entity) : [canonical]
}
