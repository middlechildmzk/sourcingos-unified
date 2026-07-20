import { describe, expect, it } from 'vitest'
import { buildSearchLanes, calibrationInsights, createRoleWorkspace, parseRoleIntake, roleMetrics } from '../lib/role-workspace'

const jd = `Program Director - Human Performance and Readiness
Location: Tampa, FL / Hybrid
Compensation: $150,000-$185,000
Clearance: Secret
Lead program management, operations, stakeholder management, human performance, AWS, and cybersecurity work.`

describe('V20 role workspace', () => {
  it('parses a role into a recruiter-reviewable intake', () => {
    const intake = parseRoleIntake(jd)
    expect(intake.title).toContain('Program Director')
    expect(intake.location).toContain('Tampa')
    expect(intake.workMode).toBe('hybrid')
    expect(intake.clearance).toContain('Secret')
    expect(intake.mustHaves).toContain('Program Management')
    expect(intake.mustHaves).toContain('AWS')
  })

  it('starts with internal database and network reuse before external discovery', () => {
    const lanes = buildSearchLanes(parseRoleIntake(jd))
    expect(lanes[0].source).toBe('candidate_database')
    expect(lanes[0].status).toBe('approved')
    expect(lanes[1].source).toBe('network')
    expect(lanes[1].status).toBe('approved')
    expect(lanes.some(lane => lane.source === 'resume_xray')).toBe(true)
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
      headline: 'Program Director',
      company: 'Example Co',
      location: 'Tampa, FL',
      source: 'manual research',
      stage: 'shortlisted',
      fitDecision: 'strong_fit',
      fitReasons: ['Human performance leadership'],
      concerns: [],
      tags: ['POTFF'],
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
