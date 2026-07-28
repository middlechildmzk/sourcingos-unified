import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Candidate Search public demo', () => {
  const page = read('app/candidate-search/page.tsx')
  const composer = read('components/SearchComposer.tsx')
  const drawer = read('components/CandidateDrawer.tsx')
  const results = read('components/WorkbenchResults.tsx')
  const workbench = read('components/WorkbenchClient.tsx')
  const sourceStatus = read('components/SourceLaneStatus.tsx')
  const marketMap = read('components/MarketMapSummary.tsx')
  const route = read('app/api/workbench/search-source/route.ts')

  it('uses one concise public trust frame', () => {
    expect(page).toContain('Public evidence, not verified candidate facts')
    expect(page).toContain('Recruiters confirm identity')
    expect(page).toContain('<WorkbenchClient publicMode initialTab="composer" />')
    expect(page).not.toContain('CandidateSearchV25Builder')
    expect(page).not.toContain('PublicComposerDefault')
    expect(page).not.toContain('CandidateSearchTrustLayer')
  })

  it('keeps useful example searches in the single composer', () => {
    expect(composer).toContain('Kubernetes Terraform AWS platform')
    expect(composer).toContain('DevSecOps Kubernetes TS/SCI')
    expect(composer).toContain('Epic Azure healthcare data')
    expect(composer).toContain('MLOps Kubernetes Python')
  })

  it('keeps evidence and identity caveats available without repeating them on every row', () => {
    expect(drawer).toContain('Public facts')
    expect(drawer).toContain('Public signals')
    expect(drawer).toContain('Assumptions to avoid')
    expect(drawer).toContain('Missing data')
    expect(drawer).toContain('Verify-next checklist')
    expect(results).toContain('Unconfirmed public profiles')
    expect(results).not.toContain('Risk flags')
    expect(results).not.toContain('Recommended next verification step')
  })

  it('separates candidate people from other source subjects', () => {
    expect(results).toContain("result.entityKind === 'person'")
    expect(results).toContain('Supporting source subjects')
    expect(results).toContain('canPromoteToCandidate')
    expect(route).toContain('classifyRealSourceResults')
    expect(route).toContain('Only person records may be saved as candidates')
  })

  it('renders results before diagnostics and keeps diagnostics collapsed', () => {
    const resultsIndex = workbench.indexOf('<WorkbenchResults')
    const sourceIndex = workbench.indexOf('<SourceLaneStatus', resultsIndex)
    const marketMapIndex = workbench.indexOf('<MarketMapSummary', resultsIndex)
    expect(resultsIndex).toBeGreaterThan(-1)
    expect(sourceIndex).toBeGreaterThan(resultsIndex)
    expect(marketMapIndex).toBeGreaterThan(sourceIndex)
    expect(sourceStatus).not.toContain('open={running')
    expect(sourceStatus).toContain('<details className="lane-status-disclosure">')
  })

  it('retains advanced search modes and low-result rescue below successful results', () => {
    expect(workbench).toContain('SearchModeSelector')
    expect(workbench).toContain('MarketMapSummary')
    expect(marketMap).toContain('Low-result rescue')
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
