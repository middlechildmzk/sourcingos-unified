import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  applyInsightAction,
  activeInsights,
  deriveCalibrationInsights,
  emptyCalibrationState,
  insightDisplayStatement,
  normalizeCalibrationState,
  pendingInsightCount,
  rankCandidatesWithCalibration,
  recommendLaneChanges,
  reconcileCalibrationState,
} from '../lib/calibration-intelligence'
import { mergeRoleWorkspaces } from '../lib/role-workspace-storage'
import type { RoleCandidate, RoleWorkspace } from '../lib/role-workspace'

const NOW = '2026-07-22T12:00:00.000Z'

function candidate(overrides: Partial<RoleCandidate> & { id: string; name: string }): RoleCandidate {
  return {
    headline: '',
    company: '',
    location: '',
    source: 'manual',
    stage: 'identified',
    fitDecision: 'unreviewed',
    fitReasons: [],
    concerns: [],
    tags: [],
    contactStatus: 'unknown',
    evidenceStatus: 'unreviewed',
    addedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as RoleCandidate
}

function workspace(overrides: Partial<RoleWorkspace> = {}): RoleWorkspace {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'active',
    intake: {
      title: 'DevSecOps Lead',
      location: 'Remote',
      workMode: 'remote',
      compensation: '',
      clearance: 'TS/SCI breadcrumbs only',
      mustHaves: ['Kubernetes'],
      niceToHaves: [],
      disqualifiers: ['no clearance breadcrumbs'],
      targetCompanies: ['Booz Allen'],
      adjacentBackgrounds: ['SRE'],
      hiringManagerNotes: '',
      rawDescription: '',
    },
    searchLanes: [],
    candidates: [],
    activity: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const strongK8s = (id: string, name: string) =>
  candidate({ id, name, fitDecision: 'strong_fit', fitReasons: ['Kubernetes platform ownership'] })
const rejectedNoK8s = (id: string, name: string) =>
  candidate({ id, name, fitDecision: 'not_fit', concerns: ['No container orchestration depth'] })

describe('V27 calibration derivation', () => {
  it('derives a must-have decision pattern with linked supporting and negative examples', () => {
    const ws = workspace({
      candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace'), rejectedNoK8s('c3', 'Linus')],
    })
    const derived = deriveCalibrationInsights(ws, NOW)
    const pattern = derived.find(insight => insight.evidenceClass === 'decision_pattern')
    expect(pattern).toBeTruthy()
    expect(pattern!.subject).toBe('Kubernetes')
    expect(pattern!.supportingCandidateIds).toEqual(['c1', 'c2'])
    expect(pattern!.negativeExamples).toContain('Linus')
    expect(pattern!.contradictingCandidateIds).toEqual([])
  })

  it('is deterministic for the same workspace input', () => {
    const ws = workspace({ candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace')] })
    expect(deriveCalibrationInsights(ws, NOW)).toEqual(deriveCalibrationInsights(ws, NOW))
  })

  it('requires a minimum of two supporting decisions before proposing anything', () => {
    const ws = workspace({ candidates: [strongK8s('c1', 'Ada')] })
    expect(deriveCalibrationInsights(ws, NOW)).toEqual([])
  })

  it('keeps contradictions visible instead of averaging them away', () => {
    const ws = workspace({
      candidates: [
        strongK8s('c1', 'Ada'),
        strongK8s('c2', 'Grace'),
        candidate({ id: 'c3', name: 'Alan', fitDecision: 'strong_fit', fitReasons: ['Strong platform generalist'] }),
      ],
    })
    const pattern = deriveCalibrationInsights(ws, NOW).find(insight => insight.evidenceClass === 'decision_pattern')!
    expect(pattern.contradictingCandidateIds).toEqual(['c3'])
    expect(pattern.contradictionNote).toContain('not absolute')
  })

  it('derives disqualifier enforcement from not-fit concerns and lowers confidence when advancing candidates carry it', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'r1', name: 'A', fitDecision: 'not_fit', concerns: ['no clearance breadcrumbs found'] }),
        candidate({ id: 'r2', name: 'B', fitDecision: 'not_fit', concerns: ['No clearance breadcrumbs in any public signal'] }),
        candidate({ id: 'p1', name: 'C', fitDecision: 'possible_fit', concerns: ['no clearance breadcrumbs yet'] }),
      ],
    })
    const insight = deriveCalibrationInsights(ws, NOW).find(item => item.evidenceClass === 'disqualifier_pattern')!
    expect(insight.supportingCandidateIds).toEqual(['r1', 'r2'])
    expect(insight.contradictingCandidateIds).toEqual(['p1'])
    expect(insight.contradictionNote).toContain('sometimes accepting')
  })

  it('flags decisions recorded on conflicting or stale evidence as hygiene work', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit', evidenceStatus: 'conflicting' }),
        candidate({ id: 'c2', name: 'Grace', fitDecision: 'not_fit', evidenceStatus: 'stale' }),
      ],
    })
    const hygiene = deriveCalibrationInsights(ws, NOW).find(item => item.evidenceClass === 'evidence_hygiene')!
    expect(hygiene.supportingCandidateIds).toEqual(['c1', 'c2'])
    expect(hygiene.confidence).toBe('emerging')
  })
})

