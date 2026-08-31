import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '../lib/canonical-agentic-search-v30'
import { buildDomainPackProfile, detectDomainPacks } from '../lib/domain-packs-v31'
import { enrichRoleIntakeWithOnet, onetSearchExpansion, type OnetRoleIntelligence } from '../lib/onet-role-intelligence'
import type { RoleIntake } from '../lib/role-workspace'

function roleIntake(patch: Partial<RoleIntake> = {}): RoleIntake {
  return {
    title: 'Operations Manager',
    location: 'Denver',
    workMode: 'hybrid',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: ['stakeholder management'],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: '',
    ...patch,
  }
}

const onetFixture: OnetRoleIntelligence = {
  provider: 'onet',
  version: '31.0',
  configured: true,
  matchedOccupation: { code: '15-1252.00', title: 'Software Developers' },
  reportedTitles: ['Platform Software Engineer'],
  relatedOccupations: [{ code: '15-1299.08', title: 'Computer Systems Engineers/Architects' }],
  technologyExamples: ['Kubernetes', 'Terraform'],
  attribution: 'O*NET test fixture attribution',
}

describe('V31 domain packs and role intelligence', () => {
  it('activates technical context and limits public execution to relevant surfaces', () => {
    const intake = roleIntake({ title: 'Platform Engineer', mustHaves: ['Kubernetes', 'Terraform', 'AWS'] })
    const profile = buildDomainPackProfile(intake)
    expect(profile.activeIds.has('technical')).toBe(true)

    const plan = buildCanonicalAgenticSearchPlan(intake)
    const publicExecutable = new Set(plan.lanes.flatMap(lane => lane.tasks
      .filter(task => task.mode === 'executable' && task.surface !== 'candidate_database')
      .map(task => task.surface)))
    expect(publicExecutable.has('github')).toBe(true)
    expect(publicExecutable.has('research_publications')).toBe(false)
  })

  it('activates healthcare context without pretending GitHub is a healthcare people registry', () => {
    const intake = roleIntake({ title: 'Nurse Practitioner', mustHaves: ['primary care', 'clinical practice'] })
    const profile = buildDomainPackProfile(intake)
    expect(profile.activeIds.has('healthcare')).toBe(true)

    const plan = buildCanonicalAgenticSearchPlan(intake)
    const publicExecutable = new Set(plan.lanes.flatMap(lane => lane.tasks
      .filter(task => task.mode === 'executable' && task.surface !== 'candidate_database')
      .map(task => task.surface)))
    expect(publicExecutable.has('research_publications')).toBe(true)
    expect(publicExecutable.has('github')).toBe(false)
  })

  it('supports multiple domain packs for genuinely cross-domain roles', () => {
    const intake = roleIntake({ title: 'Clinical Informatics Engineer', mustHaves: ['clinical systems', 'Python', 'data engineering'] })
    const ids = detectDomainPacks(intake).map(match => match.id)
    expect(ids).toContain('technical')
    expect(ids).toContain('healthcare')
  })

  it('keeps a federal-only pack honest about executable public people sources', () => {
    const intake = roleIntake({
      title: 'Federal Program Manager',
      clearance: 'Secret',
      mustHaves: ['program management', 'stakeholder management'],
    })
    const profile = buildDomainPackProfile(intake)
    expect(profile.activeIds.has('federal')).toBe(true)
    expect(profile.executablePublicSurfaces.size).toBe(0)

    const plan = buildCanonicalAgenticSearchPlan(intake)
    const externalExecutable = plan.lanes.flatMap(lane => lane.tasks.filter(task =>
      task.mode === 'executable' && task.surface !== 'candidate_database',
    ))
    expect(externalExecutable).toHaveLength(0)
    expect(plan.lanes.some(lane => lane.tasks.some(task => task.surface === 'linkedin_recruiter' && task.mode === 'guided'))).toBe(true)
  })

  it('uses O*NET as search expansion context without changing recruiter-approved requirements', () => {
    const intake = roleIntake({
      title: 'Platform Engineer',
      mustHaves: ['AWS'],
      adjacentBackgrounds: ['Site Reliability Engineer'],
    })
    const expansion = onetSearchExpansion(onetFixture)
    const enriched = enrichRoleIntakeWithOnet(intake, onetFixture)
    expect(expansion.technologyHints).toContain('Kubernetes')
    expect(enriched.mustHaves).toEqual(['AWS'])
    expect(enriched.niceToHaves).toEqual([])
    expect(enriched.adjacentBackgrounds).toContain('Software Developers')
    expect(enriched.adjacentBackgrounds).toContain('Platform Software Engineer')

    const plan = buildCanonicalAgenticSearchPlan(intake, undefined, { onet: onetFixture })
    expect(plan.roleIntelligence.onetOccupation?.code).toBe('15-1252.00')
    expect(plan.lanes.find(lane => lane.id === 'adjacent_title')?.query).toMatch(/Software Developers|Platform Software Engineer/)
  })

  it('keeps O*NET enrichment authenticated, title-only, fixed-host, cacheable, and API-key free', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/role-intelligence/onet/route.ts', import.meta.url)),
      'utf8',
    )
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench'")
    expect(route).toContain("const ONET_DATA_ORIGIN = 'https://www.onetcenter.org'")
    expect(route).toContain("const ONET_DATA_ROOT = '/dl_files/database/db_31_0_json'")
    expect(route).toContain("datasetJson<OccupationRow>('occupation_data.json')")
    expect(route).toContain("datasetJson<ReportedTitleRow>('sample_of_reported_titles.json')")
    expect(route).toContain("datasetJson<RelatedRow>('related_occupations.json')")
    expect(route).toContain("datasetJson<SoftwareSkillRow>('software_skills.json')")
    expect(route).toContain('next: { revalidate: CACHE_SECONDS }')
    expect(route).toContain('Only the normalized role title')
    expect(route).not.toContain('ONET_API_KEY')
    expect(route).not.toContain('api-v2.onetcenter.org')
    expect(route).not.toContain('rawDescription')
    expect(route).not.toContain('candidateId')
  })
})
