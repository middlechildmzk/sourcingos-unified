import type { EntityProvenance, EntityRelationship, IntelligenceEntity, LocationIntentV35 } from './types-v35'

const CURATED: EntityProvenance = {
  source: 'v35_curated',
  sourceRef: 'entity-intelligence/location-v35',
  version: 'v35.2',
  reviewState: 'reviewed',
}

const ADJACENCY: EntityProvenance = {
  source: 'cleared_market_adjacency',
  sourceRef: 'legacy lib/search-assist.ts CLEARED_MARKET_ADJACENCY',
  version: 'v35.2',
  reviewState: 'reviewed',
}

function location(
  id: string,
  kind: IntelligenceEntity['kind'],
  canonicalLabel: string,
  aliases: string[],
  metadata: NonNullable<IntelligenceEntity['metadata']>,
): IntelligenceEntity {
  return { id, kind, canonicalLabel, aliases, metadata, provenance: [CURATED] }
}

export const LOCATION_ENTITIES_V35: IntelligenceEntity[] = [
  location('loc:country:us', 'country', 'United States', ['united states', 'united states of america', 'usa', 'u.s.', 'us'], { placeType: 'country', countryCode: 'US' }),
  location('loc:state:md', 'state', 'Maryland', ['maryland', 'md'], { placeType: 'state', countryCode: 'US', stateCode: 'MD' }),
  location('loc:state:va', 'state', 'Virginia', ['virginia', 'va'], { placeType: 'state', countryCode: 'US', stateCode: 'VA' }),
  location('loc:state:il', 'state', 'Illinois', ['illinois', 'il'], { placeType: 'state', countryCode: 'US', stateCode: 'IL' }),
  location('loc:city:annapolis-junction-md', 'place', 'Annapolis Junction, MD', ['annapolis junction', 'annapolis junction md', 'annapolis junction, md'], { placeType: 'city', countryCode: 'US', stateCode: 'MD' }),
  location('loc:installation:fort-meade-md', 'place', 'Fort Meade, MD', ['fort meade', 'fort meade md', 'ft meade', 'ft. meade'], { placeType: 'installation', countryCode: 'US', stateCode: 'MD' }),
  location('loc:city:columbia-md', 'place', 'Columbia, MD', ['columbia md', 'columbia, md'], { placeType: 'city', countryCode: 'US', stateCode: 'MD' }),
  location('loc:town:hanover-md', 'place', 'Hanover, MD', ['hanover md', 'hanover, md'], { placeType: 'town', countryCode: 'US', stateCode: 'MD' }),
  location('loc:town:jessup-md', 'place', 'Jessup, MD', ['jessup md', 'jessup, md'], { placeType: 'town', countryCode: 'US', stateCode: 'MD' }),
  location('loc:city:laurel-md', 'place', 'Laurel, MD', ['laurel md', 'laurel, md'], { placeType: 'city', countryCode: 'US', stateCode: 'MD' }),
  location('loc:city:baltimore-md', 'place', 'Baltimore, MD', ['baltimore', 'baltimore md', 'baltimore, md'], { placeType: 'city', countryCode: 'US', stateCode: 'MD' }),
  location('loc:city:washington-dc', 'place', 'Washington, DC', ['washington dc', 'washington d.c.', 'washington, dc', 'district of columbia'], { placeType: 'city', countryCode: 'US' }),
  location('loc:city:arlington-va', 'place', 'Arlington, VA', ['arlington', 'arlington va', 'arlington, va'], { placeType: 'city', countryCode: 'US', stateCode: 'VA' }),
  location('loc:place:reston-va', 'place', 'Reston, VA', ['reston', 'reston va', 'reston, va'], { placeType: 'town', countryCode: 'US', stateCode: 'VA' }),
  location('loc:city:herndon-va', 'place', 'Herndon, VA', ['herndon', 'herndon va', 'herndon, va'], { placeType: 'town', countryCode: 'US', stateCode: 'VA' }),
  location('loc:place:mclean-va', 'place', 'McLean, VA', ['mclean', 'mc lean', 'mclean va', 'mclean, va'], { placeType: 'town', countryCode: 'US', stateCode: 'VA' }),
  location('loc:place:tysons-va', 'place', 'Tysons, VA', ['tysons', 'tysons corner', 'tysons va'], { placeType: 'town', countryCode: 'US', stateCode: 'VA' }),
  location('loc:city:fairfax-va', 'place', 'Fairfax, VA', ['fairfax', 'fairfax va', 'fairfax, va'], { placeType: 'city', countryCode: 'US', stateCode: 'VA' }),
  location('loc:place:chantilly-va', 'place', 'Chantilly, VA', ['chantilly', 'chantilly va'], { placeType: 'town', countryCode: 'US', stateCode: 'VA' }),
  location('loc:place:sterling-va', 'place', 'Sterling, VA', ['sterling va', 'sterling, va'], { placeType: 'town', countryCode: 'US', stateCode: 'VA' }),
  location('loc:metro:baltimore', 'metro', 'Baltimore-Columbia-Towson Metro', ['baltimore metro', 'baltimore metropolitan area', 'baltimore-columbia-towson'], { placeType: 'metro', countryCode: 'US', stateCode: 'MD' }),
  location('loc:metro:dc', 'metro', 'Washington-Arlington-Alexandria Metro', ['dc metro', 'washington metro', 'washington metropolitan area', 'national capital region'], { placeType: 'metro', countryCode: 'US' }),
  location('loc:region:dmv', 'region', 'DMV', ['dmv', 'dc maryland virginia', 'dc-md-va'], { placeType: 'region', countryCode: 'US' }),
  location('loc:region:northern-virginia', 'region', 'Northern Virginia', ['northern virginia', 'nova'], { placeType: 'region', countryCode: 'US', stateCode: 'VA' }),
  location('loc:region:bwi-corridor', 'region', 'BWI Corridor', ['bwi corridor'], { placeType: 'corridor', countryCode: 'US', stateCode: 'MD' }),
  location('loc:postal:20701', 'postal_area', '20701', ['20701'], { placeType: 'postal_area', countryCode: 'US', stateCode: 'MD', postalCode: '20701' }),
  location('loc:city:chicago-il', 'place', 'Chicago, IL', ['chicago', 'chicago il', 'chicago, il'], { placeType: 'city', countryCode: 'US', stateCode: 'IL' }),
  location('loc:metro:chicago', 'metro', 'Chicago Metro', ['chicago metro', 'chicagoland'], { placeType: 'metro', countryCode: 'US', stateCode: 'IL' }),
  location('loc:city:springfield-il', 'place', 'Springfield, IL', ['springfield il', 'springfield, il', 'springfield'], { placeType: 'city', countryCode: 'US', stateCode: 'IL' }),
  location('loc:city:springfield-ma', 'place', 'Springfield, MA', ['springfield ma', 'springfield, ma', 'springfield'], { placeType: 'city', countryCode: 'US', stateCode: 'MA' }),
  location('loc:city:springfield-mo', 'place', 'Springfield, MO', ['springfield mo', 'springfield, mo', 'springfield'], { placeType: 'city', countryCode: 'US', stateCode: 'MO' }),
  location('loc:city:london-uk', 'place', 'London, United Kingdom', ['london uk', 'london, uk', 'london'], { placeType: 'city', countryCode: 'GB' }),
  location('loc:city:toronto-ca', 'place', 'Toronto, Canada', ['toronto canada', 'toronto, canada', 'toronto'], { placeType: 'city', countryCode: 'CA' }),
  location('loc:city:berlin-de', 'place', 'Berlin, Germany', ['berlin germany', 'berlin, germany', 'berlin'], { placeType: 'city', countryCode: 'DE' }),
  location('loc:city:sydney-au', 'place', 'Sydney, Australia', ['sydney australia', 'sydney, australia', 'sydney'], { placeType: 'city', countryCode: 'AU' }),
]

