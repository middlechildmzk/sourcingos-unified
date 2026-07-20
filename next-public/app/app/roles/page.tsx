import { RoleWorkspaceClient } from '@/components/RoleWorkspaceClient'
import { RoleWorkspaceSyncPanel } from '@/components/RoleWorkspaceSyncPanel'
import { RoleSearchLaunchPanel } from '@/components/RoleSearchLaunchPanel'
import { RoleWorkspaceBackupPanel } from '@/components/RoleWorkspaceBackupPanel'

export const metadata = {
  title: 'Role Workspaces — SourcingOS Daily Driver',
  description: 'Create calibrated sourcing projects, approve search lanes, launch connected candidate discovery, review candidates, manage role-specific pipelines, back up local workspaces, and sync safely to durable storage.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS V20.2 — Connected and Portable</div>
      <RoleWorkspaceSyncPanel />
      <RoleWorkspaceBackupPanel />
      <RoleSearchLaunchPanel />
      <RoleWorkspaceClient />
    </main>
  )
}
