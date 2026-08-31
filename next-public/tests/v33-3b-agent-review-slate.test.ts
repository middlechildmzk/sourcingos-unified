import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  buildRoleReviewSlateCandidates,
  mergeReviewSlateDiscoveries,
  previewDeterministicIdentityReviews,
  reviewSlateDiscoveryKey,
  saveEligibleReviewSlateDiscoveries,
  type ReviewSlateDiscovery,
  type SavedSlateDiscovery,
} from '@/lib/agent-review-slate-v33-3'
import type { SourceResult } from '@/lib/source-types'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

function source(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'github:jane',
    source: 'github',
    sourceProfileId: 'jane',
    entityKind: 'person',
    displayName: 'Jane Engineer',
    skills: ['go'],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-08-31T00:00:00.000Z',
    raw: { type: 'User' },
    ...overrides,
  }
}

function discovery(overrides: Partial<ReviewSlateDiscovery> = {}): ReviewSlateDiscovery {
  const sourceResult = overrides.sourceResult || source()
  return {
    sourceKey: 'github',
    sourceId: sourceResult.sourceProfileId,
    sourceUrl: sourceResult.profileUrl,
    displayName: sourceResult.displayName,
    headline: sourceResult.headline,
    organization: sourceResult.organization,
    location: sourceResult.location,
    evidence: [],
    identityConfidence: 70,
    profileQuality: 70,
    saveEligible: true,
    sourceResult,
    ...overrides,
  }
}

describe('V33.3B recruiter-controlled review slate', () => {
  it('dedupes exact source records without pretending cross-source identities are the same person', () => {
    const first = discovery()
    const refreshed = discovery({ headline: 'Platform engineer' })
    const stack = discovery({
      sourceKey: 'stackoverflow',
      sourceId: '42',
      sourceResult: source({ id: 'stackoverflow:42', source: 'stackoverflow', sourceProfileId: '42', raw: { observedTags: ['go'] } }),
    })
    const merged = mergeReviewSlateDiscoveries([first], [refreshed, stack])
    expect(merged).toHaveLength(2)
    expect(merged.find(item => reviewSlateDiscoveryKey(item) === 'github:jane')?.headline).toBe('Platform engineer')
    expect(merged.some(item => reviewSlateDiscoveryKey(item) === 'stackoverflow:42')).toBe(true)
  })

  it('only admits save-eligible person records into the review-slate persistence set', () => {
    const person = discovery()
    const previewOnly = discovery({ sourceKey: 'orcid', sourceId: '0000-1', saveEligible: false })
    const nonPerson = discovery({
      sourceId: 'repo-1',
      sourceResult: source({ id: 'repo-1', sourceProfileId: 'repo-1', entityKind: 'organization' }),
    })
    expect(saveEligibleReviewSlateDiscoveries([person, previewOnly, nonPerson])).toEqual([person])
  })

  it('previews deterministic cross-source identity review without granting merge permission', () => {
    const github = discovery({
      sourceResult: source({ contactSignals: [{ type: 'website', value: 'https://jane.dev', source: 'github', verified: false }] }),
    })
    const stack = discovery({
      sourceKey: 'stackoverflow',
      sourceId: '42',
      sourceResult: source({
        id: 'stackoverflow:42',
        source: 'stackoverflow',
        sourceProfileId: '42',
        contactSignals: [{ type: 'website', value: 'https://jane.dev/about', source: 'stackoverflow', verified: false }],
        raw: { observedTags: [] },
      }),
    })
    const previews = previewDeterministicIdentityReviews([github, stack])
    expect(previews).toHaveLength(1)
    expect(previews[0].reasons).toContain('Shared personal domain jane.dev')
  })

  it('keeps common-name cross-source records separate without a deterministic anchor', () => {
    const github = discovery({ displayName: 'Alex Kim', sourceResult: source({ displayName: 'Alex Kim', location: 'Seattle' }) })
    const stack = discovery({
      sourceKey: 'stackoverflow',
      sourceId: '99',
      displayName: 'Alex Kim',
      sourceResult: source({ id: 'stackoverflow:99', source: 'stackoverflow', sourceProfileId: '99', displayName: 'Alex Kim', location: 'Boston', raw: { observedTags: [] } }),
    })
    expect(previewDeterministicIdentityReviews([github, stack])).toEqual([])
  })

  it('creates canonical role entries only as needs-review and unreviewed', () => {
    const saved: SavedSlateDiscovery[] = [{ discovery: discovery(), candidateId: 'candidate-1', candidateUrl: '/app/candidate/candidate-1', reused: false }]
    const candidates = buildRoleReviewSlateCandidates(saved, [], '2026-08-31T12:00:00.000Z', () => 'role-candidate-1')
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      id: 'role-candidate-1',
      candidateId: 'candidate-1',
      stage: 'needs_review',
      fitDecision: 'unreviewed',
      evidenceStatus: 'unreviewed',
      fitReasons: [],
      concerns: [],
    })
  })

  it('does not duplicate an existing canonical candidate in the same role', () => {
    const saved: SavedSlateDiscovery[] = [{ discovery: discovery(), candidateId: 'candidate-1', candidateUrl: '/app/candidate/candidate-1', reused: true }]
    expect(buildRoleReviewSlateCandidates(saved, ['candidate-1'])).toEqual([])
  })

  it('runs only recruiter-approved hypotheses and requires an explicit review-slate save', () => {
    const component = read('components/RoleSourcingAgentV33_3.tsx')
    expect(component).toContain("lane.status === 'approved'")
    expect(component).toContain('shouldExecuteSearch(nextAttempts')
    expect(component).toContain("fetch('/api/agentic-search'")
    expect(component).toContain("fetch('/api/workbench/save-source-profile'")
    expect(component).toContain('Create review slate')
    expect(component).toContain('No candidate was shortlisted, rejected, merged across sources, or contacted.')
    expect(component).not.toContain("fitDecision: 'strong_fit'")
    expect(component).not.toContain("fitDecision: 'not_fit'")
  })

  it('keeps the consequential role-candidate state contract in the pure builder', () => {
    const builder = read('lib/agent-review-slate-v33-3.ts')
    expect(builder).toContain("stage: 'needs_review'")
    expect(builder).toContain("fitDecision: 'unreviewed'")
    expect(builder).toContain("evidenceStatus: 'unreviewed'")
    expect(builder).not.toContain("fitDecision: 'strong_fit'")
    expect(builder).not.toContain("fitDecision: 'not_fit'")
  })

  it('makes the batch agent primary while preserving advanced source inspection', () => {
    const page = read('app/app/roles/[id]/page.tsx')
    expect(page.indexOf('<RoleSourcingAgentV33_3')).toBeLessThan(page.indexOf('<RoleAgenticSearchPanel'))
    expect(page).toContain('<details className="agentic-advanced-v33">')
    expect(page).toContain('Advanced research strategy and individual source inspection')
  })
})
