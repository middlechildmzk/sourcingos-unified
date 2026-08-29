import Link from 'next/link'
import { articles } from '@/data/articles'
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
    desc: 'Generate recruiter-ready Boolean strings for technical, cleared, cyber, healthcare, AI/ML, and GovCon searches.',
    href: '/tools/boolean-generator',
    label: 'Free search tool',
  },
  {
    icon: '⌕',
    name: 'X-Ray Launcher',
    desc: 'Build targeted X-Ray searches across GitHub, public resumes, LinkedIn, Hugging Face, OpenAlex, and the open web.',
    href: '/tools/xray-search',
    label: 'Open-web search',
  },
  {
    icon: '▦',
    name: 'JD Strategy Tool',
    desc: 'Turn a job description into target titles, search lanes, Boolean strings, and calibration questions.',
    href: '/tools/jd-search-strategy',
    label: 'Search strategy',
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
  .slice(-3)
  .reverse()

export default function Home() {
  return (
    <main className="home-v31">
      <section className="home31-hero">
        <div className="home31-shell home31-hero-grid">
          <div className="home31-hero-copy">
            <div className="home31-kicker">Private beta · agentic role research is live</div>
            <h1>Sourcing that gets <em>smarter</em> every time you review.</h1>
            <p>
              Start with one role. SourcingOS builds distinct search hypotheses, runs the public sources it can actually access, guides restricted-source work, brings evidence back to the role, and uses recruiter-approved learning to sharpen the next search.
            </p>
            <div className="home31-actions">
              <Link className="home31-primary" href="/waitlist">Request private beta access</Link>
              <Link className="home31-secondary" href="/candidate-search">Try public Candidate Search</Link>
            </div>
            <div className="home31-proofrow">
              <span>Truthful source modes</span>
              <span>Evidence stays inspectable</span>
              <span>No autonomous hiring decisions</span>
            </div>
          </div>

          <div className="home31-product" aria-label="Illustrative SourcingOS role strategy interface">
            <div className="home31-product-top">
              <div className="home31-window-dots"><i /><i /><i /></div>
              <span>Role workspace · Strategy</span>
              <span>Search Plan v2</span>
            </div>
            <div className="home31-product-body">
              <div className="home31-product-head">
                <div>
                  <small>Active role</small>
                  <h3>Senior Platform Engineer</h3>
                </div>
                <span className="home31-status">Ready to source</span>
              </div>
              <div className="home31-spine">
                <div>Brief</div>
                <div className="active">Plan</div>
                <div>Run</div>
                <div>Review</div>
                <div>Learned</div>
              </div>
              <div className="home31-plan">
                <div className="home31-plan-label"><span>Search hypotheses</span><strong>4 distinct lanes</strong></div>
                <div className="home31-lane">
                  <span className="home31-lane-no">01</span>
                  <div><strong>Exact-title engineers</strong><p>Start narrow to establish the obvious market.</p></div>
                  <span className="home31-mode exec">Executable</span>
                </div>
                <div className="home31-lane">
                  <span className="home31-lane-no">02</span>
                  <div><strong>Adjacent infrastructure titles</strong><p>Expand beyond title matching into ownership signals.</p></div>
                  <span className="home31-mode guided">Guided</span>
                </div>
                <div className="home31-lane">
                  <span className="home31-lane-no">03</span>
                  <div><strong>Public engineering evidence</strong><p>Look for repositories and technical proof.</p></div>
                  <span className="home31-mode exec">Executable</span>
                </div>
                <div className="home31-lane">
                  <span className="home31-lane-no">04</span>
                  <div><strong>Licensed people-data expansion</strong><p>Optional provider lane when connected.</p></div>
                  <span className="home31-mode optional">Optional</span>
                </div>
              </div>
              <div className="home31-learning">
                <div className="home31-mini">
                  <small>Review signal</small>
                  <strong>2 candidates rejected for management-heavy backgrounds</strong>
                </div>
                <div className="home31-mini learn">
                  <small>Approved learning</small>
                  <strong>Search Plan v2 emphasizes recent hands-on ownership</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home31-marquee">
        <div className="home31-shell home31-marquee-inner">
          <div className="home31-stat"><strong>Distinct strategy lanes</strong><span>Different hypotheses, not one query repeated five ways.</span></div>
          <div className="home31-stat"><strong>Source truth built in</strong><span>Executable, guided, provider-optional, or unavailable.</span></div>
          <div className="home31-stat"><strong>Role-level memory</strong><span>Repeated searches can be detected instead of quietly rerun.</span></div>
          <div className="home31-stat"><strong>Human approval stays central</strong><span>Research can automate; consequential hiring actions do not.</span></div>
        </div>
      </div>

      <section className="home31-section dark">
        <div className="home31-shell">
          <div className="home31-section-head">
            <div>
              <div className="home31-kicker">The operating loop</div>
              <h2>One role. One continuous sourcing system.</h2>
            </div>
            <p>
              SourcingOS is organized around the role instead of scattering intake, search, candidate review, and calibration across disconnected tools.
            </p>
          </div>
          <div className="home31-loop">
            <div className="home31-loop-card"><b>01</b><h3>Brief</h3><p>Structure requirements, constraints, adjacent backgrounds, and hiring-manager context.</p></div>
            <div className="home31-loop-card active"><b>02</b><h3>Plan</h3><p>Create distinct sourcing hypotheses with queries, rationale, source modes, and blind spots.</p></div>
            <div className="home31-loop-card"><b>03</b><h3>Run</h3><p>Execute supported public research and launch guided searches for recruiter-only surfaces.</p></div>
            <div className="home31-loop-card"><b>04</b><h3>Review</h3><p>Inspect evidence, uncertainty, gaps, fit reasons, and recruiter concerns in role context.</p></div>
            <div className="home31-loop-card"><b>05</b><h3>Learned</h3><p>Approve useful calibration and make the next sourcing pass measurably different.</p></div>
          </div>
        </div>
      </section>

      <section className="home31-section alt">
        <div className="home31-shell">
          <div className="home31-section-head">
            <div>
              <div className="home31-kicker">Role Brain + Search Brain</div>
              <h2>Reason about the market before you search it.</h2>
            </div>
            <p>
              A hard role rarely has one good Boolean string. SourcingOS turns the hiring problem into multiple explicit search bets, then keeps their reasoning visible so a recruiter can challenge the plan.
            </p>
          </div>
          <div className="home31-cap-grid">
            <div className="home31-feature-large">
              <div>
                <div className="home31-kicker">Search strategy</div>
                <h3>Multiple hypotheses with different failure modes.</h3>
                <p>Exact-title, adjacent-title, skill-cluster, evidence-first, target-company, and domain-specific strategies can coexist without pretending they are the same search.</p>
              </div>
              <div className="home31-codebox">
                <div><mark>Lane 01</mark> · title precision · executable</div>
                <div><mark>Lane 02</mark> · adjacent background · guided</div>
                <div><mark>Lane 03</mark> · public evidence · executable</div>
                <div><mark>Lane 04</mark> · licensed data · provider optional</div>
              </div>
            </div>
            <div className="home31-feature-stack">
              <div>
                <div className="home31-kicker">Evidence</div>
                <h3>Unknown is allowed to stay unknown.</h3>
                <p>Source evidence, missing information, identity uncertainty, and sensitive claims stay visible instead of being collapsed into a confident-looking answer.</p>
              </div>
              <div>
                <div className="home31-kicker">Calibration</div>
                <h3>Recruiter feedback changes the next search.</h3>
                <p>Approved learning can revise the guided search plan with visible before-and-after changes instead of silently changing the model behind the scenes.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home31-section">
        <div className="home31-shell">
          <div className="home31-section-head">
            <div>
              <div className="home31-kicker">Agentic without pretending</div>
              <h2>The product tells you what it actually did.</h2>
            </div>
            <p>A source is not “searched” just because an AI wrote a query for it. Capability mode stays explicit throughout the workflow.</p>
          </div>
          <div className="home31-source-grid">
            <div className="home31-source">
              <div className="home31-source-top"><span className="home31-source-index">01</span><span className="home31-source-badge exec">Executable</span></div>
              <h3>Run inside SourcingOS</h3>
              <p>Supported public connectors can execute read-only research and return discoveries with source context.</p>
            </div>
            <div className="home31-source">
              <div className="home31-source-top"><span className="home31-source-index">02</span><span className="home31-source-badge guided">Guided</span></div>
              <h3>Recruiter runs the source</h3>
              <p>LinkedIn Recruiter, ClearanceJobs, and other recruiter-controlled surfaces get generated search strategy without false execution claims.</p>
            </div>
            <div className="home31-source">
              <div className="home31-source-top"><span className="home31-source-index">03</span><span className="home31-source-badge optional">Provider optional</span></div>
              <h3>Add licensed data when it earns its place</h3>
              <p>Commercial people-data providers can plug into the orchestration layer later without becoming the product architecture.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="home31-section alt">
        <div className="home31-shell">
          <div className="home31-section-head">
            <div>
              <div className="home31-kicker">Domain-aware sourcing</div>
              <h2>Different talent markets need different search logic.</h2>
            </div>
            <p>Technical, healthcare, federal/cleared, and research searches should not inherit the same aliases, evidence expectations, sources, or heuristics.</p>
          </div>
          <div className="home31-domain-grid">
            <div className="home31-domain"><small>Technical</small><h3>Code + project evidence</h3><p>Repository contribution, technical ownership, adjacent titles, and skill clusters can create executable public lanes.</p></div>
            <div className="home31-domain"><small>Healthcare</small><h3>Registry-aware strategy</h3><p>Specialty language, professional registry evidence, geography, and credential context require a different sourcing model.</p></div>
            <div className="home31-domain"><small>Federal / cleared</small><h3>Guided people search</h3><p>Public program and market context can inform the strategy while clearance remains unverified unless authoritative evidence exists.</p></div>
            <div className="home31-domain"><small>Research / AI</small><h3>Open research signals</h3><p>GitHub, ORCID, OpenAlex, publications, and project evidence can matter more than conventional title matching.</p></div>
          </div>
        </div>
      </section>

      <section className="home31-section">
        <div className="home31-shell">
          <div className="home31-section-head">
            <div>
              <div className="home31-kicker">Free recruiter tools</div>
              <h2>Useful before you ever log in.</h2>
            </div>
            <p>The public tools stay open and reflect the same search methodology used inside the private role workspace.</p>
          </div>
          <div className="home31-tool-grid">
            {tools.map(tool => (
              <Link className="home31-tool" href={tool.href} key={tool.href}>
                <div className="home31-tool-icon">{tool.icon}</div>
                <small>{tool.label}</small>
                <h3>{tool.name}</h3>
                <p>{tool.desc}</p>
                <span className="arrow">Open tool →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home31-section dark">
        <div className="home31-shell home31-trust">
          <div>
            <div className="home31-kicker">Trust model</div>
            <div className="home31-quote">Autonomous <em>research.</em><br />Human hiring decisions.</div>
          </div>
          <div className="home31-trust-list">
            <div className="home31-trust-row"><b>01</b><div><strong>Public evidence is not verified truth.</strong><span>Observed source material stays separate from recruiter confirmation.</span></div></div>
            <div className="home31-trust-row"><b>02</b><div><strong>Identity uncertainty stays visible.</strong><span>Cross-source profile matches are never silently merged.</span></div></div>
            <div className="home31-trust-row"><b>03</b><div><strong>Sensitive claims stay bounded.</strong><span>Clearance, citizenship, and similar signals are not promoted to verified facts from public text.</span></div></div>
            <div className="home31-trust-row"><b>04</b><div><strong>No autonomous rejection or outreach.</strong><span>The system can research and propose; recruiters own consequential actions.</span></div></div>
          </div>
        </div>
      </section>

      <section className="home31-section alt">
        <div className="home31-shell">
          <div className="home31-section-head">
            <div>
              <div className="home31-kicker">Sourcing intelligence</div>
              <h2>Methods, benchmarks, and operating systems.</h2>
            </div>
            <p>Use the public guides to inspect the methodology behind the product, from search quality and rediscovery to evidence review and AI sourcing.</p>
          </div>
          <div className="home31-guides">
            {latestArticles.map(article => (
              <Link className="home31-guide" href={`/blog/${article.slug}`} key={article.slug}>
                <small>{article.category}</small>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home31-cta">
        <div className="home31-shell home31-cta-inner">
          <h2>Bring your next hard role into one sourcing loop.</h2>
          <div>
            <p>Request access to the private role workspace, or try the public search tools first.</p>
            <div className="home31-actions">
              <Link className="home31-primary" href="/waitlist">Request private beta access</Link>
              <Link className="home31-secondary" href="/tools">Explore free tools</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
