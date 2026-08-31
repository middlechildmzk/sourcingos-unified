import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { compareSourceProfiles } from '@/lib/candidate-graph'
import { classifySourceResult } from '@/lib/entity-classification'
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

  it('creates automatic identity proposals only from deterministic anchors and never links profiles', () => {
    const service = read('lib/identity-proposal-service-v33-2.ts')
    const saveRoute = read('app/api/workbench/save-source-profile/route.ts')
    expect(service).toContain('!comparison.deterministicAnchor')
    expect(service).toContain('This function never links source profiles')
    expect(service).not.toContain(".update({ candidate_id:")
    expect(saveRoute).toContain('createDeterministicIdentityProposals')
    expect(saveRoute).toContain('nothing was merged automatically')
  })

  it('routes agentic GitHub and Stack Overflow through canonical source-result envelopes', () => {
    const route = read('app/api/agentic-search/route.ts')
    const plan = read('lib/agentic-search-v30.ts')
    expect(route).toContain('searchGitHubPeople')
    expect(route).toContain('searchStackOverflowTalent')
    expect(route).toContain("'github', 'stackoverflow'")
    expect(plan).toContain("surface: 'stackoverflow'")
    expect(plan).toContain("connectorKeys: ['stackoverflow']")
  })

  it('admits Stack Overflow skills only from observed top-answerer tags', () => {
    const observed = classifySourceResult(person({
      id: 'stackoverflow:42',
      source: 'stackoverflow',
      sourceProfileId: '42',
      skills: ['kubernetes', 'terraform', 'invented-query-term'],
      identitySignals: [
        { type: 'skill', value: 'kubernetes', weight: 3, source: 'stackoverflow' },
        { type: 'skill', value: 'invented-query-term', weight: 3, source: 'stackoverflow' },
      ],
      raw: { observedTags: ['kubernetes', 'terraform'] },
    }))
    expect(observed.skills).toEqual(['kubernetes', 'terraform'])
    expect(observed.identitySignals.some(signal => signal.value === 'invented-query-term')).toBe(false)

    const legacy = classifySourceResult(person({
      id: 'stackoverflow:99',
      source: 'stackoverflow',
      sourceProfileId: '99',
      skills: ['kubernetes'],
      raw: {},
    }))
    expect(legacy.skills).toEqual([])
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
      raw: { observedTags: [] },
    })

    const comparison = compareSourceProfiles(github, stackoverflow)
    expect(comparison.sameStableId).toBe(false)
    expect(comparison.deterministicAnchor).toBe(true)
    expect(comparison.blocked).toBe(false)
    expect(comparison.reasons).toContain('Shared personal domain jane.dev')
  })

  it('keeps a common-name resemblance non-deterministic without a cross-source anchor', () => {
    const github = person({ id: 'github:alex', source: 'github', sourceProfileId: 'alex' })
    const stackoverflow = person({ id: 'stackoverflow:99', source: 'stackoverflow', sourceProfileId: '99', raw: { observedTags: [] } })
    const comparison = compareSourceProfiles(github, stackoverflow)
    expect(comparison.reasons).toContain('Exact display-name match')
    expect(comparison.deterministicAnchor).toBe(false)
    expect(comparison.sameStableId).toBe(false)
  })
})
