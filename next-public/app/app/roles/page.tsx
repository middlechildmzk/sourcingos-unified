import { RoleWorkspaceClient } from '@/components/RoleWorkspaceClient'
import { RoleWorkspaceSyncPanel } from '@/components/RoleWorkspaceSyncPanel'
import { RoleSearchLaunchPanel } from '@/components/RoleSearchLaunchPanel'
import { RoleWorkspaceBackupPanel } from '@/components/RoleWorkspaceBackupPanel'

export const metadata = {
  title: 'Roles — SourcingOS',
  description: 'Create calibrated roles, review candidates, approve sourcing strategy, and manage role-specific pipelines from one workspace.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return <main className="wrap v30-page-wrap">
    <div className="product-page-head v30-page-head">
      <div>
        <span className="kicker">Role Brain</span>
        <h1>Roles</h1>
        <p>One operating workspace per search—from intake and sourcing lanes through candidate evidence, recruiter feedback, and the next search-plan revision.</p>
      </div>
    </div>
    <RoleWorkspaceClient />
    <details className="advanced-disclosure product-panel v30-admin-disclosure">
      <summary>Workspace storage, backup, and connected-search controls</summary>
      <div className="v30-admin-stack"><RoleWorkspaceSyncPanel /><RoleWorkspaceBackupPanel /><RoleSearchLaunchPanel /></div>
    </details>
  </main>
}
