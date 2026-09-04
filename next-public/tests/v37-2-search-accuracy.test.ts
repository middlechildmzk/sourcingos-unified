import { describe, expect, it } from 'vitest'
import { applySearchDiscoveryExpansionV37_2 } from '../lib/search-discovery-expansion-v37-2'
import { runCandidateDataSearchV36_8 } from '../lib/candidate-data/orchestrator-v36-8'
import type { CandidateDataSearchAdapterV36_8, CandidateDataSearchRequestV36_8 } from '../lib/candidate-data/types-v36-8'
import { buildApolloPeopleSearchUrlV36_16 } from '../lib/candidate-data/providers/apollo-v36-16'

const rhelRequest: CandidateDataSearchRequestV36_8 = {
  query: 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher',
  requirements: [
    { text: 'Current or relevant title: RHEL admin', mustHave: false },
    { text: 'RHEL', mustHave: true },
    { text: '5+ years relevant experience', mustHave: true },
    { text: 'Secret clearance or higher', mustHave: true },
  ],
  titles: ['RHEL admin'],
  skills: ['RHEL'],
  locations: ['Annapolis Junction, MD'],
  limit: 10,
  highFreshness: false,
  revealContact: false,
}

describe('V37.2 recruiter search accuracy', () => {
  it('keeps recruiter requirements intact while adding bounded RHEL discovery aliases', () => {
    const expanded = applySearchDiscoveryExpansionV37_2(rhelRequest)
    expect(expanded.requirements).toEqual(rhelRequest.requirements)
    expect(expanded.titles).toEqual(expect.arrayContaining([
      'RHEL admin',
      'Red Hat Enterprise Linux Administrator',
      'Linux Administrator',
      'Linux Systems Administrator',
      'Systems Administrator',
    ]))
    expect(expanded.skills).toEqual(expect.arrayContaining(['RHEL', 'Red Hat Enterprise Linux', 'Red Hat Linux']))
    expect(expanded.locations).toEqual(expect.arrayContaining([
      'Annapolis Junction, MD',
      'Fort Meade, MD',
      'Jessup, MD',
      'Laurel, MD',
      'Columbia, MD',
      'Odenton, MD',
    ]))
  })

  it('does not silently widen geography when the recruiter did not ask for proximity', () => {
    const expanded = applySearchDiscoveryExpansionV37_2({
      ...rhelRequest,
      query: 'Find a RHEL admin in Annapolis Junction, MD',
    })
    expect(expanded.locations).toEqual(['Annapolis Junction, MD'])
  })

  it('admits an adjacent Linux-admin title as discovery while leaving RHEL evidence unknown', async () => {
    let received: CandidateDataSearchRequestV36_8 | undefined
    const adapter: CandidateDataSearchAdapterV36_8 = {
      provider: 'exa',
      search: async request => {
        received = request
        return {
          observations: [{
            provider: 'exa',
            providerPersonId: 'adjacent-linux-admin',
            displayName: 'Adjacent Linux Admin',
            currentTitle: 'Linux Systems Administrator',
            currentEmployer: 'Example Systems',
            location: 'Fort Meade, MD',
            skills: [],
            profileUrls: [{ kind: 'personal', url: 'https://example.com/adjacent-linux-admin' }],
            contactAvailability: { email: 'unknown', phone: 'unknown' },
            observedAt: '2026-09-04T00:00:00.000Z',
          }],
          telemetry: { provider: 'exa', status: 'completed', discovered: 1, latencyMs: 1 },
          warnings: [],
        }
      },
    }

    const result = await runCandidateDataSearchV36_8(rhelRequest, [adapter], 10)
    expect(received?.titles).toContain('Linux Systems Administrator')
    expect(received?.locations).toContain('Fort Meade, MD')
    expect(result.observations).toHaveLength(1)
    expect(result.observations[0].providerExplanation).toContain('Retrieval is not a qualification decision')
    expect(result.observations[0].providerExplanation).toContain('Must-haves not verified')
    expect(result.warnings[0]).toContain('Discovery expansion applied')
  })

  it('still rejects an unrelated provider observation after expansion', async () => {
    const adapter: CandidateDataSearchAdapterV36_8 = {
      provider: 'exa',
      search: async () => ({
        observations: [{
          provider: 'exa',
          providerPersonId: 'sales-manager',
          displayName: 'Unrelated Person',
          currentTitle: 'Regional Sales Manager',
          currentEmployer: 'Example Sales',
          location: 'Fort Meade, MD',
          skills: ['Sales'],
          profileUrls: [{ kind: 'personal', url: 'https://example.com/sales-manager' }],
          contactAvailability: { email: 'unknown', phone: 'unknown' },
          observedAt: '2026-09-04T00:00:00.000Z',
        }],
        telemetry: { provider: 'exa', status: 'completed', discovered: 1, latencyMs: 1 },
        warnings: [],
      }),
    }

    const result = await runCandidateDataSearchV36_8(rhelRequest, [adapter], 10)
    expect(result.observations).toHaveLength(0)
    expect(result.relevanceRejected).toBe(1)
  })

  it('does not send tenure or clearance prose into Apollo keyword filtering', () => {
    const url = new URL(buildApolloPeopleSearchUrlV36_16(applySearchDiscoveryExpansionV37_2(rhelRequest)))
    const keywords = url.searchParams.get('q_keywords') || ''
    expect(keywords.toLowerCase()).toContain('rhel')
    expect(keywords.toLowerCase()).not.toContain('5+ years')
    expect(keywords.toLowerCase()).not.toContain('secret clearance')
  })
})
