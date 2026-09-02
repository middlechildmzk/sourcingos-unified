import { describe, expect, it } from 'vitest'
import { buildLinkUpSearchBodyV36_8 } from '@/lib/candidate-data/providers/linkup-v36-8'
import { buildExaPeopleSearchBodyV36_8 } from '@/lib/candidate-data/providers/exa-v36-8'
import { employmentDisabledProviderIdsV36_8, providerRoadmapEntryV36_8 } from '@/lib/candidate-data/provider-roadmap-v36-8'

const request = {
  query: 'RHEL administrator with 5+ years Linux near Annapolis Junction, MD with Secret or higher',
  requirements: [
    { text: 'RHEL administration', mustHave: true },
    { text: '5+ years Linux experience', mustHave: true },
    { text: 'Secret clearance or higher — verification required', mustHave: true },
  ],
  titles: ['RHEL Administrator', 'Linux Administrator'],
  skills: ['RHEL', 'Red Hat Enterprise Linux', 'Linux'],
  locations: ['Annapolis Junction, MD', 'Washington, DC'],
  limit: 20,
}

describe('V36.8 provider expansion', () => {
  it('keeps LinkUp retrieval bound to recruiter-approved structured fields', () => {
    const body = buildLinkUpSearchBodyV36_8(request)
    expect(body).toEqual({
      keyword: 'RHEL Red Hat Enterprise Linux Linux',
      job_title: 'RHEL Administrator',
      location: 'Annapolis Junction, MD',
      total_results: 20,
    })
    expect(JSON.stringify(body)).not.toContain(request.query)
  })

  it('uses Exa dedicated people search and Role Brain structure instead of raw recruiter prose', () => {
    const body = buildExaPeopleSearchBodyV36_8(request)
    expect(body.category).toBe('people')
    expect(body.type).toBe('auto')
    expect(body.numResults).toBe(20)
    expect(body.contents).toEqual({ highlights: true })
    expect(body.query).toContain('RHEL Administrator')
    expect(body.query).toContain('Red Hat Enterprise Linux')
    expect(body.query).toContain('Annapolis Junction, MD')
    expect(body.query).toContain('Secret clearance or higher')
    expect(body.query).not.toBe(request.query)
  })

  it('hard-disables consumer public-record sources whose employment use is prohibited or unverified', () => {
    expect(employmentDisabledProviderIdsV36_8()).toEqual(expect.arrayContaining(['enformion_go', 'true_people_search']))
    expect(providerRoadmapEntryV36_8('enformion_go')).toMatchObject({ state: 'disabled', uses: ['disabled_for_employment'] })
    expect(providerRoadmapEntryV36_8('true_people_search')).toMatchObject({ state: 'disabled', uses: ['disabled_for_employment'] })
  })

  it('queues broad professional/AI search layers without falsely claiming they are wired', () => {
    expect(providerRoadmapEntryV36_8('apollo')).toMatchObject({ state: 'next', uses: expect.arrayContaining(['candidate_search', 'contact_enrichment']) })
    expect(providerRoadmapEntryV36_8('company_enrich')).toMatchObject({ state: 'next', uses: expect.arrayContaining(['candidate_search']) })
    expect(providerRoadmapEntryV36_8('crustdata')).toMatchObject({ state: 'next', uses: expect.arrayContaining(['candidate_search', 'public_web_locator']) })
    expect(providerRoadmapEntryV36_8('perplexity_people')).toMatchObject({ state: 'next', uses: ['public_web_locator'] })
    expect(providerRoadmapEntryV36_8('pipl')).toMatchObject({ state: 'research', uses: ['identity_corroboration'] })
    expect(providerRoadmapEntryV36_8('osint_industries')).toMatchObject({ state: 'research', uses: ['identity_corroboration'] })
  })
})
