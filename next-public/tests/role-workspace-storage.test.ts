import { describe, expect, it } from 'vitest'
import { roleCandidateIdentityKey } from '@/lib/role-workspace-storage'

describe('role candidate handoff identity', () => {
  it('prefers a normalized source URL for duplicate protection', () => {
    expect(roleCandidateIdentityKey({
      name: 'Jordan Rivera',
      company: 'Acme',
      source: 'github',
      sourceUrl: ' HTTPS://GITHUB.COM/JRIVERA ',
    })).toBe('url:https://github.com/jrivera')
  })

  it('uses a canonical candidate id when no source URL exists', () => {
    expect(roleCandidateIdentityKey({
      candidateId: '11111111-1111-4111-8111-111111111111',
      name: 'Jordan Rivera',
      source: 'candidate_database',
    })).toBe('candidate:11111111-1111-4111-8111-111111111111')
  })

  it('falls back to normalized name, company, and source without claiming a merge', () => {
    expect(roleCandidateIdentityKey({
      name: ' Jordan Rivera ',
      company: ' Acme AI ',
      source: ' Network Import ',
    })).toBe('profile:jordan rivera|acme ai|network import')
  })
})
