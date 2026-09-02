import { describe, expect, it } from 'vitest'
import {
  buildUniversalPeopleProviderRequestV36_9,
  classifyUniversalPeopleSearchV36_9,
  exactLinkedInAnchorV36_9,
} from '@/lib/universal-people-search-v36-9'

describe('V36.9 universal people search', () => {
  it('recognizes exact identity lookup surfaces before broad professional search', () => {
    expect(classifyUniversalPeopleSearchV36_9('jane.doe@example.com')).toBe('email_lookup')
    expect(classifyUniversalPeopleSearchV36_9('+1 (612) 555-0199')).toBe('phone_lookup')
    expect(classifyUniversalPeopleSearchV36_9('https://www.linkedin.com/in/jane-doe/')).toBe('linkedin_lookup')
    expect(classifyUniversalPeopleSearchV36_9('https://github.com/janedoe')).toBe('github_lookup')
    expect(classifyUniversalPeopleSearchV36_9('Jane Doe')).toBe('person_lookup')
    expect(classifyUniversalPeopleSearchV36_9('RHEL administrator Minneapolis')).toBe('professional_search')
  })

  it('keeps structured filters explicit while adding bounded company context', () => {
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
      { text: 'RHEL', mustHave: true },
      { text: 'Ansible', mustHave: true },
      { text: 'Linux', mustHave: true },
    ])
  })

  it('normalizes only exact LinkedIn profile URLs as a deterministic display-overlap anchor', () => {
    expect(exactLinkedInAnchorV36_9([{ kind: 'linkedin', url: 'https://www.linkedin.com/in/Jane-Doe/?trk=abc#top' }])).toBe('https://www.linkedin.com/in/jane-doe')
    expect(exactLinkedInAnchorV36_9([{ kind: 'github', url: 'https://github.com/janedoe' }])).toBeUndefined()
  })
})
