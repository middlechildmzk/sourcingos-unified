import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildRoleCandidateReview,
  recordRoleCandidateFitDecision,
  recordRoleCandidateReviewSignal,
  recordRoleCandidateStage,
} from '../lib/role-candidate-review'
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

  it('records one auditable fit decision without advancing the pipeline', () => {
    const role = { ...workspace(), candidates: [candidate()] }
    const decidedAt = new Date('2026-07-29T17:00:00.000Z')
    const result = recordRoleCandidateFitDecision(role, 'candidate-1', 'strong_fit', decidedAt, 'activity-1')

    expect(result.changed).toBe(true)
    expect(result.reason).toBe('updated')
    expect(result.workspace.candidates[0].fitDecision).toBe('strong_fit')
    expect(result.workspace.candidates[0].stage).toBe('needs_review')
    expect(result.workspace.candidates[0].updatedAt).toBe(decidedAt.toISOString())
    expect(result.workspace.activity).toEqual([{
      id: 'activity-1',
      type: 'candidate_reviewed',
      message: 'Recorded strong fit for Ada Engineer.',
      createdAt: decidedAt.toISOString(),
    }])
  })

  it('does not create duplicate activity for the current decision', () => {
    const role = { ...workspace(), candidates: [{ ...candidate(), fitDecision: 'possible_fit' as const }] }
    const result = recordRoleCandidateFitDecision(role, 'candidate-1', 'possible_fit', new Date(), 'activity-2')

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('unchanged')
    expect(result.workspace).toBe(role)
    expect(result.workspace.activity).toEqual([])
  })

  it('fails closed when the candidate is not in the role', () => {
    const role = { ...workspace(), candidates: [candidate()] }
    const result = recordRoleCandidateFitDecision(role, 'missing', 'not_fit', new Date(), 'activity-3')

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('missing_candidate')
    expect(result.workspace).toBe(role)
  })

  it('records an explicit stage change without changing fit or triggering another action', () => {
    const role = { ...workspace(), candidates: [{ ...candidate(), fitDecision: 'strong_fit' as const }] }
    const changedAt = new Date('2026-07-29T18:00:00.000Z')
    const result = recordRoleCandidateStage(role, 'candidate-1', 'shortlisted', changedAt, 'stage-activity-1')

    expect(result.changed).toBe(true)
    expect(result.reason).toBe('updated')
    expect(result.workspace.candidates[0].stage).toBe('shortlisted')
    expect(result.workspace.candidates[0].fitDecision).toBe('strong_fit')
    expect(result.workspace.candidates[0].contactStatus).toBe('signals_found')
    expect(result.workspace.activity).toEqual([{
      id: 'stage-activity-1',
      type: 'stage_changed',
      message: 'Moved Ada Engineer from needs review to shortlisted.',
      createdAt: changedAt.toISOString(),
    }])
  })

  it('does not duplicate stage activity when the selected stage is current', () => {
    const role = { ...workspace(), candidates: [{ ...candidate(), stage: 'shortlisted' as const }] }
    const result = recordRoleCandidateStage(role, 'candidate-1', 'shortlisted', new Date(), 'stage-activity-2')

    expect(result.changed).toBe(false)
    expect(result.reason).toBe('unchanged')
    expect(result.workspace).toBe(role)
    expect(result.workspace.activity).toEqual([])
  })

  it('adds recruiter-authored fit rationale without changing decision or stage', () => {
    const role = { ...workspace(), candidates: [candidate()] }
    const addedAt = new Date('2026-07-29T19:00:00.000Z')
    const result = recordRoleCandidateReviewSignal(
      role,
      'candidate-1',
      'fit_reason',
      'Led AWS and Kubernetes modernization in a regulated environment.',
      addedAt,
      'note-1',
    )

    expect(result.changed).toBe(true)
    expect(result.reason).toBe('added')
    expect(result.workspace.candidates[0].fitReasons).toContain('Led AWS and Kubernetes modernization in a regulated environment.')
    expect(result.workspace.candidates[0].fitDecision).toBe('unreviewed')
    expect(result.workspace.candidates[0].stage).toBe('needs_review')
    expect(result.workspace.activity[0]).toMatchObject({
      id: 'note-1',
      type: 'note_added',
      createdAt: addedAt.toISOString(),
    })
  })

  it('adds concerns, rejects duplicates, and validates length', () => {
    const role = { ...workspace(), candidates: [candidate()] }
    const added = recordRoleCandidateReviewSignal(role, 'candidate-1', 'concern', 'Leadership scope needs verification.', new Date(), 'note-2')
    const duplicate = recordRoleCandidateReviewSignal(added.workspace, 'candidate-1', 'concern', ' leadership scope needs verification. ', new Date(), 'note-3')
    const invalid = recordRoleCandidateReviewSignal(role, 'candidate-1', 'fit_reason', 'x', new Date(), 'note-4')

    expect(added.reason).toBe('added')
    expect(added.workspace.candidates[0].concerns).toContain('Leadership scope needs verification.')
    expect(duplicate.reason).toBe('duplicate')
    expect(duplicate.workspace).toBe(added.workspace)
    expect(invalid.reason).toBe('invalid')
    expect(invalid.workspace).toBe(role)
  })

  it('renders role review ahead of generic Candidate 360 evidence and removes false score presentation', () => {
    const client = read('components/Candidate360Client.tsx')

    expect(client).toContain('<RoleSpecificCandidateReview roleId={roleId} candidateId={candidateId} />')
    expect(client.indexOf('<RoleSpecificCandidateReview')).toBeLessThan(client.indexOf('<section className="product-panel">'))
    expect(client).toContain('Coverage, not a fit score')
    expect(client).not.toContain('type Dossier = any')
    expect(client).not.toContain('Score {dossier.scores?.evidenceScore')
  })

  it('exposes explicit accessible fit decisions and states that stages do not advance automatically', () => {
    const reviewPanel = read('components/RoleSpecificCandidateReview.tsx')

    expect(reviewPanel).toContain("{ value: 'strong_fit', label: 'Strong fit' }")
    expect(reviewPanel).toContain("{ value: 'possible_fit', label: 'Possible fit' }")
    expect(reviewPanel).toContain("{ value: 'not_fit', label: 'Not fit' }")
    expect(reviewPanel).toContain('aria-pressed={candidate.fitDecision === option.value}')
    expect(reviewPanel).toContain('It does not verify identity, advance the pipeline, or trigger outreach.')
    expect(reviewPanel).toContain('No duplicate activity was created.')
  })

  it('requires explicit confirmation for pipeline stages and preserves fit and outreach boundaries', () => {
    const reviewPanel = read('components/RoleSpecificCandidateReview.tsx')

    expect(reviewPanel).toContain('aria-label="Select candidate pipeline stage"')
    expect(reviewPanel).toContain('Update stage')
    expect(reviewPanel).toContain('This does not change the fit decision, verify contact information, or send outreach.')
    expect(reviewPanel).toContain('Fit decision remains ${words(activeFitDecision)} and no outreach was triggered.')
    expect(reviewPanel).toContain('disabled={(pendingStage || candidate.stage) === candidate.stage}')
  })

  it('captures recruiter-authored rationale and concerns without treating them as evidence', () => {
    const reviewPanel = read('components/RoleSpecificCandidateReview.tsx')

    expect(reviewPanel).toContain('Add recruiter review context')
    expect(reviewPanel).toContain('<option value="fit_reason">Fit rationale</option>')
    expect(reviewPanel).toContain('<option value="concern">Concern</option>')
    expect(reviewPanel).toContain('does not become verified evidence or change the current decision automatically')
    expect(reviewPanel).toContain('maxLength={300}')
    expect(reviewPanel).toContain('No recruiter-authored fit rationale has been recorded yet.')
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
