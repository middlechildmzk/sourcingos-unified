import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { buildRoleMilitaryHypothesis } from '@/lib/military-role-hypothesis-v33'
import { militaryTalentGate } from '@/lib/military-role-gating-v33'
import type { OccupationIndex, TaxonomyProvenance } from '@/lib/military-talent-intelligence-v33'
import type { RoleIntake } from '@/lib/role-workspace'

const official: TaxonomyProvenance = {
  source: 'O*NET Military Crosswalk (MOC)',
  sourceUrl: 'https://www.onetcenter.org/crosswalks.html',
  verified: true,
  version: 'moc-2024-08',
}

const index: OccupationIndex = {
  civilian: [{
    onetSocCode: '15-1212.00',
    socCode: '15-1212',
    title: 'Information Security Analysts',
    alternateTitles: [],
    occupationFamily: 'Computer and Mathematical',
    provenance: official,
  }],
  occupations: [{
    branch: 'army',
    code: '17C',
    title: 'Cyber Operations Specialist (Army - Enlisted)',
    canonicalTitle: 'Cyber Operations Specialist',
    alternateTitles: ['Cyber Operations Specialist (Army - Enlisted)'],
    serviceCategory: 'enlisted',
    description: '',
    civilianOccupationCodes: ['15-1212.00'],
    skillConcepts: [],
    credentialSignals: [],
    occupationFamilies: [],
    active: true,
    provenance: official,
  }],
}

function intake(overrides: Partial<RoleIntake> = {}): RoleIntake {
  return {
    title: 'Cybersecurity Analyst',
    location: 'Remote',
    workMode: 'remote',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: ['incident response', 'network defense'],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: 'Cybersecurity analyst responsible for incident response and network defense.',
    ...overrides,
  }
}

describe('V33.1 · military domain gating', () => {
  it('enables military intelligence for technical cybersecurity roles', () => {
    const gate = militaryTalentGate(intake())
    expect(gate.enabled).toBe(true)
    expect(gate.technical).toBe(true)
    expect(gate.cybersecurity).toBe(true)
  })

  it('enables military intelligence for a recruiter-approved clearance context', () => {
    const gate = militaryTalentGate(intake({ title: 'Program Manager', mustHaves: ['program management'], rawDescription: '', clearance: 'TS/SCI' }))
    expect(gate.enabled).toBe(true)
    expect(gate.clearanceSpecified).toBe(true)
  })

  it('does not inject military intelligence into an unrelated commercial role', () => {
    const gate = militaryTalentGate(intake({ title: 'Brand Marketing Manager', mustHaves: ['brand strategy', 'campaign planning'], rawDescription: 'Consumer marketing role.' }))
    expect(gate.enabled).toBe(false)
  })
})

describe('V33.1 · authoritative role crosswalk', () => {
  it('can propose verified MOCs from the matched O*NET occupation without pretending requirements were satisfied', () => {
    const hypothesis = buildRoleMilitaryHypothesis(index, {
      title: 'Cybersecurity Analyst',
      mustHaves: ['incident response'],
      niceToHaves: [],
    }, { code: '15-1212.00', title: 'Information Security Analysts' })

    expect(hypothesis.applicable).toBe(true)
    expect(hypothesis.provisionalDataInUse).toBe(false)
    expect(hypothesis.occupations).toHaveLength(1)
    expect(hypothesis.occupations[0].relationship).toBe('authoritative_crosswalk')
    expect(hypothesis.occupations[0].rationale).toMatch(/candidate-level evidence/i)
    expect(JSON.stringify(hypothesis)).not.toMatch(/fitScore|requirementSupport/i)
  })

  it('still refuses to open an authoritative military lane from title alone', () => {
    const hypothesis = buildRoleMilitaryHypothesis(index, {
      title: 'Cybersecurity Analyst',
      mustHaves: [],
      niceToHaves: [],
    }, { code: '15-1212.00', title: 'Information Security Analysts' })
    expect(hypothesis.applicable).toBe(false)
  })
})

describe('V33.1 · canonical Search Brain integration', () => {
  const role = intake()
  const hypothesis = buildRoleMilitaryHypothesis(index, {
    title: role.title,
    mustHaves: role.mustHaves,
    niceToHaves: role.niceToHaves,
  }, { code: '15-1212.00', title: 'Information Security Analysts' })

  it('does not add the military hypothesis before recruiter approval', () => {
    const plan = buildCanonicalAgenticSearchPlan(role, undefined, { military: hypothesis, militaryApproved: false })
    expect(plan.lanes.some(lane => String(lane.id) === 'military_transition')).toBe(false)
    expect(plan.roleIntelligence.militaryAvailable).toBe(true)
    expect(plan.roleIntelligence.militaryApproved).toBe(false)
  })

  it('adds one guided-only military lane after recruiter approval', () => {
    const plan = buildCanonicalAgenticSearchPlan(role, undefined, { military: hypothesis, militaryApproved: true })
    const lane = plan.lanes.find(item => String(item.id) === 'military_transition')
    expect(lane).toBeTruthy()
    expect(lane?.tasks.length).toBeGreaterThan(0)
    expect(lane?.tasks.every(task => task.mode === 'guided')).toBe(true)
    expect(lane?.tasks.every(task => !task.connectorKeys?.length)).toBe(true)
    expect(lane?.tasks.some(task => task.surface === 'linkedin_recruiter')).toBe(true)
    expect(lane?.tasks.some(task => task.surface === 'clearancejobs')).toBe(true)
    expect(plan.roleIntelligence.militaryApproved).toBe(true)
  })

  it('blocks provisional military intelligence from the canonical plan even if approval state exists', () => {
    const provisional = { ...hypothesis, provisionalDataInUse: true }
    const plan = buildCanonicalAgenticSearchPlan(role, undefined, { military: provisional, militaryApproved: true })
    expect(plan.lanes.some(lane => String(lane.id) === 'military_transition')).toBe(false)
    expect(plan.integrityWarnings.join(' ')).toMatch(/provisional/i)
    expect(plan.roleIntelligence.militaryApproved).toBe(false)
  })
})
