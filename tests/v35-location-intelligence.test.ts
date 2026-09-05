import { describe, expect, it } from 'vitest'
import { matchLocationEntitiesV35, resolveLocationIntentV35 } from '@/lib/entity-intelligence/location-v35'

describe('V35 location intelligence', () => {
  it('normalizes in-or-near Annapolis Junction without storing the preposition as the location', () => {
    const intent = resolveLocationIntentV35('RHEL admin in or near Annapolis Junction, MD')
    expect(intent.anchorLabel).toBe('Annapolis Junction, MD')
    expect(intent.mode).toBe('nearby')
    expect(intent.anchorLabel).not.toMatch(/in or near/i)
    expect(intent.suggestedExpansionIds.length).toBeGreaterThan(0)
    expect(intent.recruiterApprovedExpansionIds).toEqual([])
  })

  it('represents explicit radius intent without pre-materializing every radius edge', () => {
    const intent = resolveLocationIntentV35('within 25 miles of 20701')
    expect(intent.mode).toBe('radius')
    expect(intent.radiusMiles).toBe(25)
    expect(intent.anchorLabel).toBe('20701')
  })

  it('resolves DMV as a region instead of flattening it into Washington DC', () => {
    const intent = resolveLocationIntentV35('in the DMV')
    expect(intent.mode).toBe('region')
    expect(intent.anchorLabel).toBe('DMV')
    expect(intent.anchorLabel).not.toBe('Washington, DC')
  })

  it('keeps Northern Virginia distinct from its member cities', () => {
    const region = resolveLocationIntentV35('Northern Virginia')
    const arlington = resolveLocationIntentV35('Arlington, VA')
    expect(region.anchorLabel).toBe('Northern Virginia')
    expect(region.mode).toBe('region')
    expect(arlington.anchorLabel).toBe('Arlington, VA')
    expect(arlington.anchorLocationId).not.toBe(region.anchorLocationId)
  })

  it('does not silently choose an ambiguous Springfield', () => {
    const intent = resolveLocationIntentV35('Springfield')
    expect(intent.anchorLocationId).toBeUndefined()
    expect(intent.ambiguousCandidateIds?.length).toBe(3)
    expect(intent.explanation.join(' ')).toContain('ambiguous')
  })

  it('handles remote and hybrid as intent modes rather than city aliases', () => {
    const remote = resolveLocationIntentV35('remote anywhere in the US')
    const hybrid = resolveLocationIntentV35('hybrid within commuting distance of Chicago')
    expect(remote.mode).toBe('remote')
    expect(hybrid.mode).toBe('hybrid')
    expect(hybrid.anchorLabel).toBe('Chicago, IL')
  })

  it('has deterministic international city contracts without guessing a country for ambiguous Springfield', () => {
    for (const [query, expected] of [
      ['London, UK', 'London, United Kingdom'],
      ['Toronto, Canada', 'Toronto, Canada'],
      ['Berlin, Germany', 'Berlin, Germany'],
      ['Sydney, Australia', 'Sydney, Australia'],
    ] as const) {
      expect(resolveLocationIntentV35(query).anchorLabel).toBe(expected)
    }
  })

  it('preserves Fort Meade and Annapolis Junction as nearby but distinct places', () => {
    const matches = matchLocationEntitiesV35('Fort Meade and Annapolis Junction')
    expect(matches.some(entity => entity.canonicalLabel === 'Fort Meade, MD')).toBe(true)
    expect(matches.some(entity => entity.canonicalLabel === 'Annapolis Junction, MD')).toBe(true)
  })
})
