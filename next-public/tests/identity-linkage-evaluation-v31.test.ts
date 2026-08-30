import { describe, expect, it } from 'vitest'
import { assessIdentityLinkage, evaluateIdentityLinkageCases, type IdentityBenchmarkCase, type IdentityLinkageRecord } from '@/lib/identity-linkage-evaluation'

const person = (id: string, overrides: Partial<IdentityLinkageRecord> = {}): IdentityLinkageRecord => ({
  id,
  entityKind: 'person',
  displayName: 'Jordan Rivera',
  organization: 'Example Systems',
  location: 'Denver, Colorado',
  headline: 'Platform Engineer',
  identifiers: [],
  ...overrides,
})

describe('V31 probabilistic identity-linkage evaluation', () => {
  it('uses exact observed identifiers as strong review anchors but never authorizes an automatic merge', () => {
    const assessment = assessIdentityLinkage(
      person('left', { identifiers: [{ type: 'orcid', value: '0000-0002-1825-0097', source: 'orcid' }] }),
      person('right', { displayName: 'Jordan M. Rivera', identifiers: [{ type: 'orcid', value: '0000-0002-1825-0097', source: 'publication bio' }] }),
    )
    expect(assessment.bucket).toBe('likely_same')
    expect(assessment.reviewProbability).toBeGreaterThanOrEqual(0.8)
    expect(assessment.exactAnchors.some(value => value.startsWith('orcid:'))).toBe(true)
    expect(assessment.reviewRequired).toBe(true)
    expect(assessment.mayAutoMerge).toBe(false)
  })

  it('treats conflicting authoritative identifiers as a blocking conflict', () => {
    const assessment = assessIdentityLinkage(
      person('left', { identifiers: [{ type: 'npi', value: '1234567890' }] }),
      person('right', { identifiers: [{ type: 'npi', value: '9999999999' }] }),
    )
    expect(assessment.bucket).toBe('blocked_conflict')
    expect(assessment.blockingConflicts).toContainEqual(expect.objectContaining({ field: 'npi' }))
    expect(assessment.mayAutoMerge).toBe(false)
  })

  it('keeps a common-name and same-organization pair ambiguous without an explicit anchor', () => {
    const assessment = assessIdentityLinkage(
      person('left', { displayName: 'John Smith', organization: 'Acme Corporation', location: 'New York' }),
      person('right', { displayName: 'John Smith', organization: 'Acme Corporation', location: 'New York' }),
    )
    expect(assessment.bucket).toBe('ambiguous')
    expect(assessment.exactAnchors).toEqual([])
    expect(assessment.explanation).toContain('human identity review')
  })

  it('normalizes diacritics and missing middle names only as review signals', () => {
    const assessment = assessIdentityLinkage(
      person('left', { displayName: 'José Álvarez', profileUrl: 'https://example.org/people/jose-alvarez' }),
      person('right', { displayName: 'Jose M. Alvarez', profileUrl: 'https://example.org/people/jose-alvarez/' }),
    )
    expect(assessment.bucket).toBe('likely_same')
    expect(assessment.components.find(item => item.key === 'name')?.similarity).toBeGreaterThan(0.7)
    expect(assessment.mayAutoMerge).toBe(false)
  })

  it('blocks publications and artifacts from being linked as people', () => {
    const assessment = assessIdentityLinkage(
      person('person'),
      { id: 'publication', entityKind: 'publication', displayName: 'Jordan Rivera' },
    )
    expect(assessment.bucket).toBe('blocked_conflict')
    expect(assessment.blockingConflicts[0]?.field).toBe('entity_kind')
  })

  it('does not use protected-class or demographic features in linkage components', () => {
    const assessment = assessIdentityLinkage(person('left'), person('right'))
    expect(assessment.components.map(item => item.key)).toEqual([
      'explicit_identifier', 'profile_url', 'name', 'organization', 'location', 'headline',
    ])
    expect(JSON.stringify(assessment)).not.toMatch(/gender|race|ethnic|religion|age|disability|sexual/i)
  })

  it('reports synthetic benchmark behavior without claiming production accuracy', () => {
    const cases: IdentityBenchmarkCase[] = [
      {
        id: 'same-orcid',
        expected: 'same',
        left: person('a1', { identifiers: [{ type: 'orcid', value: '0000-0001-1111-1111' }] }),
        right: person('a2', { identifiers: [{ type: 'orcid', value: '0000-0001-1111-1111' }] }),
      },
      {
        id: 'different-orcid',
        expected: 'different',
        left: person('b1', { identifiers: [{ type: 'orcid', value: '0000-0001-2222-2222' }] }),
        right: person('b2', { identifiers: [{ type: 'orcid', value: '0000-0001-3333-3333' }] }),
      },
      {
        id: 'common-name',
        expected: 'ambiguous',
        left: person('c1', { displayName: 'Maria Garcia' }),
        right: person('c2', { displayName: 'Maria Garcia' }),
      },
    ]
    const report = evaluateIdentityLinkageCases(cases)
    expect(report.cases).toBe(3)
    expect(report.falsePositiveRate).toBe(0)
    expect(report.note).toContain('not production identity-accuracy claims')
  })
})
