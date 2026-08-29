import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildCalibratedGuidedSearchPlan } from '@/lib/calibrated-guided-search'
import { buildLanes } from '@/lib/jd-boolean-lanes'
import { parseJobDescription } from '@/lib/jd-parser'
import type { CalibrationInsight, CalibrationState } from '@/lib/calibration-intelligence'
import type { RoleIntake } from '@/lib/role-workspace'
import { recruiterPasteBackSourceLabel } from '@/lib/role-paste-back'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const roleActions = read('components/RoleSearchActions.tsx')

const intake: RoleIntake = {
  title: 'Citrix Administrator',
  location: 'Northern Virginia',
  workMode: 'onsite',
  compensation: 'Not specified',
  clearance: 'TS/SCI',
  mustHaves: ['Citrix', 'Windows'],
  niceToHaves: ['VMware'],
  disqualifiers: ['helpdesk'],
  targetCompanies: [],
  adjacentBackgrounds: ['VDI Engineer'],
  hiringManagerNotes: '',
  rawDescription: '',
}

const searchText = [
  'Title: Citrix Administrator',
  'Location: Northern Virginia',
  'Clearance: TS/SCI',
  'Required: Citrix, Windows',
  'Preferred: VMware',
  'Adjacent backgrounds: VDI Engineer',
].join('\n')

const baseline = buildLanes(parseJobDescription(searchText), searchText, {
  includeLocation: true,
  isCleared: true,
})

function insight(overrides: Partial<CalibrationInsight> = {}): CalibrationInsight {
  return {
    id: 'ci-disqualifier_pattern-helpdesk',
    statement: 'Recorded decisions enforce helpdesk as a disqualifier.',
    evidenceClass: 'disqualifier_pattern',
    confidence: 'moderate',
    status: 'proposed',
    scope: 'role',
    subject: 'helpdesk',
    supportingCandidateIds: ['c1', 'c2'],
    contradictingCandidateIds: [],
    positiveExamples: ['A', 'B'],
    negativeExamples: [],
    contradictionNote: '',
    derivedAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
    ...overrides,
  }
}

function state(insights: CalibrationInsight[], eventType: CalibrationState['events'][number]['type'] = 'insight_derived'): CalibrationState {
  return {
    insights,
    events: [{
      id: 'event-1',
      insightId: insights[0]?.id || 'none',
      type: eventType,
      message: 'test',
      createdAt: '2026-08-29T00:01:00.000Z',
    }],
    updatedAt: '2026-08-29T00:01:00.000Z',
  }
}

function querySnapshot(lane: (typeof baseline.lanes)[number]) {
  return {
    boolean: lane.boolean,
    linkedin: lane.linkedin,
    googleXray: lane.googleXray,
    bingXray: lane.bingXray,
    github: lane.github,
  }
}

describe('V30 PR2 calibration → guided search release gate', () => {
  it('does not change any guided query while learning is only proposed', () => {
    const plan = buildCalibratedGuidedSearchPlan(baseline, intake, state([insight()]))
    expect(plan.revision).toBe(1)
    expect(plan.calibrated).toBe(false)
    expect(plan.changes).toEqual([])
    expect(plan.current).toEqual(plan.baseline)
  })

  it('creates Search Plan v2 and excludes an approved searchable disqualifier', () => {
    const approved = insight({ status: 'approved', reviewedAt: '2026-08-29T00:01:00.000Z' })
    const plan = buildCalibratedGuidedSearchPlan(baseline, intake, state([approved], 'insight_approved'))
    const balanced = plan.current.lanes.find(lane => lane.id === 'balanced')!
    const before = plan.baseline.lanes.find(lane => lane.id === 'balanced')!

    expect(plan.revision).toBe(2)
    expect(plan.calibrated).toBe(true)
    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0]).toMatchObject({ kind: 'exclude_signal', subject: 'helpdesk', applied: true })
    expect(balanced.boolean).not.toBe(before.boolean)
    expect(balanced.boolean).toContain('NOT (helpdesk)')
    expect(balanced.linkedin).toContain('NOT (helpdesk)')
    expect(balanced.googleXray).toContain('-helpdesk')
  })

  it('does not auto-convert sensitive or logically inverted disqualifiers into search exclusions', () => {
    const unsafe = insight({
      id: 'ci-disqualifier_pattern-no-clearance',
      status: 'approved',
      subject: 'no clearance breadcrumbs',
      statement: 'Recorded decisions show missing clearance breadcrumbs.',
    })
    const plan = buildCalibratedGuidedSearchPlan(baseline, intake, state([unsafe], 'insight_approved'))
    expect(plan.revision).toBe(2)
    expect(plan.changes[0]).toMatchObject({ kind: 'review_only', applied: false })
    expect(plan.current.lanes).toEqual(plan.baseline.lanes)
  })

  it('does not duplicate an approved strong-fit signal already required by the role', () => {
    const existing = insight({
      id: 'ci-decision_pattern-citrix',
      evidenceClass: 'decision_pattern',
      status: 'approved',
      subject: 'Citrix',
      statement: 'Strong-fit decisions consistently show Citrix.',
    })
    const plan = buildCalibratedGuidedSearchPlan(baseline, intake, state([existing], 'insight_approved'))
    expect(plan.changes[0]).toMatchObject({ kind: 'require_signal', applied: false })
    for (const currentLane of plan.current.lanes) {
      const before = plan.baseline.lanes.find(lane => lane.id === currentLane.id)!
      expect(querySnapshot(currentLane)).toEqual(querySnapshot(before))
    }
    expect(plan.current.lanes.every(lane => lane.included.some(note => note === 'Approved calibration emphasis: Citrix'))).toBe(true)
  })

  it('increments revision for later calibration actions without silently activating paused learning', () => {
    const paused = insight({ status: 'paused' })
    const calibration: CalibrationState = {
      insights: [paused],
      events: [
        { id: 'e1', insightId: paused.id, type: 'insight_approved', message: 'approved', createdAt: '2026-08-29T00:01:00.000Z' },
        { id: 'e2', insightId: paused.id, type: 'insight_paused', message: 'paused', createdAt: '2026-08-29T00:02:00.000Z' },
      ],
      updatedAt: '2026-08-29T00:02:00.000Z',
    }
    const plan = buildCalibratedGuidedSearchPlan(baseline, intake, calibration)
    expect(plan.revision).toBe(3)
    expect(plan.calibrated).toBe(false)
    expect(plan.current).toEqual(plan.baseline)
  })

  it('shows recruiter-visible before/after explanation and carries plan revision into paste-back provenance', () => {
    expect(roleActions).toContain('What changed in Search Plan v')
    expect(roleActions).toContain('Approved calibration is shaping this search.')
    expect(roleActions).toContain('selectedBaselineLane')
    expect(roleActions).toContain('planRevision: guidedPlan?.revision')
    expect(recruiterPasteBackSourceLabel('clearancejobs', 'Balanced / Recruiter Default', 2))
      .toBe('ClearanceJobs · Balanced / Recruiter Default · Search Plan v2 · recruiter paste-back')
  })
})
