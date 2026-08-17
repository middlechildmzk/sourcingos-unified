import Link from 'next/link'
import { SourceStackCoverageClient } from '@/components/SourceStackCoverageClient'

export const metadata = {
  alternates: { canonical: '/tools/source-stack-coverage/' },
  title: 'Source Stack Coverage Worksheet | LinkedIn Recruiter Renewal Tool | SourcingOS',
  description: 'Map the eight jobs your sourcing team depends on, see what is already covered outside LinkedIn Recruiter, and identify gaps before you renew, downgrade, or replace seats.',
}

export default function SourceStackCoveragePage() {
  return <main className="wrap article">
    <span className="kicker">Free sourcing tool</span>
    <h1>Source Stack Coverage Worksheet</h1>
    <p className="lead">Before you compare LinkedIn Recruiter alternatives, unbundle the workflow. Mark the jobs your team actually uses every week and which ones are already covered somewhere else.</p>

    <SourceStackCoverageClient />

    <section>
      <h2>What this worksheet is measuring</h2>
      <p>It measures dependency coverage, not vendor quality. The eight jobs are identity discovery, professional history, technical evidence, academic or research evidence, contact discovery, messaging and delivery, project memory, and market mapping.</p>
    </section>

    <section>
      <h2>What to test before changing seats</h2>
      <p>For any uncovered weekly dependency, run the replacement workflow on real reqs. Measure time to first qualified lead, qualified unique leads, reply rate by channel, manual hours added, and what project state would be lost or moved.</p>
    </section>

    <div className="cta"><strong>Read the full unbundling framework:</strong> <Link href="/blog/linkedin-recruiter-alternatives">LinkedIn Recruiter Alternatives: Build a Source Stack Instead →</Link></div>
  </main>
}
