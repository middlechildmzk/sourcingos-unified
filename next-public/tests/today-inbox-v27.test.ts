import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildTodayInbox, todayInboxSummary } from '../lib/today-inbox'
import { applyInsightAction, reconcileCalibrationState } from '../lib/calibration-intelligence'
import type { RoleCandidate, RoleWorkspace } from '../lib/role-workspace'

const NOW = new Date('2026-07-22T12:00:00.000Z')
const root = path.resolve(__dirname, '..')

function candidate(overrides: Partial<RoleCandidate> & { id: string; name: string }): RoleCandidate {
  return {
    headline: '', company: '', location: '', source: 'manual', stage: 'identified',
    fitDecision: 'unreviewed', fitReasons: [], concerns: [], tags: [],
    contactStatus: 'unknown', evidenceStatus: 'unreviewed',
    addedAt: '2026-07-19T12:00:00.000Z', updatedAt: '2026-07-20T12:00:00.000Z',
    ...overrides,
  } as RoleCandidate
}

function workspace(overrides: Partial<RoleWorkspace> & { id: string }): RoleWorkspace {
  return {
    status: 'active',
    intake: {
      title: 'DevSecOps Lead', location: '', workMode: 'remote', compensation: '', clearance: '',
      mustHaves: ['Kubernetes'], niceToHaves: [], disqualifiers: [], targetCompanies: [],
      adjacentBackgrounds: [], hiringManagerNotes: '', rawDescription: '',
    },
    searchLanes: [], candidates: [], activity: [],
    createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-21T12:00:00.000Z',
    ...overrides,
  }
}

describe('V27 Today decision inbox', () => {
  it('ranks evidence conflicts and blockers above everything else, deterministically', () => {
    const roles = [
      workspace({
        id: '11111111-1111-4111-8111-111111111111',
        searchLanes: [{ id: 'l1', label: 'Lane', purpose: '', query: 'q', source: 'web_xray', status: 'proposed' }],
        candidates: [
          candidate({ id: 'c1', name: 'Ada', evidenceStatus: 'conflicting' }),
          candidate({ id: 'c2', name: 'Grace' }),
          candidate({ id: 'c3', name: 'Linus', evidenceStatus: 'stale', fitDecision: 'possible_fit' }),
        ],
      }),
    ]
    const items = buildTodayInbox(roles, NOW)
    expect(items[0].kind).toBe('evidence_conflict')
    expect(items[1].kind).toBe('role_blocker')
    expect(items.map(item => item.kind)).toEqual(['evidence_conflict', 'role_blocker', 'candidate_decision', 'lane_approval', 'stale_evidence'])
    expect(buildTodayInbox(roles, NOW)).toEqual(items)
  })

  it('describes every item in human-readable terms with impact, effort, action, evidence, and aging', () => {
    const roles = [workspace({ id: '11111111-1111-4111-8111-111111111111', candidates: [candidate({ id: 'c1', name: 'Ada' })] })]
    for (const item of buildTodayInbox(roles, NOW)) {
      expect(item.whyItMatters.length).toBeGreaterThan(10)
      expect(['high', 'medium', 'low']).toContain(item.impact)
      expect(['quick', 'moderate', 'deep']).toContain(item.effort)
      expect(item.recommendedAction.length).toBeGreaterThan(5)
      expect(item.aging).toMatch(/today|day/)
      expect(item.href).toContain('/app/roles/')
    }
  })

  it('surfaces pending calibration approvals with a deep link into the calibration tab', () => {
    const ws = workspace({
      id: '11111111-1111-4111-8111-111111111111',
      candidates: [
        candidate({ id: 'c1', name: 'Ada', fitDecision: 'strong_fit', fitReasons: ['Kubernetes ownership'] }),
        candidate({ id: 'c2', name: 'Grace', fitDecision: 'strong_fit', fitReasons: ['Kubernetes platform'] }),
      ],
    })
    ws.calibration = reconcileCalibrationState(ws, undefined, '2026-07-21T12:00:00.000Z')
    const item = buildTodayInbox([ws], NOW).find(entry => entry.kind === 'calibration_approval')!
    expect(item.title).toContain('awaiting your review')
    expect(item.href).toBe(`/app/roles/${ws.id}?tab=calibration`)
    expect(item.evidence).toContain('Kubernetes')

    const id = ws.calibration.insights[0].id
    ws.calibration = applyInsightAction(ws.calibration, id, 'approve').state
    expect(buildTodayInbox([ws], NOW).some(entry => entry.kind === 'calibration_approval')).toBe(false)
  })

  it('skips closed roles and reports inbox zero honestly', () => {
    const closed = workspace({ id: '22222222-2222-4222-8222-222222222222', status: 'closed', candidates: [candidate({ id: 'c1', name: 'Ada' })] })
    const items = buildTodayInbox([closed], NOW)
    expect(items).toEqual([])
    expect(todayInboxSummary(items)).toContain('No decisions are waiting')
  })

  it('flags active roles with no approved lane as blockers', () => {
    const ws = workspace({ id: '33333333-3333-4333-8333-333333333333' })
    const blocker = buildTodayInbox([ws], NOW).find(item => item.kind === 'role_blocker')!
    expect(blocker.impact).toBe('high')
    expect(blocker.evidence).toContain('No lanes drafted')
  })

  it('routes the app root and navigation to the Today surface without breaking Agent OS', () => {
    const appPage = fs.readFileSync(path.join(root, 'app/app/page.tsx'), 'utf8')
    expect(appPage).toContain("redirect('/app/today')")
    const shell = fs.readFileSync(path.join(root, 'components/AppShell.tsx'), 'utf8')
    expect(shell).toContain("{ href: '/app/today', label: 'Today'")
    expect(shell).toContain("{ href: '/app/agent-os', label: 'Agent OS'")
    expect(fs.existsSync(path.join(root, 'app/app/agent-os/page.tsx'))).toBe(true)
    const client = fs.readFileSync(path.join(root, 'components/TodayInboxClient.tsx'), 'utf8')
    expect(client).toContain('Nothing here acts on its own')
  })
})
