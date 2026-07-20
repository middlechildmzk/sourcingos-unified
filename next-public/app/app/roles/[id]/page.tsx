import { RoleDetailClient } from '@/components/RoleDetailClient'

export const metadata = {
  title: 'Role Workspace | SourcingOS',
  robots: { index: false, follow: false },
}

export default function RoleDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="wrap">
      <RoleDetailClient roleId={params.id} />
    </main>
  )
}
