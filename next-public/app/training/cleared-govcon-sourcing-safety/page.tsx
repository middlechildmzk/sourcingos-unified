import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/training/cleared-govcon-sourcing-safety/' },
  title: 'Cleared GovCon Sourcing Safety | SourcingOS',
  description: 'A recruiter training module for using public clearance breadcrumbs safely without claiming verified clearance from open-web evidence.',
}

export default function ClearedGovConSourcingSafetyPage() {
  return <main className="wrap article">
    <span className="kicker">Training module</span>
    <h1>Use clearance breadcrumbs without overclaiming.</h1>
    <p className="lead">Cleared sourcing requires discipline. Public text can help you discover leads, but it cannot verify clearance, eligibility, access, recency, or program fit.</p>

    <section>
      <h2>Safe language</h2>
      <p>Use phrases like public clearance breadcrumb, public clearance language, possible GovCon signal, and verify next. Avoid verified clearance, active clearance, cleared candidate, or confirmed status unless your authorized process has actually confirmed it.</p>
    </section>

    <section>
      <h2>Search signals worth testing</h2>
      <ul>
        <li>TS/SCI, Secret, Top Secret, Polygraph, CI Poly, Full Scope Poly.</li>
        <li>RMF, ATO, FedRAMP, NIST, DoD, IC, SCIF, JWICS.</li>
        <li>AWS GovCloud, IL5, Kubernetes, Terraform, secure delivery, DevSecOps.</li>
        <li>Donor companies that share mission, customer, compliance, and delivery environments.</li>
      </ul>
    </section>

    <section>
      <h2>Verification stays outside the public web</h2>
      <p>Public breadcrumbs can support discovery. Verification must happen through your employer, client, candidate conversation, and authorized clearance process. SourcingOS keeps those labels separate so the public evidence never becomes an accidental claim.</p>
    </section>

    <section>
      <h2>SourcingOS workflow</h2>
      <p>Use Clearance Search or BooleanOS to build the lane, then Candidate Search to review the public evidence and missing data. Candidate 360 should show clearance as verify next until confirmed by the proper process.</p>
      <p>
        <Link className="btn" href="/tools/clearance-search">Open Clearance Search</Link>{' '}
        <Link className="btn secondary" href="/blog/cleared-devsecops-sourcing">Read cleared DevSecOps guide</Link>
      </p>
    </section>
  </main>
}
