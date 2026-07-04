import Link from 'next/link'
import { FaqJsonLd } from '@/components/StructuredData'

export const metadata = {
  alternates: { canonical: '/trust/' },
  title: 'Trust Rules | SourcingOS',
  description: 'The non-negotiable rules SourcingOS is built on: no fake candidates, public evidence only, no auto-outreach, no silent merges, and human verification required.'
}

const faqs = [
  {
    question: 'Does SourcingOS verify candidates?',
    answer: 'No. SourcingOS shows public-source evidence and helps recruiters review it. Identity, employment, clearance, availability, and fit must be verified by the recruiter and hiring process.',
  },
  {
    question: 'Does SourcingOS scrape LinkedIn or paid databases?',
    answer: 'No. SourcingOS does not scrape LinkedIn, Indeed, ClearanceJobs, paid resume databases, or restricted platforms. X-Ray strings are manual-safe searches recruiters run themselves.',
  },
  {
    question: 'What does confidence mean in SourcingOS?',
    answer: 'Confidence means source relevance only. It does not verify the person, their clearance, their current employer, their location, their contact data, or their interest.',
  },
]

export default function TrustPage() {
  return <main className="wrap article">
    <FaqJsonLd id="trust-faq-jsonld" faqs={faqs} />
    <span className="kicker">SourcingOS trust</span>
    <h1>Trust rules</h1>
    <p className="lead">Recruiters get burned by tools that overclaim. These are the rules SourcingOS will not break, in the product and in the code.</p>

    <div className="article-callout">
      <strong>TL;DR:</strong> SourcingOS never invents candidates, never treats public signals as verification, never scrapes restricted platforms, never auto-merges profiles, and never sends outreach for you.
    </div>

    <section>
      <h2>No fake candidates</h2>
      <p>SourcingOS never invents people, companies, jobs, links, or contact data. If a search finds nothing, you see an honest empty state with suggestions for the next search, not filler results.</p>
    </section>

    <section>
      <h2>Public evidence only</h2>
      <p>Every record traces back to a public URL or to data you imported yourself. Source provenance stays attached to each evidence artifact so you can always answer the question: where did this come from?</p>
    </section>

    <section>
      <h2>Signals are not verification</h2>
      <p>Clearance language in a public bio is an unverified clearance breadcrumb. Open-to-work phrasing is a public signal. A matching name across two profiles is a possible match. None of these are treated as verified. Human verification is required before any of them count.</p>
    </section>

    <section>
      <h2>No silent merges</h2>
      <p>Source profiles stay separate until a recruiter reviews the identity signals and confirms they belong to the same person. There is no auto-merge at any confidence level.</p>
    </section>

    <section>
      <h2>No auto-outreach</h2>
      <p>SourcingOS drafts outreach angles grounded in the evidence you selected. It never sends anything. You review, edit, and send from your own tools.</p>
    </section>

    <section>
      <h2>No restricted-platform scraping</h2>
      <p>SourcingOS does not scrape LinkedIn, Indeed, ClearanceJobs, or paid resume databases, and it does not automate anything behind a login wall. X-Ray search strings are provided for you to run in your own browser and review yourself.</p>
    </section>

    <section>
      <h2>Fail closed</h2>
      <p>Private routes and write APIs require authentication. If the auth backend is unavailable, they refuse the request instead of quietly letting it through.</p>
    </section>

    <section>
      <h2>FAQ</h2>
      {faqs.map(faq => <div className="faq" key={faq.question}>
        <h3>{faq.question}</h3>
        <p>{faq.answer}</p>
      </div>)}
    </section>

    <section>
      <h2>See it in practice</h2>
      <p>The methodology page walks through how these rules shape the actual workflow, and the data sources page lists exactly which public sources power search.</p>
      <p>
        <Link className="btn secondary" href="/methodology">Read the methodology</Link>{' '}
        <Link className="btn secondary" href="/data-sources">See data sources</Link>
      </p>
    </section>
  </main>
}
