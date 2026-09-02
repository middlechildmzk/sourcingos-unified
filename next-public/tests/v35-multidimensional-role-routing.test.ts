import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { buildJobFamilyRoutingV34 } from '@/lib/job-family-router-v34'
import type { RoleIntake } from '@/lib/role-workspace'

function role(overrides: Partial<RoleIntake>): RoleIntake {
  return {
    title: '',
    location: '',
    workMode: 'unknown',
    compensation: '',
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

describe('V35 multidimensional occupational routing', () => {
  it('keeps a federal technical sourcer in talent acquisition and reports federal as context', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Technical Sourcer',
      clearance: 'Secret',
      mustHaves: ['sourcing', 'boolean search'],
      rawDescription: 'Technical sourcer for a federal contractor supporting cleared programs',
    }))
    expect(routing.primaryFamily).toBe('talent_acquisition')
    expect(routing.occupationResolved).toBe(true)
    expect(routing.contextModifiers.map(item => item.id)).toContain('federal_govcon')
    expect(routing.deprioritizedPublicSurfaces).toContain('github')
  })

  it('keeps cleared program management as the occupation instead of federal context', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Program Manager',
      clearance: 'TS/SCI',
      mustHaves: ['program management'],
      rawDescription: 'Cleared program manager supporting a DoD contract',
    }))
    expect(routing.primaryFamily).toBe('program_management')
    expect(routing.contextModifiers.map(item => item.id)).toContain('federal_govcon')
  })

  it('routes aviation from an A&P credential signal', () => {
    const routing = buildJobFamilyRoutingV34(role({
      title: 'Aircraft Maintenance Technician',
      mustHaves: ['A&P certificate'],
      rawDescription: 'Aircraft maintenance technician with A&P certificate',
    }))
    expect(routing.primaryFamily).toBe('aviation')
    expect(routing.occupationResolved).toBe(true)
  })

  it.each([
    ['Product Manager', 'product_management'],
    ['Enterprise Account Executive', 'gtm_sales'],
    ['Warehouse Operations Supervisor', 'operations'],
    ['Regulatory Counsel', 'legal_compliance'],
  ] as const)('adds explicit occupational coverage for %s', (title, family) => {
    const routing = buildJobFamilyRoutingV34(role({ title, rawDescription: title }))
    expect(routing.primaryFamily).toBe(family)
    expect(routing.occupationResolved).toBe(true)
    expect(routing.deprioritizedPublicSurfaces).toContain('github')
  })

  it('emits routing_declined when neither occupational routing nor domain packs have source intelligence', () => {
    const plan = buildCanonicalAgenticSearchPlan(role({
      title: 'Executive Assistant',
      location: 'Baltimore, MD',
      rawDescription: 'Executive assistant supporting a two-person leadership team in Baltimore, MD',
    }))
    expect(plan.jobFamilyRouting.primaryFamily).toBe('general')
    expect(plan.jobFamilyRouting.occupationResolved).toBe(false)
    expect(plan.surfaceRouting.declinedSurfaces.length).toBeGreaterThan(0)
    expect(plan.surfaceRouting.decisions.filter(item => item.disposition === 'routing_declined').every(item => item.reason.includes('Unknown source suitability'))).toBe(true)
  })

  it('does not call an explicit family suppression a routing decline', () => {
    const plan = buildCanonicalAgenticSearchPlan(role({
      title: 'Technical Sourcer',
      mustHaves: ['sourcing'],
      rawDescription: 'Technical sourcer',
    }))
    expect(plan.jobFamilyRouting.primaryFamily).toBe('talent_acquisition')
    expect(plan.surfaceRouting.declinedSurfaces).toEqual([])
    expect(plan.surfaceRouting.suppressedSurfaces).toContain('github')
  })
})
