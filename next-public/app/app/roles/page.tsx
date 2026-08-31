import { RoleWorkspaceClient } from '@/components/RoleWorkspaceClient'
import { RoleWorkspaceSyncPanel } from '@/components/RoleWorkspaceSyncPanel'
import { RoleSearchLaunchPanel } from '@/components/RoleSearchLaunchPanel'
import { RoleWorkspaceBackupPanel } from '@/components/RoleWorkspaceBackupPanel'

export const metadata = {
  title: 'Roles — SourcingOS',
  description: 'Describe who you need, confirm what SourcingOS understood, and let the sourcing agent build an evidence-backed review slate.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return <main className="wrap v30-page-wrap">
    <link rel="stylesheet" href="/role-workbench-v33-4.css" />
    <link rel="stylesheet" href="/role-workbench-v33-4-light.css" />
    <link rel="stylesheet" href="/role-agent-intake-v33-4.css" />
    <div className="product-page-head v30-page-head">
      <div>
        <span className="kicker">Sourcing Agent</span>
        <h1>Who are you looking for?</h1>
        <p>Describe the person naturally. SourcingOS will parse the request, show you what it understood, and start sourcing after one confirmation.</p>
      </div>
    </div>
    <RoleWorkspaceClient />
    <details className="advanced-disclosure product-panel v30-admin-disclosure">
      <summary>Workspace storage, backup, and connected-search controls</summary>
      <div className="v30-admin-stack"><RoleWorkspaceSyncPanel /><RoleWorkspaceBackupPanel /><RoleSearchLaunchPanel /></div>
    </details>
  </main>
}
