import Link from 'next/link'
import { UniversalPeopleSearchV36_9 } from '@/components/UniversalPeopleSearchV36_9'
import { CandidateProviderReadinessV36_9 } from '@/components/CandidateProviderReadinessV36_9'
import '../candidate-search/universal-people-search.css'

export const metadata = {
  title: 'People Search — SourcingOS',
  description: 'Find a person by name, email, phone, professional profile URL, or professional attributes across connected SourcingOS data sources.',
  robots: { index: false, follow: false },
}

export default function PeopleSearchPage() {
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS · People intelligence</div>
      <h1>People Search</h1>
      <p className="lead" style={{ maxWidth: 900 }}>
        Find a person you already know about or discover people matching professional criteria. Search by name, email, phone, LinkedIn/GitHub/profile URL, name + company/location/title, or a professional query such as “DevOps engineer with 10+ years in Washington, DC.” SourcingOS chooses the eligible sources behind the scenes and keeps provenance attached to every returned observation.
      </p>

      <section className="product-panel" style={{ marginBottom: 16 }} aria-label="People Search modes">
        <div className="product-panel-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <span className="kicker">One search bar · multiple identity anchors</span>
            <h2 style={{ marginBottom: 6 }}>Lookup when you know the person. Discovery when you know the profile.</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 780 }}>
              Exact identifiers trigger identity-resolution lanes. Broader professional criteria trigger provider fan-out. More anchors increase identity confidence, but retrieval never becomes an automatic qualification or cross-source merge decision.
            </p>
          </div>
          <span className="status-pill active">flagship search</span>
        </div>
        <div className="chips" style={{ marginTop: 14 }}>
          <span className="tag">Name</span>
          <span className="tag">Email</span>
          <span className="tag">Phone</span>
          <span className="tag">LinkedIn / GitHub URL</span>
          <span className="tag">Name + company</span>
          <span className="tag">Name + location</span>
          <span className="tag">Title + skills + location</span>
        </div>
      </section>

      <UniversalPeopleSearchV36_9 />

      <details className="product-panel" style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Data source health & diagnostics</summary>
        <p className="muted" style={{ marginTop: 10 }}>
          Recruiters should not need to manage provider-by-provider complexity during normal searching. Open this only when you need to inspect which professional-search lanes are configured in the current runtime.
        </p>
        <CandidateProviderReadinessV36_9 />
      </details>

      <section className="product-panel" style={{ marginTop: 18 }}>
        <span className="kicker">Different job, same data fabric</span>
        <div className="grid two" style={{ marginTop: 12 }}>
          <Link href="/app/agentic-sourcing" style={{ color: 'inherit' }}>
            <strong>AI Sourcing</strong>
            <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
              Start from natural language, a JD, Boolean, or an approved role strategy and let SourcingOS fan the search across provider and public-evidence lanes.
            </p>
          </Link>
          <Link href="/app/talent-insights" style={{ color: 'inherit' }}>
            <strong>Talent Insights</strong>
            <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
              Size the observable market, assess search constraints, and turn the role into a recruiter-facing market strategy without pretending vendor database counts are unique people.
            </p>
          </Link>
        </div>
      </section>
    </main>
  )
}
