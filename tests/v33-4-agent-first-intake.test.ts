import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('V33.4 agent-first intake', () => {
  it('keeps the default setup to one prompt, one compact confirmation, and one launch action', () => {
    const source = readFileSync(new URL('../components/RoleIntakeWizardV33_4.tsx', import.meta.url), 'utf8')
    expect(source).toContain('Who are you looking for?')
    expect(source).toContain('Here’s what I’m looking for.')
    expect(source).toContain('Edit details')
    expect(source).toContain('Start sourcing →')
    expect(source).toContain("fetch('/api/role-intelligence/parse'")
    expect(source).not.toContain('How should SourcingOS search?')
    expect(source).not.toContain('Looks right — review search plan')
    expect(source).not.toContain('role-wizard-steps')
  })

  it('lets a clear natural-language role start without forcing a must-have field', () => {
    const source = readFileSync(new URL('../components/RoleIntakeWizardV33_4.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('I still need at least one non-negotiable capability')
    expect(source).toContain('I can start now and revisit these after seeing the first talent pool.')
    expect(source).toContain('The agent researches and builds an unreviewed slate.')
  })

  it('treats Start sourcing as explicit initial-pass authorization without hiring decisions', () => {
    const source = readFileSync(new URL('../components/RoleIntakeWizardV33_4.tsx', import.meta.url), 'utf8')
    expect(source).toContain("status: 'approved' as const")
    expect(source).toContain('authorized the initial')
    expect(source).toContain('It does not contact or advance anyone.')
  })

  it('launches the canonical existing sourcing agent and review-slate save path instead of creating a second execution engine', () => {
    const bridge = readFileSync(new URL('../components/RoleAutoStartV33_4.tsx', import.meta.url), 'utf8')
    expect(bridge).toContain('.agent-review-command-actions button.btn')
    expect(bridge).toContain('.agent-review-create-bar button.btn')
    expect(bridge).toContain('run sourcing agent')
    expect(bridge).toContain('create review slate')
    expect(bridge).toContain('never authorizes shortlist/reject/outreach')
  })

  it('uses an authenticated AI parser with deterministic fallback and no invented sensitive requirements', () => {
    const route = readFileSync(new URL('../app/api/role-intelligence/parse/route.ts', import.meta.url), 'utf8')
    const parser = readFileSync(new URL('../lib/ai/role-brief-parser-v33-4.ts', import.meta.url), 'utf8')
    expect(route).toContain('requireSession')
    expect(route).toContain("rateLimit(req, 'ai'")
    expect(parser).toContain('callModelJson')
    expect(parser).toContain('interpretRoleBrief')
    expect(parser).toContain('Do not invent requirements, employers, years, compensation, geography, clearance, citizenship, or disqualifiers.')
    expect(parser).toContain('Maximum 2 follow-up questions')
  })

  it('lands directly on the prompt and enters a confirmed role through the auto-start URL', () => {
    const source = readFileSync(new URL('../components/RoleWorkspaceClient.tsx', import.meta.url), 'utf8')
    expect(source).toContain('useState(true)')
    expect(source).toContain('Describe the person and let the agent do the setup.')
    expect(source).toContain('router.push(`/app/roles/${role.id}?start=1`)')
    expect(source).not.toContain("setShowCreate] = useState(false)")
  })

  it('keeps trust and taxonomy explanations behind progressive disclosure', () => {
    const source = readFileSync(new URL('../components/RoleIntakeWizardV33_4.tsx', import.meta.url), 'utf8')
    expect(source).toContain('<summary>How I interpreted this search</summary>')
    expect(source).toContain('related titles may broaden discovery but do not become hidden requirements')
    expect(source).not.toContain('role-wizard-trust-strip')
  })

  it('keeps O*NET technology examples as search context instead of recruiter-authored preferences', () => {
    const onet = readFileSync(new URL('../lib/onet-role-intelligence.ts', import.meta.url), 'utf8')
    expect(onet).toContain('technology examples remain source/search hints only')
    expect(onet).not.toContain('...expansion.technologyHints')
    expect(onet).toContain('adjacentBackgrounds: uniq')
  })
})
