import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildRoleReviewSlateCandidates,
  evidenceBearingFirstReviewBatch,
  mergeReviewSlateDiscoveries,
  previewDeterministicIdentityReviews,
  reviewSlateDiscoveryKey,
  saveEligibleReviewSlateDiscoveries,
  type ReviewSlateDiscovery,
  type SavedSlateDiscovery,
} from '@/lib/agent-review-slate-v33-3'
import type { RoleIntake } from '@/lib/role-workspace'
import type { SourceResult } from '@/lib/source-types'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function source(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'github:alex',
    source: 'github',
    sourceProfileId: 'alex',
    entityKind: 'person',
    displayName: 'Alex Kim',
    headline: 'Platform Engineer',
    location: 'Austin, TX',
    profileUrl: 'https://github.com/alex',
    skills: ['Kubernetes', 'Terraform'],
    evidence: [{ id: 'ev-1', label: 'Public skill evidence', detail: 'Kubernetes and Terraform', source: 'github', confidence: 'high', observedAt: '2026-08-31T12:00:00.000Z' }],
    contactSignals: [],
    identitySignals: [{ type: 'source_url', value: 'https://github.com/alex', weight: 1, source: 'github' }],
    refreshedAt: '2026-08-31T12:00:00.000Z',
    raw: {},
    ...overrides,
  }
}

function discovery(overrides: Partial<ReviewSlateDiscovery> = {}): ReviewSlateDiscovery {
  const result = overrides.sourceResult || source()
  return {
    sourceKey: result.source as ReviewSlateDiscovery['sourceKey'],
    sourceId: result.sourceProfileId,
    sourceUrl: result.profileUrl,
    displayName: result.displayName,
    headline: result.headline,
    organization: result.organization,
    location: result.location,
    evidence: result.evidence.map(item => ({ kind: 'source_evidence', label: item.label, value: item.detail, url: item.url, observedAt: item.observedAt })),
    identityConfidence: 80,
    profileQuality: 80,
    saveEligible: true,
    sourceResult: result,
    ...overrides,
  }
}

const intake: RoleIntake = {
  title: 'Platform Engineer',
  location: 'Austin, TX',
  workMode: 'hybrid',
  compensation: 'Not specified',
  clearance: 'Not specified',
  mustHaves: ['Kubernetes'],
  niceToHaves: ['Terraform'],
  disqualifiers: [],
  targetCompanies: [],
  adjacentBackgrounds: [],
  hiringManagerNotes: '',
  rawDescription: '',
}

describe('V33.3B recruiter-controlled review slate', () => {
  it('builds a small evidence-bearing first batch without treating held discoveries as rejected', () => {
    const relevant = discovery()
    const irrelevant = discovery({
      sourceId: 'designer',
      displayName: 'Design Person',
      headline: 'Product Designer',
      evidence: [{ kind: 'source_evidence', label: 'Public profile', value: 'Figma product design' }],
      sourceResult: source({
        id: 'github:designer', sourceProfileId: 'designer', displayName: 'Design Person', headline: 'Product Designer',
        skills: ['Figma'], evidence: [], identitySignals: [{ type: 'source_url', value: 'https://github.com/designer', weight: 1, source: 'github' }],
      }),
    })
    const result = evidenceBearingFirstReviewBatch([irrelevant, relevant], intake, 12)
    expect(result.batch).toEqual([relevant])
    expect(result.checks.find(item => item.discovery === irrelevant)?.admitted).toBe(false)
    expect(result.checks.find(item => item.discovery === irrelevant)?.explanation).toContain('no observed role-relevant')
  })

  it('caps the first review batch without silently discarding held discoveries', () => {
    const people = Array.from({ length: 20 }, (_, index) => discovery({
      sourceId: `person-${index}`,
      displayName: `Person ${index}`,
      sourceResult: source({ id: `github:person-${index}`, sourceProfileId: `person-${index}`, displayName: `Person ${index}` }),
    }))
    const result = evidenceBearingFirstReviewBatch(people, intake, 12)
    expect(result.batch).toHaveLength(12)
    expect(result.checks).toHaveLength(20)
  })

  it('deduplicates source discoveries by stable source profile key', () => {
    const first = discovery()
    const updated = discovery({ headline: 'Senior Platform Engineer' })
    const merged = mergeReviewSlateDiscoveries([first], [updated])
    expect(merged).toHaveLength(1)
    expect(merged[0].headline).toBe('Senior Platform Engineer')
    expect(reviewSlateDiscoveryKey(merged[0])).toBe('github:alex')
  })

  it('keeps only explicitly person/save-eligible records at the Candidate Graph save boundary', () => {
    const person = discovery()
    const artifact = discovery({ sourceId: 'artifact', sourceResult: source({ id: 'github:artifact', sourceProfileId: 'artifact', entityKind: 'artifact' }) })
    const blocked = discovery({ sourceId: 'blocked', saveEligible: false, sourceResult: source({ id: 'github:blocked', sourceProfileId: 'blocked' }) })
    expect(saveEligibleReviewSlateDiscoveries([person, artifact, blocked])).toEqual([person])
  })

  it('previews only deterministic cross-source identity anchors and never merges them', () => {
    const github = discovery({
      sourceResult: source({ identitySignals: [{ type: 'email', value: 'alex@example.com', weight: 1, source: 'github' }] }),
    })
    const stack = discovery({
      sourceKey: 'stackoverflow',
      sourceId: '99',
      displayName: 'Alex Kim',
      sourceResult: source({ id: 'stackoverflow:99', source: 'stackoverflow', sourceProfileId: '99', displayName: 'Alex Kim', identitySignals: [{ type: 'email', value: 'alex@example.com', weight: 1, source: 'stackoverflow' }], raw: { observedTags: [] } }),
    })
    expect(previewDeterministicIdentityReviews([github, stack])).toHaveLength(1)
  })

  it('does not propose a merge from name/location similarity alone', () => {
    const github = discovery({
      sourceResult: source({ identitySignals: [{ type: 'name', value: 'Alex Kim', weight: 0.5, source: 'github' }, { type: 'location', value: 'Boston', weight: 0.2, source: 'github' }] }),
    })
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
    expect(component).toMatch(/no candidate was shortlisted, rejected, merged across sources, or contacted\./i)
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
    const component = read('components/RoleSourcingAgentV33_3.tsx')
    expect(component).toContain('Run sourcing agent')
    expect(component).toContain('Review hypotheses')
    expect(component).toContain('sourceStatus')
  })
})
