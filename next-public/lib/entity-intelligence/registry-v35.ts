import { ALL_TAXONOMY, type TaxonomyEntry } from '@/data/search-taxonomy'
import { EXPANSIONS } from '@/data/search-expansions'
import { LOCATION_ENTITIES_V35, LOCATION_RELATIONSHIPS_V35 } from './location-v35'
import type {
  EntityKind,
  EntityMatchType,
  EntityRegistryV35,
  EntityRelationship,
  EntityRelationshipType,
  EntitySuggestion,
  IntelligenceEntity,
} from './types-v35'

const LEGACY = {
  source: 'legacy_search_taxonomy' as const,
  sourceRef: 'data/search-taxonomy.ts',
  version: 'v35.2',
  reviewState: 'reviewed' as const,
}

const LEGACY_EXPANSION = {
  source: 'legacy_search_expansions' as const,
  sourceRef: 'data/search-expansions.ts',
  version: 'v35.2',
  reviewState: 'needs_review' as const,
  note: 'Legacy expansions are discovery hypotheses, not qualification evidence.',
}

const CURATED = {
  source: 'v35_curated' as const,
  sourceRef: 'entity-intelligence/registry-v35',
  version: 'v35.2',
  reviewState: 'reviewed' as const,
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function kindFor(entry: TaxonomyEntry): EntityKind {
  if (entry.type === 'certification') return 'credential'
  if (entry.type === 'tool') return 'technology'
  if (entry.type === 'title') return 'occupation'
  return entry.type
}

function fromLegacy(entry: TaxonomyEntry): IntelligenceEntity {
  return {
    id: `entity:${entry.type}:${slug(entry.canonical)}`,
    kind: kindFor(entry),
    canonicalLabel: entry.canonical,
    aliases: Array.from(new Set([entry.canonical.toLowerCase(), ...entry.aliases.map(alias => alias.toLowerCase())])),
    provenance: [LEGACY],
    metadata: { legacyType: entry.type, legacyColor: entry.color },
  }
}

const LEGACY_ENTITIES = ALL_TAXONOMY
  .filter(entry => entry.type !== 'location')
  .map(fromLegacy)

const CURATED_ENTITIES: IntelligenceEntity[] = [
  {
    id: 'entity:skill:rhel',
    kind: 'skill',
    canonicalLabel: 'Red Hat Enterprise Linux',
    aliases: ['red hat enterprise linux', 'rhel', 'red hat linux'],
    provenance: [CURATED],
    metadata: { shortLabel: 'RHEL' },
  },
  {
    id: 'entity:credential:rhce',
    kind: 'credential',
    canonicalLabel: 'RHCE',
    aliases: ['rhce', 'red hat certified engineer'],
    provenance: [CURATED],
  },
  {
    id: 'entity:skill:selinux',
    kind: 'skill',
    canonicalLabel: 'SELinux',
    aliases: ['selinux', 'security-enhanced linux'],
    provenance: [CURATED],
  },
  {
    id: 'entity:technology:ansible',
    kind: 'technology',
    canonicalLabel: 'Ansible',
    aliases: ['ansible'],
    provenance: [CURATED],
  },
  {
    id: 'entity:technology:red-hat-satellite',
    kind: 'technology',
    canonicalLabel: 'Red Hat Satellite',
    aliases: ['red hat satellite', 'satellite server'],
    provenance: [CURATED],
  },
  {
    id: 'entity:occupation:linux-systems-administrator',
    kind: 'occupation',
    canonicalLabel: 'Linux Systems Administrator',
    aliases: ['linux systems administrator', 'linux system administrator', 'linux administrator', 'rhel administrator', 'red hat administrator', 'rhel admin'],
    provenance: [CURATED],
  },
  {
    id: 'entity:occupation:site-reliability-engineer',
    kind: 'occupation',
    canonicalLabel: 'Site Reliability Engineer',
    aliases: ['site reliability engineer', 'sre'],
    provenance: [CURATED],
  },
  {
    id: 'entity:clearance:ts-sci',
    kind: 'clearance',
    canonicalLabel: 'TS/SCI',
    aliases: ['ts/sci', 'ts sci', 'tssci', 'top secret sci'],
    provenance: [CURATED],
  },
]

function relationship(
  fromEntityId: string,
  toEntityId: string,
  type: EntityRelationshipType,
  provenance = CURATED,
  direction: EntityRelationship['direction'] = 'directed',
  note?: string,
): EntityRelationship {
  return {
    id: `rel:${type.toLowerCase()}:${fromEntityId}:${toEntityId}`,
    fromEntityId,
    toEntityId,
    type,
    direction,
    provenance: [provenance],
    confidence: provenance.reviewState === 'reviewed' ? 'strong' : 'moderate',
    ...(note ? { note } : {}),
  }
}

function allEntities(): IntelligenceEntity[] {
  const byId = new Map<string, IntelligenceEntity>()
  for (const entity of [...LEGACY_ENTITIES, ...CURATED_ENTITIES, ...LOCATION_ENTITIES_V35]) byId.set(entity.id, entity)
  return Array.from(byId.values())
}

function findByCanonical(entities: IntelligenceEntity[], label: string): IntelligenceEntity | undefined {
  const lower = label.trim().toLowerCase()
  return entities.find(entity => entity.canonicalLabel.toLowerCase() === lower || entity.aliases.includes(lower))
}

function expansionRelationshipType(entity: IntelligenceEntity): EntityRelationshipType {
  if (entity.kind === 'occupation') return 'ADJACENT_TO'
  if (entity.kind === 'skill' || entity.kind === 'technology') return 'RELATED_TECHNOLOGY'
  if (entity.kind === 'credential') return 'ADJACENT_TO'
  if (entity.kind === 'company') return 'ADJACENT_TO'
  return 'ADJACENT_TO'
}

function expansionRelationships(entities: IntelligenceEntity[]): EntityRelationship[] {
  const out: EntityRelationship[] = []
  for (const [canonical, values] of Object.entries(EXPANSIONS)) {
    const from = findByCanonical(entities, canonical)
    if (!from) continue
    for (const value of values) {
      const to = findByCanonical(entities, value)
      if (!to || to.id === from.id) continue
      out.push(relationship(
        from.id,
        to.id,
        expansionRelationshipType(from),
        LEGACY_EXPANSION,
        'directed',
        'Legacy search expansion. Useful for discovery only; never qualification evidence by itself.',
      ))
    }
  }
  return out
}

function curatedRelationships(entities: IntelligenceEntity[]): EntityRelationship[] {
  const id = (label: string) => findByCanonical(entities, label)?.id
  const pairs: Array<[string | undefined, string | undefined, EntityRelationshipType, string?]> = [
    [id('Red Hat Enterprise Linux'), id('Linux Systems Administrator'), 'ADJACENT_TO', 'RHEL is a capability/search concept associated with Linux systems administration; it does not prove the occupation.'],
    [id('RHCE'), id('Red Hat Enterprise Linux'), 'CREDENTIAL_FOR', 'RHCE is a credential signal for Red Hat expertise; it does not prove current hands-on experience.'],
    [id('SELinux'), id('Red Hat Enterprise Linux'), 'RELATED_TECHNOLOGY'],
    [id('Ansible'), id('Red Hat Enterprise Linux'), 'RELATED_TECHNOLOGY'],
    [id('Red Hat Satellite'), id('Red Hat Enterprise Linux'), 'RELATED_TECHNOLOGY'],
  ]
  const out = pairs.flatMap(([from, to, type, note]) => from && to ? [relationship(from, to, type, CURATED, 'directed', note)] : [])

  const ts = entities.find(entity => entity.canonicalLabel === 'TypeScript')
  const tssci = entities.find(entity => entity.canonicalLabel === 'TS/SCI')
  if (ts && tssci) {
    out.push(relationship(ts.id, tssci.id, 'CONFUSABLE_WITH', CURATED, 'symmetric', 'TS can refer to TypeScript in software context; TS/SCI is a clearance concept. Never cross-infer.'))
    out.push(relationship(ts.id, tssci.id, 'DO_NOT_INFER_FROM', CURATED, 'directed', 'Software TypeScript evidence cannot satisfy a clearance requirement.'))
    out.push(relationship(tssci.id, ts.id, 'DO_NOT_INFER_FROM', CURATED, 'directed', 'Clearance terminology cannot satisfy a TypeScript requirement.'))
  }

  return out
}

const ENTITIES = allEntities()
const RELATIONSHIPS = [
  ...LOCATION_RELATIONSHIPS_V35,
  ...expansionRelationships(ENTITIES),
  ...curatedRelationships(ENTITIES),
]

export const ENTITY_REGISTRY_V35: EntityRegistryV35 = {
  version: 'v35.2',
  entities: ENTITIES,
  relationships: RELATIONSHIPS,
}

export function entityByIdV35(id: string): IntelligenceEntity | undefined {
  return ENTITY_REGISTRY_V35.entities.find(entity => entity.id === id)
}

export function relationshipsFromV35(id: string, types?: EntityRelationshipType[]): EntityRelationship[] {
  return ENTITY_REGISTRY_V35.relationships.filter(relationship =>
    relationship.fromEntityId === id && (!types || types.includes(relationship.type)))
}

export function matchEntitiesV35(text: string, allowedKinds?: EntityKind[]): EntitySuggestion[] {
  const lower = ` ${text.toLowerCase().replace(/[(),]/g, ' ')} `
  const suggestions: EntitySuggestion[] = []

  for (const entity of ENTITY_REGISTRY_V35.entities) {
    if (allowedKinds?.length && !allowedKinds.includes(entity.kind)) continue
    const candidates = [entity.canonicalLabel.toLowerCase(), ...entity.aliases]
      .sort((a, b) => b.length - a.length)
    const matched = candidates.find(alias => lower.includes(` ${alias.replace(/[(),]/g, ' ')} `))
    if (!matched) continue

    const canonical = entity.canonicalLabel.toLowerCase()
    const compactMatched = matched.replace(/[^a-z0-9]/g, '')
    const compactCanonical = canonical.replace(/[^a-z0-9]/g, '')
    let matchType: EntityMatchType = matched === canonical || compactMatched === compactCanonical ? 'exact' : 'alias'
    if (matched.length <= 6 && entity.canonicalLabel.length > matched.length && /^[a-z0-9/+.-]+$/i.test(matched)) matchType = 'acronym'

    suggestions.push({
      entity,
      matchedText: matched,
      matchType,
      explanation: matchType === 'exact' ? `Exact ${entity.kind} match.` : `${matched} normalizes to ${entity.canonicalLabel}.`,
      rank: matchType === 'exact' ? 0 : matchType === 'acronym' ? 0.2 : 0.4,
      activation: matchType === 'exact' ? 'original' : 'normalized',
    })
  }

  return suggestions.sort((a, b) => a.rank - b.rank || b.matchedText.length - a.matchedText.length)
}

export function suggestRelatedEntitiesV35(entityId: string): EntitySuggestion[] {
  return relationshipsFromV35(entityId)
    .filter(relationship => ['COMMON_MARKET_VARIANT', 'ADJACENT_TO', 'RELATED_TECHNOLOGY', 'CREDENTIAL_FOR', 'NEAR', 'METRO_MEMBER_OF', 'PART_OF_REGION'].includes(relationship.type))
    .flatMap(relationship => {
      const entity = entityByIdV35(relationship.toEntityId)
      if (!entity) return []
      const matchType: EntityMatchType = relationship.type === 'COMMON_MARKET_VARIANT' ? 'market_variant' : 'adjacent'
      return [{
        entity,
        matchedText: entity.canonicalLabel,
        matchType,
        relationship,
        explanation: relationship.note || `${relationship.type.replaceAll('_', ' ').toLowerCase()} ${entity.canonicalLabel}`,
        rank: relationship.type === 'NEAR' ? 1 : relationship.type === 'CREDENTIAL_FOR' ? 1.2 : 1.5,
        activation: 'suggested_inactive' as const,
      }]
    })
    .sort((a, b) => a.rank - b.rank || a.entity.canonicalLabel.localeCompare(b.entity.canonicalLabel))
}
