import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const page = read('app/app/search/page.tsx')
const workspace = read('components/SearchWorkspaceV38_1.tsx')
const searchRoute = read('app/api/candidate-data/search/route.ts')
const saveRoute = read('app/api/candidate-data/save/route.ts')
const orchestrator = read('lib/candidate-data/orchestrator-v36-8.ts')
const peopleRedirect = read('app/app/people-search/page.tsx')
const agenticRedirect = read('app/app/agentic-sourcing/page.tsx')
const labRedirect = read('app/app/candidate-search/page.tsx')

describe('V38.1 canonical Search + Review Workspace', () => {
  it('owns one authenticated people-search route while preserving legacy URLs as redirects', () => {
    expect(page).toContain('<SearchWorkspaceV38_1')
    expect(peopleRedirect).toContain("redirect('/app/search?from=people-search')")
    expect(agenticRedirect).toContain("redirect('/app/search?from=agentic-sourcing')")
    expect(labRedirect).toContain('/app/search?')
  })

  it('accepts role/query presets without auto-running provider search', () => {
    expect(page).toContain("initialQuery={sp.q || ''}")
    expect(page).toContain('roleId={sp.roleId}')
    expect(workspace).toContain('if (!initialQuery && role && !prefilledRole.current)')
    expect(workspace).toContain('Role-linked search · recruiter decisions stay attached to this role.')
  })

  it('keeps intentional search refinements attached to the prior people plan', () => {
    expect(workspace).toContain('...(previousPlan ? { previousPlan } : {})')
    expect(workspace).toContain('setPreviousPlan(next)')
    expect(workspace).toContain('Search / refine')
  })

  it('keeps slate Q&A separate from provider execution', () => {
    const askStart = workspace.indexOf('function askSlate')
    const askEnd = workspace.indexOf('function signedFor', askStart)
    expect(askStart).toBeGreaterThan(-1)
    expect(askEnd).toBeGreaterThan(askStart)
    const askBody = workspace.slice(askStart, askEnd)
    expect(askBody).toContain('buildSlateCopilotAnswerV38_1')
    expect(askBody).not.toContain('/api/agent-runtime/plan')
    expect(askBody).not.toContain('/api/candidate-data/search')
    expect(workspace).toContain('Ask about results')
    expect(workspace).toContain('Uses current slate · no provider rerun')
  })

  it('streams real provider-terminal progress but waits for the final retained slate', () => {
    expect(workspace).toContain('/api/candidate-data/search?stream=1')
    expect(workspace).toContain("streamEvent.type === 'provider'")
    expect(workspace).toContain("streamEvent.type === 'final'")
    expect(searchRoute).toContain("req.nextUrl.searchParams.get('stream') === '1'")
    expect(searchRoute).toContain("type: 'provider'")
    expect(searchRoute).toContain("type: 'final'")
    expect(orchestrator).toContain('onProviderSettled')
    expect(orchestrator).toContain('passesRetrievalRelevanceGateV37')
  })

  it('keeps paid contact reads behind a candidate-level recruiter approval action', () => {
    expect(workspace).toContain('Find contact')
    expect(workspace).toContain('Approve contact lookup')
    expect(workspace).toContain("fetch('/api/contact-enrichment/find'")
    expect(workspace).toContain("purpose: 'contact_bundle'")
    expect(workspace).not.toContain('send_outreach')
    expect(workspace).not.toContain('sync_ats')
  })

  it('saves only server-signed review observations before creating a canonical candidate', () => {
    expect(searchRoute).toContain('reviewObservations')
    expect(workspace).toContain('result?.reviewObservations.find')
    expect(workspace).toContain("fetch('/api/candidate-data/save'")
    expect(workspace).toContain('observationSignature: signed.observationSignature')
    expect(saveRoute).toContain('verifyProviderObservationV36_8')
    expect(saveRoute).toContain('Client-supplied entity kind, skills, contacts, and evidence are ignored.')
    expect(workspace).toContain('Save all retained')
  })

  it('makes Candidate 360 review, exports, and recruiter-authored disposition explicit', () => {
    expect(workspace).toContain('Candidate 360')
    expect(workspace).toContain('Export candidate brief')
    expect(workspace).toContain('Export CSV')
    expect(workspace).toContain('This is a SourcingOS candidate brief, not the candidate’s original resume.')
    expect(workspace).toContain("onReview('strong_fit')")
    expect(workspace).toContain("onReview('possible_fit')")
    expect(workspace).toContain("onReview('not_fit')")
    expect(workspace).toContain('These are recruiter-authored dispositions.')
  })
})
