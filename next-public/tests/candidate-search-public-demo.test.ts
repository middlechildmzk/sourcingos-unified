import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Candidate Search public demo', () => {
  const page = read('app/candidate-search/page.tsx')
  const builder = read('components/CandidateSearchV25Builder.tsx')
  const trustLayer = read('components/CandidateSearchTrustLayer.tsx')
  const drawer = read('components/CandidateDrawer.tsx')
  const results = read('components/WorkbenchResults.tsx')
  const workbench = read('components/WorkbenchClient.tsx')
  const marketMap = read('components/MarketMapSummary.tsx')
  const route = read('app/api/workbench/search-source/route.ts')

  it('renders public trust disclaimers and confidence framing', () => {
    expect(page).toContain('Public evidence matches only')
    expect(page).toContain('Not confirmed candidates')
    expect(page).toContain('Contact signals unverified')
    expect(page).toContain('Confidence means source relevance only')
  })

  it('keeps required example searches available', () => {
    expect(builder).toContain('cleared DevSecOps')
    expect(builder).toContain('senior Kubernetes platform engineers')
    expect(builder).toContain('AI/ML researchers')
    expect(builder).toContain('nurse recruiters')
    expect(builder).toContain('healthcare data analysts')
  })

  it('explains source lane routing and clearance breadcrumbs safely', () => {
    expect(trustLayer).toContain('GitHub / code evidence')
    expect(trustLayer).toContain('Open web / X-Ray')
    expect(trustLayer).toContain('Research / publications')
    expect(trustLayer).toContain('Package ecosystem')
    expect(trustLayer).toContain('Healthcare / license / registry')
    expect(trustLayer).toContain('GovCon / clearance breadcrumb')
    expect(trustLayer).toContain('AI / ML ecosystem')
    expect(trustLayer).toContain('unverified breadcrumb, not a verified clearance')
  })

  it('gates durable workflow actions in public mode', () => {
    expect(trustLayer).toContain('Save source profile')
    expect(trustLayer).toContain('Add to project')
    expect(trustLayer).toContain('Confirm same person')
    expect(trustLayer).toContain('Create Candidate 360')
    expect(trustLayer).toContain('Contact enrichment')
    expect(trustLayer).toContain('Export dossier')
    expect(trustLayer).toContain('This is available in the private beta')
  })

  it('separates evidence drawer concepts and avoids identity verification claims', () => {
    expect(drawer).toContain('Public facts')
    expect(drawer).toContain('Public signals')
    expect(drawer).toContain('Assumptions to avoid')
    expect(drawer).toContain('Missing data')
    expect(drawer).toContain('Verify-next checklist')
    expect(drawer).toContain('Safe outreach angle draft')
    expect(drawer).toContain('Saving does not verify identity, clearance, employment, or contact accuracy')
  })

  it('result cards keep confidence and verification language honest', () => {
    expect(results).toContain('Evidence-first source profile results')
    expect(results).toContain('Confidence means source relevance only')
    expect(results).toContain('Risk flags')
    expect(results).toContain('Recommended next verification step')
    expect(results).not.toContain('verified candidate')
  })

  it('adds search modes, market map summary, and low-result rescue', () => {
    expect(workbench).toContain('SearchModeSelector')
    expect(workbench).toContain('MarketMapSummary')
    expect(marketMap).toContain('Market map summary')
    expect(marketMap).toContain('Low-result rescue')
    expect(marketMap).toContain('public-source discovery, not confirmed candidates')
  })

  it('raises public source caps and broadens public-safe source coverage', () => {
    expect(route).toContain('max(12)')
    expect(route).toContain("'stackoverflow'")
    expect(route).toContain("'devto'")
    expect(route).toContain("'dockerhub'")
    expect(route).toContain("'semantic_scholar'")
    expect(route).toContain("'arxiv'")
    expect(route).toContain("'resume_xray'")
    expect(route).toContain('Confidence means source relevance only')
  })
})
