import { FleetGrowthDashboardClient } from '@/components/FleetGrowthDashboardClient'

export const metadata = {
  title: 'Agent Fleet — SourcingOS',
  description: 'Monitor autonomous sourcing lanes, Candidate Graph growth, source yield, identity-review proposals, credits, and fleet health.',
  robots: { index: false, follow: false },
}

export default function AgentFleetPage() {
  return <main className="wrap"><FleetGrowthDashboardClient /></main>
}
