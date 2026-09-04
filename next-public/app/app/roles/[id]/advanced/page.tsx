import Link from 'next/link'
import { RoleDetailClient } from '@/components/RoleDetailClient'
import { RoleDeleteControl } from '@/components/RoleDeleteControl'

export const metadata = { title: 'Advanced Role Controls | SourcingOS', robots: { index: false, follow: false } }

export default async function AdvancedRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <main className="wrap role-section-stack">
    <section className="product-page-head">
      <div><span className="kicker">Advanced role controls</span><h1>Strategy, calibration, pipeline, and maintenance.</h1><p>The default Role Workspace is the recruiter workbench. These lower-frequency controls remain available here while V37 consolidates them deliberately.</p></div>
      <div className="product-page-actions"><Link className="btn" href={`/app/roles/${encodeURIComponent(id)}`}>← Back to workspace</Link></div>
    </section>
    <RoleDetailClient roleId={id} initialTab="strategy" />
    <RoleDeleteControl roleId={id} />
  </main>
}
