import { describe, expect, it } from 'vitest'
import {
  buildUniversalExactIdentityRequestV36_9,
  buildUniversalPeopleProviderRequestV36_9,
  classifyUniversalPeopleSearchV36_9,
  exactLinkedInAnchorV36_9,
} from '@/lib/universal-people-search-v36-9'

describe('V36.9 universal people search', () => {
  it('recognizes exact identity lookup surfaces before broad professional search', () => {
    expect(classifyUniversalPeopleSearchV36_9('jane.doe@example.com')).toBe('email_lookup')
    expect(classifyUniversalPeopleSearchV36_9('+1 (612) 555-0199')).toBe('phone_lookup')
    expect(classifyUniversalPeopleSearchV36_9('https://www.linkedin.com/in/jane-doe/')).toBe('linkedin_lookup')
    expect(classifyUniversalPeopleSearchV36_9('linkedin.com/in/jane-doe/')).toBe('linkedin_lookup')
    expect(classifyUniversalPeopleSearchV36_9('https://github.com/janedoe')).toBe('github_lookup')
    expect(classifyUniversalPeopleSearchV36_9('Jane Doe')).toBe('person_lookup')
    expect(classifyUniversalPeopleSearchV36_9('RHEL administrator Minneapolis')).toBe('professional_search')
  })

  it('routes exact identifiers to explicit identity enrichment without pretending it is a broad people query', () => {
    expect(buildUniversalExactIdentityRequestV36_9('jane.doe@example.com')).toEqual({
      purpose: 'identity_enrichment',
      email: 'jane.doe@example.com',
      sourceContext: 'universal_people_search_v36_9',
    })
    expect(buildUniversalExactIdentityRequestV36_9('+1 (612) 555-0199')).toEqual({
      purpose: 'identity_enrichment',
      phone: '+1 (612) 555-0199',
      sourceContext: 'universal_people_search_v36_9',
    })
    expect(buildUniversalExactIdentityRequestV36_9('linkedin.com/in/jane-doe')).toEqual({
      purpose: 'identity_enrichment',
      linkedinUrl: 'https://linkedin.com/in/jane-doe',
      profileUrl: 'https://linkedin.com/in/jane-doe',
      sourceContext: 'universal_people_search_v36_9',
    })
  })

  it('keeps explicit structured filters authoritative while adding bounded company context', () => {
    const request = buildUniversalPeopleProviderRequestV36_9({
      query: 'Jane Doe',
      title: 'Linux Administrator',
      company: 'Acme Federal',
      location: 'Annapolis Junction, MD',
      skills: 'RHEL, Ansible, Linux',
      limit: 30,
    })

    expect(request.query).toBe('Jane Doe · company Acme Federal')
    expect(request.titles).toEqual(['Linux Administrator'])
    expect(request.locations).toEqual(['Annapolis Junction, MD'])
    expect(request.skills).toEqual(['RHEL', 'Ansible', 'Linux'])
    expect(request.requirements).toEqual([
      { text: 'Current or relevant title: Linux Administrator', mustHave: false },
      { text: 'Current or relevant employer: Acme Federal', mustHave: false },
      { text: 'RHEL', mustHave: true },
      { text: 'Ansible', mustHave: true },
      { text: 'Linux', mustHave: true },
    ])
  })

  it('structures the flagship natural-language sourcing query for providers that require fields', () => {
    const request = buildUniversalPeopleProviderRequestV36_9({
      query: 'Find me a RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with Secret clearance or higher',
      limit: 30,
    })

    expect(request.titles).toEqual(['RHEL admin'])
    expect(request.locations).toEqual(['Annapolis Junction, MD'])
    expect(request.skills).toContain('RHEL')
    expect(request.requirements).toEqual(expect.arrayContaining([
      { text: 'Current or relevant title: RHEL admin', mustHave: false },
      { text: 'RHEL', mustHave: true },
      { text: '5+ years relevant experience', mustHave: true },
      { text: 'Secret clearance or higher', mustHave: true },
    ]))
  })

  it('keeps alternative free-text skills soft instead of turning OR into AND must-haves', () => {
    const request = buildUniversalPeopleProviderRequestV36_9({
      query: 'Find me a cloud engineer with AWS or Azure',
      limit: 20,
    })

    expect(request.titles).toEqual(['cloud engineer'])
    expect(request.skills).toEqual(expect.arrayContaining(['AWS', 'Azure']))
    expect(request.requirements).toEqual(expect.arrayContaining([
      { text: 'AWS', mustHave: false },
      { text: 'Azure', mustHave: false },
    ]))
  })

  it('does not reinterpret a person name as structured role criteria', () => {
    const request = buildUniversalPeopleProviderRequestV36_9({ query: 'Jane Doe', limit: 10 })
    expect(request.titles).toBeUndefined()
    expect(request.skills).toBeUndefined()
    expect(request.locations).toBeUndefined()
  })

  it('normalizes only exact LinkedIn profile URLs as a deterministic display-overlap anchor', () => {
    expect(exactLinkedInAnchorV36_9([{ kind: 'linkedin', url: 'https://www.linkedin.com/in/Jane-Doe/?trk=abc#top' }])).toBe('https://www.linkedin.com/in/jane-doe')
    expect(exactLinkedInAnchorV36_9([{ kind: 'github', url: 'https://github.com/janedoe' }])).toBeUndefined()
  })
})
