import { AgentOSClient } from '@/components/AgentOSClient'

export const metadata = {
  title: 'Today — SourcingOS',
  description: 'A clean recruiter command center for approvals, prioritized candidate review, active roles, agent workflows, memory, and talent graph intelligence.',
  robots: { index: false, follow: false },
}

export default function AgentOSPage() {
  return <main className="wrap"><AgentOSClient /></main>
}