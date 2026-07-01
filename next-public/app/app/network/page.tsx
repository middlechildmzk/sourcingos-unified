import Link from 'next/link'
import { NetworkVaultClient } from '@/components/NetworkVaultClient'

export const metadata = {
  title: 'Network Vault — SourcingOS',
  description:
    'Browse, search, and filter your imported LinkedIn connections as private network context. Relationship signals only. Contact data is unverified. No outreach.',
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
        Your imported network, searchable. Browse the people you have connected with, filter by company,
        title, or available signals, and open a person to see their source profile and unverified contact
        signals. This is relationship context to organize from, not a list of approved candidates.
      </p>

      <div className="button-row" style={{ margin: '16px 0 22px' }}>
        <Link className="btn secondary" href="/app/network/import">Import LinkedIn connections →</Link>
        <Link className="btn ghost" href="/app/candidate-database">Open Candidate Database →</Link>
      </div>

      <NetworkVaultClient />
    </main>
  )
}
