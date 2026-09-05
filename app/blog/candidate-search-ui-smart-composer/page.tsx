import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Candidate Search Smart Composer — Product Design Note | SourcingOS',
  description: 'A product design note explaining how SourcingOS interprets titles, skills, locations, source lanes, and trust-sensitive signals in Candidate Search.',
  alternates: { canonical: '/blog/candidate-search-ui-smart-composer/' },
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Candidate Search Smart Composer — Product Design Note | SourcingOS',
    description: 'How SourcingOS shapes recruiter search intent without turning query interpretation into candidate fact or automated decision-making.',
    url: '/blog/candidate-search-ui-smart-composer/',
    type: 'article',
  },
}

export default function CandidateSearchComposerNote() {
  return <main className="wrap article article-pro">
    <div className="article-hero-card">
      <span className="kicker">Product design note · not indexed</span>
      <h1>Candidate Search Smart Composer</h1>
      <p className="lead">This page documents a SourcingOS product-design decision: the search box should help a sourcer structure intent while keeping candidate evidence, identity, and consequential decisions outside the autocomplete layer.</p>
    </div>
    <article className="article-main">
      <section><h2>What the composer interprets</h2><p>The interface can recognize search-oriented concepts such as role titles, skills, location, exclusions, clearance-related breadcrumbs, and source-lane hints. It can suggest a cleaner query or a better source path, but those suggestions describe the search, not the person.</p></section>
      <section><h2>What it should not do</h2><ul><li>invent people or profile details</li><li>turn a clearance mention into current-status confirmation</li><li>silently merge identities</li><li>infer protected or sensitive traits</li><li>auto-run a consequential candidate decision from the query alone</li></ul></section>
      <section><h2>Why this is noindex</h2><p>This is useful product documentation, but it does not need to compete with the search-facing SourcingOS methodology library. The canonical authority pages explain the broader sourcing concepts; this page remains accessible for users and product reviewers who want implementation context.</p></section>
      <div className="nav-links"><Link className="button ghost compact" href="/candidate-search/">Try Candidate Search</Link><Link className="button ghost compact" href="/trust/">Read trust rules</Link><Link className="button ghost compact" href="/blog/source-pack-methodology/">Source Pack Methodology</Link></div>
    </article>
  </main>
}
