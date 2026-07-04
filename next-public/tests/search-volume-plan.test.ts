import { describe, expect, it } from 'vitest'
import { buildManualSafeLanes, buildQueryVariants, buildVolumeSearchPlan } from '../lib/search/volume-plan'

describe('search volume plan', () => {
  const chips = [
    { canonical: 'DevSecOps Engineer', type: 'title' },
    { canonical: 'Kubernetes', type: 'skill' },
    { canonical: 'Terraform', type: 'skill' },
    { canonical: 'AWS GovCloud', type: 'skill' },
    { canonical: 'TS/SCI', type: 'clearance' },
    { canonical: 'Northern Virginia', type: 'location' },
  ]

  it('builds query variants without inventing candidates', () => {
    const variants = buildQueryVariants('DevSecOps Kubernetes Terraform TS/SCI Northern Virginia', chips)
    expect(variants.map(v => v.id)).toContain('exact')
    expect(variants.map(v => v.id)).toContain('skills-only')
    expect(variants.map(v => v.id)).toContain('broad')
    expect(variants.map(v => v.id)).toContain('govcon-manual-safe')
    expect(variants.map(v => v.query).join(' ')).not.toMatch(/verified candidate/i)
  })

  it('expands source coverage by mode', () => {
    const precision = buildVolumeSearchPlan({ rawQuery: 'Kubernetes Terraform AWS', chips, mode: 'precision' })
    const broad = buildVolumeSearchPlan({ rawQuery: 'Kubernetes Terraform AWS', chips, mode: 'broad' })
    const market = buildVolumeSearchPlan({ rawQuery: 'Kubernetes Terraform AWS', chips, mode: 'market_map' })

    expect(precision.sourceLimit).toBe(6)
    expect(broad.sourceLimit).toBe(10)
    expect(market.sourceLimit).toBe(12)
    expect(broad.liveSources.length).toBeGreaterThan(precision.liveSources.length)
    expect(market.liveSources.length).toBeGreaterThanOrEqual(broad.liveSources.length)
  })

  it('creates manual-safe lanes with no scraping and no auto-import language', () => {
    const lanes = buildManualSafeLanes('DevSecOps Kubernetes Terraform TS/SCI', chips)
    const labels = lanes.map(l => l.label)
    expect(labels).toContain('Public Resume X-Ray')
    expect(labels).toContain('Portfolio / personal site X-Ray')
    expect(labels).toContain('Conference speaker X-Ray')
    expect(labels).toContain('LinkedIn X-Ray string')
    expect(labels).toContain('GovCon / clearance breadcrumb X-Ray')
    expect(lanes.map(l => l.note).join(' ')).toContain('No scraping')
    expect(lanes.map(l => l.note).join(' ')).toContain('no auto-import')
  })

  it('keeps clearance as an unverified breadcrumb', () => {
    const plan = buildVolumeSearchPlan({ rawQuery: 'TS/SCI DevSecOps Kubernetes', chips, mode: 'market_map' })
    expect(plan.queryVariants.some(v => v.note.includes('Public clearance text is not verification'))).toBe(true)
    expect(plan.lowResultActions.join(' ')).toContain('manual-safe breadcrumbs')
  })
})