describe('V27 calibration lifecycle', () => {
  const ws = workspace({ candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace')] })

  it('proposes new insights with role scope and records a derivation event', () => {
    const state = reconcileCalibrationState(ws, undefined, NOW)
    expect(state.insights.every(insight => insight.status === 'proposed' && insight.scope === 'role')).toBe(true)
    expect(pendingInsightCount(state)).toBe(state.insights.length)
    expect(state.events.some(event => event.type === 'insight_derived')).toBe(true)
  })

  it('supports approve, edit, reject, pause, scope change, and rollback with events', () => {
    let state = reconcileCalibrationState(ws, undefined, NOW)
    const id = state.insights[0].id

    let result = applyInsightAction(state, id, 'approve', {}, NOW)
    expect(result.state.insights[0].status).toBe('approved')
    expect(result.event?.type).toBe('insight_approved')

    result = applyInsightAction(result.state, id, 'edit', { editedStatement: 'Recruiter phrasing.' }, NOW)
    expect(result.state.insights[0].status).toBe('edited')
    expect(insightDisplayStatement(result.state.insights[0])).toBe('Recruiter phrasing.')

    result = applyInsightAction(result.state, id, 'set_scope', { scope: 'organization' }, NOW)
    expect(result.state.insights[0].scope).toBe('organization')

    result = applyInsightAction(result.state, id, 'pause', {}, NOW)
    expect(result.state.insights[0].status).toBe('paused')
    expect(activeInsights(result.state)).toEqual([])

    result = applyInsightAction(result.state, id, 'reject', {}, NOW)
    expect(result.state.insights[0].status).toBe('rejected')

    result = applyInsightAction(result.state, id, 'rollback', {}, NOW)
    expect(result.state.insights[0].status).toBe('proposed')
    expect(result.state.insights[0].editedStatement).toBeUndefined()
    expect(result.state.events.map(event => event.type)).toContain('insight_rolled_back')
  })

  it('rejects an edit without a statement and unknown insight ids', () => {
    const state = reconcileCalibrationState(ws, undefined, NOW)
    expect(applyInsightAction(state, state.insights[0].id, 'edit', {}, NOW).error).toBeTruthy()
    expect(applyInsightAction(state, 'missing', 'approve', {}, NOW).error).toBeTruthy()
  })

  it('re-derivation preserves reviewer decisions and refreshes evidence', () => {
    let state = reconcileCalibrationState(ws, undefined, NOW)
    const id = state.insights.find(insight => insight.evidenceClass === 'decision_pattern')!.id
    state = applyInsightAction(state, id, 'approve', {}, NOW).state
    const grown = workspace({ candidates: [...ws.candidates, strongK8s('c9', 'Marie')] })
    const next = reconcileCalibrationState(grown, state, '2026-07-23T12:00:00.000Z')
    const insight = next.insights.find(item => item.id === id)!
    expect(insight.status).toBe('approved')
    expect(insight.supportingCandidateIds).toContain('c9')
    expect(next.events.some(event => event.type === 'insight_updated')).toBe(true)
  })

  it('drops unsupported proposed insights but keeps reviewed ones', () => {
    let state = reconcileCalibrationState(ws, undefined, NOW)
    const id = state.insights[0].id
    const approved = applyInsightAction(state, id, 'approve', {}, NOW).state
    const emptied = workspace({ candidates: [] })
    expect(reconcileCalibrationState(emptied, state, NOW).insights).toEqual([])
    const kept = reconcileCalibrationState(emptied, approved, NOW)
    expect(kept.insights.map(insight => insight.id)).toEqual([id])
    expect(kept.insights[0].status).toBe('approved')
  })
})

describe('V27 explainable ranking and lane recommendations', () => {
  const base = (candidateRecord: RoleCandidate) => (candidateRecord.fitDecision === 'strong_fit' ? 50 : 40)

  it('does not move anyone while insights are only proposed', () => {
    const ws = workspace({ candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace')] })
    const state = reconcileCalibrationState(ws, undefined, NOW)
    const ranking = rankCandidatesWithCalibration(ws.candidates, base, state)
    expect(ranking.changes).toEqual([])
    expect(ranking.adjustments.size).toBe(0)
  })

  it('moves matching candidates only after approval and explains every move with its cause', () => {
    const ws = workspace({ candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace'), rejectedNoK8s('c3', 'Linus')] })
    let state = reconcileCalibrationState(ws, undefined, NOW)
    const id = state.insights.find(insight => insight.evidenceClass === 'decision_pattern')!.id
    state = applyInsightAction(state, id, 'approve', {}, NOW).state
    const ranking = rankCandidatesWithCalibration(ws.candidates, () => 50, state)
    const up = ranking.changes.filter(change => change.direction === 'up')
    expect(up.map(change => change.candidateId).sort()).toEqual(['c1', 'c2'])
    expect(up[0].causedByInsightIds).toEqual([id])
    expect(up[0].explanation).toContain('recorded signals only, not verified facts')
    expect(ranking.orderedCandidateIds.slice(0, 2).sort()).toEqual(['c1', 'c2'])
  })

  it('penalizes approved disqualifier patterns and surfaces uncertain evidence', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'r1', name: 'A', fitDecision: 'not_fit', concerns: ['no clearance breadcrumbs'] }),
        candidate({ id: 'r2', name: 'B', fitDecision: 'not_fit', concerns: ['no clearance breadcrumbs'] }),
        candidate({ id: 'p1', name: 'C', fitDecision: 'possible_fit', concerns: ['no clearance breadcrumbs'], evidenceStatus: 'conflicting' }),
      ],
    })
    let state = reconcileCalibrationState(ws, undefined, NOW)
    const id = state.insights.find(insight => insight.evidenceClass === 'disqualifier_pattern')!.id
    state = applyInsightAction(state, id, 'approve', {}, NOW).state
    const ranking = rankCandidatesWithCalibration(ws.candidates, () => 50, state)
    expect(ranking.changes.every(change => change.direction === 'down')).toBe(true)
    expect(ranking.uncertain).toContain('p1')
  })

  it('recommends lanes aligned with approved learning and never auto-applies', () => {
    const ws = workspace({
      searchLanes: [
        { id: 'l1', label: 'Kubernetes platform lane', purpose: 'k8s leaders', query: 'Kubernetes AND platform', source: 'web_xray', status: 'proposed' },
        { id: 'l2', label: 'General ops', purpose: 'ops', query: 'operations', source: 'web_xray', status: 'proposed' },
      ],
      candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace')],
    })
    let state = reconcileCalibrationState(ws, undefined, NOW)
    expect(recommendLaneChanges(ws.searchLanes, state)).toEqual([])
    const id = state.insights.find(insight => insight.evidenceClass === 'decision_pattern')!.id
    state = applyInsightAction(state, id, 'approve', {}, NOW).state
    const recommendations = recommendLaneChanges(ws.searchLanes, state)
    expect(recommendations).toHaveLength(1)
    expect(recommendations[0].laneId).toBe('l1')
    expect(recommendations[0].recommendation).toBe('raise_priority')
    expect(recommendations[0].causedByInsightIds).toEqual([id])
    expect(ws.searchLanes[0].status).toBe('proposed')
  })
})

