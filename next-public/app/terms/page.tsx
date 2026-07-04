import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/terms/' },
  title: 'Terms of Use | SourcingOS',
  description: 'Plain-language beta terms for SourcingOS: what the product promises, what it does not, and acceptable use.'
}

export default function TermsPage() {
  return <main className="wrap article">
    <span className="kicker">Beta terms</span>
    <h1>Terms of Use</h1>
    <p className="lead">SourcingOS is in beta. These terms are written to be read, not skimmed past. Last updated July 4, 2026.</p>

    <section>
      <h2>Beta service</h2>
      <p>SourcingOS is provided as-is during beta. Features can change, have gaps, or be temporarily unavailable. We may add, limit, or remove beta access as the product evolves.</p>
    </section>

    <section>
      <h2>What SourcingOS does not promise</h2>
      <p>Search results are public evidence, not a complete market view. Public signals like clearance breadcrumbs, open-to-work language, or matching names are unverified until a human verifies them. SourcingOS does not verify identity, clearance, employment, or contact accuracy, and nothing in the product is a hiring decision. You own your hiring decisions and your process compliance, including platform terms and applicable employment law.</p>
    </section>

    <section>
      <h2>Acceptable use</h2>
      <p>Do not use SourcingOS to harass or discriminate, to scrape restricted platforms, to automate access behind login walls, or to attempt to bypass authentication, rate limits, or beta gating. Search strings we generate for restricted platforms are for you to run manually under your own accounts and their terms.</p>
    </section>

    <section>
      <h2>Your data</h2>
      <p>How we handle waitlist submissions, analytics, and imported data is covered in the privacy policy. You can ask us to remove your submitted information.</p>
      <p><Link className="btn secondary" href="/privacy">Read the privacy policy</Link></p>
    </section>

    <section>
      <h2>Changes</h2>
      <p>These terms may be updated during beta. Material changes will be reflected on this page with a new date at the top.</p>
      <p><Link className="btn secondary" href="/contact">Questions? Contact us</Link></p>
    </section>
  </main>
}
