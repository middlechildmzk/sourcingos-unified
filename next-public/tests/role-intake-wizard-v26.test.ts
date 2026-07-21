import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const wizard = fs.readFileSync(path.join(root, 'components/RoleIntakeWizard.tsx'), 'utf8')
const roles = fs.readFileSync(path.join(root, 'components/RoleWorkspaceClient.tsx'), 'utf8')
const shell = fs.readFileSync(path.join(root, 'components/AppShell.tsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'app/app/v26.css'), 'utf8')

describe('V26 guided role setup and product polish', () => {
  it('guides recruiters through intake, calibration, and strategy approval', () => {
    expect(wizard).toContain("const steps = [")
    expect(wizard).toContain("label: 'Intake'")
    expect(wizard).toContain("label: 'Calibration'")
    expect(wizard).toContain("label: 'Strategy'")
    expect(wizard).toContain('Extract intake')
    expect(wizard).toContain('Approve the search plan')
    expect(wizard).toContain('Create calibrated workspace')
  })

  it('keeps recruiter control explicit before workspace creation', () => {
    expect(wizard).toContain('No campaign launches and no candidate is contacted during setup.')
    expect(wizard).toContain('Approve at least one search lane')
    expect(wizard).toContain("status: 'calibrating'")
    expect(wizard).toContain("type: 'lane_approved'")
  })

  it('ships role templates without replacing role-specific extraction', () => {
    for (const label of ['Technical & DevSecOps', 'Cleared & GovCon', 'Healthcare', 'Human Performance', 'Talent Acquisition', 'AI & Research']) {
      expect(wizard).toContain(label)
    }
    expect(wizard).toContain("key: 'auto'")
    expect(wizard).toContain('enhanceWithTemplate(createRoleWorkspace')
  })

  it('opens the created workspace and surfaces portfolio health', () => {
    expect(roles).toContain("router.push(`/app/roles/${role.id}`)")
    expect(roles).toContain('roleHealth(role)')
    expect(roles).toContain('Search portfolio')
    expect(roles).toContain('Start guided setup')
  })

  it('replaces navigation glyphs with a consistent product icon system', () => {
    expect(shell).toContain('ProductIcon')
    expect(shell).toContain("icon: 'today'")
    expect(shell).toContain("icon: 'roles'")
    expect(shell).toContain("icon: 'autosource'")
    expect(shell).toContain("icon: 'candidates'")
  })

  it('includes responsive wizard and portfolio styling', () => {
    expect(css).toContain('.role-wizard')
    expect(css).toContain('.role-template-grid')
    expect(css).toContain('.role-wizard-calibration-grid')
    expect(css).toContain('.role-portfolio-row-v26')
    expect(css).toContain('@media(max-width:700px)')
  })
})