describe('V27 calibration persistence safety', () => {
  it('normalization fails closed on malformed input and strips unknown enum values', () => {
    expect(normalizeCalibrationState(null).insights).toEqual([])
    expect(normalizeCalibrationState('junk').insights).toEqual([])
    const dirty = normalizeCalibrationState({
      insights: [
        { id: 'ok', statement: 'Real', status: 'evil', scope: 'global', evidenceClass: 'nope', confidence: 'huge' },
        { statement: 'missing id' },
        'garbage',
      ],
      events: [{ id: 'e1', insightId: 'ok', type: 'not_a_type', message: 'x' }, 'junk'],
    })
    expect(dirty.insights).toHaveLength(1)
    expect(dirty.insights[0]).toMatchObject({ status: 'proposed', scope: 'role', evidenceClass: 'decision_pattern', confidence: 'emerging' })
    expect(dirty.events).toEqual([])
  })

  it('workspace merge keeps the newest review per insight and unions events', () => {
    const ws = workspace({ candidates: [strongK8s('c1', 'Ada'), strongK8s('c2', 'Grace')] })
    const initial = reconcileCalibrationState(ws, undefined, NOW)
    const id = initial.insights[0].id
    const deviceA = applyInsightAction(initial, id, 'approve', {}, '2026-07-22T13:00:00.000Z').state
    const deviceB = applyInsightAction(initial, id, 'reject', {}, '2026-07-22T14:00:00.000Z').state
    const merged = mergeRoleWorkspaces(
      [{ ...ws, calibration: deviceA, updatedAt: '2026-07-22T15:00:00.000Z' }],
      [{ ...ws, calibration: deviceB, updatedAt: '2026-07-22T14:30:00.000Z' }]
    )
    const insight = merged[0].calibration!.insights.find(item => item.id === id)!
    expect(insight.status).toBe('rejected')
    const eventTypes = merged[0].calibration!.events.map(event => event.type)
    expect(eventTypes).toContain('insight_approved')
    expect(eventTypes).toContain('insight_rejected')
  })

  it('sync route persists sanitized calibration on push and returns it on pull', () => {
    const route = fs.readFileSync(path.resolve(__dirname, '../app/api/roles/sync/route.ts'), 'utf8')
    expect(route).toContain("calibration: normalizeCalibrationState(workspace.calibration)")
    expect(route).toContain("calibration: role.calibration ? normalizeCalibrationState(role.calibration) : undefined")
  })

  it('migration adds the column additively and keeps the RPC service-role only', () => {
    const migration = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/20260722160000_role_calibration_state.sql'), 'utf8')
    expect(migration).toContain("add column if not exists calibration jsonb not null default '{}'::jsonb")
    expect(migration).toContain("calibration = case when jsonb_typeof(p_role->'calibration') = 'object'")
    expect(migration).toContain('revoke all on function public.save_role_workspace_snapshot')
    expect(migration).toContain('grant execute on function public.save_role_workspace_snapshot')
    expect(migration).toContain('to service_role')
    expect(migration).not.toContain('to authenticated')
  })

  it('empty state helper produces a valid state', () => {
    const state = emptyCalibrationState(NOW)
    expect(state).toEqual({ insights: [], events: [], updatedAt: NOW })
  })
})
