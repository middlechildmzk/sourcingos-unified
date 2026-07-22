import { describe, expect, it } from 'vitest'
import {
  buildCalibrationReport,
  buildCandidateSlate,
  buildSearchStrategyBrief,
  buildWeeklyUpdate,
  HM_OUTPUTS,
} from '../lib/hm-outputs'
import { applyInsightAction, reconcileCalibrationState } from '../lib/calibration-intelligence'
import type { RoleCandidate, RoleWorkspace } from '../lib/role-workspace'

const NOW = new Date('2026-07-22T12:00:00.000Z')

function candidate(overrides: Partial<RoleCandidate> & { id: string; name: string }): RoleCandidate {
  return {
    headline: 'Platform Lead', company: 'Acme', location: 'Remote', source: 'manual research', stage: 'shortlisted',
    fitDecision: 'unreviewed', fitReasons: [], concerns: [], tags: [],
    contactStatus: 'unknown', evidenceStatus: 'unreviewed',
    addedAt: '2026-07-19T12:00:00.000Z', updatedAt: '2026-07-20T12:00:00.000Z',
    ...overrides,
  } as RoleCandidate
}

function workspace(overrides: Partial<RoleWorkspace> = {}): RoleWorkspace {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    status: 'active',
    intake: {
      title: 'DevSecOps Lead', location: 'Remote', workMode: 'remote', compensation: '', clearance: 'TS/SCI required',
      mustHaves: ['Kubernetes'], niceToHaves: [], disqualifiers: [], targetCompanies: [],
      adjacentBackgrounds: [], hiringManagerNotes: '', rawDescription: '',
    },
    searchLanes: [{ id: 'l1', label: 'K8s lane', purpose: 'platform leaders', query: 'kubernetes', source: 'web_xray', status: 'approved' }],
    candidates: [], activity: [],
    createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-21T12:00:00.000Z',
    ...overrides,
  }
}

describe('V27 hiring manager outputs', () => {
  it('every output carries the evidence honesty key and never asserts candidate clearance', () => {
    const ws = workspace({ candidates: [candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit' })] })
    for (const output of HM_OUTPUTS) {
      const text = output.build(ws, NOW)
      expect(text).toContain('not')
      expect(text).toContain('How to read this document')
      expect(text.toLowerCase()).not.toContain('verified clearance')
      expect(text.toLowerCase()).not.toContain('clearance verified')
    }
    expect(buildSearchStrategyBrief(ws, NOW)).toContain('candidate clearance is never asserted')
  })

  it('slate labels recorded signals, unknown contact, stale and conflicting evidence honestly', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit', fitReasons: ['Kubernetes ownership'], evidenceStatus: 'reviewed', contactStatus: 'signals_found' }),
        candidate({ id: 'c2', name: 'Grace', fitDecision: 'strong_fit', evidenceStatus: 'conflicting' }),
        candidate({ id: 'c3', name: 'Linus', fitDecision: 'strong_fit', evidenceStatus: 'stale' }),
      ],
    })
    const slate = buildCandidateSlate(ws, NOW)
    expect(slate).toContain('Recorded signals: Kubernetes ownership')
    expect(slate).toContain('Contact signals found, unconfirmed')
    expect(slate).toContain('Conflicting evidence, unresolved')
    expect(slate).toContain('Stale evidence, needs re-verification')
    expect(slate).toContain('Contact path unknown')
    expect(slate).not.toContain('fit probability')
  })

  it('brief includes only approved learning and discloses pending patterns', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit', fitReasons: ['Kubernetes ownership'] }),
        candidate({ id: 'c2', name: 'Grace', fitDecision: 'strong_fit', fitReasons: ['Kubernetes platform'] }),
      ],
    })
    ws.calibration = reconcileCalibrationState(ws, undefined, '2026-07-21T12:00:00.000Z')
    const before = buildSearchStrategyBrief(ws, NOW)
    expect(before).toContain('No approved calibration learning yet')
    expect(before).toContain('await recruiter review')

    const id = ws.calibration.insights.find(insight => insight.evidenceClass === 'decision_pattern')!.id
    ws.calibration = applyInsightAction(ws.calibration, id, 'approve').state
    const after = buildSearchStrategyBrief(ws, NOW)
    expect(after).toContain('approved learning from 2 recorded decisions')
  })

  it('calibration report marks proposed insights as having no effect', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit', fitReasons: ['Kubernetes ownership'] }),
        candidate({ id: 'c2', name: 'Grace', fitDecision: 'strong_fit', fitReasons: ['Kubernetes platform'] }),
      ],
    })
    ws.calibration = reconcileCalibrationState(ws, undefined, '2026-07-21T12:00:00.000Z')
    expect(buildCalibrationReport(ws, NOW)).toContain('not yet reviewed; has no effect on the search')
  })

  it('weekly update surfaces conflicts and stale evidence as risks instead of hiding them', () => {
    const ws = workspace({
      candidates: [
        candidate({ id: 'c1', name: 'Ada', evidenceStatus: 'conflicting' }),
        candidate({ id: 'c2', name: 'Grace', evidenceStatus: 'stale', fitDecision: 'possible_fit' }),
      ],
    })
    const update = buildWeeklyUpdate(ws, NOW)
    expect(update).toContain('Risks and honesty flags')
    expect(update).toContain('unresolved evidence conflicts: Ada')
    expect(update).toContain('stale evidence')
  })

  it('outputs are deterministic for a fixed date', () => {
    const ws = workspace({ candidates: [candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit' })] })
    expect(buildCandidateSlate(ws, NOW)).toEqual(buildCandidateSlate(ws, NOW))
  })
})
