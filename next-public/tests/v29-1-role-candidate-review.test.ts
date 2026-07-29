import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRoleCandidateReview } from '../lib/role-candidate-review'
import type { RoleCandidate, RoleWorkspace } from '../lib/role-workspace'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const now = '2026-07-29T16:00:00.000Z'

function workspace(): RoleWorkspace {
  return {
    id: 'role-platform',
    status: 'active',
    intake: {
      title: 'Platform Engineer',
      location: 'Remote US',
      workMode: 'remote',
      compensation: 'Not specified',
      clearance: 'Secret',
      mustHaves: ['Kubernetes', 'Terraform', 'AWS'],
      niceToHaves: ['Python'],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: '',
    },
    searchLanes: [],
    candidates: [],
    activity: [],
    createdAt: now,
    updatedAt: now,
  }
}

function candidate(): RoleCandidate {
  return {
    id: 'candidate-1',
    candidateId: 'candidate-1',
    name: 'Ada Engineer',
    headline: 'Platform Engineer',
    company: 'Example Cloud',
    location: 'Remote US',
    source: 'github',
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: ['Strong Kubernetes production ownership'],
    concerns: ['AWS depth is not yet supported.'],
    tags: ['Terraform', 'Python'],
    contactStatus: 'signals_found',
    evidenceStatus: 'unreviewed',
    addedAt: now,
    updatedAt: now,
  }
}

describe('V29.1 role-specific Candidate 360 review', () => {
  it('separates supported and unconfirmed role requirements without creating a fit score', () => {
    const review = buildRoleCandidateReview(workspace(), candidate())

    expect(review.supportedMustHaves).toEqual(['Kubernetes', 'Terraform'])
    expect(review.unconfirmedMustHaves).toEqual(['AWS'])
    expect(review.supportedNiceToHaves).toEqual(['Python'])
    expect(review.unconfirmedNiceToHaves).toEqual([])
    expect(review.summary).toContain('2 of 3 must-have requirements')
    expect(review.summary).toContain('not independent verification')
  })

  it('builds transparent verification work from missing requirements and review state', () => {
    const review = buildRoleCandidateReview(workspace(), candidate())

    expect(review.concerns).toEqual(['AWS depth is not yet supported.'])
    expect(review.verifyNext).toContain('Verify AWS.')
    expect(review.verifyNext).toContain('Review the underlying evidence before making a role-fit decision.')
    expect(review.verifyNext).toContain('Verify any contact path and permission before outreach.')
    expect(review.verifyNext).toContain('Confirm Secret only through the appropriate authorized process.')
    expect(review.verifyNext).toContain('Record a recruiter-controlled fit decision in the role review queue.')
  })

  it('renders role review ahead of generic Candidate 360 evidence and removes false score presentation', () => {
    const client = read('components/Candidate360Client.tsx')

    expect(client).toContain('<RoleSpecificCandidateReview roleId={roleId} candidateId={candidateId} />')
    expect(client.indexOf('<RoleSpecificCandidateReview')).toBeLessThan(client.indexOf('<section className="product-panel">'))
    expect(client).toContain('Coverage, not a fit score')
    expect(client).not.toContain('type Dossier = any')
    expect(client).not.toContain('Score {dossier.scores?.evidenceScore')
  })

  it('fails closed when any related Candidate 360 query fails', () => {
    const route = read('app/api/candidate-db/360/[id]/route.ts')

    expect(route).toContain("error: 'Candidate dossier relationships could not be loaded.'")
    expect(route).toContain('failedSections')
    expect(route).toContain('{ status: 502 }')
    expect(route).toContain("{ section: 'sourceProfiles', error: spRes.error }")
    expect(route).toContain("{ section: 'projectCandidates', error: pcRes.error }")
  })
})
