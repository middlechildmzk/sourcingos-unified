import { FleetGrowthDashboardClient } from '@/components/FleetGrowthDashboardClient'

export const metadata = {
  title: 'Agent Fleet — SourcingOS',
  description: 'Monitor autonomous discovery, Resume/CV research, profile enrichment, Candidate Graph growth, and source health.',
  robots: { index: false, follow: false },
}

export default function AgentFleetPage() {
  return <main className="wrap"><FleetGrowthDashboardClient /></main>
}
