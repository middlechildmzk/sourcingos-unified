import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RoleIntake, RoleWorkspace } from '@/lib/role-workspace'
import { normalizeRoleWorkspace } from '@/lib/role-workspace-storage'
import { approveStagedRoleBrief, initializeApprovedRoleBrief, stageRoleBriefRevision } from '@/lib/role-brief-artifact-v33-4'
import {
  activeRoleBriefVersion,
  calibrationReviewAsk,
  roleBriefInterpretations,
  searchLaneProgress,
  slateGapAnalysis,
} from '@/lib/role-workbench-v33-4'
import type { SearchAttempt } from '@/lib/search-state-memory-v30'

const intake: RoleIntake = {
  title: 'Senior RHEL Administrator',
  location: 'Annapolis Junction, MD',
  workMode: 'onsite',
  compensation: 'Not specified',
  clearance: 'Secret or higher',
  mustHaves: ['RHEL administration', 'Linux server ownership'],
  niceToHaves: ['Ansible'],
  disqualifiers: ['Current employee of hiring company'],
  targetCompanies: ['Leidos', 'Booz Allen'],
  adjacentBackgrounds: ['Linux Systems Administrator'],
  hiringManagerNotes: '',
  rawDescription: 'Find senior RHEL administrators near Annapolis Junction. Secret or higher required.',
}

function workspace(): RoleWorkspace {
  return {
    id: 'role-rhel',
    status: 'calibrating',
    intake,
    searchLanes: [{ id: 'exact_title', label: 'Exact title', purpose: 'Exact role hypothesis', query: 'RHEL administrator', source: 'github', status: 'approved' }],
    candidates: [],
    activity: [{ id: 'created', type: 'role_created', message: 'Created role.', createdAt: '2026-08-31T20:00:00.000Z' }],
    createdAt: '2026-08-31T20:00:00.000Z',
    updatedAt: '2026-08-31T20:00:00.000Z',
  }
}

