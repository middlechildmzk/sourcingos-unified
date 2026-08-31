import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '../lib/canonical-agentic-search-v30'
import { buildSearchLanes, calibrationInsights, createRoleWorkspace, parseRoleIntake, roleMetrics } from '../lib/role-workspace'

const jd = `Senior Platform Program Director
Location: Minneapolis, MN / Hybrid
Compensation: $150,000-$185,000
Required: AWS, Kubernetes, Terraform
Preferred: stakeholder management, program management
Lead a synthetic cloud infrastructure program.`

describe('V20 role workspace with canonical V33 Search Brain', () => {
  it('parses only recruiter-authored requirements into a reviewable intake', () => {
    const intake = parseRoleIntake(jd)
    expect(intake.title).toContain('Senior Platform Program Director')
    expect(intake.location).toContain('Minneapolis')
    expect(intake.workMode).toBe('hybrid')
    expect(intake.mustHaves).toContain('AWS')
    expect(intake.mustHaves).toContain('Kubernetes')
    expect(intake.mustHaves).not.toContain('Program Management')
  })

  it('persists the canonical hypothesis plan instead of a second source-centric plan', () => {
    const intake = parseRoleIntake(jd)
    const lanes = buildSearchLanes(intake)
    const canonical = buildCanonicalAgenticSearchPlan(intake)
    expect(lanes.map(lane => lane.id)).toEqual(canonical.lanes.map(lane => lane.id))
    expect(lanes[0].id).toBe('exact_title')
    expect(lanes[0].status).toBe('approved')
    expect(lanes.some(lane => lane.id === 'database')).toBe(false)
    expect(lanes.every(lane => lane.purpose.includes('Blind spot:'))).toBe(true)
  })

  it('creates a calibrating role with an audit event and no invented candidates', () => {
    const role = createRoleWorkspace(jd, 'role-1', new Date('2026-07-20T12:00:00.000Z'))
    expect(role.status).toBe('calibrating')
    expect(role.candidates).toEqual([])
    expect(role.activity[0].type).toBe('role_created')
    expect(role.searchLanes.length).toBeGreaterThan(3)
  })

  it('computes role-specific pipeline metrics without global candidate ratings', () => {
    const role = createRoleWorkspace(jd, 'role-1')
    role.candidates.push({
      id: 'candidate-1',
      name: 'Jordan Rivera',
      headline: 'Platform Program Director',
      company: 'Example Co',
      location: 'Minneapolis, MN',
      source: 'manual research',
      stage: 'shortlisted',
      fitDecision: 'strong_fit',
      fitReasons: ['Recruiter observed relevant infrastructure leadership'],
      concerns: [],
      tags: ['synthetic platform program'],
      contactStatus: 'unknown',
      evidenceStatus: 'reviewed',
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const metrics = roleMetrics(role)
    expect(metrics.candidateCount).toBe(1)
    expect(metrics.strongFits).toBe(1)
    expect(metrics.byStage.shortlisted).toBe(1)
  })

  it('does not propose feedback patterns before a minimum calibration sample', () => {
    const role = createRoleWorkspace(jd, 'role-1')
    expect(calibrationInsights(role)[0]).toMatch(/at least three candidates/i)
  })
})