function edge(
  fromEntityId: string,
  toEntityId: string,
  type: EntityRelationship['type'],
  provenance: EntityProvenance = CURATED,
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
    confidence: 'strong',
    ...(note ? { note } : {}),
  }
}

const stateMd = ['loc:city:annapolis-junction-md', 'loc:installation:fort-meade-md', 'loc:city:columbia-md', 'loc:town:hanover-md', 'loc:town:jessup-md', 'loc:city:laurel-md', 'loc:city:baltimore-md', 'loc:postal:20701']
const stateVa = ['loc:city:arlington-va', 'loc:place:reston-va', 'loc:city:herndon-va', 'loc:place:mclean-va', 'loc:place:tysons-va', 'loc:city:fairfax-va', 'loc:place:chantilly-va', 'loc:place:sterling-va']

export const LOCATION_RELATIONSHIPS_V35: EntityRelationship[] = [
  ...stateMd.map(id => edge(id, 'loc:state:md', 'LOCATED_IN')),
  ...stateVa.map(id => edge(id, 'loc:state:va', 'LOCATED_IN')),
  edge('loc:city:chicago-il', 'loc:state:il', 'LOCATED_IN'),
  edge('loc:city:baltimore-md', 'loc:metro:baltimore', 'METRO_MEMBER_OF'),
  edge('loc:city:columbia-md', 'loc:metro:baltimore', 'METRO_MEMBER_OF'),
  edge('loc:town:hanover-md', 'loc:metro:baltimore', 'METRO_MEMBER_OF'),
  edge('loc:city:washington-dc', 'loc:metro:dc', 'METRO_MEMBER_OF'),
  edge('loc:city:arlington-va', 'loc:metro:dc', 'METRO_MEMBER_OF'),
  edge('loc:place:reston-va', 'loc:metro:dc', 'METRO_MEMBER_OF'),
  edge('loc:city:herndon-va', 'loc:metro:dc', 'METRO_MEMBER_OF'),
  edge('loc:city:chicago-il', 'loc:metro:chicago', 'METRO_MEMBER_OF'),
  ...stateVa.map(id => edge(id, 'loc:region:northern-virginia', 'PART_OF_REGION')),
  edge('loc:city:washington-dc', 'loc:region:dmv', 'PART_OF_REGION'),
  edge('loc:city:arlington-va', 'loc:region:dmv', 'PART_OF_REGION'),
  edge('loc:city:annapolis-junction-md', 'loc:region:dmv', 'PART_OF_REGION'),
  edge('loc:installation:fort-meade-md', 'loc:region:dmv', 'PART_OF_REGION'),
  edge('loc:city:annapolis-junction-md', 'loc:installation:fort-meade-md', 'NEAR', ADJACENCY, 'symmetric'),
  edge('loc:city:annapolis-junction-md', 'loc:city:columbia-md', 'NEAR', ADJACENCY, 'symmetric'),
  edge('loc:city:annapolis-junction-md', 'loc:town:hanover-md', 'NEAR', ADJACENCY, 'symmetric'),
  edge('loc:city:annapolis-junction-md', 'loc:town:jessup-md', 'NEAR', CURATED, 'symmetric'),
  edge('loc:city:annapolis-junction-md', 'loc:city:laurel-md', 'NEAR', CURATED, 'symmetric'),
  edge('loc:installation:fort-meade-md', 'loc:city:columbia-md', 'NEAR', ADJACENCY, 'symmetric'),
  edge('loc:installation:fort-meade-md', 'loc:town:hanover-md', 'NEAR', ADJACENCY, 'symmetric'),
  edge('loc:installation:fort-meade-md', 'loc:region:bwi-corridor', 'NEAR', ADJACENCY, 'symmetric'),
  edge('loc:postal:20701', 'loc:city:annapolis-junction-md', 'NEAR', CURATED, 'directed', 'Postal service area association is a sourcing anchor, not a municipal-boundary claim.'),
]

