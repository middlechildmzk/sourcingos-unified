import Link from 'next/link'
import { LiveJobsClient } from '@/components/LiveJobsClient'
import { jobCategories } from '@/data/jobs'

export const metadata = {
  title: 'Recruiter & Talent Sourcer Jobs (2026) — Live Search | SourcingOS',
  description: 'Search current recruiter, talent sourcer, technical sourcer, recruiting ops, healthcare, GovCon, AI, and contract recruiting roles from original public job sources.',
  alternates: { canonical: '/jobs/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Recruiter & Talent Sourcer Jobs (2026) — Live Search | SourcingOS',
    description: 'Search current recruiting and sourcing roles from original public sources, then use SourcingOS tools to sharpen your search and application strategy.',
    url: '/jobs/',
    type: 'website',
  },
}

const faq = [
  {
    question: 'Where does SourcingOS get recruiter and sourcer jobs?',
    answer: 'SourcingOS searches reviewed public sources, curated employer ATS feeds, and other public job sources where available. Apply links point to the original posting rather than copied third-party job descriptions.',
  },
  {
    question: 'What recruiter job categories can I search?',
    answer: 'Current category pages include remote recruiter jobs, remote talent sourcer jobs, technical sourcer jobs, recruiting operations jobs, healthcare recruiter jobs, cleared and GovCon recruiter jobs, AI recruiter jobs, and contract or fractional recruiter jobs.',
  },
  {
    question: 'How should I search recruiter jobs with different titles?',
    answer: 'Recruiting titles vary significantly by company. Search adjacent titles such as recruiter, talent acquisition partner, talent sourcer, sourcing specialist, recruiting operations, talent operations, technical recruiter, and embedded recruiter rather than relying on one exact title.',
  },
]

export default function JobsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="wrap hero">
        <div className="eyebrow">Recruiter career intelligence · 2026</div>
        <h1>Recruiter and talent sourcer jobs from original sources.</h1>
        <p className="lead">Search current recruiter, talent sourcer, technical sourcer, recruiting operations, healthcare, GovCon, AI, and contract recruiting roles. SourcingOS links back to the original public posting and connects job search with practical sourcing tools and career intelligence.</p>
        <div className="hero-actions">
          <Link className="btn" href="#live-jobs">Search live jobs</Link>
          <Link className="btn secondary" href="/jobs/submit">Post a job for review</Link>
          <Link className="btn ghost" href="/waitlist">Join SourcingOS beta</Link>
        </div>
        <div className="grid">
          <div className="card"><span className="kicker">Trust-first</span><h3>No fake apply links</h3><p className="muted">SourcingOS links to original public job sources. The static production job dataset contains no seeded example openings.</p></div>
          <div className="card"><span className="kicker">Search presets</span><h3>Recruiter career categories</h3><p className="muted">Remote recruiter, talent sourcer, technical sourcer, recruiting ops, healthcare recruiter, cleared recruiter, AI recruiter, and contract recruiter search presets.</p></div>
          <div className="card"><span className="kicker">Search smarter</span><h3>Jobs + tools + methods</h3><p className="muted">Turn job descriptions into better title maps, Boolean searches, X-Ray queries, sourcing examples, and interview-ready proof of your process.</p></div>
        </div>
      </section>

      <section className="wrap" id="live-jobs">
        <div className="eyebrow">Live source search</div>
        <h2>Search live recruiter and sourcer listings.</h2>
        <p className="muted">Start broad, then narrow by role, location, remote status, and source. Always confirm availability, compensation, and employment details on the original posting.</p>
        <LiveJobsClient />
      </section>

      <section className="wrap">
        <div className="eyebrow">Career categories</div>
        <h2>Explore high-intent recruiter job searches.</h2>
        <div className="grid">
          {jobCategories.map(category => (
            <Link className="card" href={`/jobs/${category.slug}`} key={category.slug}>
              <span className="kicker">Live search preset</span>
              <h3>{category.name}</h3>
              <p className="muted">{category.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">Free job-search tools</div>
        <h2>Turn a posting into a stronger search and interview story.</h2>
        <div className="grid">
          <Link className="card" href="/tools/jd-search-strategy">
            <span className="kicker">JD Strategy Tool</span>
            <h3>Decode the job description</h3>
            <p className="muted">Extract must-haves, adjacent titles, source lanes, Boolean ideas, and hiring-manager calibration questions.</p>
          </Link>
          <Link className="card" href="/tools/boolean-generator">
            <span className="kicker">BooleanOS</span>
            <h3>Show your sourcing craft</h3>
            <p className="muted">Build recruiter-ready Boolean strings you can use as portfolio proof or practice for sourcing interviews.</p>
          </Link>
          <Link className="card" href="/tools/xray-search">
            <span className="kicker">X-Ray Launcher</span>
            <h3>Practice open-web sourcing</h3>
            <p className="muted">Generate X-Ray searches across GitHub, public resumes, LinkedIn, Hugging Face, OpenAlex, and other public sources.</p>
          </Link>
        </div>
      </section>

      <section className="wrap">
        <div className="grid two">
          <div className="card">
            <span className="kicker">Career topics</span>
            <h2>Build proof for the role you want</h2>
            <p className="muted">Use the career hub to strengthen sourcing portfolios, remote recruiter searches, recruiting operations positioning, GovCon recruiting knowledge, and AI recruiting fluency.</p>
            <Link className="btn secondary" href="/jobs/guides">See career guide topics</Link>
          </div>
          <div className="card">
            <span className="kicker">Employer hub</span>
            <h2>Hiring recruiters or sourcers?</h2>
            <p className="muted">Submit a role for review. Listings remain link-out based and require review before publication.</p>
            <Link className="btn" href="/jobs/submit">Post a job for review</Link>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">FAQ</div>
        <div className="grid">
          {faq.map(item => (
            <div className="card" key={item.question}>
              <h3>{item.question}</h3>
              <p className="muted">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
