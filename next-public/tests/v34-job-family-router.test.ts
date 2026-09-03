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
    expect(routing.contextModifiers.map(match => match.id)).toContain('federal_govcon')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['stackoverflow', 'github']))
    expect(routing.deprioritizedPublicSurfaces).toContain('devto')
    expect(routing.deprioritizedPublicSurfaces).toContain('huggingface')
  })

  it('routes frontend and application software roles to developer evidence communities', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Senior Frontend Engineer', mustHaves: ['TypeScript', 'React'] }))
    expect(routing.primaryFamily).toBe('software')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('distinguishes cloud/devops from classic systems administration', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Senior DevOps Engineer', mustHaves: ['Kubernetes', 'Terraform', 'AWS'] }))
    expect(routing.primaryFamily).toBe('cloud_devops')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('keeps cybersecurity and federal context as separate concurrent routing signals', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'SOC Analyst', mustHaves: ['SIEM', 'Splunk', 'incident response'], clearance: 'TS/SCI' }))
    expect(routing.primaryFamily).toBe('cybersecurity')
    expect(routing.contextModifiers.map(match => match.id)).toContain('federal_govcon')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow']))
  })

  it('routes AI/ML roles toward Hugging Face and research evidence as well as public code', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Machine Learning Engineer', mustHaves: ['PyTorch', 'LLM', 'RAG'] }))
    expect(routing.primaryFamily).toBe('ai_ml')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['huggingface', 'github', 'research_publications', 'stackoverflow']))
  })

  it('routes data engineering separately from general application software', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Data Engineer', mustHaves: ['Snowflake', 'dbt', 'Airflow', 'SQL'] }))
    expect(routing.primaryFamily).toBe('data')
  })

  it('routes clinical roles to registry and research surfaces rather than developer communities', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Registered Nurse', mustHaves: ['RN', 'critical care'] }))
    expect(routing.primaryFamily).toBe('healthcare_clinical')
    expect(routing.preferredPublicSurfaces).toEqual(expect.arrayContaining(['healthcare_registry', 'research_publications']))
    expect(routing.deprioritizedPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto', 'huggingface']))
  })

  it('routes publication-heavy science roles to the research graph', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Research Scientist', mustHaves: ['publication record', 'experimental design'] }))
    expect(routing.primaryFamily).toBe('research_science')
    expect(routing.preferredPublicSurfaces).toContain('research_publications')
  })

  it('recognizes regulated finance without pretending developer sources are primary talent evidence', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Financial Advisor', mustHaves: ['Series 7', 'wealth management'] }))
    expect(routing.primaryFamily).toBe('finance_regulated')
    expect(routing.preferredPublicSurfaces).toEqual([])
    expect(routing.deprioritizedPublicSurfaces).toEqual(expect.arrayContaining(['github', 'stackoverflow', 'devto']))
  })

  it('recognizes aviation roles as authority-led rather than developer-community searches', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Aircraft Mechanic', mustHaves: ['A&P mechanic', 'aircraft maintenance'] }))
    expect(routing.primaryFamily).toBe('aviation')
    expect(routing.preferredPublicSurfaces).toEqual([])
  })

  it('routes an aviation occupation from A&P credential language', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Aircraft Maintenance Technician', mustHaves: ['A&P certificate'] }))
    expect(routing.primaryFamily).toBe('aviation')
    expect(routing.occupationResolved).toBe(true)
  })

  it('keeps federal/GovCon as context while program management remains the occupation', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Federal Program Manager', clearance: 'Secret', mustHaves: ['program management'] }))
    expect(routing.primaryFamily).toBe('program_management')
    expect(routing.contextModifiers.map(item => item.id)).toContain('federal_govcon')
    expect(routing.preferredPublicSurfaces).toEqual([])
    expect(routing.deprioritizedPublicSurfaces).toContain('github')
  })

  it('preserves a talent acquisition occupation when federal context is present', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Technical Sourcer',
      clearance: 'Secret',
      mustHaves: ['sourcing', 'boolean search'],
      rawDescription: 'Technical sourcer for a federal contractor supporting cleared programs',
    }))
    expect(routing.primaryFamily).toBe('talent_acquisition')
    expect(routing.contextModifiers.map(item => item.id)).toContain('federal_govcon')
    expect(routing.deprioritizedPublicSurfaces).toContain('github')
  })

  it.each([
    ['Product Manager', 'product_management'],
    ['Enterprise Account Executive', 'gtm_sales'],
    ['Warehouse Operations Supervisor', 'operations'],
    ['Regulatory Counsel', 'legal_compliance'],
  ] as const)('adds explicit occupational coverage for %s', (title, expectedFamily) => {
    const routing = buildJobFamilyRoutingV34(role({ title, rawDescription: title }))
    expect(routing.primaryFamily).toBe(expectedFamily)
    expect(routing.occupationResolved).toBe(true)
    expect(routing.deprioritizedPublicSurfaces).toContain('github')
  })

  it('falls back honestly when occupational intelligence is still missing', () => {
    const routing = buildJobFamilyRoutingV34(role({ title: 'Executive Assistant', rawDescription: 'Executive assistant supporting a leadership team' }))
    expect(routing.primaryFamily).toBe('general')
    expect(routing.occupationResolved).toBe(false)
    expect(routing.rationale.join(' ')).toMatch(/no occupational family/i)
  })

  it('never selects a context modifier as primary', () => {
    for (const clearance of ['Secret', 'TS/SCI', 'Public Trust']) {
      const routing = buildJobFamilyRoutingV34(role({ title: 'Executive Assistant', clearance }))
      expect(routing.primaryFamily, clearance).not.toBe('federal_govcon')
      expect(routing.contextModifiers.map(item => item.id), clearance).toContain('federal_govcon')
    }
  })

  it('never mutates recruiter-approved role truth while routing sources', () => {
    const intake = role({ title: 'RHEL administrator', mustHaves: ['RHEL', '5+ years relevant experience'], clearance: 'Secret or higher', location: 'Annapolis Junction, MD' })
    const snapshot = JSON.parse(JSON.stringify(intake))
    buildJobFamilyRoutingV34(intake)
    expect(intake).toEqual(snapshot)
  })
})
