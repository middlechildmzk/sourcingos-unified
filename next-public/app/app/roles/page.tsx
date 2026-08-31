import { RoleWorkspaceClient } from '@/components/RoleWorkspaceClient'
import { RoleWorkspaceSyncPanel } from '@/components/RoleWorkspaceSyncPanel'
import { RoleSearchLaunchPanel } from '@/components/RoleSearchLaunchPanel'
import { RoleWorkspaceBackupPanel } from '@/components/RoleWorkspaceBackupPanel'

export const metadata = {
  title: 'Sourcing Agent — SourcingOS',
  description: 'Describe who you need, confirm what SourcingOS understood, and let the sourcing agent build an evidence-backed review slate.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return <main className="wrap v30-page-wrap role-agent-entry-page-v33-4">
    <link rel="stylesheet" href="/role-workbench-v33-4.css" />
    <link rel="stylesheet" href="/role-workbench-v33-4-light.css" />
    <link rel="stylesheet" href="/role-agent-intake-v33-4.css" />
    <link rel="stylesheet" href="/role-product-intelligence-v33-4.css" />
    <RoleWorkspaceClient />
    <details className="advanced-disclosure product-panel v30-admin-disclosure">
      <summary>Workspace storage, backup, and connected-search controls</summary>
      <div className="v30-admin-stack"><RoleWorkspaceSyncPanel /><RoleWorkspaceBackupPanel /><RoleSearchLaunchPanel /></div>
    </details>
  </main>
}
