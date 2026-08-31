import { RoleAgenticSearchPanel } from '@/components/RoleAgenticSearchPanel'
import { RoleCanonicalSearchActions } from '@/components/RoleCanonicalSearchActions'
import { RoleDeleteControl } from '@/components/RoleDeleteControl'
import { RoleDetailClient } from '@/components/RoleDetailClient'
import { RoleIntelligenceProviderV33 } from '@/components/RoleIntelligenceProviderV33'
import { RoleMilitaryIntelligencePanel } from '@/components/RoleMilitaryIntelligencePanel'
import { RolePasteBackV33 } from '@/components/RolePasteBackV33'
import { RoleSourcingAgentV33_3 } from '@/components/RoleSourcingAgentV33_3'
import { RoleUnifiedWorkbenchV33_4 } from '@/components/RoleUnifiedWorkbenchV33_4'

export const metadata = {
  title: 'Role Workspace | SourcingOS',
  robots: { index: false, follow: false },
}

export default async function RoleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ tab?: string }> }) {
  const { id } = await params
  const sp = (await searchParams) ?? {}
  const showLegacyControls = Boolean(sp.tab)
  return (
    <main className="wrap role-page-v33-4">
      <link rel="stylesheet" href="/agentic-role.css" />
      <link rel="stylesheet" href="/agent-review-slate-v33-3.css" />
      <link rel="stylesheet" href="/role-workbench-v33-4.css" />
      <link rel="stylesheet" href="/role-workbench-v33-4-light.css" />

      <RoleUnifiedWorkbenchV33_4 roleId={id} />

      <RoleIntelligenceProviderV33 roleId={id}>
        <details className="role-sourcing-execution-v33-4">
          <summary>Run sourcing / create another review slate</summary>
          <RoleSourcingAgentV33_3 roleId={id} />
        </details>
        <details className="agentic-advanced-v33">
          <summary>Advanced research strategy and individual source inspection</summary>
          <RoleAgenticSearchPanel roleId={id} />
          <RoleMilitaryIntelligencePanel roleId={id} />
          <RoleCanonicalSearchActions roleId={id} />
        </details>
      </RoleIntelligenceProviderV33>

      <details className="advanced-disclosure role-legacy-controls-v33-4" open={showLegacyControls}>
        <summary>Advanced role controls, calibration, pipeline, paste-back, and activity</summary>
        <RolePasteBackV33 roleId={id} />
        <RoleDetailClient roleId={id} initialTab={sp.tab} />
      </details>
      <RoleDeleteControl roleId={id} />
    </main>
  )
}
