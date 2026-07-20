import Link from 'next/link'
import { AgentOSClient } from '@/components/AgentOSClient'

export const metadata = {
  title: 'Agent OS — SourcingOS',
  description: 'Durable recruiting-agent orchestration, approvals, recruiter memory, talent graph, and autonomous role workflows.',
  robots: { index: false, follow: false },
}

export default function AgentOSPage() {
  return <main className="wrap">
    <div className="eyebrow">SourcingOS private intelligence layer</div>
    <h1>Recruiter Agent OS</h1>
    <p className="lead">Launch, inspect, approve, pause, and resume multi-agent recruiting workflows. Every checkpoint is durable and every sensitive decision stays recruiter-controlled.</p>
    <div className="button-row" style={{ margin: '16px 0 22px' }}>
      <Link className="btn ghost" href="/app/autosource">Open AutoSource →</Link>
      <Link className="btn ghost" href="/app/roles">Open Roles →</Link>
      <Link className="btn ghost" href="/app/acquisition">Open Acquisition →</Link>
    </div>
    <AgentOSClient />
  </main>
}
