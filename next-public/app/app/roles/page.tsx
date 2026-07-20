import { RoleWorkspaceClient } from '@/components/RoleWorkspaceClient'
import { RoleWorkspaceSyncPanel } from '@/components/RoleWorkspaceSyncPanel'
import { RoleSearchLaunchPanel } from '@/components/RoleSearchLaunchPanel'

export const metadata = {
  title: 'Role Workspaces — SourcingOS Daily Driver',
  description: 'Create calibrated sourcing projects, approve search lanes, launch connected candidate discovery, review candidates, manage role-specific pipelines, and sync safely to durable storage.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS V20.1 — Connected Daily Driver</div>
      <RoleWorkspaceSyncPanel />
      <RoleSearchLaunchPanel />
      <RoleWorkspaceClient />
    </main>
  )
}
