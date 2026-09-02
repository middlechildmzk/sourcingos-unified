import type { IntelligenceEntity } from './types-v35'

export type GeographicPrecisionV36_6 =
  | 'country'
  | 'state'
  | 'county'
  | 'metro'
  | 'city'
  | 'town'
  | 'postal_centroid'
  | 'point'
  | 'region'
  | 'unknown'

export type GeographicSourceV36_6 = 'reviewed_registry' | 'iso_3166' | 'us_state' | 'postal_syntax' | 'external_authoritative'

export interface GeographicObservationV36_6 {
  id: string
  label: string
  kind: 'country' | 'state' | 'county' | 'metro' | 'city' | 'town' | 'postal_area' | 'region' | 'place'
  source: GeographicSourceV36_6
  sourceRef: string
  sourceVersion: string
  precision: GeographicPrecisionV36_6
  countryCode?: string
  stateCode?: string
  postalCode?: string
  latitude?: number
  longitude?: number
  searchOnly: true
  candidateResidenceInferred: false
}

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
}

const STATE_CODE_BY_NAME = new Map(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]))

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function slug(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function usStateObservationV36_6(input: string): GeographicObservationV36_6 | null {
  const raw = clean(input)
  const upper = raw.toUpperCase()
  const code = US_STATES[upper] ? upper : STATE_CODE_BY_NAME.get(raw.toLowerCase())
  if (!code) return null
  return {
    id: `geo:us-state:${code.toLowerCase()}`,
    label: US_STATES[code],
    kind: 'state',
    source: 'us_state',
    sourceRef: 'USPS/state abbreviation convention + ISO subdivision-compatible state codes',
    sourceVersion: 'v36.6',
    precision: 'state',
    countryCode: 'US',
    stateCode: code,
    searchOnly: true,
    candidateResidenceInferred: false,
  }
}

/**
 * Uses the runtime's ICU/Intl region data rather than shipping a stale country
 * list. Unknown/reserved codes are rejected when Intl returns the code or an
 * "Unknown Region" label.
 */
export function isoCountryObservationV36_6(input: string): GeographicObservationV36_6 | null {
  const raw = clean(input)
  const display = new Intl.DisplayNames(['en'], { type: 'region' })
  const normalizedInput = raw.toLowerCase()

  let matchCode = ''
  let matchLabel = ''
  if (/^[A-Za-z]{2}$/.test(raw)) {
    const code = raw.toUpperCase()
    const label = display.of(code) || ''
    if (label && label.toUpperCase() !== code && !/^unknown region$/i.test(label)) {
      matchCode = code
      matchLabel = label
    }
  } else {
    // There are at most 676 alpha-2 combinations; this deterministic scan is
    // small and avoids maintaining a duplicate country vocabulary.
    outer: for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b)
        const label = display.of(code) || ''
        if (!label || label.toUpperCase() === code || /^unknown region$/i.test(label)) continue
        if (label.toLowerCase() === normalizedInput) {
          matchCode = code
          matchLabel = label
          break outer
        }
      }
    }
  }

  if (!matchCode) return null
  return {
    id: `geo:country:${matchCode.toLowerCase()}`,
    label: matchLabel,
    kind: 'country',
    source: 'iso_3166',
    sourceRef: 'ICU Intl.DisplayNames region data',
    sourceVersion: 'runtime-icu',
    precision: 'country',
    countryCode: matchCode,
    searchOnly: true,
    candidateResidenceInferred: false,
  }
}

export function usPostalObservationV36_6(input: string): GeographicObservationV36_6 | null {
  const raw = clean(input)
  const match = raw.match(/^([0-9]{5})(?:-[0-9]{4})?$/)
  if (!match) return null
  return {
    id: `geo:us-postal:${match[1]}`,
    label: match[1],
    kind: 'postal_area',
    source: 'postal_syntax',
    sourceRef: 'US ZIP syntax only; no centroid/boundary asserted without an authoritative postal dataset',
    sourceVersion: 'v36.6',
    precision: 'unknown',
    countryCode: 'US',
    postalCode: match[1],
    searchOnly: true,
    candidateResidenceInferred: false,
  }
}

export function observationFromEntityV36_6(entity: IntelligenceEntity): GeographicObservationV36_6 | null {
  if (!['location', 'place', 'metro', 'region', 'postal_area', 'country', 'state', 'county'].includes(entity.kind)) return null
  const placeType = String(entity.metadata?.placeType || '')
  const precision: GeographicPrecisionV36_6 =
    entity.kind === 'country' ? 'country' :
    entity.kind === 'state' ? 'state' :
    entity.kind === 'county' ? 'county' :
    entity.kind === 'metro' ? 'metro' :
    entity.kind === 'region' ? 'region' :
    entity.kind === 'postal_area' ? (typeof entity.metadata?.latitude === 'number' ? 'postal_centroid' : 'unknown') :
    placeType === 'town' ? 'town' :
    placeType === 'city' ? 'city' :
    typeof entity.metadata?.latitude === 'number' ? 'point' : 'unknown'
  return {
    id: entity.id,
    label: entity.canonicalLabel,
    kind: entity.kind === 'location' ? 'place' : entity.kind as GeographicObservationV36_6['kind'],
    source: 'reviewed_registry',
    sourceRef: entity.provenance[0]?.sourceRef || 'shared Entity Intelligence registry',
    sourceVersion: entity.provenance[0]?.version || 'unknown',
    precision,
    ...(entity.metadata?.countryCode ? { countryCode: entity.metadata.countryCode } : {}),
    ...(entity.metadata?.stateCode ? { stateCode: entity.metadata.stateCode } : {}),
    ...(entity.metadata?.postalCode ? { postalCode: entity.metadata.postalCode } : {}),
    ...(typeof entity.metadata?.latitude === 'number' ? { latitude: entity.metadata.latitude } : {}),
    ...(typeof entity.metadata?.longitude === 'number' ? { longitude: entity.metadata.longitude } : {}),
    searchOnly: true,
    candidateResidenceInferred: false,
  }
}

export function administrativeGeographySuggestionsV36_6(query: string, limit = 10): GeographicObservationV36_6[] {
  const raw = clean(query)
  if (raw.length < 2) return []
  const lower = raw.toLowerCase()
  const out: GeographicObservationV36_6[] = []

  for (const [code, name] of Object.entries(US_STATES)) {
    if (code.toLowerCase().startsWith(lower) || name.toLowerCase().startsWith(lower)) {
      const item = usStateObservationV36_6(code)
      if (item) out.push(item)
    }
  }

  // Exact ISO country/name recognition is deterministic and avoids noisy global
  // prefix scans over ICU's region labels.
  const country = isoCountryObservationV36_6(raw)
  if (country) out.push(country)
  const postal = usPostalObservationV36_6(raw)
  if (postal) out.push(postal)

  const seen = new Set<string>()
  return out.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  }).slice(0, Math.max(1, Math.min(limit, 20)))
}

export function geographicObservationReplayKeyV36_6(observation: GeographicObservationV36_6): string {
  return [observation.source, observation.sourceVersion, observation.id].join(':')
}
