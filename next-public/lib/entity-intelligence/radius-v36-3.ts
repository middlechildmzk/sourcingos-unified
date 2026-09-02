import type { EntityRelationship, IntelligenceEntity } from './types-v35'

export type RadiusAssessmentStatusV36_3 = 'within_radius' | 'outside_radius' | 'graph_nearby' | 'unknown'
export type RadiusAssessmentBasisV36_3 = 'coordinates' | 'graph' | 'none'

export interface RadiusAssessmentV36_3 {
  status: RadiusAssessmentStatusV36_3
  basis: RadiusAssessmentBasisV36_3
  distanceMiles?: number
  radiusMiles: number
  candidateResidenceInferred: false
  explanation: string
}

function validLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90
}

function validLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180
}

function toRadians(value: number): number {
  return value * Math.PI / 180
}

export function distanceMilesV36_3(
  a: Pick<IntelligenceEntity, 'metadata'>,
  b: Pick<IntelligenceEntity, 'metadata'>,
): number | null {
  const lat1 = a.metadata?.latitude
  const lon1 = a.metadata?.longitude
  const lat2 = b.metadata?.latitude
  const lon2 = b.metadata?.longitude
  if (!validLatitude(lat1) || !validLongitude(lon1) || !validLatitude(lat2) || !validLongitude(lon2)) return null

  const earthRadiusMiles = 3958.7613
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const phi1 = toRadians(lat1)
  const phi2 = toRadians(lat2)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)))
}

function graphNearby(
  anchor: IntelligenceEntity,
  candidate: IntelligenceEntity,
  relationships: EntityRelationship[],
): boolean {
  if (anchor.id === candidate.id) return true

  const directNear = relationships.some(rel => {
    if (rel.type !== 'NEAR') return false
    if (rel.fromEntityId === anchor.id && rel.toEntityId === candidate.id) return true
    return rel.direction === 'symmetric' && rel.fromEntityId === candidate.id && rel.toEntityId === anchor.id
  })
  if (directNear) return true

  const metrosFor = (entityId: string) => new Set(relationships
    .filter(rel => rel.type === 'METRO_MEMBER_OF' && rel.fromEntityId === entityId)
    .map(rel => rel.toEntityId))
  const anchorMetros = metrosFor(anchor.id)
  return [...metrosFor(candidate.id)].some(id => anchorMetros.has(id))
}

/**
 * Assesses sourcing geography only. It never asserts that a candidate lives in,
 * commutes from, or is willing to work in a location. Candidate residence and
 * work-location willingness require profile/recruiter evidence elsewhere.
 */
export function assessLocationRadiusV36_3(input: {
  anchor: IntelligenceEntity
  candidateLocation: IntelligenceEntity
  radiusMiles: number
  relationships?: EntityRelationship[]
}): RadiusAssessmentV36_3 {
  const radiusMiles = input.radiusMiles
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
    return {
      status: 'unknown',
      basis: 'none',
      radiusMiles,
      candidateResidenceInferred: false,
      explanation: 'A positive finite radius is required. No geographic inference was made.',
    }
  }

  const distance = distanceMilesV36_3(input.anchor, input.candidateLocation)
  if (distance !== null) {
    const rounded = Math.round(distance * 10) / 10
    return {
      status: distance <= radiusMiles ? 'within_radius' : 'outside_radius',
      basis: 'coordinates',
      distanceMiles: rounded,
      radiusMiles,
      candidateResidenceInferred: false,
      explanation: `Geographic source coordinates are approximately ${rounded} miles apart. This is a sourcing-area calculation, not candidate residence evidence.`,
    }
  }

  if (graphNearby(input.anchor, input.candidateLocation, input.relationships || [])) {
    return {
      status: 'graph_nearby',
      basis: 'graph',
      radiusMiles,
      candidateResidenceInferred: false,
      explanation: 'The locations have a reviewed NEAR/shared-metro relationship, but no coordinate distance was asserted. This is search expansion only.',
    }
  }

  return {
    status: 'unknown',
    basis: 'none',
    radiusMiles,
    candidateResidenceInferred: false,
    explanation: 'No trusted coordinate or reviewed nearby relationship is available. The system will not invent proximity.',
  }
}
