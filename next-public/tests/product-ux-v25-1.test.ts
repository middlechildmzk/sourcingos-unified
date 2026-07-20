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

describe('V25.1 recruiter-first product experience', () => {
  it('keeps the primary navigation focused on four recruiter destinations', () => {
    for (const destination of ["label: 'Today'", "label: 'Roles'", "label: 'AutoSource'", "label: 'Candidates'"]) expect(shell).toContain(destination)
    expect(shell).toContain('Tools & data')
    expect(shell).toContain('app-tools-toggle')
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

  it('promotes recruiter-accepted discoveries into canonical candidates', () => {
    expect(autoSourceApi).toContain('promoteStoredDiscovery')
    expect(acquisition).toContain("manual ? 'accepted' : 'auto_promoted'")
    expect(acquisition).toContain("status: manual || d.identityConfidence >= 92 ? 'confirmed' : 'pending'")
  })

  it('learns recruiter memory only after repeated decisions and approval', () => {
    expect(automation).toContain('reviewed.length < 3')
    expect(automation).toContain('supportingEvents')
    expect(agentEngine).toContain('buildMemoryProposals')
    expect(agentEngine).toContain('applyMemoryProposals')
    expect(agentEngine).toContain("approval.approval_type === 'calibration'")
  })

  it('connects scheduled acquisition, workflows, enrichment, and daily briefs', () => {
    expect(cron).toContain('runDueAgentWorkflows')
    expect(cron).toContain('processEnrichmentQueue')
    expect(cron).toContain('generateDailyBrief')
  })

  it('moves operational role controls behind progressive disclosure', () => {
    expect(rolesPage).toContain('<details')
    expect(rolesPage).toContain('Workspace data, backup, and connected search controls')
  })

  it('uses real database conflict keys for role handoff', () => {
    expect(automation).toContain("onConflict: 'role_id,identity_key'")
    expect(automation).toContain("onConflict: 'role_id,event_key'")
    expect(automation).not.toContain("onConflict: 'owner_id,role_id,identity_key'")
  })
})
