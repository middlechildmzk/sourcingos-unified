import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | SourcingOS',
  description: 'How SourcingOS handles waitlist information, public-source research, recruiter-controlled candidate evidence, retention, and removal requests.'
}

export default function PrivacyPage() {
  return <main className="wrap article">
    <span className="kicker">SourcingOS privacy</span>
    <h1>Privacy Policy</h1>
    <p className="lead">SourcingOS is built around a simple principle: public evidence should stay traceable, recruiter judgment should stay human, and private user data should not be sold.</p>

    <section>
      <h2>What we collect from visitors and users</h2>
      <p>SourcingOS may collect information you submit through forms, including your email address, role, recruiting focus, job submission details, beta-interest notes, contact requests, and product feedback. Public tool usage may also generate bounded product analytics such as page views, tool launches, and button clicks.</p>
    </section>

    <section>
      <h2>Candidate and sourcing data</h2>
      <p>Recruiters using private product features may import or save candidate-related information. Depending on the workflow, that can include a candidate name, professional headline, title, company, location, skills, resume or profile text supplied by the recruiter, source URLs, public professional or research records, contact signals, role associations, recruiter review decisions, and evidence used to support or question a sourcing conclusion.</p>
      <p>SourcingOS also stores provenance so evidence can remain tied to the source from which it was observed. Search context by itself is not treated as proof about a candidate.</p>
    </section>

    <section>
      <h2>Why candidate data is processed</h2>
      <p>Candidate data is processed to support recruiter-directed sourcing, research, identity review, evidence review, candidate comparison, role-specific workflow, and data-quality operations. SourcingOS is not designed to make final hiring decisions automatically. Recruiters remain responsible for determining whether their use of candidate information is permitted under the laws, contracts, policies, and notices that apply to their organization and jurisdiction.</p>
      <p>Public-source records are used as research evidence rather than as permission to contact a person or as authoritative identity, employment, citizenship, clearance, licensure, or eligibility verification.</p>
    </section>

    <section>
      <h2>How we use visitor and account information</h2>
      <p>We use submitted information to manage the beta waitlist, operate support and privacy queues, improve the product, understand which sourcing workflows are useful, and contact users about SourcingOS when appropriate. We do not sell user-submitted data to advertisers.</p>
    </section>

    <section>
      <h2>Public-source research</h2>
      <p>SourcingOS may use public or officially available sources such as GitHub, Stack Overflow, OpenAlex, NPI, ORCID, PubMed, arXiv, public government records, and other permitted sources. These records are evidence sources, not identity verification and not outreach permission. Source profiles remain separate until a recruiter reviews identity signals and confirms whether records should be associated.</p>
    </section>

    <section>
      <h2>Candidate Graph and no auto-merge</h2>
      <p>SourcingOS does not silently merge profiles at any confidence level. The platform may suggest possible matches based on public evidence, but recruiter confirmation is required before source profiles are treated as the same candidate record.</p>
    </section>

    <section>
      <h2>Healthcare and clearance-sensitive data</h2>
      <p>NPI data and healthcare registry data are used for sourcing research context only. Public clearance language is treated as an unverified breadcrumb only and must be manually verified through appropriate hiring processes. SourcingOS does not infer protected characteristics for candidate scoring.</p>
    </section>

    <section>
      <h2>Retention during the beta</h2>
      <p>During the private beta, recruiter-controlled candidate records and their associated source/evidence records are retained until the recruiter removes them or a verified candidate-data removal request is completed. SourcingOS does not currently promise an automatic time-based expiry for candidate records. This retention rule is intentionally stated as the product behaves today and will be revised before broader release if automated retention is introduced.</p>
      <p>Operational records needed to secure and run the service, such as bounded rate-limit counters and basic analytics, may have different retention behavior and are not used as candidate dossiers.</p>
    </section>

    <section>
      <h2>Access, correction, and removal requests</h2>
      <p>If you believe SourcingOS stores candidate data about you, you can request access, correction, or removal through the dedicated contact form. Provide only enough information to locate the record. We may request reasonable verification before disclosing or deleting personal data so a request cannot be used to access or erase another person&apos;s information.</p>
      <p>When a verified removal request is accepted, SourcingOS will remove the matching candidate data from the active product records that it controls, subject to any limited retention required for security, legal obligations, fraud prevention, or documenting the request itself. We do not require a candidate to create a SourcingOS account to submit a removal request.</p>
      <p><Link className="btn secondary" href="/contact">Submit a privacy or candidate-data request</Link></p>
    </section>

    <section>
      <h2>Security reports</h2>
      <p>Security researchers can use the same contact route and select Security vulnerability. SourcingOS also publishes a standard security contact file at <Link href="/.well-known/security.txt">/.well-known/security.txt</Link>.</p>
    </section>

    <section>
      <h2>Contact</h2>
      <p>Use the dedicated contact route for privacy, candidate-data, security, or general product questions. Beta access requests remain separate.</p>
      <div className="button-row">
        <Link className="btn secondary" href="/contact">Contact SourcingOS</Link>
        <Link className="btn ghost" href="/waitlist">Request beta access</Link>
      </div>
    </section>
  </main>
}
