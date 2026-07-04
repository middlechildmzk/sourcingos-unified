import Link from 'next/link'
import { articles } from '@/data/articles'
import { methods } from '@/data/methods'

export const metadata = {
  alternates: { canonical: '/' },
  title: 'SourcingOS — Find who your search missed.',
  description:
    'Build source packs, run open-web searches, and turn candidate evidence into recruiter-confirmed Candidate 360 profiles. Free tools for technical, cleared, healthcare, and AI recruiting.',
}

const tools = [
  {
    icon: 'B',
    name: 'BooleanOS',
    desc: 'Generate recruiter-ready Boolean strings by role mode: technical, cleared, cyber, healthcare, AI/ML, GovCon.',
    href: '/tools/boolean-generator',
    label: 'Hero free tool',
  },
  {
    icon: '⌕',
    name: 'X-Ray Launcher',
    desc: 'Build Google X-Ray searches across GitHub, public resumes, LinkedIn, Hugging Face, OpenAlex, and open-web sources.',
    href: '/tools/xray-search',
    label: 'Open-web search',
  },
  {
    icon: '▦',
    name: 'JD Strategy Tool',
    desc: 'Turn a messy job description into source lanes, target titles, Boolean strings, and hiring manager calibration questions.',
    href: '/tools/jd-search-strategy',
    label: 'Search strategy',
  },
]

const latestArticles = [...articles].slice(-6).reverse()

