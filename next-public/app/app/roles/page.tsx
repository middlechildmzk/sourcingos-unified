import { RoleWorkspaceClient } from '@/components/RoleWorkspaceClient'

export const metadata = {
  title: 'Role Workspaces — SourcingOS Daily Driver',
  description: 'Create calibrated sourcing projects, approve search lanes, review candidates, and manage role-specific pipelines.',
  robots: { index: false, follow: false },
}

export default function RolesPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS V20 — Daily Driver</div>
      <RoleWorkspaceClient />
    </main>
  )
}
