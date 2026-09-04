import { describe, expect, it } from 'vitest'
import { retrievalRelevanceDecisionV37 } from '@/lib/candidate-data/retrieval-relevance-v37'
import type { CandidateDataSearchRequestV36_8, CandidateProviderObservationV36_8 } from '@/lib/candidate-data/types-v36-8'

function observation(overrides: Partial<CandidateProviderObservationV36_8> = {}): CandidateProviderObservationV36_8 {
  return {
    provider: 'contactout',
    providerPersonId: 'test-person',
    displayName: 'Example Person',
    skills: [],
    profileUrls: [],
    contactAvailability: { email: 'unknown', phone: 'unknown' },
    observedAt: '2026-09-04T00:00:00.000Z',
    ...overrides,
  }
}

function request(overrides: Partial<CandidateDataSearchRequestV36_8> = {}): CandidateDataSearchRequestV36_8 {
  return {
    query: 'backend engineers with AWS and Kubernetes in Minneapolis',
    titles: ['Backend Engineer'],
    skills: ['AWS', 'Kubernetes'],
    locations: ['Minneapolis, MN'],
    limit: 25,
    revealContact: false,
    highFreshness: false,
    ...overrides,
  }
}

describe('V37 provider-neutral retrieval admission', () => {
  it('rejects an unrelated fast-source observation before diversity/interleaving', () => {
    const result = retrievalRelevanceDecisionV37(request(), observation({
      displayName: 'Research Example',
      currentTitle: 'Research Assistant',
      currentEmployer: 'University Example',
      location: 'Minneapolis, MN',
      providerExplanation: 'Provider ranked this profile highly.',
    }))
    expect(result.admitted).toBe(false)
    expect(result.reasons).toContain('no_role_skill_or_company_signal')
  })

  it('admits a candidate with relevant normalized skill evidence even when title wording differs', () => {
    const result = retrievalRelevanceDecisionV37(request(), observation({
      currentTitle: 'Software Engineer',
      currentEmployer: 'Example Systems',
      skills: ['Amazon Web Services', 'Kubernetes', 'Go'],
    }))
    expect(result.admitted).toBe(true)
    expect(result.reasons).toContain('skill_signal')
  })

  it('does not reject a relevant candidate merely because location is missing', () => {
    const result = retrievalRelevanceDecisionV37(request({ titles: ['RHEL Administrator'], skills: ['RHEL'] }), observation({
      currentTitle: 'Linux Administrator',
      skills: ['RHEL', 'SELinux', 'Ansible'],
      location: undefined,
    }))
    expect(result.admitted).toBe(true)
  })

  it('requires an explicit name anchor when the recruiter searched a named person', () => {
    const named = request({ names: ['Jane Example'], titles: [], skills: [], locations: [] })
    expect(retrievalRelevanceDecisionV37(named, observation({ displayName: 'Jane Example', currentTitle: 'Engineer' })).admitted).toBe(true)
    expect(retrievalRelevanceDecisionV37(named, observation({ displayName: 'John Different', currentTitle: 'Engineer' })).admitted).toBe(false)
  })

  it('never treats providerExplanation as evidence for admission', () => {
    const result = retrievalRelevanceDecisionV37(request(), observation({
      currentTitle: 'Research Assistant',
      providerExplanation: 'Backend Engineer AWS Kubernetes perfect match',
    }))
    expect(result.admitted).toBe(false)
  })
})
