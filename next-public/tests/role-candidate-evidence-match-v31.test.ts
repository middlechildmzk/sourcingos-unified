import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { CandidateDossier } from '@/lib/candidate-dossier'
import { buildCandidateRoleEvidenceAnalysis } from '@/lib/role-candidate-evidence-match'
import type { RoleCandidate, RoleWorkspace } from '@/lib/role-workspace'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

function candidate(overrides: Partial<RoleCandidate> = {}): RoleCandidate {
  return {
    id: 'role-candidate-1',
    candidateId: 'candidate-1',
    name: 'Jordan Example',
    headline: 'Platform Engineer',
    company: 'Example Systems',
    location: 'Remote US',
    source: 'candidate_graph',
    sourceUrl: 'https://example.org/profile',
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: [],
    concerns: [],
    tags: [],
    contactStatus: 'unknown',
    evidenceStatus: 'reviewed',
    addedAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
    ...overrides,
  }
}

function role(overrides: Partial<RoleWorkspace['intake']> = {}, roleCandidate = candidate()): RoleWorkspace {
  return {
    id: 'role-1',
    status: 'active',
    intake: {
      title: 'Platform Engineer',
      location: 'United States',
      workMode: 'remote',
      compensation: 'Not specified',
      clearance: 'Secret',
      mustHaves: ['AWS', 'Kubernetes', 'Terraform'],
      niceToHaves: ['Python'],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: '',
      ...overrides,
    },
    searchLanes: [],
    candidates: [roleCandidate],
    activity: [],
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T00:00:00.000Z',
  }
}

function dossier(evidence: CandidateDossier['evidence']): CandidateDossier {
  return {
    candidate: { id: 'candidate-1', canonicalName: 'Jordan Example' },
    evidence,
    sourceProfiles: [],
    contacts: [],
    openToWorkSignals: [],
    matchReviews: [],
    verifyNext: [],
  }
}

describe('V31 requirement-level evidence analysis', () => {
  it('keeps source evidence, candidate-stated material, recruiter notes, and clearance semantically separate', () => {
    const person = candidate({
      fitReasons: ['Terraform ownership looks strong based on recruiter review.'],
    })
    const analysis = buildCandidateRoleEvidenceAnalysis(role({}, person), person, dossier([
      { id: 'aws-1', source: 'github', label: 'Public project', detail: 'Maintains AWS infrastructure automation in a public repository.', confidence: 'high', url: 'https://example.org/aws' },
      { id: 'k8s-1', source: 'uploaded_resume', label: 'Resume', detail: 'Kubernetes production experience.', confidence: 'medium' },
      { id: 'clearance-1', source: 'public_profile', label: 'Public bio', detail: 'Bio mentions Secret clearance.', confidence: 'medium' },
    ]))

    expect(analysis.requirements.find(item => item.requirement === 'AWS')?.state).toBe('supported')
    expect(analysis.requirements.find(item => item.requirement === 'Kubernetes')).toMatchObject({ state: 'needs_verification' })
    expect(analysis.requirements.find(item => item.requirement === 'Terraform')).toMatchObject({ state: 'needs_verification', evidence: [] })
    expect(analysis.requirements.find(item => item.requirement === 'Secret')).toMatchObject({ state: 'needs_verification', tier: 'clearance' })
    expect(analysis.caseFor.map(item => item.title)).toEqual(['AWS'])
    expect(analysis.summary).toContain('evidence coverage, not a fit score')
  })

  it('requires an explicit source-linked negative statement before calling a requirement contradicted', () => {
    const person = candidate({ concerns: ['Kubernetes depth still needs review.'] })
    const withConcernOnly = buildCandidateRoleEvidenceAnalysis(role({}, person), person, dossier([]))
    expect(withConcernOnly.requirements.find(item => item.requirement === 'Kubernetes')?.state).toBe('needs_verification')

    const withContradiction = buildCandidateRoleEvidenceAnalysis(role({}, person), person, dossier([
      { id: 'negative-1', source: 'public_bio', label: 'Interview transcript', detail: 'The engineer has no Kubernetes production experience.' },
    ]))
    expect(withContradiction.requirements.find(item => item.requirement === 'Kubernetes')?.state).toBe('contradicted')
    expect(withContradiction.caseAgainst.some(item => item.title === 'Kubernetes')).toBe(true)
  })

  it('surfaces unresolved must-haves instead of converting missing evidence into a low score', () => {
    const person = candidate()
    const analysis = buildCandidateRoleEvidenceAnalysis(role({}, person), person, dossier([
      { id: 'aws-1', source: 'github', label: 'Repository', detail: 'AWS infrastructure code.' },
    ]))

    expect(analysis.unresolved.map(item => item.title)).toEqual(expect.arrayContaining(['Kubernetes', 'Terraform', 'Secret']))
    expect(analysis).not.toHaveProperty('score')
    expect(analysis).not.toHaveProperty('fitScore')
  })

  it('shows recruiter concerns as a separate case-against basis without calling them evidence', () => {
    const person = candidate({ concerns: ['Role scope may be more application-focused than platform-focused.'] })
    const analysis = buildCandidateRoleEvidenceAnalysis(role({}, person), person, dossier([]))
    expect(analysis.caseAgainst).toContainEqual(expect.objectContaining({ title: 'Recruiter concern', basis: 'recruiter_context' }))
    expect(analysis.caseAgainst.find(item => item.title === 'Recruiter concern')?.evidenceIds).toEqual([])
  })

  it('wires the evidence matrix into role-specific Candidate 360 without changing hiring actions', () => {
    const page = read('app/app/candidate/[id]/page.tsx')
    const matrix = read('components/RoleCandidateEvidenceMatrix.tsx')
    const loader = read('components/RoleCandidateEvidenceAnalysisClient.tsx')

    expect(page).toContain('RoleCandidateEvidenceAnalysisClient')
    expect(matrix).toContain('Requirement evidence matrix')
    expect(matrix).toContain('Case for fit')
    expect(matrix).toContain('Case against fit')
    expect(matrix).toContain('Unresolved / verify')
    expect(matrix).toContain('No fit score')
    expect(matrix).toContain('Recruiter-authored context is shown separately and never promoted into source evidence.')
    expect(loader).toContain('/api/candidate-db/360/')
    expect(matrix).not.toContain('auto-reject')
    expect(matrix).not.toContain('advanceStage')
  })
})
