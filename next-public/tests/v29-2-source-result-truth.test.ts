import { describe, expect, it } from 'vitest'
import { classifySourceResult, resolveStoredEntityKind } from '../lib/entity-classification'
import type { SourceName, SourceResult } from '../lib/source-types'

function sourceResult(source: SourceName, overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: `${source}:record-1`,
    source,
    sourceProfileId: 'record-1',
    entityKind: 'person',
    displayName: 'Alex Example',
    headline: 'Public source result',
    profileUrl: `https://example.com/${source}/record-1`,
    skills: ['kubernetes', 'terraform'],
    evidence: [],
    contactSignals: [
      {
        type: 'profile_url',
        value: `https://example.com/${source}/record-1`,
        source,
        verified: false,
        note: 'Public profile link.',
      },
    ],
    identitySignals: [
      { type: 'name', value: 'Alex Example', weight: 15, source },
      { type: 'skill', value: 'kubernetes', weight: 3, source },
    ],
    refreshedAt: '2026-07-29T00:00:00.000Z',
    raw: {},
    ...overrides,
  }
}

describe('source result truth boundary', () => {
  it('classifies arXiv and PubMed source objects as publications, not people', () => {
    expect(resolveStoredEntityKind({ source: 'arxiv', entityKind: 'person' })).toBe('publication')
    expect(resolveStoredEntityKind({ source: 'pubmed', entityKind: 'person' })).toBe('publication')

    const arxiv = classifySourceResult(sourceResult('arxiv', {
      raw: { title: 'A Reliable Systems Paper', url: 'https://arxiv.org/abs/1234' },
    }))

    expect(arxiv.entityKind).toBe('publication')
    expect(arxiv.displayName).toBe('A Reliable Systems Paper')
    expect(arxiv.headline).toContain('First listed author: Alex Example')
    expect(arxiv.skills).toEqual([])
    expect(arxiv.contactSignals).toEqual([])
  })

  it('does not treat a public profile URL as contact information', () => {
    const stackOverflow = classifySourceResult(sourceResult('stackoverflow', {
      contactSignals: [
        {
          type: 'profile_url',
          value: 'https://stackoverflow.com/users/123/alex',
          source: 'stackoverflow',
          verified: false,
          note: 'Public profile URL.',
        },
        {
          type: 'website',
          value: 'https://alex.example',
          source: 'stackoverflow',
          verified: false,
          note: 'Public website.',
        },
      ],
    }))

    expect(stackOverflow.contactSignals).toEqual([
      expect.objectContaining({ type: 'website', value: 'https://alex.example' }),
    ])
    expect(stackOverflow.profileUrl).toBe('https://example.com/stackoverflow/record-1')
  })

  it('removes recruiter query terms when the source did not observe candidate skills', () => {
    const stackOverflow = classifySourceResult(sourceResult('stackoverflow'))
    const semanticScholar = classifySourceResult(sourceResult('semantic_scholar'))

    expect(stackOverflow.skills).toEqual([])
    expect(semanticScholar.skills).toEqual([])
    expect(stackOverflow.identitySignals.some(signal => signal.type === 'skill')).toBe(false)
    expect(semanticScholar.identitySignals.some(signal => signal.type === 'skill')).toBe(false)
  })

  it('preserves source-observed OpenAlex concepts and NPI taxonomies', () => {
    const openAlex = classifySourceResult(sourceResult('openalex', {
      raw: {
        x_concepts: [
          { display_name: 'Distributed computing' },
          { display_name: 'Kubernetes' },
        ],
      },
    }))
    const npi = classifySourceResult(sourceResult('npi', {
      raw: {
        enumeration_type: 'NPI-1',
        basic: { first_name: 'Alex', last_name: 'Example' },
        taxonomies: [
          { desc: 'Registered Nurse' },
          { code: '163W00000X' },
        ],
      },
    }))

    expect(openAlex.skills).toEqual(['Distributed computing', 'Kubernetes'])
    expect(npi.entityKind).toBe('person')
    expect(npi.skills).toEqual(['Registered Nurse', '163W00000X'])
  })

  it('does not fall back to copied query terms when OpenAlex has no concepts', () => {
    const openAlex = classifySourceResult(sourceResult('openalex', { raw: {} }))
    expect(openAlex.skills).toEqual([])
  })
})
