import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const rolesPage = read('app/app/roles/page.tsx')
const roleDetailPage = read('app/app/roles/[id]/page.tsx')
const rolePortfolio = read('components/RoleWorkspaceClient.tsx')
const roleWizard = read('components/RoleIntakeWizard.tsx')
const roleDetail = read('components/RoleDetailClient.tsx')
const candidateReview = read('components/CandidateReviewPro.tsx')
const roleDelete = read('components/RoleDeleteControl.tsx')
const roleStore = read('lib/use-role-workspaces.ts')
const shell = read('components/AppShell.tsx')
const palette = read('components/CommandPalette.tsx')
const styles = read('app/app/v25-2.css')
const v26Styles = read('app/app/v26.css')
const candidateReviewStyles = read('app/app/v26-candidate-review.css')

describe('V25.2 daily driver experience', () => {
  it('uses a guided role portfolio plus a dedicated role workspace route', () => {
    expect(rolesPage).toContain('<RoleWorkspaceClient />')
    expect(rolePortfolio).toContain('href={`/app/roles/${role.id}`}')
    expect(rolePortfolio).toContain('Search portfolio')
    expect(rolePortfolio).toContain('<RoleIntakeWizard')
    expect(roleWizard).toContain('Guided role setup')
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
    expect(roleDetail).toContain('Candidate Review Pro')
    expect(candidateReview).toContain('candidate-drawer-layer')
    expect(candidateReview).toContain('Role evidence matrix')
    expect(candidateReview).toContain('Strongest source evidence')
    expect(candidateReview).toContain('Save & next')
    expect(candidateReview).toContain('/api/candidate-db/360/')
    expect(candidateReview).toContain("action: 'queue_enrichment'")
    expect(candidateReview).toContain("action: 'extract_graph'")
  })

  it('hydrates server versions and debounces versioned owner-scoped sync', () => {
    expect(roleStore).toContain("fetch('/api/roles/sync'")
    expect(roleStore).toContain('hydrateRoleWorkspaces')
    expect(roleStore).toContain('scheduleSync')
    expect(roleStore).toContain('expectedVersion: versions.current[workspace.id]')
    expect(roleStore).toContain('versionsFromResponse(json.versions)')
  })

  it('supports version-checked durable role deletion', () => {
    expect(roleStore).toContain("method: 'DELETE'")
    expect(roleStore).toContain('expectedVersion=${expectedVersion}')
    expect(roleStore).toContain('The local workspace was preserved.')
    expect(roleDetailPage).toContain('<RoleDeleteControl roleId={params.id} />')
    expect(roleDelete).toContain('Delete this role workspace')
    expect(roleDelete).toContain('window.confirm')
    expect(roleDelete).toContain('await removeRole(roleId)')
    expect(roleDelete).toContain("router.push('/app/roles')")
  })

  it('adds a global role and candidate command palette', () => {
    expect(shell).toContain('<CommandPalette />')
    expect(shell).toContain('app-command-trigger-mobile')
    expect(palette).toContain("event.key.toLowerCase() === 'k'")
    expect(palette).toContain('/api/candidate-db/list?q=')
    expect(palette).toContain('readRoleWorkspaces()')
    expect(palette).toContain('Search roles, candidates, or actions')
  })

  it('includes responsive drawer, command, role tab, pipeline, guided setup, and review styles', () => {
    expect(styles).toContain('.candidate-drawer')
    expect(styles).toContain('.command-palette')
    expect(styles).toContain('.role-tabs')
    expect(styles).toContain('.role-pipeline-board')
    expect(styles).toContain('@media(max-width:620px)')
    expect(v26Styles).toContain('.role-wizard')
    expect(v26Styles).toContain('.role-portfolio-row-v26')
    expect(candidateReviewStyles).toContain('.candidate-review-command')
    expect(candidateReviewStyles).toContain('.candidate-compare-table')
  })
})
