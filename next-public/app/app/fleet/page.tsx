import { FleetGrowthDashboardClient } from '@/components/FleetGrowthDashboardClient'
import { FLEET_IMPROVEMENT_PODS_V40_7, fleetCapabilitySummaryV40_7 } from '@/lib/fleet/governance-v40-7'

export const metadata = {
  title: 'Agent Fleet — SourcingOS',
  description: 'Monitor autonomous discovery, governed improvement pods, Resume/CV research, profile enrichment, Candidate Graph growth, and source health.',
  robots: { index: false, follow: false },
}

export default function AgentFleetPage() {
  const program = fleetCapabilitySummaryV40_7()

  return <main className="wrap">
    <section className="product-panel" style={{ marginBottom: 16 }}>
      <div className="product-panel-head">
        <div>
          <span className="kicker">V40.7 improvement program</span>
          <h2>Governed 50-agent build fleet</h2>
        </div>
        <span className="status-pill success">{program.improvementAgents} seats · Resume sprint isolated</span>
      </div>
      <p className="muted" style={{ fontSize: 12, lineHeight: 1.65 }}>
        Five ten-seat pods improve search intelligence, candidate evidence, recruiter UX, product engineering, and QA/red-team coverage. This program is separate from the production talent-intelligence workers and has no authority to release Resume/CV backlog work, scrape account-gated sources, buy providers, merge identities silently, harvest contacts unattended, or send outreach.
      </p>
      <div className="chips" style={{ marginTop: 12 }}>
        {FLEET_IMPROVEMENT_PODS_V40_7.map(pod => <span className="tag" key={pod.id}>{pod.label} · {pod.seats}</span>)}
      </div>
    </section>
    <FleetGrowthDashboardClient />
  </main>
}
