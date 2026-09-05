import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  administrativeGeographySuggestionsV36_6,
  geographicObservationReplayKeyV36_6,
  isoCountryObservationV36_6,
  usPostalObservationV36_6,
  usStateObservationV36_6,
  type GeographicObservationV36_6,
} from '@/lib/entity-intelligence/geography-v36-6'
import {
  assessRecruiterGeographyV36_6,
  buildLocationSearchPlanV36_6,
  distanceBetweenObservationsV36_6,
  trustedPointForRadiusV36_6,
} from '@/lib/entity-intelligence/geographic-assessment-v36-6'
import { geographyAssistSuggestionsV36_6, geographyPhraseFromComposerV36_6 } from '@/lib/entity-intelligence/geography-assist-v36-6'
import { resolveLocationIntentV35 } from '@/lib/entity-intelligence/location-v35'

function point(id: string, latitude: number, longitude: number, precision: GeographicObservationV36_6['precision'] = 'city'): GeographicObservationV36_6 {
  return {
    id, label: id, kind: 'city', source: 'external_authoritative', sourceRef: 'test-fixture', sourceVersion: '1', precision,
    latitude, longitude, searchOnly: true, candidateResidenceInferred: false,
  }
}

describe('V36.6 broad administrative geography recognition', () => {
  it('recognizes all U.S. states/DC by name or abbreviation without a second giant taxonomy', () => {
    for (const sample of [['MN', 'Minnesota'], ['MD', 'Maryland'], ['VA', 'Virginia'], ['CA', 'California'], ['TX', 'Texas'], ['DC', 'District of Columbia']] as const) {
      expect(usStateObservationV36_6(sample[0])?.label).toBe(sample[1])
      expect(usStateObservationV36_6(sample[1])?.stateCode).toBe(sample[0])
    }
  })

  it('uses runtime standards data for country recognition', () => {
    expect(isoCountryObservationV36_6('US')?.label).toBe('United States')
    expect(isoCountryObservationV36_6('Canada')?.countryCode).toBe('CA')
    expect(isoCountryObservationV36_6('Germany')?.countryCode).toBe('DE')
    expect(isoCountryObservationV36_6('ZZ')).toBeNull()
  })

  it('recognizes ZIP syntax but does not invent a centroid, city or radius coordinate', () => {
    const zip = usPostalObservationV36_6('20701')!
    expect(zip).toMatchObject({ postalCode: '20701', precision: 'unknown', candidateResidenceInferred: false, searchOnly: true })
    expect(zip.latitude).toBeUndefined()
    expect(zip.longitude).toBeUndefined()
    expect(trustedPointForRadiusV36_6(zip)).toBe(false)
  })

  it('provides categorized administrative suggestions for filters', () => {
    expect(administrativeGeographySuggestionsV36_6('Minn').some(item => item.label === 'Minnesota')).toBe(true)
    expect(administrativeGeographySuggestionsV36_6('20701').some(item => item.postalCode === '20701')).toBe(true)
    expect(geographyAssistSuggestionsV36_6('candidates in Maryland').some(item => item.label === 'Maryland')).toBe(true)
  })

  it('produces stable replay/provenance keys', () => {
    const state = usStateObservationV36_6('MD')!
    expect(geographicObservationReplayKeyV36_6(state)).toBe('us_state:v36.6:geo:us-state:md')
  })
})

