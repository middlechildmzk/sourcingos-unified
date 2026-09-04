import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const shell = read('components/AppShell.tsx')
const shellCss = read('app/app/app-shell.css')
const today = read('components/AgentOSClient.tsx')
const agentApi = read('app/api/agent-os/route.ts')
const agentEngine = read('lib/agent-os-v25.ts')
const automation = read('lib/agent-automation-v25-1.ts')
const autoSourceApi = read('app/api/autosource/campaigns/route.ts')
const acquisition = read('lib/acquisition-engine-v22.ts')
const cron = read('app/api/cron/autosource/route.ts')
const rolesPage = read('app/app/roles/page.tsx')
const roleDetailPage = read('app/app/roles/[id]/page.tsx')
const roleWorkspace = read('components/RoleWorkspaceV37.tsx')

describe('V25.1 recruiter-first product experience', () => {
  it('keeps the primary navigation focused on the canonical V37 recruiter workflows', () => {
    for (const destination of ["label: 'Today'", "label: 'Roles'", "label: 'Search'", "label: 'Talent'", "label: 'Sources'"]) expect(shell).toContain(destination)
    expect(shell).not.toContain("label: 'Search Lab'")
    expect(shell).not.toContain("label: 'AutoSource'")
    expect(shell).toContain('Evidence visible. Decisions stay human.')
    expect(shellCss).toContain('.app-sidebar')
    expect(shellCss).toContain('.product-row')
  })

  it('converges approvals, candidates, roles, and briefs on Today', () => {
    expect(today).toContain('Needs your attention')
    expect(today).toContain("action: 'inbox_to_role'")
    expect(today).toContain("action: 'daily_brief'")
    expect(today).toContain("action: 'create_from_role'")
    expect(agentApi).toContain("sb.from('autosource_inbox')")
    expect(agentApi).toContain("sb.from('role_workspaces')")
  })

  it('promotes only recruiter-accepted discoveries into canonical candidates', () => {
    expect(autoSourceApi).toContain('promoteStoredDiscovery')
    expect(acquisition).toContain('Automated Candidate Graph promotion is disabled; recruiter review is required.')
    expect(acquisition).toContain("const disposition = 'needs_review' as const")
    expect(acquisition).toContain("merge_status: 'pending'")
    expect(acquisition).not.toContain("'auto_promoted'")
    expect(acquisition).not.toContain("status: manual || d.identityConfidence >= 92 ? 'confirmed' : 'pending'")
  })

  it('learns recruiter memory only after repeated decisions and approval', () => {
    expect(automation).toContain('reviewed.length < 3')
    expect(automation).toContain('supportingEvents')
    expect(agentEngine).toContain('buildMemoryProposals')
    expect(agentEngine).toContain('applyMemoryProposals')
    expect(agentEngine).toContain("approval.approval_type === 'calibration'")
  })

  it('keeps acquisition workflow, enrichment, and daily-brief functions available behind explicit controls', () => {
    expect(cron).toContain('runDueAgentWorkflows')
    expect(cron).toContain('processEnrichmentQueue')
    expect(cron).toContain('generateDailyBrief')
  })

  it('replaces role-page disclosure archaeology with one canonical workbench and explicit advanced route', () => {
    expect(rolesPage).toContain('<RolesPortfolioV37 />')
    expect(rolesPage).not.toContain('<details')
    expect(roleDetailPage).toContain('<RoleWorkspaceV37 roleId={id} />')
    expect(roleDetailPage).not.toContain('<details')
    expect(roleWorkspace).toContain('/advanced')
    expect(roleWorkspace).toContain('/activity')
  })

  it('uses real database conflict keys for role handoff', () => {
    expect(automation).toContain("onConflict: 'role_id,identity_key'")
    expect(automation).toContain("onConflict: 'role_id,event_key'")
    expect(automation).not.toContain("onConflict: 'owner_id,role_id,identity_key'")
  })
})
