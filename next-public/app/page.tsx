import Link from 'next/link'
import { articles } from '@/data/articles'
import { methods } from '@/data/methods'

export const metadata = {
  title: 'SourcingOS — Find who your search missed.',
  description:
    'Build source packs, run open-web searches, and turn candidate evidence into recruiter-confirmed Candidate 360 profiles. Free tools for technical, cleared, healthcare, and AI recruiting.',
}

const tools = [
  {
    icon: '{}',
    name: 'BooleanOS',
    desc: 'Generate recruiter-ready Boolean strings by role mode — technical, cleared, cyber, healthcare, AI/ML, GovCon.',
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

export default function Home() {
  return (
    <main>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="wrap hero">
        <div className="eyebrow">The sourcing stack for hard-to-fill roles</div>
        <h1>Find who your<br />search missed.</h1>
        <p className="lead">
          Build source packs, run open-web searches, and turn candidate evidence into
          recruiter-confirmed Candidate 360 profiles.
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/tools/boolean-generator">Try BooleanOS</Link>
          <Link className="btn secondary" href="/waitlist">Request Candidate Search beta</Link>
          <Link className="btn ghost" href="/sample-candidate-360">See a sample Candidate 360 →</Link>
        </div>
        <div className="cta">
          <strong>Human-approved sourcing intelligence:</strong> public evidence, source provenance,
          recruiter-confirmed identity matching, and no silent profile merges.
        </div>
      </section>

      {/* ── Workflow diagram ─────────────────────────────────────── */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow">
          <span className="section-tag">How SourcingOS works</span>
        </div>
        <h2 className="section-title">From req to Candidate 360 in one workflow.</h2>
        <div className="workflow">
          <div className="workflow-step">
            <div className="wf-num">01</div>
            <div className="wf-title">Role Intake</div>
            <p className="wf-desc">Define must-haves, disqualifiers, target companies, and HM calibration questions.</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step">
            <div className="wf-num">02</div>
            <div className="wf-title">Search Strategy</div>
            <p className="wf-desc">Generate search lanes, Boolean strings, X-Ray queries, and adjacent title maps.</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step">
            <div className="wf-num">03</div>
            <div className="wf-title">Candidate Search</div>
            <p className="wf-desc">Search public sources, collect evidence, and save source profiles to the Candidate Graph.</p>
          </div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step">
            <div className="wf-num">04</div>
            <div className="wf-title">Candidate 360</div>
            <p className="wf-desc">Review recruiter-confirmed identity matches, evidence, and outreach angles in one dossier.</p>
          </div>
        </div>
        <p className="muted" style={{ fontSize: '13px', marginTop: '6px' }}>
          Powered by Candidate Graph — SourcingOS keeps source profiles, evidence, contact signals,
          and identity matches in one recruiter-confirmed candidate record.
        </p>
      </section>

      <hr className="section-divider" />

      {/* ── Free Tools ───────────────────────────────────────────── */}
      <section className="section">
        <div className="section-eyebrow">
          <span className="section-tag">Free tools</span>
        </div>
        <h2 className="section-title">Start sourcing in 30 seconds. No account required.</h2>
        <p className="section-body">
          BooleanOS, X-Ray Launcher, and the JD Strategy Tool are free and open. They wire
          directly into the Candidate Search beta workflow.
        </p>
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

      {/* ── Candidate Search beta ────────────────────────────────── */}
      <section className="section">
        <div className="section-eyebrow">
          <span className="section-tag">Private beta</span>
        </div>
        <h2 className="section-title">Candidate Search beta.</h2>
        <p className="section-body">
          The main SourcingOS workbench connects role intake, search strategy, open-web discovery,
          and Candidate 360 dossiers into one recruiter-controlled workflow. No autonomous sourcing.
          No silent merges. Evidence stays visible.
        </p>
        <div className="beta-preview-card">
          <div className="grid two">
            <div className="card">
              <span className="kicker">Role Intake</span>
              <h3>Req-to-lane in one pass</h3>
              <p className="muted">Paste the JD. Get role summary, must-haves, target titles, search lanes, and HM calibration questions.</p>
            </div>
            <div className="card">
              <span className="kicker">Multi-source discovery</span>
              <h3>GitHub, OpenAlex, npm, and more</h3>
              <p className="muted">Search 17 public source connectors. Status-labeled honestly: live, preview, or manual-safe.</p>
            </div>
            <div className="card">
              <span className="kicker">Candidate Graph</span>
              <h3>No auto-merge. Ever.</h3>
              <p className="muted">Source profiles stay separate. Recruiter confirms identity matches before they roll up into Candidate 360.</p>
            </div>
            <div className="card">
              <span className="kicker">Candidate 360</span>
              <h3>Evidence dossier</h3>
              <p className="muted">Evidence matrix, contact signals, open-to-work signals, verify-next checklist, and HM pitch.</p>
            </div>
          </div>
          <div className="home-cta-row" style={{ marginTop: '24px' }}>
            <Link className="btn" href="/waitlist">Request Candidate Search beta</Link>
            <Link className="btn secondary" href="/app/candidate-search">Preview workbench</Link>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ── Jobs hub ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-eyebrow">
          <span className="section-tag">Career hub</span>
        </div>
        <h2 className="section-title">Jobs for people who find people.</h2>
        <p className="section-body">
          Remote recruiter, technical sourcer, healthcare recruiter, cleared recruiter, recruiting ops, and AI recruiter
          jobs — pulled from public sources and linked to original listings.
        </p>
        <div className="home-cta-row">
          <Link className="btn secondary" href="/jobs">Browse recruiter jobs</Link>
          <Link className="btn ghost" href="/jobs/submit">Post a sourcing role</Link>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ── Sourcing Vault ───────────────────────────────────────── */}
      <section className="section">
        <div className="section-eyebrow">
          <span className="section-tag">Sourcing vault</span>
        </div>
        <h2 className="section-title">Methods that ship with the methodology.</h2>
        <div className="grid">
          {methods.slice(0, 6).map(m => (
            <Link className="card" href={m.href} key={m.slug}>
              <span className="kicker">Method</span>
              <h3>{m.name}</h3>
              <p className="muted">{m.description}</p>
            </Link>
          ))}
        </div>
        <div className="home-cta-row" style={{ marginTop: '20px' }}>
          <Link className="btn secondary" href="/methods">All sourcing methods</Link>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ── Guides ───────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-eyebrow">
          <span className="section-tag">Guides</span>
        </div>
        <h2 className="section-title">Flagship sourcing guides.</h2>
        <div className="grid">
          {articles.slice(0, 6).map(a => (
            <Link className="card" href={`/blog/${a.slug}`} key={a.slug}>
              <span className="kicker">{a.category}</span>
              <h3>{a.title}</h3>
              <p className="muted">{a.description}</p>
            </Link>
          ))}
        </div>
        <div className="home-cta-row" style={{ marginTop: '20px' }}>
          <Link className="btn secondary" href="/blog">All guides</Link>
          <Link className="btn ghost" href="/directory">Tool directory</Link>
        </div>
      </section>

      {/* ── Waitlist CTA ─────────────────────────────────────────── */}
      <div className="waitlist-section">
        <div className="waitlist-inner">
          <div className="eyebrow" style={{ justifyContent: 'center', display: 'flex', marginBottom: '12px' }}>Private beta</div>
          <h2>Request Candidate Search beta access.</h2>
          <p>
            SourcingOS is in private beta for senior sourcers and recruiting teams working hard-to-fill
            technical, cleared, healthcare, and AI roles.
          </p>
          <Link className="btn" href="/waitlist">Request access</Link>
        </div>
      </div>

    </main>
  )
}
