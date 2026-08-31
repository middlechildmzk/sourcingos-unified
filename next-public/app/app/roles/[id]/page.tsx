import { RoleAgenticSearchPanel } from '@/components/RoleAgenticSearchPanel'
import { RoleCanonicalSearchActions } from '@/components/RoleCanonicalSearchActions'
import { RoleDeleteControl } from '@/components/RoleDeleteControl'
import { RoleDetailClient } from '@/components/RoleDetailClient'
import { RoleEvidenceSlateContainerV33_2 } from '@/components/RoleEvidenceSlateContainerV33_2'
import { RoleIntelligenceProviderV33 } from '@/components/RoleIntelligenceProviderV33'
import { RoleMilitaryIntelligencePanel } from '@/components/RoleMilitaryIntelligencePanel'
import { RolePasteBackV33 } from '@/components/RolePasteBackV33'
import { RoleSourcingAgentV33_3 } from '@/components/RoleSourcingAgentV33_3'

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
      <link rel="stylesheet" href="/agent-review-slate-v33-3.css" />
      <RoleIntelligenceProviderV33 roleId={id}>
        <RoleSourcingAgentV33_3 roleId={id} />
        <details className="agentic-advanced-v33">
          <summary>Advanced research strategy and individual source inspection</summary>
          <RoleAgenticSearchPanel roleId={id} />
        </details>
        <RoleMilitaryIntelligencePanel roleId={id} />
        <RoleCanonicalSearchActions roleId={id} />
      </RoleIntelligenceProviderV33>
      <RoleEvidenceSlateContainerV33_2 roleId={id} />
      <RolePasteBackV33 roleId={id} />
      <RoleDetailClient roleId={id} initialTab={sp.tab} />
      <RoleDeleteControl roleId={id} />
    </main>
  )
}
