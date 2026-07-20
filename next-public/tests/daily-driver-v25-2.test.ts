import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const rolesPage = read('app/app/roles/page.tsx')
const roleDetailPage = read('app/app/roles/[id]/page.tsx')
const rolePortfolio = read('components/RoleWorkspaceClient.tsx')
const roleDetail = read('components/RoleDetailClient.tsx')
const roleStore = read('lib/use-role-workspaces.ts')
const shell = read('components/AppShell.tsx')
const palette = read('components/CommandPalette.tsx')
const styles = read('app/app/v25-2.css')

describe('V25.2 daily driver experience', () => {
  it('uses a role portfolio plus a dedicated role workspace route', () => {
    expect(rolesPage).toContain('<RoleWorkspaceClient />')
    expect(rolePortfolio).toContain('href={`/app/roles/${role.id}`}')
    expect(rolePortfolio).toContain('Req portfolio')
    expect(roleDetailPage).toContain('<RoleDetailClient roleId={params.id} />')
  })

  it('keeps role context across overview, candidates, strategy, and activity', () => {
    expect(roleDetail).toContain("type Tab = 'overview' | 'candidates' | 'strategy' | 'activity'")
    expect(roleDetail).toContain('Role workspace')
    expect(roleDetail).toContain('Next best actions')
    expect(roleDetail).toContain('Pipeline board')
    expect(roleDetail).toContain('Approve the search plan')
  })

  it('reviews candidates in an evidence-aware drawer without losing role context', () => {
    expect(roleDetail).toContain('CandidateReviewDrawer')
    expect(roleDetail).toContain('candidate-drawer-layer')
    expect(roleDetail).toContain('Strongest evidence')
    expect(roleDetail).toContain('Save review')
    expect(roleDetail).toContain('/api/candidate-db/360/')
    expect(roleDetail).toContain("action: 'queue_enrichment'")
    expect(roleDetail).toContain("action: 'extract_graph'")
  })

  it('hydrates roles from account storage and debounces owner-scoped sync', () => {
    expect(roleStore).toContain("fetch('/api/roles/sync'")
    expect(roleStore).toContain('hydrateRoleWorkspaces')
    expect(roleStore).toContain('scheduleSync')
    expect(roleStore).toContain('JSON.stringify({ workspace })')
  })

  it('adds a global role and candidate command palette', () => {
    expect(shell).toContain('<CommandPalette />')
    expect(shell).toContain('app-command-trigger-mobile')
    expect(palette).toContain("event.key.toLowerCase() === 'k'")
    expect(palette).toContain('/api/candidate-db/list?q=')
    expect(palette).toContain('readRoleWorkspaces()')
    expect(palette).toContain('Search roles, candidates, or actions')
  })

  it('includes responsive drawer, command, role tab, and pipeline styles', () => {
    expect(styles).toContain('.candidate-drawer')
    expect(styles).toContain('.command-palette')
    expect(styles).toContain('.role-tabs')
    expect(styles).toContain('.role-pipeline-board')
    expect(styles).toContain('@media(max-width:620px)')
  })
})
