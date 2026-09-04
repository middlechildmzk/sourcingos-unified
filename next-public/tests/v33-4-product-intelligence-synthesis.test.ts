import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

describe('V33.4 multi-model product intelligence synthesis', () => {
  it('keeps portfolio intelligence free of opaque AI fit ranking', () => {
    const desk = read('components/RolePortfolioIntelligenceV33_4.tsx')
    expect(desk).toContain('What needs your attention')
    expect(desk).toContain('What changed')
    expect(desk).toContain('Approved learning')
    expect(desk).toContain('evidence conflict')
    expect(desk).toContain('waiting')
    expect(desk).not.toContain('fitScore')
    expect(desk).not.toContain('matchPercent')
    expect(desk).not.toContain('market size')
  })

  it('keeps proposed search changes reviewable in V37 while preserving calibration approval safety', () => {
    const page = read('app/app/roles/[id]/page.tsx')
    const workspace = read('components/RoleWorkspaceV37.tsx')
    const advanced = read('app/app/roles/[id]/advanced/page.tsx')
    const preview = read('components/RoleCalibrationPreviewV33_4.tsx')
    expect(page).toContain('<RoleWorkspaceV37 roleId={id} />')
    expect(workspace).toContain('proposedLanes')
    expect(workspace).toContain('Needs review')
    expect(workspace).toContain('/advanced')
    expect(advanced).toContain('<RoleDetailClient roleId={id} initialTab="strategy" />')
    expect(preview).toContain('SourcingOS noticed a pattern')
    expect(preview).toContain('applyInsightAction')
    expect(preview).toContain('recommendLaneChanges')
    expect(preview).toContain('Approve learning')
    expect(preview).toContain('Not a pattern')
    expect(preview).toContain('search angles remain separately approval-gated')
    expect(preview).not.toContain('auto-reject')
  })

  it('preserves the strategic build/integrate boundary and rejected unsafe recommendations in the repo', () => {
    const doc = read('docs/AI_PRODUCT_REVIEW_SYNTHESIS_V33_4.md')
    expect(doc).toContain('## Build vs integrate vs partner')
    expect(doc).toContain('## Explicitly rejected recommendations')
    expect(doc).toContain('opaque 0–100 fit or match percentages')
    expect(doc).toContain('public-evidence "verified clearance"')
    expect(doc).toContain('automatic search mutation directly from thumbs-up/down without recruiter approval')
    expect(doc).toContain('unauthorized LinkedIn or restricted-source scraping')
    expect(doc).toContain('Recruiting Memory + Standing Search')
    expect(doc).toContain('Cross-role Candidate Intelligence')
  })
})
