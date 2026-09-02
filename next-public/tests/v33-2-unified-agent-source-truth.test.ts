import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('V33.2 unified agent source-truth boundary', () => {
  it('requires canonical person envelopes before the agent can present a save action', () => {
    const route = read('app/api/agentic-search/route.ts')
    const panel = read('components/RoleAgenticSearchPanel.tsx')
    expect(route).toContain('saveEligible')
    expect(route).toContain('sourceResult')
    expect(route).toContain("entityKind === 'person'")
    expect(panel).toContain('result.saveEligible && result.sourceResult')
    expect(panel).toContain('Save + add to role review')
  })

  it('re-validates public-source records at the canonical write boundary', () => {
    const route = read('app/api/workbench/save-source-profile/route.ts')
    expect(route).toContain('assertCanonicalPersonSourceResult')
    expect(route).toContain('Provider/database-shaped request bodies are not canonical public evidence')
    expect(route).toContain("sourceResult.entityKind !== 'person'")
  })

  it('keeps raw client evidence from becoming persisted truth without source linkage', () => {
    const route = read('app/api/workbench/save-source-profile/route.ts')
    expect(route).toContain('sourceProfileId')
    expect(route).toContain('sourceTextRef')
    expect(route).toContain('spanStart')
    expect(route).toContain('spanEnd')
    expect(route).not.toContain('confidence: req.body.confidence')
  })

  it('creates automatic identity proposals only from deterministic anchors and never links profiles', () => {
    const service = read('lib/identity-proposal-service-v33-2.ts')
    const saveRoute = read('app/api/workbench/save-source-profile/route.ts')
    expect(service).toContain('!comparison.deterministicAnchor')
    expect(service).toContain('This function never links source profiles')
    expect(service).not.toContain(".update({ candidate_id:")
    expect(saveRoute).toContain('createDeterministicIdentityProposals')
    expect(saveRoute).toContain('nothing was merged automatically')
  })

  it('routes agentic GitHub and Stack Overflow through canonical source-result envelopes', () => {
    const route = read('app/api/agentic-search/route.ts')
    const plan = read('lib/agentic-search-v30.ts')
    expect(route).toContain('searchGitHubPeople')
    expect(route).toContain('searchStackOverflowTalent')
    expect(route).toContain("'github', 'stackoverflow'")
    expect(plan).toContain("surface: 'stackoverflow'")
    expect(plan).toContain("connectorKeys: ['stackoverflow']")
  })

  it('moves an explicitly saved canonical candidate into the active role review slate', () => {
    const panel = read('components/RoleAgenticSearchPanel.tsx')
    expect(panel).toContain('const { roles, mode, updateRole } = useRoleWorkspaces()')
    expect(panel).toContain('function linkSavedCandidateToRole')
    expect(panel).toContain('workspace.candidates.some(candidate => candidate.candidateId === params.candidateId)')
    expect(panel).toContain("source: 'candidate_database'")
    expect(panel).toContain("stage: 'needs_review'")
    expect(panel).toContain("fitDecision: 'unreviewed'")
    expect(panel).toContain("evidenceStatus: 'unreviewed'")
    expect(panel).toContain('Save + add to role review')
  })

  it('keeps the source-linked pre-shortlist evidence contract in the V33.4 unified workbench', () => {
    const route = read('app/api/role-candidate-assessment/route.ts')
    const workbench = read('components/RoleUnifiedWorkbenchV33_4.tsx')
    const page = read('app/app/roles/[id]/page.tsx')
    expect(route).toContain('buildEvidenceLedger')
    expect(route).toContain('buildRequirementAssessments')
    expect(route).toContain('Missing evidence remains unknown and never becomes a negative finding.')
    expect(route).toContain('This is an evidence review slate, not a fit score, ranking, rejection, or hiring recommendation.')
    expect(route).toContain("? 'evidence_ready'")
    expect(route).not.toContain("fitDecision: 'strong_fit'")
    expect(workbench).toContain('Review slate · evidence before decision')
    expect(workbench).toContain('Evidence strength')
    expect(workbench).toContain('Open-to-work evidence')
    expect(workbench).toContain('Clearance breadcrumb')
    expect(workbench).toContain('Evidence gaps')
    expect(page).toContain("tab === 'candidates' && <RoleUnifiedWorkbenchV33_4")
  })
})
