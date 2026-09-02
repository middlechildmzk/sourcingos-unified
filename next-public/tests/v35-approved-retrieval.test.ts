import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan, publicQueryForAgenticLane } from '@/lib/canonical-agentic-search-v30'
import {
  approvedExecutionLocationsV35,
  setApprovedSearchEntityV35,
  type RoleSearchIntelligenceStateV35,
} from '@/lib/entity-intelligence/search-approval-v35'
import type { RoleIntake } from '@/lib/role-workspace'

function intake(): RoleIntake {
  return {
    title: 'RHEL administrator',
    location: 'Annapolis Junction, MD',
    workMode: 'onsite',
    compensation: 'Not specified',
    clearance: 'Secret or higher',
    mustHaves: ['RHEL', '5+ years relevant experience'],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: 'RHEL admin with 5+ years of experience in or near Annapolis Junction, MD with a Secret security clearance or higher',
  }
}

function approvedState(): RoleSearchIntelligenceStateV35 {
  let state = setApprovedSearchEntityV35(undefined, 'entity:technology:ansible', true, new Date('2026-09-02T00:01:00Z'))
  state = setApprovedSearchEntityV35(state, 'entity:credential:rhce', true, new Date('2026-09-02T00:02:00Z'))
  state = setApprovedSearchEntityV35(state, 'loc:installation:fort-meade-md', true, new Date('2026-09-02T00:03:00Z'))
  if (!state) throw new Error('Expected approved search state')
  return state
}

describe('V35.3 recruiter-approved retrieval expansion', () => {
  it('keeps the exact-title lane unchanged while broadening discovery-oriented lanes', () => {
    const role = intake()
    const state = approvedState()
    const exactBefore = publicQueryForAgenticLane(role, 'exact_title')
    const exactAfter = publicQueryForAgenticLane(role, 'exact_title', state)
    const skillsAfter = publicQueryForAgenticLane(role, 'skill_cluster', state)
    const adjacentAfter = publicQueryForAgenticLane(role, 'adjacent_title', state)

    expect(exactAfter).toBe(exactBefore)
    expect(exactAfter).not.toMatch(/ansible|rhce/i)
    expect(skillsAfter).toMatch(/ansible/i)
    expect(skillsAfter).toMatch(/rhce/i)
    expect(adjacentAfter).toMatch(/ansible|rhce/i)
  })

  it('adds only recruiter-approved location expansions to execution geography', () => {
    const locations = approvedExecutionLocationsV35(intake(), approvedState())
    expect(locations[0]).toBe('Annapolis Junction, MD')
    expect(locations).toContain('Fort Meade, MD')
    expect(locations).not.toContain('Columbia, MD')
  })

  it('never injects sensitive clearance concepts into public queries through search approvals', () => {
    let state = approvedState()
    state = setApprovedSearchEntityV35(state, 'entity:clearance:ts-sci', true, new Date('2026-09-02T00:04:00Z'))
    const plan = buildCanonicalAgenticSearchPlan(intake(), undefined, { searchIntelligence: state })
    const publicQueries = plan.lanes.flatMap(lane => lane.tasks)
      .filter(task => ['github', 'stackoverflow', 'devto', 'huggingface', 'research_publications', 'google_xray'].includes(task.surface))
      .map(task => task.query)

    expect(plan.roleIntelligence.approvedSearchLabels).toContain('TS/SCI')
    for (const query of publicQueries) expect(query).not.toMatch(/ts\/?sci|top secret|secret clearance|citizenship/i)
  })

  it('does not mutate recruiter-approved RoleIntake while building expanded plans', () => {
    const role = intake()
    const snapshot = JSON.parse(JSON.stringify(role))
    buildCanonicalAgenticSearchPlan(role, undefined, { searchIntelligence: approvedState() })
    expect(role).toEqual(snapshot)
  })
})
