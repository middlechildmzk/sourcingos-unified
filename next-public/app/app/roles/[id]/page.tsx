import { RoleDeleteControl } from '@/components/RoleDeleteControl'
import { RoleDetailClient } from '@/components/RoleDetailClient'
import { RoleSearchActions } from '@/components/RoleSearchActions'

export const metadata = {
  title: 'Role Workspace | SourcingOS',
  robots: { index: false, follow: false },
}

export default async function RoleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  return (
    <main className="wrap">
      <RoleSearchActions roleId={id} />
      <RoleDetailClient roleId={id} initialTab={sp.tab} />
      <RoleDeleteControl roleId={id} />
    </main>
  )
}
