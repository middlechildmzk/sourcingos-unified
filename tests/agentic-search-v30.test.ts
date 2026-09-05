import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  buildCanonicalAgenticSearchPlan,
  executableTaskDistinctness,
} from '../lib/canonical-agentic-search-v30'
import {
  searchFingerprint,
  shouldExecuteSearch,
  type SearchAttempt,
} from '../lib/search-state-memory-v30'
import type { RoleIntake } from '../lib/role-workspace'

function roleIntake(patch: Partial<RoleIntake> = {}): RoleIntake {
  return {
    title: 'Platform Engineer',
    location: 'Chicago',
    workMode: 'hybrid',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: ['Kubernetes', 'Terraform', 'AWS'],
    niceToHaves: ['Go'],
    disqualifiers: ['helpdesk'],
    targetCompanies: ['Example Systems'],
    adjacentBackgrounds: ['SRE', 'Cloud Engineer'],
    hiringManagerNotes: '',
    rawDescription: '',
    ...patch,
  }
}

describe('V30 agentic search foundation', () => {
  it('builds multiple distinct sourcing hypotheses with explicit blind spots', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake())
    expect(plan.lanes.length).toBeGreaterThanOrEqual(4)
    expect(plan.distinctQueryCount).toBe(plan.lanes.length)
    for (const lane of plan.lanes) {
      expect(lane.hypothesis.length).toBeGreaterThan(20)
      expect(lane.blindSpot.length).toBeGreaterThan(20)
    }
  })

  it('does not replay one executable public query across every strategy', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake())
    const distinctness = executableTaskDistinctness(plan)
    expect(distinctness.taskCount).toBeGreaterThan(1)
    expect(distinctness.distinctCount).toBeGreaterThan(1)
  })

  it('removes clearance and citizenship language from open/public tasks', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake({
      title: 'TS/SCI Platform Engineer',
      clearance: 'TS/SCI with polygraph',
      mustHaves: ['Kubernetes', 'US citizenship', 'Terraform'],
    }))
    const publicTasks = plan.lanes.flatMap(lane => lane.tasks.filter(task =>
      ['github', 'research_publications', 'google_xray'].includes(task.surface),
    ))
    for (const task of publicTasks) {
      expect(task.query).not.toMatch(/ts\/?sci|polygraph|clearance|citizenship|citizen/i)
    }
  })

  it('labels recruiter-run and optional provider surfaces truthfully', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake())
    const tasks = plan.lanes[0]?.tasks || []
    expect(tasks.find(task => task.surface === 'linkedin_recruiter')?.mode).toBe('guided')
    expect(tasks.find(task => task.surface === 'clearancejobs')?.mode).toBe('guided')
    expect(tasks.find(task => task.surface === 'exa_people')?.mode).toBe('provider_optional')
  })

  it('blocks exact repeat searches but allows a failed retry', () => {
    const query = 'Kubernetes AND Terraform'
    const base: Omit<SearchAttempt, 'status'> = {
      id: 'attempt-1',
      roleId: 'role-1',
      laneId: 'skill_cluster',
      surface: 'github',
      query,
      fingerprint: searchFingerprint('github', query),
      resultKeys: [],
      startedAt: new Date(0).toISOString(),
    }

    const completed: SearchAttempt = { ...base, status: 'completed' }
    expect(shouldExecuteSearch([completed], 'github', query).execute).toBe(false)

    const failed: SearchAttempt = { ...base, status: 'failed' }
    expect(shouldExecuteSearch([failed], 'github', query).execute).toBe(true)
  })

  it('keeps the execution route authenticated, rate-limited, read-only, and explicit about external content', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/agentic-search/route.ts', import.meta.url)),
      'utf8',
    )
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench'")
    expect(route).toContain("execution: 'read_only_preview'")
    expect(route).toContain('untrusted data')
    expect(route).not.toContain("from('candidates').insert")
  })
})
