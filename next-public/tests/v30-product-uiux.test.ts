import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const shell = read('components/AppShell.tsx')
const today = read('components/TodayInboxClient.tsx')
const roles = read('components/RoleWorkspaceClient.tsx')
const search = read('components/RoleSearchActions.tsx')
const layout = read('app/app/layout.tsx')
const ui = read('app/app/v30-uiux.css')

describe('V30 product experience release gate', () => {
  it('keeps the primary navigation focused on the recruiter workflow', () => {
    expect(shell).toContain("label: 'Today'")
    expect(shell).toContain("label: 'Roles'")
    expect(shell).toContain("label: 'Talent'")
    expect(shell).toContain('Research & data')
    expect(shell).toContain("label: 'Search Lab'")
    expect(shell).toContain("label: 'AutoSource'")
    expect(shell).toContain('Human approval stays in the loop.')
  })

  it('turns Today into a focus dashboard with resumable role work', () => {
    expect(today).toContain('Your next best decisions.')
    expect(today).toContain('Candidates to review')
    expect(today).toContain('Learning to review')
    expect(today).toContain('Resume a role')
    expect(today).toContain('Autonomous research · Human hiring decisions')
  })

  it('uses explainable workflow readiness rather than an opaque role health score', () => {
    expect(roles).toContain('function workflowReadiness')
    expect(roles).toContain('Confirm the role brief')
    expect(roles).toContain('Approve a search lane')
    expect(roles).toContain('Build the first slate')
    expect(roles).toContain('Review the first candidates')
    expect(roles).not.toContain('function roleHealth')
    expect(roles).not.toContain('search health')
  })

  it('does not ship the private role demo in the public role portfolio', () => {
    expect(roles).not.toContain('human performance program')
    expect(roles).not.toContain('readiness program')
    expect(roles).not.toContain('Try human performance program demo')
  })

  it('presents the role sourcing loop as a coherent five-step studio', () => {
    expect(search).toContain('Search Plan v')
    expect(search).toContain('<b>1</b> Search')
    expect(search).toContain('<b>2</b> Bring back')
    expect(search).toContain('<b>3</b> Review')
    expect(search).toContain('<b>4</b> Learn')
    expect(search).toContain('<b>5</b> Search again')
    expect(search).toContain('LinkedIn Recruiter')
    expect(search).toContain('ClearanceJobs / ATS')
    expect(search).toContain('Google X-Ray')
    expect(search).toContain('Bring candidates back to this role')
  })

  it('loads the V30 design layer after legacy product styles', () => {
    expect(layout).toMatch(/import '\.\/import-center\.css'\s+import '\.\/v30-uiux\.css'/)
    expect(ui).toContain('.app-desktop-topbar')
    expect(ui).toContain('.today-workspace-grid')
    expect(ui).toContain('.role-card-v30')
    expect(ui).toContain('.role-search-studio')
    expect(ui).toContain(':focus-visible')
  })
})
