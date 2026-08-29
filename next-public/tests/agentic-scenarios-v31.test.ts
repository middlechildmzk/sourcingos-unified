import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '../lib/canonical-agentic-search-v30'
import type { RoleIntake } from '../lib/role-workspace'

function roleIntake(patch: Partial<RoleIntake> = {}): RoleIntake {
  return {
    title: 'Operations Manager',
    location: 'Denver, CO',
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

function externalExecutable(plan: ReturnType<typeof buildCanonicalAgenticSearchPlan>) {
  return plan.lanes.flatMap(lane => lane.tasks.filter(task =>
    task.mode === 'executable' && task.surface !== 'candidate_database',
  ))
}

describe('V31 honest agentic execution scenarios', () => {
  it('executes technical public evidence for a platform engineer', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake({
      title: 'Platform Engineer',
      mustHaves: ['Kubernetes', 'Terraform', 'AWS'],
      niceToHaves: ['Go'],
    }))
    const tasks = externalExecutable(plan)
    expect(tasks.some(task => task.surface === 'github' && task.connectorKeys?.includes('github'))).toBe(true)
    expect(tasks.some(task => task.surface === 'healthcare_registry')).toBe(false)
    expect(plan.domainPacks.map(pack => pack.id)).toContain('technical')
  })

  it('executes the public NPI Registry for a provider role', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake({
      title: 'Nurse Practitioner',
      location: 'Minneapolis, MN',
      mustHaves: ['primary care', 'patient care'],
    }))
    const exact = plan.lanes.find(lane => lane.id === 'exact_title')
    const npi = exact?.tasks.find(task => task.surface === 'healthcare_registry')
    expect(plan.domainPacks.map(pack => pack.id)).toContain('healthcare')
    expect(npi?.mode).toBe('executable')
    expect(npi?.connectorKeys).toEqual(['npi'])
    expect(npi?.query).toBe('Nurse Practitioner')
    expect(npi?.truth).toMatch(/not proof of interest, availability, or job fit/i)
  })

  it('does not mistake a healthcare technology role for a licensed-provider lookup', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake({
      title: 'Epic Clinical Analyst',
      mustHaves: ['Epic', 'clinical workflows'],
    }))
    expect(plan.domainPacks.map(pack => pack.id)).toContain('healthcare')
    expect(externalExecutable(plan).some(task => task.surface === 'healthcare_registry')).toBe(false)
  })

  it('keeps a federal-only role guided rather than inventing an executable people source', () => {
    const plan = buildCanonicalAgenticSearchPlan(roleIntake({
      title: 'Federal Program Manager',
      clearance: 'Secret',
      mustHaves: ['program management', 'stakeholder management'],
    }))
    expect(plan.domainPacks.map(pack => pack.id)).toContain('federal')
    expect(externalExecutable(plan)).toHaveLength(0)
    expect(plan.lanes.some(lane => lane.tasks.some(task => task.surface === 'linkedin_recruiter' && task.mode === 'guided'))).toBe(true)
    expect(plan.lanes.some(lane => lane.tasks.some(task => task.surface === 'clearancejobs' && task.mode === 'guided'))).toBe(true)
  })

  it('uses connector-specific task queries instead of replaying one query everywhere', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/agentic-search/route.ts', import.meta.url)),
      'utf8',
    )
    const panel = readFileSync(
      fileURLToPath(new URL('../components/RoleAgenticSearchPanel.tsx', import.meta.url)),
      'utf8',
    )
    expect(route).toContain('connectorQueries')
    expect(route).toContain('body.connectorQueries?.[connector] || body.query')
    expect(panel).toContain('connectorQueries[connector] = task.query')
  })

  it('keeps the NPI adapter fixed-host and privacy-minimized', () => {
    const adapter = readFileSync(
      fileURLToPath(new URL('../lib/agentic-npi-v31.ts', import.meta.url)),
      'utf8',
    )
    expect(adapter).toContain("const NPI_ORIGIN = 'https://npiregistry.cms.hhs.gov'")
    expect(adapter).toContain("enumeration_type: 'NPI-1'")
    expect(adapter).toContain('taxonomy_description: taxonomy')
    expect(adapter).not.toContain('telephone_number')
    expect(adapter).not.toContain('fax_number')
    expect(adapter).not.toContain('address_1')
    expect(adapter).not.toContain('postal_code')
  })

  it('keeps agent execution authenticated, rate-limited and read-only with registry truth', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/agentic-search/route.ts', import.meta.url)),
      'utf8',
    )
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench'")
    expect(route).toContain("execution: 'read_only_preview'")
    expect(route).toContain("persisted: false")
    expect(route).toContain('Professional-registry records are discovery and evidence inputs only')
    expect(route).not.toContain("from('candidates').insert")
  })
})
