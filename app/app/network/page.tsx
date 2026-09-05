import Link from 'next/link'
import { NetworkVaultClient } from '@/components/NetworkVaultClient'
import { NetworkRoleHandoffClient } from '@/components/NetworkRoleHandoffClient'

export const metadata = {
  title: 'Network Vault — SourcingOS',
  description:
    'Browse, search, and filter imported LinkedIn connections as private relationship context, then add reviewed records to role-specific queues. Contact data is unverified. No outreach.',
  robots: { index: false, follow: false },
}

// Private app page. Data is fail-closed at /api/network/list (auth required);
// this page renders for everyone and the client handles the signed-out state.
export default function NetworkVaultPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS private network</div>
      <h1>Network Vault</h1>
      <p className="lead">
        Your imported network, searchable. Browse known connections, review relationship context, and place selected people into a role-specific review queue without treating them as verified candidates or approved outreach targets.
      </p>

      <div className="button-row" style={{ margin: '16px 0 22px' }}>
        <Link className="btn secondary" href="/app/network/import">Import LinkedIn connections →</Link>
        <Link className="btn ghost" href="/app/candidate-database">Open Candidate Database →</Link>
        <Link className="btn ghost" href="/app/roles">Open Role Workspaces →</Link>
      </div>

      <NetworkRoleHandoffClient />
      <NetworkVaultClient />
    </main>
  )
}
