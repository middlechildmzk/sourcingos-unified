import { describe, expect, it } from 'vitest'
import { applyInsightAction } from '../lib/calibration-intelligence'
import { buildSearchStrategyBrief } from '../lib/hm-outputs'
import { reconcileRoleWorkspaceCalibration } from '../lib/role-calibration-reconciliation'
import { buildTodayInbox } from '../lib/today-inbox'
import type { RoleCandidate, RoleWorkspace } from '../lib/role-workspace'

const NOW = '2026-07-22T18:00:00.000Z'

function candidate(id: string, name: string): RoleCandidate {
  return {
    id,
    name,
    headline: 'Platform engineer',
    company: 'Example',
    location: 'Remote',
    source: 'manual',
    stage: 'needs_review',
    fitDecision: 'strong_fit',
    fitReasons: ['Kubernetes platform ownership'],
    concerns: [],
    tags: ['Kubernetes'],
    contactStatus: 'unknown',
    evidenceStatus: 'reviewed',
    addedAt: NOW,
    updatedAt: NOW,
  }
}

function role(): RoleWorkspace {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'active',
    intake: {
      title: 'Platform Engineering Lead',
      location: 'Remote',
      workMode: 'remote',
      compensation: '',
      clearance: '',
      mustHaves: ['Kubernetes'],
      niceToHaves: [],
      disqualifiers: [],
      targetCompanies: [],
      adjacentBackgrounds: [],
      hiringManagerNotes: '',
      rawDescription: '',
    },
    searchLanes: [{ id: 'lane-1', label: 'Platform leaders', purpose: 'Kubernetes leaders', query: 'Kubernetes', source: 'web_xray', status: 'approved' }],
    candidates: [candidate('candidate-1', 'Ada'), candidate('candidate-2', 'Grace')],
    activity: [],
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('V28 role-level calibration reconciliation', () => {
  it('derives pending calibration before the Calibration tab is opened', () => {
    const reconciled = reconcileRoleWorkspaceCalibration(role(), NOW)
    expect(reconciled.calibration?.insights).toHaveLength(1)
    expect(reconciled.calibration?.insights[0].status).toBe('proposed')

    const today = buildTodayInbox([reconciled], new Date(NOW))
    expect(today.some(item => item.kind === 'calibration_approval' && item.count === 1)).toBe(true)

    const brief = buildSearchStrategyBrief(reconciled, new Date(NOW))
    expect(brief).toContain('1 detected pattern(s) still await recruiter review')
  })

  it('preserves recruiter approval while refreshing the linked evidence', () => {
    const initial = reconcileRoleWorkspaceCalibration(role(), NOW)
    const insightId = initial.calibration!.insights[0].id
    const approvedState = applyInsightAction(initial.calibration!, insightId, 'approve', {}, NOW).state
    const approved = { ...initial, calibration: approvedState }
    const expanded = {
      ...approved,
      candidates: [...approved.candidates, candidate('candidate-3', 'Linus')],
    }

    const reconciled = reconcileRoleWorkspaceCalibration(expanded, '2026-07-23T18:00:00.000Z')
    const insight = reconciled.calibration!.insights.find(item => item.id === insightId)!
    expect(insight.status).toBe('approved')
    expect(insight.supportingCandidateIds).toEqual(['candidate-1', 'candidate-2', 'candidate-3'])
  })

  it('returns the existing workspace when reconciliation finds no semantic change', () => {
    const first = reconcileRoleWorkspaceCalibration(role(), NOW)
    const second = reconcileRoleWorkspaceCalibration(first, '2026-07-23T18:00:00.000Z')
    expect(second).toBe(first)
  })
})
