import Link from 'next/link'
import { RoleAgenticSearchPanel } from '@/components/RoleAgenticSearchPanel'
import { RoleSearchActions } from '@/components/RoleSearchActions'

export const metadata = {
  title: 'Agentic Sourcing Role | SourcingOS',
  robots: { index: false, follow: false },
}

export default async function AgenticRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <main className="wrap">
    <div className="role-detail-topbar">
      <Link className="btn ghost" href="/app/agentic-sourcing">← Agentic Sourcing</Link>
      <Link className="btn secondary" href={`/app/roles/${encodeURIComponent(id)}`}>Open full role workspace</Link>
      <Link className="btn secondary" href={`/app/roles/${encodeURIComponent(id)}?tab=candidates`}>Review slate</Link>
    </div>
    <RoleAgenticSearchPanel roleId={id} />
    <RoleSearchActions roleId={id} />
  </main>
}