export default function Home() {
  return (
    <main>

      <section className="wrap hero hero-pro">
        <div className="eyebrow">The sourcing OS for hard-to-fill roles</div>
        <h1>Find who your<br />search missed.</h1>
        <p className="lead">
          Build source packs, run open-web searches, and turn candidate evidence into
          recruiter-confirmed Candidate 360 profiles.
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/candidate-search">Try Candidate Search</Link>
          <Link className="btn secondary" href="/tools/boolean-generator">Try BooleanOS</Link>
          <Link className="btn ghost" href="/sample-candidate-360">See a sample Candidate 360 →</Link>
        </div>
        <div className="trust-strip">
          <span>No fake candidates</span>
          <span>Public evidence only</span>
          <span>Recruiter-confirmed merges</span>
          <span>No auto-outreach</span>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow"><span className="section-tag">How SourcingOS works</span></div>
        <h2 className="section-title">From req to Candidate 360 in one workflow.</h2>
        <div className="workflow">
          <div className="workflow-step"><div className="wf-num">01</div><div className="wf-title">Role Intake</div><p className="wf-desc">Define must-haves, disqualifiers, target companies, and HM calibration questions.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">02</div><div className="wf-title">Search Strategy</div><p className="wf-desc">Generate search lanes, Boolean strings, X-Ray queries, and adjacent title maps.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">03</div><div className="wf-title">Candidate Search</div><p className="wf-desc">Search public sources, collect evidence, and review source profiles.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">04</div><div className="wf-title">Candidate 360</div><p className="wf-desc">Review evidence, gaps, contact signals, and recruiter-confirmed identity matches.</p></div>
        </div>
        <p className="muted" style={{ fontSize: '13px', marginTop: '6px' }}>
          Candidate Graph keeps source profiles, evidence, contact signals, and identity matches separate until a recruiter confirms them.
        </p>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Free vs beta</span></div>
        <h2 className="section-title">Clear value before the login wall.</h2>
        <p className="section-body">SourcingOS should feel useful immediately, then make the private beta obvious when the workflow becomes durable.</p>
        <div className="grid two">
          <div className="card featured"><span className="kicker">Free, no account</span><h3>Tools and public demo</h3><p className="muted">BooleanOS, X-Ray Launcher, JD Strategy Tool, Clearance Search, Aging Req Rescue, Candidate Search demo, and sample Candidate 360.</p></div>
          <div className="card"><span className="kicker">Private beta</span><h3>Durable sourcing cockpit</h3><p className="muted">Projects, saved candidates, contact enrichment, Candidate Graph, Candidate 360 dossiers, project memory, and admin workflows.</p></div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Free tools</span></div>
        <h2 className="section-title">Start sourcing in 30 seconds. No account required.</h2>
        <p className="section-body">BooleanOS, X-Ray Launcher, and the JD Strategy Tool are free and open. They wire directly into the Candidate Search beta workflow.</p>
        <div className="tools-grid">
          {tools.map(t => (
            <Link className="tool-card" href={t.href} key={t.href}>
              <div className="tool-icon">{t.icon}</div>
              <span className="kicker">{t.label}</span>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <span className="kicker" style={{ color: 'var(--muted)' }}>Open tool →</span>
            </Link>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Candidate Search beta</span></div>
        <h2 className="section-title">Smart search assist, source lanes, and evidence-first profiles.</h2>
        <p className="section-body">The workbench recognizes titles, skills, locations, clearance breadcrumbs, and source-lane hints while you type. Press Enter to search, then review evidence before saving anything.</p>
        <div className="beta-preview-card">
          <div className="grid two">
            <div className="card"><span className="kicker">Smart composer</span><h3>Understands sourcer intent</h3><p className="muted">Entity recognition, selectable suggestions, chips, keyboard support, source lane routing, and trust notes.</p></div>
            <div className="card"><span className="kicker">Evidence review</span><h3>No black-box matches</h3><p className="muted">Open the drawer, inspect public evidence, see missing fields, and keep clearance/open-to-work as unverified signals.</p></div>
            <div className="card"><span className="kicker">Candidate Graph</span><h3>No auto-merge. Ever.</h3><p className="muted">Source profiles stay separate until a recruiter confirms identity matches.</p></div>
            <div className="card"><span className="kicker">Candidate 360</span><h3>HM-ready dossier</h3><p className="muted">Evidence matrix, contact signals, verify-next checklist, risk flags, and pitch angles.</p></div>
          </div>
          <div className="home-cta-row" style={{ marginTop: '24px' }}>
            <Link className="btn" href="/candidate-search">Try public demo</Link>
            <Link className="btn secondary" href="/waitlist">Request beta access</Link>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Sourcing vault</span></div>
        <h2 className="section-title">Methods that make the product feel inevitable.</h2>
        <div className="grid">
          {methods.slice(0, 6).map(m => (
            <Link className="card" href={m.href} key={m.slug}>
              <span className="kicker">Method</span>
              <h3>{m.name}</h3>
              <p className="muted">{m.description}</p>
            </Link>
          ))}
        </div>
        <div className="home-cta-row" style={{ marginTop: '20px' }}><Link className="btn secondary" href="/methods">All sourcing methods</Link></div>
      </section>

      <hr className="section-divider" />

      <section className="section authority-section">
        <div className="section-eyebrow"><span className="section-tag">Authority hub</span></div>
        <h2 className="section-title">Next-level sourcing guides for senior recruiters.</h2>
        <p className="section-body">Deep sourcing articles built around search strategy, AI workflows, contact data, cleared recruiting, evidence review, rediscovery, and sourcer operations.</p>
        <div className="grid">
          {latestArticles.map(a => (
            <Link className="card authority-card" href={`/blog/${a.slug}`} key={a.slug}>
              <span className="kicker">{a.category}</span>
              <h3>{a.title}</h3>
              <p className="muted">{a.description}</p>
            </Link>
          ))}
        </div>
        <div className="home-cta-row" style={{ marginTop: '20px' }}>
          <Link className="btn secondary" href="/blog">All guides</Link>
          <Link className="btn ghost" href="/blog/best-contact-finders-for-recruiters-2026">Best contact finders 2026</Link>
        </div>
      </section>

      <div className="waitlist-section">
        <div className="waitlist-inner">
          <div className="eyebrow" style={{ justifyContent: 'center', display: 'flex', marginBottom: '12px' }}>Private beta</div>
          <h2>Request Candidate Search beta access.</h2>
          <p>SourcingOS is in private beta for senior sourcers and recruiting teams working hard-to-fill technical, cleared, healthcare, and AI roles.</p>
          <Link className="btn" href="/waitlist">Request access</Link>
        </div>
      </div>

    </main>
  )
}
