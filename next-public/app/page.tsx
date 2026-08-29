import Link from 'next/link'
import { articles } from '@/data/articles'
import { methods } from '@/data/methods'
import { withTierAOverride } from '@/data/tier-a-article-overrides'

export const metadata = {
  alternates: { canonical: '/' },
  title: 'AI Sourcing Software for Recruiters | SourcingOS',
  description:
    'Evidence-first AI sourcing software for hard-to-fill technical, cleared, healthcare, and AI roles. Turn a role brief into sourcing strategies, truthful source execution, recruiter-reviewed evidence, and calibrated next searches.',
  openGraph: {
    title: 'AI Sourcing Software for Recruiters | SourcingOS',
    description:
      'Turn one role into a sourcing plan, execute supported public-source searches, guide restricted-source work, review evidence, and calibrate the next search.',
    url: '/',
    type: 'website',
  },
}

const tools = [
  {
    icon: 'B',
    name: 'BooleanOS',
    desc: 'Generate recruiter-ready Boolean strings by role mode: technical, cleared, cyber, healthcare, AI/ML, GovCon.',
    href: '/tools/boolean-generator',
    label: 'Free search tool',
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
    desc: 'Turn a messy job description into source lanes, target titles, Boolean strings, and hiring-manager calibration questions.',
    href: '/tools/jd-search-strategy',
    label: 'Search strategy',
  },
]

const trainingModules = [
  {
    href: '/training/ai-sourcing-prompts',
    label: 'AI sourcing',
    title: 'Build source packs with AI',
    desc: 'Prompts that structure the search without inventing candidates, links, or verification.',
  },
  {
    href: '/training/evidence-review-checklist',
    label: 'Evidence review',
    title: 'Facts, signals, assumptions',
    desc: 'A checklist for reviewing public evidence before saving or pitching a source profile.',
  },
  {
    href: '/training/candidate-360-workshop',
    label: 'Candidate 360',
    title: 'Build HM-ready dossiers',
    desc: 'Turn source evidence into a recruiter-confirmed dossier with gaps and verify-next steps.',
  },
]

const excludedArticleSlugs = new Set([
  'open-web-sourcing-stack',
  'sourcing-tool-stack-for-agency-recruiters',
  'sourcing-for-founders-and-small-teams',
  'hard-to-fill-role-intake-template',
  'hiring-manager-calibration-questions',
  'govcon-cleared-sourcing-market-map',
  'source-profile-evidence-ledger',
  'contact-enrichment-compliance-for-recruiters',
  'candidate-search-ui-smart-composer',
])
const latestArticles = [...articles]
  .map(withTierAOverride)
  .filter(article => !excludedArticleSlugs.has(article.slug))
  .slice(-6)
  .reverse()