function normalized(text: string): string {
  return text.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasAlias(text: string, alias: string): boolean {
  const haystack = ` ${normalized(text).replace(/[,.]/g, ' ')} `
  const needle = ` ${normalized(alias).replace(/[,.]/g, ' ')} `
  return haystack.includes(needle)
}

export function matchLocationEntitiesV35(text: string): IntelligenceEntity[] {
  const matches = LOCATION_ENTITIES_V35.filter(entity => entity.aliases.some(alias => hasAlias(text, alias)))
  return matches.sort((a, b) => {
    const longestA = Math.max(...a.aliases.filter(alias => hasAlias(text, alias)).map(alias => alias.length), 0)
    const longestB = Math.max(...b.aliases.filter(alias => hasAlias(text, alias)).map(alias => alias.length), 0)
    return longestB - longestA || a.canonicalLabel.localeCompare(b.canonicalLabel)
  })
}

function relatedIds(anchorId: string, allowed: EntityRelationship['type'][]): string[] {
  const ids = new Set<string>()
  for (const relationship of LOCATION_RELATIONSHIPS_V35) {
    if (!allowed.includes(relationship.type)) continue
    if (relationship.fromEntityId === anchorId) ids.add(relationship.toEntityId)
    if (relationship.direction === 'symmetric' && relationship.toEntityId === anchorId) ids.add(relationship.fromEntityId)
  }
  return Array.from(ids)
}

export function resolveLocationIntentV35(rawText: string, legacyLocation = ''): LocationIntentV35 {
  const source = [legacyLocation, rawText].filter(Boolean).join(' ')
  const lower = normalized(source)
  const radius = lower.match(/(?:within|inside)\s+(\d{1,3})\s*(?:mile|miles|mi)\s+(?:of|from)/)
  const nearby = /\b(?:in or near|near|nearby|commuting distance|commute distance)\b/.test(lower)
  const remote = /\b(?:remote|fully remote|remote us|work from home|wfh)\b/.test(lower)
  const hybrid = /\bhybrid\b/.test(lower)

  const matched = matchLocationEntitiesV35(source)
  const longest = matched[0]
  const sameBest = longest
    ? matched.filter(entity => Math.max(...entity.aliases.filter(alias => hasAlias(source, alias)).map(alias => alias.length), 0)
      === Math.max(...longest.aliases.filter(alias => hasAlias(source, alias)).map(alias => alias.length), 0))
    : []
  const springfieldAmbiguous = /\bspringfield\b/.test(lower) && !/\bspringfield\s*,?\s*(?:il|ma|mo)\b/.test(lower)
  const ambiguous = springfieldAmbiguous ? matched.filter(entity => entity.canonicalLabel.startsWith('Springfield,')) : sameBest.length > 1 ? sameBest : []
  const anchor = ambiguous.length ? undefined : longest

  let mode: LocationIntentV35['mode'] = 'unknown'
  if (remote) mode = 'remote'
  else if (hybrid) mode = 'hybrid'
  else if (radius) mode = 'radius'
  else if (nearby) mode = 'nearby'
  else if (anchor?.kind === 'metro') mode = 'metro'
  else if (anchor?.kind === 'region') mode = 'region'
  else if (anchor?.kind === 'state') mode = 'state'
  else if (anchor) mode = 'exact'

  const suggested = anchor
    ? relatedIds(anchor.id, mode === 'nearby' || mode === 'radius' ? ['NEAR', 'METRO_MEMBER_OF', 'PART_OF_REGION'] : ['METRO_MEMBER_OF', 'PART_OF_REGION'])
    : []

  const explanation: string[] = []
  if (ambiguous.length) explanation.push(`Location is ambiguous: ${ambiguous.map(entity => entity.canonicalLabel).join(', ')}.`)
  if (anchor) explanation.push(`Normalized location to ${anchor.canonicalLabel}.`)
  if (mode === 'nearby') explanation.push('Recruiter explicitly allowed nearby-location expansion; suggestions remain inactive until approved.')
  if (mode === 'radius') explanation.push(`Recruiter explicitly requested a ${Number(radius?.[1])}-mile radius; distance execution is represented but not silently broadened.`)
  if (mode === 'region') explanation.push('Regional aliases are represented as regions, not collapsed into a single city.')
  if (mode === 'remote') explanation.push('Remote is treated as work-location intent, not as a city or candidate residence fact.')
  if (mode === 'hybrid') explanation.push('Hybrid is treated as work-mode/location intent; any geographic anchor remains separate.')

  return {
    mode,
    rawText: legacyLocation || rawText,
    ...(anchor ? { anchorLocationId: anchor.id, anchorLabel: anchor.canonicalLabel } : {}),
    ...(radius ? { radiusMiles: Number(radius[1]) } : {}),
    recruiterApprovedExpansionIds: [],
    suggestedExpansionIds: suggested,
    ...(ambiguous.length ? { ambiguousCandidateIds: ambiguous.map(entity => entity.id) } : {}),
    explanation,
    version: 'v35.2',
  }
}
