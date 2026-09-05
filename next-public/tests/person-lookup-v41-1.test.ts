import { describe, expect, it } from 'vitest'
import {
  classifyKnownPersonLookupV41_1,
  exactIdentifierQueryParamV41_1,
  liveKnownPersonSearchPayloadV41_1,
} from '@/lib/person-lookup-v41-1'

describe('V41.1 known-person lookup routing', () => {
  it('treats email as an exact identifier and never converts it into fuzzy live people search', () => {
    const email = 'Recruiter.Test+identity@example.com'
    expect(classifyKnownPersonLookupV41_1(email)).toEqual({
      kind: 'email',
      normalized: 'recruiter.test+identity@example.com',
      exact: true,
    })
    expect(exactIdentifierQueryParamV41_1(email)).toBe('recruiter.test+identity@example.com')
    expect(liveKnownPersonSearchPayloadV41_1(email)).toBeNull()
  })

  it('treats profile URLs as exact identifiers and never substitutes unrelated people', () => {
    const url = 'https://github.com/example-person#readme'
    const classified = classifyKnownPersonLookupV41_1(url)
    expect(classified.kind).toBe('profile_url')
    expect(classified.exact).toBe(true)
    expect(classified.normalized).toBe('https://github.com/example-person')
    expect(liveKnownPersonSearchPayloadV41_1(url)).toBeNull()
  })

  it('sends a clear person name as an explicit name anchor', () => {
    expect(liveKnownPersonSearchPayloadV41_1('Jane Q Doe')).toEqual({
      query: 'Jane Q Doe',
      names: ['Jane Q Doe'],
      limit: 12,
      highFreshness: false,
    })
  })

  it('keeps broader professional context as discovery intent rather than identity authority', () => {
    const payload = liveKnownPersonSearchPayloadV41_1('Jane Doe at Acme')
    expect(payload).toEqual({
      query: 'Jane Doe at Acme',
      limit: 12,
      highFreshness: false,
    })
  })
})
