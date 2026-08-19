import Link from 'next/link'
import { LiveJobsClient } from '@/components/LiveJobsClient'
import { jobCategories } from '@/data/jobs'

export const metadata = {
  title: 'SourcingOS Jobs — Jobs for people who find people',
  description: 'Recruiter and sourcer job search hub with live public job-source search, career categories, and SourcingOS career intelligence.',
  alternates: { canonical: '/jobs/' },
  openGraph: {
    title: 'SourcingOS Jobs — Jobs for people who find people',
    description: 'Search recruiter and sourcer roles from public job sources and connect the search to SourcingOS tools and career topics.',
    url: '/jobs/',
    type: 'website',
  },
}

export default function JobsPage() {
  return (
    <main>
      <section className="wrap hero">
        <div className="eyebrow">Recruiter career intelligence</div>
        <h1>Jobs for people who find people.</h1>
        <p className="lead">A recruiter career hub for sourcers, recruiters, TA, recruiting ops, healthcare recruiting, GovCon recruiting, and AI recruiting. Live listings are pulled from public/free sources where available and always link back to the original source.</p>
        <div className="hero-actions">
          <Link className="btn" href="#live-jobs">Search live jobs</Link>
          <Link className="btn secondary" href="/jobs/submit">Post a job for review</Link>
          <Link className="btn ghost" href="/waitlist">Join SourcingOS beta</Link>
        </div>
        <div className="grid">
          <div className="card"><span className="kicker">Trust-first</span><h3>No fake apply links</h3><p className="muted">SourcingOS links to original public job sources. The static production job dataset contains no seeded example openings.</p></div>
          <div className="card"><span className="kicker">Search presets</span><h3>Recruiter career categories</h3><p className="muted">Remote recruiter, talent sourcer, technical sourcer, recruiting ops, healthcare recruiter, cleared recruiter, AI recruiter, and contract recruiter search presets.</p></div>
          <div className="card"><span className="kicker">SourcingOS workflow</span><h3>Jobs + tools + methods</h3><p className="muted">Career searches connect back to SourcingOS tools, source packs, training, and private beta workflows.</p></div>
        </div>
      </section>

      <section className="wrap" id="live-jobs">
        <div className="eyebrow">Live source search</div>
        <h2>Search live recruiter and sourcer listings.</h2>
        <LiveJobsClient />
      </section>

      <section className="wrap">
        <div className="eyebrow">Career categories</div>
        <h2>Explore recruiter job searches.</h2>
        <div className="grid">
          {jobCategories.map(category => (
            <Link className="card" href={`/jobs/${category.slug}`} key={category.slug}>
              <span className="kicker">Search preset</span>
              <h3>{category.name}</h3>
              <p className="muted">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="grid two">
          <div className="card">
            <span className="kicker">Career topics</span>
            <h2>Recruiter career topics in development</h2>
            <p className="muted">See the current topic index for sourcing portfolios, remote recruiter searches, recruiting operations, GovCon recruiting, and AI recruiting careers. These are not yet full standalone guides.</p>
            <Link className="btn secondary" href="/jobs/guides">See career guide topics</Link>
          </div>
          <div className="card">
            <span className="kicker">Employer hub</span>
            <h2>Hiring recruiters or sourcers?</h2>
            <p className="muted">Submit a role for review. V1 uses curated link-out listings and admin approval before anything goes live.</p>
            <Link className="btn" href="/jobs/submit">Post a job for review</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
