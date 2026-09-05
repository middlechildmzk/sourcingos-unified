import { describe, expect, it } from 'vitest'
import {
  classifySourceResult,
  resolveStoredEntityKind,
} from '../lib/entity-classification'
import type { SourceResult } from '../lib/source-types'

function orcidResult(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'orcid:0009-0000-4164-7159',
    source: 'orcid',
    sourceProfileId: '0009-0000-4164-7159',
    entityKind: 'person',
    displayName: '0009-0000-4164-7159',
    headline: 'ORCID public researcher identity match.',
    profileUrl: 'https://orcid.org/0009-0000-4164-7159',
    skills: ['kubernetes', 'terraform'],
    evidence: [],
    contactSignals: [],
    identitySignals: [
      {
        type: 'source_url',
        value: 'https://orcid.org/0009-0000-4164-7159',
        weight: 10,
        source: 'orcid',
      },
      {
        type: 'skill',
        value: 'kubernetes',
        weight: 3,
        source: 'orcid',
      },
    ],
    refreshedAt: '2026-07-29T00:00:00.000Z',
    raw: {
      'orcid-identifier': {
        path: '0009-0000-4164-7159',
      },
    },
    ...overrides,
  }
}

describe('ORCID identity hygiene', () => {
  it('does not trust source type or a client-supplied entity kind when only an identifier is present', () => {
    expect(resolveStoredEntityKind({
      source: 'orcid',
      entityKind: 'person',
      raw: {
        'orcid-identifier': { path: '0009-0000-4164-7159' },
      },
    })).toBe('unknown')
  })

  it('keeps identifier-only ORCID records out of candidate results and removes query-derived skills', () => {
    const classified = classifySourceResult(orcidResult())

    expect(classified.entityKind).toBe('unknown')
    expect(classified.displayName).toBe('Unresolved ORCID identity')
    expect(classified.headline).toContain('no public person name was resolved')
    expect(classified.skills).toEqual([])
    expect(classified.identitySignals).toEqual([
      expect.objectContaining({ type: 'source_url' }),
    ])
  })

  it('recognizes an ORCID record as a person only when public name fields are present', () => {
    const raw = {
      'orcid-identifier': { path: '0000-0002-1825-0097' },
      'given-names': 'Josiah',
      'family-names': 'Carberry',
    }

    expect(resolveStoredEntityKind({ source: 'orcid', raw })).toBe('person')

    const classified = classifySourceResult(orcidResult({
      sourceProfileId: '0000-0002-1825-0097',
      displayName: 'Josiah Carberry',
      raw,
      skills: [],
    }))

    expect(classified.entityKind).toBe('person')
    expect(classified.displayName).toBe('Josiah Carberry')
  })
})
