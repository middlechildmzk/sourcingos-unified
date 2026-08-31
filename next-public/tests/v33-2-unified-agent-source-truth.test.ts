import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { compareSourceProfiles } from '@/lib/candidate-graph'
import type { SourceResult } from '@/lib/source-types'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

function person(overrides: Partial<SourceResult>): SourceResult {
  return {
    id: 'source-1',
    source: 'github',
    sourceProfileId: 'source-1',
    entityKind: 'person',
    displayName: 'Jane Engineer',
    skills: [],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-08-31T00:00:00.000Z',
    raw: { type: 'User' },
    ...overrides,
  }
}

describe('V33.2 unified agent source-truth boundary', () => {
  it('never promotes recruiter search skills into acquisition candidate skills', () => {
    const acquisition = read('lib/acquisition-v22.ts')
    expect(acquisition).toContain('role/search criteria may retrieve a person')
    expect(acquisition).not.toContain('skills: uniq(input.skills)')
    expect(acquisition).not.toContain('...input.skills])')
    expect(acquisition).toContain('skills: uniq((r.x_concepts || [])')
  })

  it('uses the proposal-only rich resolver in the live identity-review route', () => {
    const route = read('app/api/candidate-db/match-review/route.ts')
    expect(route).toContain('compareSourceProfiles')
    expect(route).not.toContain('scoreIdentityMatch')
    expect(route).toContain("version: 'v29.2.1-proposal-only'")
    expect(route).toContain('mergeAuthorized: false')
  })

  it('treats a shared observed personal domain as review evidence, never merge permission', () => {
    const github = person({
      id: 'github:jane',
      source: 'github',
      sourceProfileId: 'jane',
      profileUrl: 'https://github.com/jane',
      contactSignals: [{ type: 'website', value: 'https://jane.dev', source: 'github', verified: false, note: 'Public GitHub website.' }],
    })
    const stackoverflow = person({
      id: 'stackoverflow:42',
      source: 'stackoverflow',
      sourceProfileId: '42',
      profileUrl: 'https://stackoverflow.com/users/42/jane',
      contactSignals: [{ type: 'website', value: 'https://jane.dev/about', source: 'stackoverflow', verified: false, note: 'Public Stack Overflow website.' }],
      raw: {},
    })

    const comparison = compareSourceProfiles(github, stackoverflow)
    expect(comparison.sameStableId).toBe(false)
    expect(comparison.deterministicAnchor).toBe(true)
    expect(comparison.blocked).toBe(false)
    expect(comparison.reasons).toContain('Shared personal domain jane.dev')
  })

  it('keeps a common-name resemblance non-deterministic without a cross-source anchor', () => {
    const github = person({ id: 'github:alex', source: 'github', sourceProfileId: 'alex' })
    const stackoverflow = person({ id: 'stackoverflow:99', source: 'stackoverflow', sourceProfileId: '99', raw: {} })
    const comparison = compareSourceProfiles(github, stackoverflow)
    expect(comparison.reasons).toContain('Exact display-name match')
    expect(comparison.deterministicAnchor).toBe(false)
    expect(comparison.sameStableId).toBe(false)
  })
})
