import type { GeographicObservationV36_6, GeographicPrecisionV36_6 } from './geography-v36-6'

export type GeographicMatchClassV36_6 =
  | 'exact'
  | 'within_radius'
  | 'same_metro'
  | 'likely_commutable'
  | 'same_region'
  | 'remote_compatible'
  | 'outside_radius'
  | 'unknown'

export type CommuteEvidenceV36_6 = {
  source: 'reviewed_relationship' | 'travel_time_provider' | 'commute_flow_dataset'
  sourceRef: string
  observedMinutes?: number
  confidence: 'strong' | 'moderate'
}

export type GeographicAssessmentV36_6 = {
  classification: GeographicMatchClassV36_6
  distanceMiles?: number
  distanceBasis?: 'coordinates'
  commuteEvidence?: CommuteEvidenceV36_6
  candidateResidenceInferred: false
  candidateWillingnessInferred: false
  explanation: string[]
}

const RADIUS_PRECISIONS = new Set<GeographicPrecisionV36_6>(['city', 'town', 'postal_centroid', 'point'])

function radians(value: number): number { return value * Math.PI / 180 }

function validCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function trustedPointForRadiusV36_6(observation: GeographicObservationV36_6): boolean {
  return RADIUS_PRECISIONS.has(observation.precision)
    && validCoordinate(observation.latitude, -90, 90)
    && validCoordinate(observation.longitude, -180, 180)
}

export function distanceBetweenObservationsV36_6(a: GeographicObservationV36_6, b: GeographicObservationV36_6): number | null {
  if (!trustedPointForRadiusV36_6(a) || !trustedPointForRadiusV36_6(b)) return null
  const lat1 = a.latitude as number
  const lon1 = a.longitude as number
  const lat2 = b.latitude as number
  const lon2 = b.longitude as number
  const earthRadiusMiles = 3958.7613
  const dLat = radians(lat2 - lat1)
  const dLon = radians(lon2 - lon1)
  const phi1 = radians(lat1)
  const phi2 = radians(lat2)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Recruiter geography evaluation. The candidateLocation input is itself an
 * observation from a profile/source; matching it never asserts residence or
 * willingness to commute beyond what the source actually states.
 */
export function assessRecruiterGeographyV36_6(input: {
  roleAnchor: GeographicObservationV36_6
  candidateLocation: GeographicObservationV36_6
  radiusMiles?: number
  sameMetro?: boolean
  sameRegion?: boolean
  remoteCompatible?: boolean
  commuteEvidence?: CommuteEvidenceV36_6
}): GeographicAssessmentV36_6 {
  const explanation: string[] = []
  const base = { candidateResidenceInferred: false as const, candidateWillingnessInferred: false as const }

  if (input.roleAnchor.id === input.candidateLocation.id) {
    return { classification: 'exact', ...base, explanation: ['The role anchor and observed candidate-location entity are the same canonical place.'] }
  }

  if (typeof input.radiusMiles === 'number' && Number.isFinite(input.radiusMiles) && input.radiusMiles > 0) {
    const distance = distanceBetweenObservationsV36_6(input.roleAnchor, input.candidateLocation)
    if (distance !== null) {
      const rounded = Math.round(distance * 10) / 10
      return {
        classification: distance <= input.radiusMiles ? 'within_radius' : 'outside_radius',
        distanceMiles: rounded,
        distanceBasis: 'coordinates',
        ...base,
        explanation: [`Trusted source coordinates are approximately ${rounded} miles apart. This measures sourcing geography, not candidate residence or commute willingness.`],
      }
    }
    explanation.push('Radius was requested, but at least one location lacks sufficiently precise trusted coordinates; no numeric distance was invented.')
  }

  if (input.sameMetro) {
    return { classification: 'same_metro', ...base, explanation: [...explanation, 'Both places are supported as members of the same reviewed metropolitan area.'] }
  }

  if (input.commuteEvidence) {
    return {
      classification: 'likely_commutable',
      commuteEvidence: input.commuteEvidence,
      ...base,
      explanation: [...explanation, 'A reviewed commute/travel-time signal supports likely commutability. This is not a statement about the candidate’s willingness to commute.'],
    }
  }

  if (input.sameRegion) {
    return { classification: 'same_region', ...base, explanation: [...explanation, 'Both places are in the same reviewed recruiting region; that is broader than a commute claim.'] }
  }

  if (input.remoteCompatible) {
    return { classification: 'remote_compatible', ...base, explanation: [...explanation, 'The role permits remote geography compatible with the observed location.'] }
  }

  return {
    classification: 'unknown',
    ...base,
    explanation: [...explanation, 'No trusted radius, metro, commute, regional or remote relationship establishes geographic compatibility.'],
  }
}

export type LocationSearchExecutionModeV36_6 = 'native_location' | 'downstream_filter' | 'source_agnostic'

export type LocationSearchPlanV36_6 = {
  mode: 'exact' | 'nearby' | 'radius' | 'metro' | 'region' | 'state' | 'remote' | 'hybrid' | 'unknown'
  anchorId?: string
  radiusMiles?: number
  approvedLocationIds: string[]
  sourceExecutionMode: LocationSearchExecutionModeV36_6
  noResidenceInference: true
  notes: string[]
}

export function buildLocationSearchPlanV36_6(input: {
  mode: LocationSearchPlanV36_6['mode']
  anchorId?: string
  radiusMiles?: number
  approvedLocationIds?: string[]
  sourceSupportsNativeLocation: boolean
  sourceIsGeographyAgnostic?: boolean
}): LocationSearchPlanV36_6 {
  return {
    mode: input.mode,
    ...(input.anchorId ? { anchorId: input.anchorId } : {}),
    ...(typeof input.radiusMiles === 'number' ? { radiusMiles: input.radiusMiles } : {}),
    approvedLocationIds: Array.from(new Set(input.approvedLocationIds || [])),
    sourceExecutionMode: input.sourceIsGeographyAgnostic ? 'source_agnostic' : input.sourceSupportsNativeLocation ? 'native_location' : 'downstream_filter',
    noResidenceInference: true,
    notes: [
      input.sourceIsGeographyAgnostic
        ? 'This source retrieves without native geography; location is evaluated from candidate evidence downstream.'
        : input.sourceSupportsNativeLocation
          ? 'This source can receive recruiter-approved location anchors natively.'
          : 'This source cannot reliably search native geography; location is evaluated downstream.',
      'Approved search geography is not candidate residence evidence.',
    ],
  }
}
