import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRoleCandidateReview } from '../lib/role-candidate-review'
import type { RoleCandidate, RoleWorkspace } from '../lib/role-workspace'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const now = '2026-07-29T17:00:00.000Z'

function roleWithAws(): RoleWorkspace {
  return {
    id: 'role-aws',
    status: 'active',
    intake: {
      title: 'Cloud Engineer',
      location: 'Remote US',
      workMode: 'remote',
      compensation: 'Not specified',
      clearance: 'Not specified',
      mustHaves: ['AWS'],
      niceToHaves: [],
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

function candidateWithSignals(signals: string[]): RoleCandidate {
  return {
    id: 'candidate-aws',
    candidateId: 'candidate-aws',
    name: 'Cloud Candidate',
    headline: 'Cloud Engineer',
    company: 'Example Cloud',
    location: 'Remote US',
    source: 'github',
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: signals,
    concerns: [],
    tags: [],
    contactStatus: 'unknown',
    evidenceStatus: 'unreviewed',
    addedAt: now,
    updatedAt: now,
  }
}

describe('V29.1 candidate truth guards', () => {
  it('does not treat a substring inside an unrelated word as requirement support', () => {
    const falsePositive = buildRoleCandidateReview(roleWithAws(), candidateWithSignals(['Draws architecture diagrams']))
    const supported = buildRoleCandidateReview(roleWithAws(), candidateWithSignals(['Led AWS architecture modernization']))

    expect(falsePositive.supportedMustHaves).toEqual([])
    expect(falsePositive.unconfirmedMustHaves).toEqual(['AWS'])
    expect(supported.supportedMustHaves).toEqual(['AWS'])
    expect(supported.unconfirmedMustHaves).toEqual([])
  })

  it('removes the false-precision evidence score from the dossier contract and Supabase response', () => {
    const dossier = read('lib/candidate-dossier.ts')
    const route = read('app/api/candidate-db/360/[id]/route.ts')

    expect(dossier).not.toContain('evidenceScore')
    expect(route).not.toContain('const evidenceScore')
    expect(route).not.toContain('scores: { bestContactScore, openToWorkScore, evidenceScore }')
    expect(route).toContain('contacts: contactsWithScore')
    expect(route).toContain('openToWorkSignals: otwWithScore')
  })
})
