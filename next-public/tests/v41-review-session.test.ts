import { describe, expect, it } from 'vitest'
import type { RequirementAssessment } from '@/lib/requirement-assessment-v32'
import type { RoleCandidate, RoleWorkspace } from '@/lib/role-workspace'
import {
  applyReviewDecisionV41,
  createReviewSessionSnapshotV41,
  displayRequirementStateV41,
  firstUndecidedReviewIndexV41,
  fitDecisionForReviewDecisionV41,
  requirementStateLabelV41,
  undoReviewDecisionV41,
} from '@/lib/review/session-v41'

const NOW = '2026-09-05T18:00:00.000Z'

function candidate(id: string, fitDecision: RoleCandidate['fitDecision'] = 'unreviewed'): RoleCandidate {
  return {
    id,
    candidateId: `candidate-${id}`,
    name: `Candidate ${id}`,
    headline: 'Engineer',
    company: 'Example',
    location: 'Maryland',
    source: 'test',
    stage: 'needs_review',
    fitDecision,
    fitReasons: [],
    concerns: [],
    tags: [],
    contactStatus: 'unknown',
    evidenceStatus: 'unreviewed',
    addedAt: NOW,
    updatedAt: NOW,
  }
}

function role(candidates: RoleCandidate[]): RoleWorkspace {
  return {
    id: 'role-1',
    status: 'active',
    intake: {
      title: 'RHEL Administrator',
      location: 'Annapolis Junction, MD',
      workMode: 'onsite',
      compensation: '',
      clearance: 'Secret or higher',
      mustHaves: ['RHEL', '5+ years Linux administration'],
      niceToHaves: ['Ansible'],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: '',
    },
    searchLanes: [],
    candidates,
    activity: [],
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function clearanceAssessment(state: RequirementAssessment['state']): RequirementAssessment {
  return {
    requirementId: 'clearance',
    requirementText: 'Secret or higher',
    tier: 'must_have',
    kind: 'clearance',
    state,
    claims: [],
    strongestSourceType: 'authoritative_registry',
    spans: [],
    contradictions: [],
    recruiterContext: [],
    rationale: 'Synthetic fixture.',
  }
}

describe('V41 review session', () => {
  it('takes a stable bounded snapshot of only undecided candidates', () => {
    const candidates = Array.from({ length: 30 }, (_, index) => candidate(String(index + 1), index === 0 ? 'strong_fit' : 'unreviewed'))
    const snapshot = createReviewSessionSnapshotV41(role(candidates))
    expect(snapshot.candidateIds).toHaveLength(25)
    expect(snapshot.candidateIds).not.toContain('1')
    expect(snapshot.candidateIds[0]).toBe('2')
  })

  it('resumes at the first undecided candidate in the original session order', () => {
    const workspace = role([candidate('a', 'strong_fit'), candidate('b', 'not_fit'), candidate('c'), candidate('d')])
    const snapshot = { roleId: workspace.id, candidateIds: ['a', 'b', 'c', 'd'], createdAt: NOW }
    expect(firstUndecidedReviewIndexV41(workspace, snapshot)).toBe(2)
  })

  it('never renders a public clearance requirement as supported or verified', () => {
    const assessment = clearanceAssessment('supported')
    expect(displayRequirementStateV41(assessment)).toBe('needs_verification')
    const label = requirementStateLabelV41(assessment)
    expect(label).toBe('Unverified clearance breadcrumb')
    expect(label.toLowerCase()).not.toBe('verified clearance')
    expect(label.toLowerCase()).not.toBe('clearance verified')
  })

  it('maps recruiter decisions without moving the pipeline stage', () => {
    const workspace = role([candidate('a')])
    const result = applyReviewDecisionV41(workspace, 'a', 'evidence_fit', new Date('2026-09-05T18:01:00Z'))
    expect(result.role.candidates[0].fitDecision).toBe('strong_fit')
    expect(result.role.candidates[0].stage).toBe('needs_review')
    expect(result.role.candidates[0].evidenceStatus).toBe('reviewed')
    expect(fitDecisionForReviewDecisionV41('needs_verification')).toBe('possible_fit')
  })

  it('undo restores the previous review state', () => {
    const workspace = role([candidate('a')])
    const applied = applyReviewDecisionV41(workspace, 'a', 'not_fit')
    expect(applied.mutation).not.toBeNull()
    const restored = undoReviewDecisionV41(applied.role, applied.mutation!)
    expect(restored.candidates[0].fitDecision).toBe('unreviewed')
    expect(restored.candidates[0].evidenceStatus).toBe('unreviewed')
    expect(restored.candidates[0].stage).toBe('needs_review')
  })
})
