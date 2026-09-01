import { describe, expect, it } from 'vitest'
import { buildJobFamilyRoutingV34 } from '@/lib/job-family-router-v34'
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

describe('V34 explainable job-family source routing', () => {
  it('routes RHEL administration to infrastructure communities rather than generic developer communities', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'RHEL administrator',
      mustHaves: ['RHEL', 'Linux', 'Ansible'],
      clearance: 'Secret or higher',
      location: 'Annapolis Junction, MD',
    }))

    expect(routing.primaryFamily).toBe('infrastructure')
    expect(routing.matches.map(match => match.id)).toContain('federal_govcon')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['stackoverflow', 'github']))
    expect(routing.deprioritizedPublicSurfaces).toContain('devto')
    expect(routing.deprioritizedPublicSurfaces).toContain('huggingface')
  })

  it('routes frontend and application software roles to developer evidence communities', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Senior Frontend Engineer',
      mustHaves: ['TypeScript', 'React'],
    }))

    expect(routing.primaryFamily).toBe('software')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('distinguishes cloud/devops from classic systems administration', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Senior DevOps Engineer',
      mustHaves: ['Kubernetes', 'Terraform', 'AWS'],
    }))

    expect(routing.primaryFamily).toBe('cloud_devops')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('keeps cybersecurity and federal context as separate concurrent routing signals', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'SOC Analyst',
      mustHaves: ['SIEM', 'Splunk', 'incident response'],
      clearance: 'TS/SCI',
    }))

    expect(routing.primaryFamily).toBe('cybersecurity')
    expect(routing.matches.map(match => match.id)).toEqual(expect.arrayContaining(['cybersecurity', 'federal_govcon']))
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow']))
  })

  it('routes AI/ML roles toward Hugging Face and research evidence as well as public code', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Machine Learning Engineer',
      mustHaves: ['PyTorch', 'LLM', 'RAG'],
    }))

    expect(routing.primaryFamily).toBe('ai_ml')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['huggingface', 'github', 'research_publications', 'stackoverflow']))
  })

  it('routes data engineering separately from general application software', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Data Engineer',
      mustHaves: ['Snowflake', 'dbt', 'Airflow', 'SQL'],
    }))

    expect(routing.primaryFamily).toBe('data')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('routes clinical roles to registry and research surfaces rather than developer communities', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Registered Nurse',
      mustHaves: ['RN', 'critical care'],
    }))

    expect(routing.primaryFamily).toBe('healthcare_clinical')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['healthcare_registry', 'research_publications']))
    expect(routing.deprioritizedPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto', 'huggingface']))
  })

  it('routes publication-heavy science roles to the research graph', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Research Scientist',
      mustHaves: ['publication record', 'experimental design'],
    }))

    expect(routing.primaryFamily).toBe('research_science')
    expect(routing.preferredPublicSurfaces).toContain('research_publications')
  })

  it('recognizes regulated finance without pretending developer sources are primary talent evidence', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Financial Advisor',
      mustHaves: ['Series 7', 'wealth management'],
    }))

    expect(routing.primaryFamily).toBe('finance_regulated')
    expect(routing.preferredPublicSurfaces).toEqual([])
    expect(routing.deprioritizedPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('recognizes aviation roles as authority-led rather than developer-community searches', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Aircraft Mechanic',
      mustHaves: ['A&P mechanic', 'aircraft maintenance'],
    }))

    expect(routing.primaryFamily).toBe('aviation')
    expect(routing.preferredPublicSurfaces).toEqual([])
  })

  it('recognizes cleared federal roles even when they have no technical family', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Federal Program Manager',
      clearance: 'Secret',
      mustHaves: ['program management'],
    }))

    expect(routing.primaryFamily).toBe('federal_govcon')
    expect(routing.preferredPublicSurfaces).toEqual([])
  })

  it('falls back explicitly to general instead of inventing a specialized source family', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Product Manager',
      mustHaves: ['roadmapping', 'stakeholder management'],
    }))

    expect(routing.primaryFamily).toBe('general')
    expect(routing.preferredPublicSurfaces).toEqual([])
    expect(routing.rationale.join(' ')).toMatch(/no specialized family/i)
  })

  it('never mutates recruiter-approved role truth while routing sources', () => {
    const intake = role({
      title: 'RHEL administrator',
      mustHaves: ['RHEL', '5+ years relevant experience'],
      clearance: 'Secret or higher',
      location: 'Annapolis Junction, MD',
    })
    const snapshot = JSON.parse(JSON.stringify(intake))

    buildJobFamilyRoutingV34(intake)

    expect(intake).toEqual(snapshot)
  })
})
