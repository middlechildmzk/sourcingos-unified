import { describe, expect, it } from 'vitest'
import {
  canonicalProfessionalProfileUrlV36_10,
  sharedProfessionalProfileAnchorsV36_10,
} from '@/lib/identity-anchors-v36-10'
import type { SourceResult } from '@/lib/source-types'

function result(input: Partial<SourceResult> & Pick<SourceResult, 'source' | 'sourceProfileId' | 'displayName'>): SourceResult {
  return {
    id: `${input.source}:${input.sourceProfileId}`,
    entityKind: 'person',
    skills: [],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-09-02T00:00:00.000Z',
    ...input,
  }
}

describe('V36.10 canonical professional identity anchors', () => {
  it('normalizes equivalent LinkedIn profile URLs for display/dedupe without making them deterministic identity authority', () => {
    const a = canonicalProfessionalProfileUrlV36_10('https://www.linkedin.com/in/John-Doe/?utm_source=test')
    const b = canonicalProfessionalProfileUrlV36_10('linkedin.com/in/john-doe')
    expect(a?.canonicalUrl).toBe('https://linkedin.com/in/john-doe')
    expect(b?.canonicalUrl).toBe(a?.canonicalUrl)
  })

  it('uses the Stack Overflow numeric user id as the stable public profile anchor', () => {
    expect(canonicalProfessionalProfileUrlV36_10('https://stackoverflow.com/users/123456/john-doe?tab=profile')?.canonicalUrl)
      .toBe('https://stackoverflow.com/users/123456')
  })

  it('does not promote a GitHub repository URL into a person-level deterministic anchor', () => {
    expect(canonicalProfessionalProfileUrlV36_10('https://github.com/acme/shared-project')).toBeNull()
  })

  it('keeps the same LinkedIn URL review-only even when a provider and public resume both report it', () => {
    const provider = result({
      source: 'people_data_labs',
      sourceProfileId: 'pdl-1',
      displayName: 'Example Person',
      profileUrl: 'https://www.linkedin.com/in/example-person/',
    })
    const resume = result({
      source: 'resume_xray',
      sourceProfileId: 'resume-1',
      displayName: 'Example Person',
      evidence: [{
        id: 'ev-1',
        label: 'Public URL',
        detail: 'LinkedIn profile',
        source: 'resume_xray',
        confidence: 'medium',
        url: 'https://linkedin.com/in/EXAMPLE-PERSON?trk=resume',
        observedAt: '2026-09-02T00:00:00.000Z',
      }],
    })

    const shared = sharedProfessionalProfileAnchorsV36_10(provider, resume)
    expect(shared.matched).toBe(false)
    expect(shared.anchors).toEqual([])
  })

  it('can still use independently observed public GitHub person profiles as deterministic review anchors', () => {
    const provider = result({
      source: 'people_data_labs',
      sourceProfileId: 'pdl-2',
      displayName: 'Example Person',
      contactSignals: [{
        type: 'profile_url',
        value: 'https://github.com/example-person',
        source: 'people_data_labs',
        verified: false,
        note: 'Provider-observed public GitHub profile URL.',
      }],
    })
    const github = result({
      source: 'github',
      sourceProfileId: 'example-person',
      displayName: 'Example Person',
      profileUrl: 'https://github.com/example-person',
    })

    const shared = sharedProfessionalProfileAnchorsV36_10(provider, github)
    expect(shared.matched).toBe(true)
    expect(shared.anchors[0]?.network).toBe('github')
    expect(shared.anchors[0]?.canonicalUrl).toBe('https://github.com/example-person')
  })

  it('keeps different professional profiles separate', () => {
    const a = result({ source: 'github', sourceProfileId: 'a', displayName: 'Example Person', profileUrl: 'https://github.com/example-a' })
    const b = result({ source: 'exa', sourceProfileId: 'b', displayName: 'Example Person', profileUrl: 'https://github.com/example-b' })
    expect(sharedProfessionalProfileAnchorsV36_10(a, b).matched).toBe(false)
  })
})
