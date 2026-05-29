import Link from 'next/link'
import { JobsFilter } from '@/components/JobsFilter'
import { jobCategories, jobs } from '@/data/jobs'

export const metadata = {
  title: 'SourcingOS Jobs — Jobs for people who find people',
  description: 'Curated recruiter, sourcer, TA, recruiting ops, healthcare recruiting, GovCon recruiting, and AI recruiting jobs.'
}

export default function JobsPage() {
  return (
    <main>
      <section className="wrap hero">
        <div className="eyebrow">Recruiter career intelligence</div>
        <h1>Jobs for people who find people.</h1>
        <p className="lead">The curated job board for sourcers, recruiters, TA, recruiting ops, HR ops, and talent leaders. Remote-friendly, sourcing-heavy, and built into the SourcingOS ecosystem.</p>
        <div className="hero-actions">
          <Link className="btn" href="#jobs">Browse jobs</Link>
          <Link className="btn secondary" href="/jobs/submit">Post a job free</Link>
          <Link className="btn ghost" href="/waitlist">Join SourcingOS beta</Link>
        </div>
        <div className="grid">
          <div className="card"><span className="kicker">Curated</span><h3>No generic firehose</h3><p className="muted">Jobs are organized around recruiter-specific metadata like sourcing-heavy, technical, healthcare, GovCon, AI, contract, ATS stack, and salary visibility.</p></div>
          <div className="card"><span className="kicker">SEO categories</span><h3>Role-specific career hubs</h3><p className="muted">Remote recruiter, talent sourcer, technical sourcer, recruiting ops, healthcare recruiter, cleared recruiter, and AI recruiter pages.</p></div>
          <div className="card"><span className="kicker">SourcingOS funnel</span><h3>Jobs + tools + methods</h3><p className="muted">Every job category connects back to SourcingOS tools, source packs, career guides, and private beta workflows.</p></div>
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">Start here</div>
        <h2>Explore recruiter job categories.</h2>
        <div className="grid">
          {jobCategories.map(category => (
            <Link className="card" href={`/jobs/${category.slug}`} key={category.slug}>
              <span className="kicker">Jobs</span>
              <h3>{category.name}</h3>
              <p className="muted">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap" id="jobs">
        <div className="eyebrow">Featured roles</div>
        <h2>Sourcing-heavy opportunities.</h2>
        <JobsFilter jobs={jobs} />
      </section>

      <section className="wrap">
        <div className="grid two">
          <div className="card">
            <span className="kicker">Career hub</span>
            <h2>Recruiter salary and career guides</h2>
            <p className="muted">Next up: salary pages, resume positioning, sourcing portfolio examples, and interview prep for sourcers and recruiters.</p>
            <Link className="btn secondary" href="/jobs/guides">Open career guides</Link>
          </div>
          <div className="card">
            <span className="kicker">Employer hub</span>
            <h2>Hiring recruiters or sourcers?</h2>
            <p className="muted">Submit a role for review. V1 uses curated link-out listings and admin approval before anything goes live.</p>
            <Link className="btn" href="/jobs/submit">Post a job free</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
