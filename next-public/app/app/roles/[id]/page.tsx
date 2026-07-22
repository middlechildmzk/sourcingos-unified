import { RoleDeleteControl } from '@/components/RoleDeleteControl'
import { RoleDetailClient } from '@/components/RoleDetailClient'

export const metadata = {
  title: 'Role Workspace | SourcingOS',
  robots: { index: false, follow: false },
}

export default function RoleDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { tab?: string } }) {
  return (
    <main className="wrap">
      <RoleDetailClient roleId={params.id} initialTab={searchParams?.tab} />
      <RoleDeleteControl roleId={params.id} />
    </main>
  )
}
