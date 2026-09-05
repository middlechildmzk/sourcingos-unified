import Link from 'next/link'
import { SearchLaneExpanderClient } from '@/components/SearchLaneExpanderClient'

export const metadata = {
  alternates: { canonical: '/tools/search-lane-expander/' },
  title: 'Search Lane Expander | SourcingOS',
  description: 'Expand a sourcing target into Precision, Balanced, Broad, and Market Map lanes with live public sources, query variants, and manual-safe X-Ray lanes.',
}

export default function SearchLaneExpanderPage() {
  return <main className="wrap article">
    <span className="kicker">Free sourcing tool</span>
    <h1>Search Lane Expander</h1>
    <p className="lead">Turn a rough role target into Precision, Balanced, Broad, and Market Map sourcing lanes. Built for source coverage, not fake candidate volume.</p>

    <SearchLaneExpanderClient />

    <section>
      <h2>How to use it</h2>
      <p>Start with the narrowest lane that returns useful evidence. If public-source volume is thin, move to Broad or Market Map, then use manual-safe X-Ray lanes for open-web discovery. Every result still requires recruiter review.</p>
      <p>
        <Link className="btn" href="/candidate-search">Try Candidate Search</Link>{' '}
        <Link className="btn secondary" href="/training/evidence-review-checklist">Evidence checklist</Link>{' '}
        <Link className="btn ghost" href="/methodology">Read methodology</Link>
      </p>
    </section>
  </main>
}
