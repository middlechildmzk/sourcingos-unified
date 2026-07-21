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
  return <main className="wrap">
    <div className="product-page-head">
      <div>
        <span className="kicker">Search portfolio</span>
        <h1>Roles</h1>
        <p>Turn every intake into an approved search strategy, evidence-backed candidate review queue, and recruiter-controlled operating workspace.</p>
      </div>
    </div>
    <RoleWorkspaceClient />
    <details className="advanced-disclosure product-panel" style={{ marginTop: 16 }}>
      <summary>Workspace data, backup, and connected search controls</summary>
      <div style={{ marginTop: 16 }}><RoleWorkspaceSyncPanel /><RoleWorkspaceBackupPanel /><RoleSearchLaunchPanel /></div>
    </details>
  </main>
}
