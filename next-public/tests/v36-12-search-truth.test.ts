import { describe, expect, it } from 'vitest'
import { buildUniversalPeopleProviderRequestV36_9 } from '@/lib/universal-people-search-v36-9'
import { buildPeopleDataLabsSearchBodyV36_8 } from '@/lib/candidate-data/providers/people-data-labs-search-v36-8'
import { buildLinkUpSearchBodyV36_8 } from '@/lib/candidate-data/providers/linkup-v36-8'
import { buildSearchQualitySnapshotV36_12, canonicalSearchRoleKeyV36_12 } from '@/lib/search-quality-v36-12'

describe('V36.12 Universal People Search structured anchors', () => {
  it('splits explicit name + company syntax', () => {
    const at = buildUniversalPeopleProviderRequestV36_9({ query: 'Jane Doe at Acme' })
    expect(at.names).toEqual(['Jane Doe'])
    expect(at.companies).toEqual(['Acme'])

    const comma = buildUniversalPeopleProviderRequestV36_9({ query: 'Jane Doe, Acme' })
    expect(comma.names).toEqual(['Jane Doe'])
    expect(comma.companies).toEqual(['Acme'])
  })

  it('does not turn a compact company token into a surname', () => {
    const request = buildUniversalPeopleProviderRequestV36_9({ query: 'Jane Doe Acme' })
    expect(request.names).toEqual(['Jane Doe'])
    expect(request.companies).toEqual(['Acme'])

    const pdl = buildPeopleDataLabsSearchBodyV36_8(request)
    expect(JSON.stringify(pdl.query)).toContain('jane doe')
    expect(JSON.stringify(pdl.query)).toContain('acme')
    expect(JSON.stringify(pdl.query)).not.toContain('jane doe acme')
  })

  it('preserves the flagship RHEL role extraction', () => {
    const request = buildUniversalPeopleProviderRequestV36_9({
      query: 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher',
    })
    expect(request.titles).toContain('RHEL admin')
    expect(request.skills).toContain('RHEL')
    expect(request.locations).toContain('Annapolis Junction, MD')
    expect(request.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: '5+ years relevant experience', mustHave: true }),
      expect.objectContaining({ text: expect.stringMatching(/Secret/i), mustHave: true }),
    ]))
  })

  it('passes company context to LinkUp without inventing identity authority', () => {
    const body = buildLinkUpSearchBodyV36_8({
      query: 'Jane Doe at Acme',
      names: ['Jane Doe'],
      companies: ['Acme'],
      limit: 10,
    })
    expect(body.current_company).toBe('Acme')
  })
})

describe('V36.12 Search Quality harness', () => {
  it('recognizes the canonical RHEL baseline and reports observation/contact metrics', () => {
    const query = 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher'
    expect(canonicalSearchRoleKeyV36_12(query)).toBe('cleared-rhel-annapolis')

    const snapshot = buildSearchQualitySnapshotV36_12(
      { query, limit: 30 },
      {
        observations: [
          {
            provider: 'exa', providerPersonId: 'a', displayName: 'Alex Example', skills: [], profileUrls: [],
            contactAvailability: { email: true, phone: 'unknown' }, observedAt: '2026-09-03T00:00:00.000Z',
          },
          {
            provider: 'pearch', providerPersonId: 'b', displayName: 'Taylor Example', skills: [], profileUrls: [],
            contactAvailability: { email: false, phone: false }, observedAt: '2026-09-03T00:00:00.000Z',
          },
        ],
        telemetry: [
          { provider: 'exa', status: 'completed', discovered: 2, latencyMs: 100, estimatedCredits: 2 },
          { provider: 'pearch', status: 'completed', discovered: 1, latencyMs: 300 },
          { provider: 'linkup', status: 'failed', discovered: 0, latencyMs: 200 },
        ],
        warnings: [],
        providerMix: { exa: 2, pearch: 1, linkup: 0 },
        retainedProviderMix: { exa: 1, pearch: 1 },
        discoveredBeforeCap: 3,
        returnedAfterCap: 2,
        contributingProviders: 2,
      },
    )

    expect(snapshot.rawObservations).toBe(3)
    expect(snapshot.retainedObservations).toBe(2)
    expect(snapshot.contributingProviders).toBe(2)
    expect(snapshot.failedProviders).toBe(1)
    expect(snapshot.contactAvailabilityRate).toBe(0.5)
    expect(snapshot.estimatedCredits).toBe(2)
    expect(snapshot.novelPeople).toBeNull()
  })
})
