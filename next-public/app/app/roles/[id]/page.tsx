import { RoleAgenticSearchPanel } from '@/components/RoleAgenticSearchPanel'
import { RoleCanonicalSearchActions } from '@/components/RoleCanonicalSearchActions'
import { RoleDeleteControl } from '@/components/RoleDeleteControl'
import { RoleDetailClient } from '@/components/RoleDetailClient'
import { RolePasteBackV33 } from '@/components/RolePasteBackV33'

export const metadata = {
  title: 'Role Workspace | SourcingOS',
  robots: { index: false, follow: false },
}

export default async function RoleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  return (
    <main className="wrap">
      <link rel="stylesheet" href="/agentic-role.css" />
      <RoleAgenticSearchPanel roleId={id} />
      <RoleCanonicalSearchActions roleId={id} />
      <RolePasteBackV33 roleId={id} />
      <RoleDetailClient roleId={id} initialTab={sp.tab} />
      <RoleDeleteControl roleId={id} />
    </main>
  )
}