export default function Home() {
  return (
    <main>
      <section className="wrap hero hero-pro">
        <div className="eyebrow">The evidence-first AI sourcing workspace for hard-to-fill roles</div>
        <h1>Turn one req into<br />a sourcing system.</h1>
        <p className="lead">
          SourcingOS turns a role brief into distinct search hypotheses, runs the public sources it can actually access, guides the searches it cannot execute, and keeps candidate evidence, recruiter decisions, and calibration connected to the role.
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/waitlist">Request private beta access</Link>
          <Link className="btn secondary" href="/candidate-search">Try the public Candidate Search</Link>
          <Link className="btn ghost" href="/ai-sourcing">See how the sourcing agent works →</Link>
        </div>
        <div className="trust-strip">
          <span>Executable sources are labeled</span>
          <span>Guided sources are never claimed as searched</span>
          <span>Public evidence stays visible</span>
          <span>Human hiring decisions stay human</span>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-eyebrow"><span className="section-tag">Now live in the private beta</span></div>
        <h2 className="section-title">A role-first sourcing loop, not another pile of recruiter tools.</h2>
        <p className="section-body">
          The private workspace is organized around the job you are trying to fill. Build the role brain, inspect multiple sourcing lanes, execute supported research, bring candidates back into role context, review evidence, record fit, and use recruiter feedback to improve the next search.
        </p>
        <div className="grid two">
          <div className="card featured">
            <span className="kicker">Role Brain</span>
            <h3>Start with the actual hiring problem</h3>
            <p className="muted">Structure must-haves, disqualifiers, adjacent backgrounds, target companies, location, clearance language, and hiring-manager context before searching.</p>
          </div>
          <div className="card">
            <span className="kicker">Search Brain</span>
            <h3>Multiple hypotheses, with the reasoning exposed</h3>
            <p className="muted">Exact-title, adjacent-title, skill-cluster, evidence-first, target-company, and domain-specific lanes each show why they exist and what they may miss.</p>
          </div>
          <div className="card">
            <span className="kicker">Source truth</span>
            <h3>Run what is executable. Guide what is not.</h3>
            <p className="muted">Public connectors can run in product. Recruiter-only or restricted sources stay clearly labeled as guided workflows rather than being presented as autonomous searches.</p>
          </div>
          <div className="card">
            <span className="kicker">Evidence + calibration</span>
            <h3>Learn from recruiter decisions without hiding the why</h3>
            <p className="muted">Candidate evidence, fit decisions, concerns, identity uncertainty, and approved calibration signals stay reviewable instead of collapsing into an opaque score.</p>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">The sourcing loop</span></div>
        <h2 className="section-title">Brief → Plan → Run → Review → Learn.</h2>
        <p className="section-body">The product is designed so a recruiter can stay inside one role from intake through the next search decision.</p>
        <div className="workflow">
          <div className="workflow-step"><div className="wf-num">01</div><div className="wf-title">Brief</div><p className="wf-desc">Capture the role, requirements, constraints, adjacent talent, and HM context.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">02</div><div className="wf-title">Plan</div><p className="wf-desc">Generate distinct sourcing lanes, queries, rationale, source modes, and blind spots.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">03</div><div className="wf-title">Run</div><p className="wf-desc">Execute supported public research and launch guided searches for recruiter-only surfaces.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">04</div><div className="wf-title">Review</div><p className="wf-desc">Inspect source evidence, identity uncertainty, gaps, fit reasons, and concerns.</p></div>
          <div className="workflow-arrow">→</div>
          <div className="workflow-step"><div className="wf-num">05</div><div className="wf-title">Learn</div><p className="wf-desc">Use recruiter feedback and approved calibration to sharpen the next sourcing move.</p></div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Agentic without pretending</span></div>
        <h2 className="section-title">SourcingOS tells you what the agent actually did.</h2>
        <p className="section-body">
          A sourcing agent is only useful if you can distinguish execution from suggestion. SourcingOS exposes the capability mode for each source and keeps external content inside an explicit evidence boundary.
        </p>
        <div className="grid">
          <div className="card featured">
            <span className="kicker">Executable</span>
            <h3>Public-source research the system can really run</h3>
            <p className="muted">Examples include technical and research connectors such as GitHub and selected public registries or publication sources when they are relevant to the role.</p>
          </div>
          <div className="card">
            <span className="kicker">Guided</span>
            <h3>Recruiter-run search with generated strategy</h3>
            <p className="muted">For surfaces such as LinkedIn Recruiter or ClearanceJobs, SourcingOS builds the lane and query but does not claim it searched a source it cannot lawfully or technically execute.</p>
          </div>
          <div className="card">
            <span className="kicker">Provider optional</span>
            <h3>Commercial data is an adapter, not the product</h3>
            <p className="muted">Licensed people-data providers can be added when needed. The sourcing intelligence, evidence, calibration, and orchestration layer remains independent of any one database.</p>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Built for different sourcing domains</span></div>
        <h2 className="section-title">Technical, cleared, healthcare, and research searches should not behave the same way.</h2>
        <p className="section-body">
          SourcingOS is evolving toward composable domain intelligence: different aliases, lane families, evidence expectations, public sources, and heuristics can be activated for the same role when the work spans more than one domain.
        </p>
        <div className="grid two">
          <div className="card featured"><span className="kicker">Technical</span><h3>Code and project evidence</h3><p className="muted">Repository contribution, technical projects, adjacent titles, skill clusters, and public engineering evidence can become executable lanes where appropriate.</p></div>
          <div className="card"><span className="kicker">Healthcare</span><h3>Registry-aware sourcing</h3><p className="muted">Professional registry evidence, specialty language, geography, credential context, and healthcare-specific source choices are treated differently from software sourcing.</p></div>
          <div className="card"><span className="kicker">Federal / cleared</span><h3>Guided by design when people data is not executable</h3><p className="muted">Clearance breadcrumbs, incumbent and competitor hypotheses, program context, and donor-company strategy can guide the search without presenting public text as clearance verification.</p></div>
          <div className="card"><span className="kicker">Research / AI</span><h3>Publications, repositories, and open research</h3><p className="muted">OpenAlex, ORCID, publication sources, GitHub, and related evidence can be combined when the role calls for research depth rather than title matching alone.</p></div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Free vs private beta</span></div>
        <h2 className="section-title">Useful in public. Durable inside the role workspace.</h2>
        <p className="section-body">Use the free tools immediately, or request access to the private workspace where searches, candidate evidence, role decisions, and calibration stay connected.</p>
        <div className="grid two">
          <div className="card featured"><span className="kicker">Free, no account</span><h3>Search utilities and public learning</h3><p className="muted">BooleanOS, X-Ray Launcher, JD Strategy Tool, Clearance Search Builder, Candidate Search demo, sourcing methods, training modules, and public guides.</p></div>
          <div className="card"><span className="kicker">Private beta</span><h3>The role-centric sourcing cockpit</h3><p className="muted">Role workspaces, agentic research, candidate slate, evidence review, Candidate 360, recruiter fit decisions, calibration, memory, and saved sourcing work.</p></div>
        </div>
        <div className="home-cta-row" style={{ marginTop: '20px' }}>
          <Link className="btn" href="/waitlist">Request beta access</Link>
          <Link className="btn secondary" href="/candidate-search">Try public Candidate Search</Link>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Free recruiter tools</span></div>
        <h2 className="section-title">Start sourcing now. No account required.</h2>
        <p className="section-body">The public tools are still useful on their own—and they reflect the same evidence-first sourcing methods used inside the private product.</p>
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
        <div className="section-eyebrow"><span className="section-tag">Evidence-first by construction</span></div>
        <h2 className="section-title">The agent can research. The recruiter owns the consequential decision.</h2>
        <p className="section-body">SourcingOS keeps the trust boundary visible throughout the workflow instead of hiding uncertainty behind a recommendation score.</p>
        <div className="beta-preview-card">
          <div className="grid two">
            <div className="card"><span className="kicker">Public evidence</span><h3>Claims stay inspectable</h3><p className="muted">Source profiles, evidence items, observed dates, conflicts, and missing information stay visible for recruiter review.</p></div>
            <div className="card"><span className="kicker">Identity</span><h3>No silent profile merges</h3><p className="muted">Cross-source identity matches retain uncertainty until a recruiter confirms the person relationship.</p></div>
            <div className="card"><span className="kicker">Sensitive claims</span><h3>Clearance is not “verified” by public text</h3><p className="muted">Clearance, citizenship, open-to-work, and similar signals remain candidate-stated, inferred, unknown, or otherwise unverified unless authoritative evidence supports them.</p></div>
            <div className="card"><span className="kicker">Hiring actions</span><h3>No autonomous rejection or outreach</h3><p className="muted">The system can research and propose. Recruiters remain responsible for outreach, merges, stage changes, rejection, and other consequential hiring actions.</p></div>
          </div>
          <div className="home-cta-row" style={{ marginTop: '24px' }}>
            <Link className="btn" href="/trust">Read the trust model</Link>
            <Link className="btn secondary" href="/sample-candidate-360">See sample Candidate 360</Link>
            <Link className="btn ghost" href="/methodology">Methodology →</Link>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Training hub</span></div>
        <h2 className="section-title">Teach the workflow, then let the product prove it.</h2>
        <p className="section-body">Short recruiter training modules explain AI sourcing, evidence review, HM calibration, cleared sourcing guardrails, and Candidate 360.</p>
        <div className="grid">
          {trainingModules.map(module => (
            <Link className="card authority-card" href={module.href} key={module.href}>
              <span className="kicker">{module.label}</span>
              <h3>{module.title}</h3>
              <p className="muted">{module.desc}</p>
            </Link>
          ))}
        </div>
        <div className="home-cta-row" style={{ marginTop: '20px' }}><Link className="btn secondary" href="/training">Open training hub</Link></div>
      </section>

      <hr className="section-divider" />

      <section className="section">
        <div className="section-eyebrow"><span className="section-tag">Sourcing vault</span></div>
        <h2 className="section-title">Methods behind the product.</h2>
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
        <div className="section-eyebrow"><span className="section-tag">Sourcing intelligence guides</span></div>
        <h2 className="section-title">Advanced sourcing systems for senior recruiters.</h2>
        <p className="section-body">Deep guides on AI sourcing, cleared recruiting, talent mapping, evidence review, rediscovery, contact data, search quality, and recruiting operations.</p>
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
          <h2>Bring your next hard-to-fill role into SourcingOS.</h2>
          <p>Request access to the role-centric sourcing workspace for technical, cleared, healthcare, research, and other evidence-heavy searches.</p>
          <Link className="btn" href="/waitlist">Request access</Link>
        </div>
      </div>
    </main>
  )
}
