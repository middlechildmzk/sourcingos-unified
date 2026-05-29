import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | SourcingOS',
  description: 'How SourcingOS handles waitlist information, public-source research, analytics, and recruiter-controlled candidate evidence.'
}

export default function PrivacyPage() {
  return <main className="wrap article">
    <span className="kicker">SourcingOS privacy</span>
    <h1>Privacy Policy</h1>
    <p className="lead">SourcingOS is built around a simple principle: public evidence should stay traceable, recruiter judgment should stay human, and private user data should not be sold.</p>

    <section>
      <h2>What we collect</h2>
      <p>SourcingOS may collect information you submit through forms, including your email address, role, recruiting focus, job submission details, and beta-interest notes. Public tool usage may also generate basic product analytics such as page views, tool launches, and button clicks.</p>
    </section>

    <section>
      <h2>How we use it</h2>
      <p>We use submitted information to manage the beta waitlist, improve the product, understand which sourcing workflows are useful, and contact you about SourcingOS updates. We do not sell user-submitted data to advertisers.</p>
    </section>

    <section>
      <h2>Public-source research</h2>
      <p>SourcingOS treats GitHub, Stack Overflow, OpenAlex, NPI, ORCID, PubMed, arXiv, and other public-source records as evidence sources, not identity verification and not outreach permission. Source profiles remain separate until a recruiter reviews identity signals and confirms whether records should be associated.</p>
    </section>

    <section>
      <h2>Candidate Graph and no auto-merge</h2>
      <p>SourcingOS does not silently merge profiles at any confidence level. The platform may suggest possible matches based on public evidence, but recruiter confirmation is required before source profiles are treated as the same candidate record.</p>
    </section>

    <section>
      <h2>Healthcare and clearance-sensitive data</h2>
      <p>NPI data and healthcare registry data are used for sourcing research context only. Public clearance language is treated as an unverified breadcrumb only and must be manually verified through appropriate hiring processes.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Questions about privacy or data handling can be sent through the waitlist/contact flow while the product is in beta.</p>
      <Link className="btn secondary" href="/waitlist">Contact / request access</Link>
    </section>
  </main>
}
