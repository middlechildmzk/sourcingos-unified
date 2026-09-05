import { AgingReqRescueTool } from '@/components/AgingReqRescueTool'

export const metadata = {
  title: 'Aging Req Rescue Planner | SourcingOS',
  description:
    'Stuck req? Get a structured diagnosis — ghost req, lane exhaustion, calibration drift, comp mismatch, or outreach problem — plus a rescue checklist and a hiring-manager note. Deterministic, no AI. Free, no account.',
}

export default function Page() {
  return (
    <main className="wrap">
      <span className="kicker">Free Tool</span>
      <h1>Aging Req Rescue Planner</h1>
      <p className="lead">
        A req that won&rsquo;t close usually has one of a few specific causes, and each has a
        different fix. Answer five questions about where the search actually stands and get a
        primary diagnosis, a rescue checklist, and a hiring-manager note you can adapt. No AI &mdash;
        just the heuristics a senior sourcer runs in their head.
      </p>
      <AgingReqRescueTool />
    </main>
  )
}
