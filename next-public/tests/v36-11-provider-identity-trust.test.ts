import { describe, expect, it } from 'vitest'
import { providerObservationToSourceResultV36_8 } from '@/lib/candidate-data/provider-observation-bridge-v36-8'
import { identityComparisonV36_10 } from '@/lib/identity-proposal-service-v33-2'
import type { SourceResult } from '@/lib/source-types'

function result(input: Partial<SourceResult> & Pick<SourceResult, 'source' | 'sourceProfileId' | 'displayName'>): SourceResult {
  return {
    id: `${input.source}:${input.sourceProfileId}`,
    entityKind: 'person',
    skills: [],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-09-03T00:00:00.000Z',
    ...input,
  }
}

describe('V36.11 provider identity trust boundary', () => {
  it('preserves provider-observed LinkedIn as provenance without promoting it to a source-native URL or weight-1 identity signal', () => {
    const source = providerObservationToSourceResultV36_8({
      provider: 'contactout',
      providerPersonId: 'example-person',
      displayName: 'Example Person',
      currentTitle: 'Platform Engineer',
      currentEmployer: 'Example Co',
      location: 'Washington, DC',
      skills: ['Linux'],
      profileUrls: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/example-person' }],
      contactAvailability: { email: true, phone: 'unknown' },
      observedAt: '2026-09-03T00:00:00.000Z',
    })

    expect(source.profileUrl).toBeUndefined()
    expect(source.contactSignals).toContainEqual(expect.objectContaining({
      type: 'profile_url',
      value: 'https://www.linkedin.com/in/example-person',
      verified: false,
    }))
    expect(source.identitySignals.some(signal => signal.type === 'source_url')).toBe(false)
    expect((source.raw as Record<string, unknown>)?.observedProfileUrls).toEqual([
      { kind: 'linkedin', url: 'https://www.linkedin.com/in/example-person' },
    ])
  })

  it('does not let matching LinkedIn URLs alone create deterministic cross-source identity authority', () => {
    const provider = result({
      source: 'contactout',
      sourceProfileId: 'example-person',
      displayName: 'Example Person',
      profileUrl: 'https://www.linkedin.com/in/example-person',
    })
    const resume = result({
      source: 'resume_xray',
      sourceProfileId: 'resume-1',
      displayName: 'Example Person',
      evidence: [{
        id: 'resume-link',
        label: 'Professional link',
        detail: 'Observed profile link',
        source: 'resume_xray',
        confidence: 'medium',
        url: 'https://linkedin.com/in/example-person',
        observedAt: '2026-09-03T00:00:00.000Z',
      }],
    })

    const comparison = identityComparisonV36_10(provider, resume)
    expect(comparison.deterministicAnchor).toBe(false)
    expect(comparison.deterministicRules.find(rule => rule.ruleId === 'explicit_cross_profile_link')?.passed).toBe(false)
    expect(comparison.deterministicRules.find(rule => rule.ruleId === 'shared_canonical_professional_profile')?.passed).toBe(false)
    expect(comparison.reasons).toContain('Exact display-name match')
  })

  it('still allows an independently observed public GitHub person profile to create a recruiter-review anchor', () => {
    const provider = result({
      source: 'people_data_labs',
      sourceProfileId: 'pdl-example',
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

    const comparison = identityComparisonV36_10(provider, github)
    expect(comparison.deterministicAnchor).toBe(true)
    expect(comparison.deterministicRules.find(rule => rule.ruleId === 'shared_canonical_professional_profile')?.passed).toBe(true)
  })
})