describe('V33.4 Unified Role Workbench', () => {
  it('states source-truth, verification, and disqualifier boundaries out loud', () => {
    const notes = roleBriefInterpretations(intake)
    expect(notes.some(note => note.statement.includes('never become candidate facts'))).toBe(true)
    const clearance = notes.find(note => note.category === 'clearance')
    expect(clearance?.verificationGated).toBe(true)
    expect(clearance?.statement.toLowerCase()).toContain('do not verify')
    const disqualifier = notes.find(note => note.id === 'disqualifiers')
    expect(disqualifier?.statement).toContain('never auto-reject')
  })

  it('creates Role Brief v1 as an approved recruiter artifact', () => {
    const role = initializeApprovedRoleBrief(workspace(), '2026-08-31T20:05:00.000Z')
    expect(role.roleBriefVersions).toHaveLength(1)
    expect(role.roleBriefVersions?.[0].status).toBe('approved')
    expect(role.roleBriefVersions?.[0].version).toBe(1)
    expect(activeRoleBriefVersion(role).intake.title).toBe('Senior RHEL Administrator')
  })

  it('stages a brief revision without changing approved intake or search authorization', () => {
    const role = initializeApprovedRoleBrief(workspace())
    const proposed = { ...intake, location: 'Fort Meade / Annapolis Junction corridor' }
    const staged = stageRoleBriefRevision(role, proposed, '2026-08-31T20:10:00.000Z')
    expect(staged.intake.location).toBe('Annapolis Junction, MD')
    expect(staged.searchLanes[0].status).toBe('approved')
    const draft = activeRoleBriefVersion(staged)
    expect(draft.status).toBe('draft')
    expect(draft.intake.location).toBe('Fort Meade / Annapolis Junction corridor')
    expect(staged.activity[0].message).toContain('approved intake and Search Plan have not changed')
  })

  it('applies a staged brief only on explicit approval and returns all regenerated lanes to proposed', () => {
    const role = initializeApprovedRoleBrief(workspace())
    const staged = stageRoleBriefRevision(role, { ...intake, mustHaves: [...intake.mustHaves, 'Ansible'] }, '2026-08-31T20:10:00.000Z')
    const approved = approveStagedRoleBrief(staged, '2026-08-31T20:12:00.000Z')
    expect(approved.intake.mustHaves).toContain('Ansible')
    expect(activeRoleBriefVersion(approved).status).toBe('approved')
    expect(approved.searchLanes.length).toBeGreaterThan(0)
    expect(approved.searchLanes.every(lane => lane.status === 'proposed')).toBe(true)
    expect(approved.activity[0].message).toContain('still require explicit recruiter approval')
  })

  it('preserves Role Brief versions through the canonical role-workspace normalizer', () => {
    const staged = stageRoleBriefRevision(initializeApprovedRoleBrief(workspace()), { ...intake, location: 'Fort Meade, MD' }, '2026-08-31T20:10:00.000Z')
    const restored = normalizeRoleWorkspace(JSON.parse(JSON.stringify(staged)))
    expect(restored?.roleBriefVersions).toHaveLength(2)
    expect(restored?.activeRoleBriefVersionId).toBe(staged.activeRoleBriefVersionId)
    expect(restored?.activity[0].type).toBe('brief_version_created')
  })

  it('renders search hypotheses as measurable progress using real result keys', () => {
    const role = workspace()
    const attempts: SearchAttempt[] = [{
      id: 'attempt-1', roleId: role.id, laneId: 'exact_title', surface: 'github', query: 'RHEL administrator',
      fingerprint: 'github:rhel administrator', status: 'completed', resultKeys: ['github:a', 'github:b'],
      startedAt: '2026-08-31T20:00:00.000Z', completedAt: '2026-08-31T20:01:00.000Z', message: '2 source identities returned.',
    }]
    const progress = searchLaneProgress(role, attempts)
    expect(progress[0]).toMatchObject({ state: 'complete', yield: 2, attempts: 1 })
  })

  it('quantifies the calibration ask without silently changing search strategy', () => {
    const role = workspace()
    role.candidates = [
      { id: 'a', name: 'A', headline: '', company: '', location: '', source: 'test', stage: 'needs_review', fitDecision: 'strong_fit', fitReasons: [], concerns: [], tags: [], contactStatus: 'unknown', evidenceStatus: 'unreviewed', addedAt: role.createdAt, updatedAt: role.createdAt },
      { id: 'b', name: 'B', headline: '', company: '', location: '', source: 'test', stage: 'needs_review', fitDecision: 'possible_fit', fitReasons: [], concerns: [], tags: [], contactStatus: 'unknown', evidenceStatus: 'unreviewed', addedAt: role.createdAt, updatedAt: role.createdAt },
    ]
    const ask = calibrationReviewAsk(role)
    expect(ask.remaining).toBe(1)
    expect(ask.message).toContain('Review 1 more candidate')
    role.candidates.push({ id: 'c', name: 'C', headline: '', company: '', location: '', source: 'test', stage: 'needs_review', fitDecision: 'not_fit', fitReasons: [], concerns: ['Wrong background'], tags: [], contactStatus: 'unknown', evidenceStatus: 'unreviewed', addedAt: role.createdAt, updatedAt: role.createdAt })
    const ready = calibrationReviewAsk(role)
    expect(ready.ready).toBe(true)
    expect(ready.message).toContain('requires approval')
  })

  it('keeps unknown distinct from contradiction in slate-level gap analysis', () => {
    const gap = slateGapAnalysis([
      { candidateId: '1', requirements: [{ requirementId: 'rhel', requirementText: 'RHEL administration', tier: 'must_have', state: 'supported' }, { requirementId: 'clearance', requirementText: 'Secret clearance', tier: 'must_have', state: 'needs_verification' }] },
      { candidateId: '2', requirements: [{ requirementId: 'rhel', requirementText: 'RHEL administration', tier: 'must_have', state: 'supported' }, { requirementId: 'clearance', requirementText: 'Secret clearance', tier: 'must_have', state: 'unknown' }] },
      { candidateId: '3', requirements: [{ requirementId: 'rhel', requirementText: 'RHEL administration', tier: 'must_have', state: 'contradicted' }, { requirementId: 'clearance', requirementText: 'Secret clearance', tier: 'must_have', state: 'unknown' }] },
    ])
    expect(gap.mostEvidenceConstrained?.requirementText).toBe('Secret clearance')
    expect(gap.mostEvidenceConstrained?.unknown).toBe(2)
    expect(gap.mostEvidenceConstrained?.contradicted).toBe(0)
    expect(gap.summary).toContain('need verification')
    expect(gap.nextMoves.at(-1)).toContain('No role criterion or candidate decision changes automatically')
  })

  it('makes evidence coverage and keyboard review explicit while refusing opaque match percentages', () => {
    const source = readFileSync(new URL('../components/RoleUnifiedWorkbenchV33_4.tsx', import.meta.url), 'utf8')
    expect(source).toContain("key === 'j'")
    expect(source).toContain("key === 'k'")
    expect(source).toContain("key === 'y'")
    expect(source).toContain("key === 'm'")
    expect(source).toContain("key === 'n'")
    expect(source).toContain('must-haves supported')
    expect(source).toContain('Missing evidence is not a red X.')
    expect(source).toContain('No opaque fit score')
    expect(source).not.toContain('matchPercent')
    expect(source).not.toContain('fitScore')
  })
})
