import Link from 'next/link'
import { TalentInsightsV36_11 } from '@/components/TalentInsightsV36_11'
import '../candidate-search/universal-people-search.css'

export const metadata = {
  title: 'Talent Insights — SourcingOS',
  description: 'Analyze observed talent-market breadth, search constraint pressure, provider contribution, and sourcing strategy.',
  robots: { index: false, follow: false },
}

export default function TalentInsightsPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS · Talent intelligence</div>
      <h1>Talent Insights</h1>
      <p className="lead" style={{ maxWidth: 900 }}>
        Turn a role into a market diagnostic before you burn sourcing time. Enter titles, must-haves, location, experience, clearance, and other professional criteria; SourcingOS samples the connected talent universe, shows how restrictive the search appears, and recommends a sourcing strategy while keeping observed provider rows separate from true unique-person market size.
      </p>

      <TalentInsightsV36_11 />

      <section className="product-panel" style={{ marginTop: 18 }}>
        <span className="kicker">Connected workflow</span>
        <div className="grid two" style={{ marginTop: 12 }}>
          <Link href="/app/people-search" style={{ color: 'inherit' }}>
            <strong>People Search</strong>
            <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>Resolve a known person or run a fast professional people search across connected provider lanes.</p>
          </Link>
          <Link href="/app/agentic-sourcing" style={{ color: 'inherit' }}>
            <strong>AI Sourcing</strong>
            <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>Take the approved role strategy into natural-language, JD, Boolean, provider, and public-evidence sourcing workflows.</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