describe('V36.6 radius truth contract', () => {
  it('keeps the exact RHEL acceptance radius parser structured', () => {
    const intent = resolveLocationIntentV35('RHEL administrator within 25 miles of Annapolis Junction, MD')
    expect(intent.mode).toBe('radius')
    expect(intent.radiusMiles).toBe(25)
    expect(intent.anchorLabel).toBe('Annapolis Junction, MD')
  })

  it('calculates radius only when both source observations have trustworthy point precision', () => {
    const annapolis = point('Annapolis Junction', 39.1204, -76.7766)
    const columbia = point('Columbia', 39.2037, -76.8610)
    const distance = distanceBetweenObservationsV36_6(annapolis, columbia)
    expect(distance).not.toBeNull()
    const assessment = assessRecruiterGeographyV36_6({ roleAnchor: annapolis, candidateLocation: columbia, radiusMiles: 25 })
    expect(assessment.classification).toBe('within_radius')
    expect(assessment.distanceBasis).toBe('coordinates')
    expect(assessment.distanceMiles).toBeGreaterThan(0)
    expect(assessment.candidateResidenceInferred).toBe(false)
    expect(assessment.candidateWillingnessInferred).toBe(false)
  })

  it('refuses numeric radius claims for state/country/unknown ZIP precision', () => {
    const anchor = point('anchor', 39.1, -76.8)
    const state = usStateObservationV36_6('MD')!
    const assessment = assessRecruiterGeographyV36_6({ roleAnchor: anchor, candidateLocation: state, radiusMiles: 25 })
    expect(assessment.classification).toBe('unknown')
    expect(assessment.distanceMiles).toBeUndefined()
    expect(assessment.explanation.join(' ').toLowerCase()).toContain('no numeric distance was invented')
  })
})

describe('V36.6 metro/commute/source execution separation', () => {
  const anchor = point('role', 39.1, -76.8)
  const observed = point('candidate-source-location', 39.2, -76.7)

  it('does not equate same metro with candidate willingness to commute', () => {
    const result = assessRecruiterGeographyV36_6({ roleAnchor: anchor, candidateLocation: observed, sameMetro: true })
    expect(result.classification).toBe('same_metro')
    expect(result.candidateResidenceInferred).toBe(false)
    expect(result.candidateWillingnessInferred).toBe(false)
  })

  it('requires an explicit commute evidence object for likely_commutable', () => {
    const withoutEvidence = assessRecruiterGeographyV36_6({ roleAnchor: { ...anchor, latitude: undefined, longitude: undefined }, candidateLocation: { ...observed, latitude: undefined, longitude: undefined } })
    expect(withoutEvidence.classification).toBe('unknown')
    const withEvidence = assessRecruiterGeographyV36_6({
      roleAnchor: anchor,
      candidateLocation: observed,
      commuteEvidence: { source: 'travel_time_provider', sourceRef: 'authorized-test-provider', observedMinutes: 28, confidence: 'strong' },
    })
    expect(withEvidence.classification).toBe('likely_commutable')
    expect(withEvidence.commuteEvidence?.observedMinutes).toBe(28)
    expect(withEvidence.candidateWillingnessInferred).toBe(false)
  })

  it('makes native vs downstream vs source-agnostic geography execution explicit', () => {
    expect(buildLocationSearchPlanV36_6({ mode: 'radius', anchorId: 'a', radiusMiles: 25, sourceSupportsNativeLocation: true }).sourceExecutionMode).toBe('native_location')
    expect(buildLocationSearchPlanV36_6({ mode: 'radius', anchorId: 'a', radiusMiles: 25, sourceSupportsNativeLocation: false }).sourceExecutionMode).toBe('downstream_filter')
    expect(buildLocationSearchPlanV36_6({ mode: 'radius', anchorId: 'a', radiusMiles: 25, sourceSupportsNativeLocation: false, sourceIsGeographyAgnostic: true }).sourceExecutionMode).toBe('source_agnostic')
  })
})

describe('V36.6 recruiter smart-filter UI', () => {
  const dropdown = readFileSync(join(process.cwd(), 'components/SearchAssistDropdown.tsx'), 'utf8')

  it('wires administrative geography suggestions into the same dropdown as RIG/O*NET', () => {
    expect(dropdown).toContain('geographyAssistSuggestionsV36_6')
    expect(dropdown).toContain("kind: 'location' as const")
    expect(dropdown).toContain('Geographic suggestions are search anchors')
  })

  it('extracts common recruiter geography phrases', () => {
    expect(geographyPhraseFromComposerV36_6('find candidates in Maryland')).toBe('Maryland')
    expect(geographyPhraseFromComposerV36_6('RHEL admin near Annapolis Junction, MD')).toBe('MD')
    expect(geographyPhraseFromComposerV36_6('people in 20701')).toBe('20701')
  })
})
