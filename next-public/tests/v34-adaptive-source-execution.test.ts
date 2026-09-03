import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import type { AgenticSearchSurface } from '@/lib/agentic-search-v30'
import type { RoleIntake } from '@/lib/role-workspace'

function role(overrides: Partial<RoleIntake>): RoleIntake {
  return {
    title: 'Unspecified role',
    location: 'Not specified',
    workMode: 'unknown',
    compensation: 'Not specified',
    clearance: 'Not specified',
    mustHaves: [],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: '',
    ...overrides,
  }
}

function executablePublicSurfaces(intake: RoleIntake): Set<AgenticSearchSurface> {
  const plan = buildCanonicalAgenticSearchPlan(intake)
  return new Set(plan.lanes.flatMap(lane => lane.tasks
    .filter(task => task.mode === 'executable' && task.surface !== 'candidate_database')
    .map(task => task.surface)))
}

describe('V34 adaptive public-source execution', () => {
  it('executes infrastructure evidence communities for RHEL and suppresses noisy developer/research sources', () => {
    const intake = role({
      title: 'RHEL administrator',
      location: 'Annapolis Junction, MD',
      clearance: 'Secret or higher',
      mustHaves: ['RHEL', '5+ years relevant experience'],
      rawDescription: 'RHEL administrator with 5+ years relevant experience near Annapolis Junction, MD with Secret or higher',
    })
    const plan = buildCanonicalAgenticSearchPlan(intake)
    const surfaces = executablePublicSurfaces(intake)

    expect(plan.jobFamilyRouting.primaryFamily).toBe('infrastructure')
    expect(plan.jobFamilyRouting.contextModifiers.map(item => item.id)).toContain('federal_govcon')
    expect(surfaces).toEqual(new Set<AgenticSearchSurface>(['github', 'stackoverflow']))
  })

  it('keeps software engineering on GitHub, Stack Exchange, and DEV without AI/research spillover', () => {
    const surfaces = executablePublicSurfaces(role({
      title: 'Senior Frontend Engineer',
      mustHaves: ['TypeScript', 'React'],
      rawDescription: 'Senior frontend engineer with TypeScript and React',
    }))

    expect(surfaces).toEqual(new Set<AgenticSearchSurface>(['github', 'stackoverflow', 'devto']))
  })

  it('adds Hugging Face and research evidence for AI/ML while suppressing generic DEV author search', () => {
    const surfaces = executablePublicSurfaces(role({
      title: 'Machine Learning Engineer',
      mustHaves: ['PyTorch', 'LLM', 'RAG'],
      rawDescription: 'Machine learning engineer with PyTorch, LLM and RAG',
    }))

    expect(surfaces).toEqual(new Set<AgenticSearchSurface>(['github', 'stackoverflow', 'huggingface', 'research_publications']))
  })

  it('uses clinical registry/research evidence rather than developer communities for a nurse', () => {
    const plan = buildCanonicalAgenticSearchPlan(role({
      title: 'Registered Nurse',
      mustHaves: ['Epic', 'EMR/EHR'],
      rawDescription: 'Registered nurse with Epic and EMR experience',
    }))
    const surfaces = new Set(plan.lanes.flatMap(lane => lane.tasks
      .filter(task => task.mode === 'executable' && task.surface !== 'candidate_database')
      .map(task => task.surface)))

    expect(plan.jobFamilyRouting.primaryFamily).toBe('healthcare_clinical')
    expect(surfaces).toEqual(new Set<AgenticSearchSurface>(['healthcare_registry', 'research_publications']))
  })

  it('does not execute irrelevant public technical communities for a federal program manager', () => {
    const intake = role({
      title: 'Federal Program Manager',
      clearance: 'Secret',
      mustHaves: ['program management'],
      rawDescription: 'Federal program manager with Secret clearance',
    })
    const plan = buildCanonicalAgenticSearchPlan(intake)
    const surfaces = executablePublicSurfaces(intake)

    expect(plan.jobFamilyRouting.primaryFamily).toBe('program_management')
    expect(plan.jobFamilyRouting.contextModifiers.map(item => item.id)).toContain('federal_govcon')
    expect(plan.surfaceRouting.declinedSurfaces).toEqual([])
    expect(surfaces.size).toBe(0)
  })

  it('does not force developer-community sourcing onto regulated finance or aviation roles', () => {
    const finance = executablePublicSurfaces(role({
      title: 'Financial Advisor',
      mustHaves: ['Series 7', 'wealth management'],
      rawDescription: 'Financial advisor with Series 7 and wealth management',
    }))
    const aviation = executablePublicSurfaces(role({
      title: 'Aircraft Mechanic',
      mustHaves: ['A&P mechanic'],
      rawDescription: 'Aircraft mechanic with A&P mechanic experience',
    }))

    expect(finance.size).toBe(0)
    expect(aviation.size).toBe(0)
  })

  it('preserves guided recruiter surfaces while changing executable public sources', () => {
    const plan = buildCanonicalAgenticSearchPlan(role({
      title: 'SOC Analyst',
      clearance: 'TS/SCI',
      mustHaves: ['Splunk', 'SIEM'],
      rawDescription: 'SOC analyst with Splunk and SIEM and TS/SCI clearance',
    }))
    const tasks = plan.lanes.flatMap(lane => lane.tasks)

    expect(tasks.some(task => task.surface === 'linkedin_recruiter' && task.mode === 'guided')).toBe(true)
    expect(tasks.some(task => task.surface === 'clearancejobs' && task.mode === 'guided')).toBe(true)
    expect(tasks.some(task => task.surface === 'google_xray' && task.mode === 'guided')).toBe(true)
    for (const task of tasks.filter(task => ['github', 'stackoverflow', 'google_xray'].includes(task.surface))) {
      expect(task.query).not.toMatch(/ts\/?sci|clearance|citizenship|citizen/i)
    }
  })
})
