import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'The Source Pack Methodology: A Search Operating System for Hard-to-Fill Roles'
const description = 'A practical sourcing methodology for turning a difficult requisition into evidence requirements, search lanes, donor companies, Boolean queries, false-positive rules, calibration questions, and explicit stop conditions.'
const canonical = '/blog/source-pack-methodology/'

export const metadata: Metadata = {
  title: 'Source Pack Methodology for Hard-to-Fill Recruiting | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['sourcing strategy template','source pack recruiting','technical sourcing methodology','hard to fill recruiting strategy','sourcing plan template','recruiter search strategy'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is a source pack in recruiting?', 'A source pack is the working search plan for one requisition. It records the evidence standard, title map, donor-company map, search lanes, Boolean and X-Ray queries, false-positive rules, calibration questions, and stop conditions before the team starts accumulating random profiles.'],
  ['Is a source pack just a Boolean string?', 'No. Boolean is one execution layer. A source pack explains what the search is trying to prove, which markets are being tested, what can flex, what must be confirmed, and how the team will know whether a lane is working.'],
  ['When should a sourcer build one?', 'Use a source pack when a requisition is expensive to get wrong: technical, cleared, healthcare, AI, executive, niche, location-constrained, or repeatedly rejected searches. High-volume evergreen roles may need a lighter version.'],
  ['How often should the source pack change?', 'Update it when new evidence changes the search: hiring-manager feedback, repeated false positives, low lane yield, compensation reality, new donor companies, or a newly approved tradeoff. Do not silently rewrite the plan after every weak search.'],
  ['What should be measured?', 'Track lane yield, evidence-fit saves, duplicate pressure, unique contribution, rejection reasons, and which assumptions changed. The source pack should become project memory, not a document that disappears after intake.'],
] as const

const packFields = [
  ['1. Outcome', 'What the person must actually accomplish in the role, written in work terms rather than title language.'],
  ['2. Evidence standard', 'What public or recruiter-confirmed evidence would support each must-have. Separate strong evidence, weak breadcrumbs, and facts that require a later authorized check.'],
  ['3. Title map', 'Exact titles, adjacent titles, legacy titles, internal-company variants, and titles that look similar but usually produce the wrong work.'],
  ['4. Donor map', 'Primary, adjacent, and stretch organizations that produce the relevant environment, scale, customer, compliance model, or technical stack.'],
  ['5. Search lanes', 'Independent ways into the market: title, skill, artifact, donor, research, registry, ATS rediscovery, referral, or other role-specific lanes.'],
  ['6. Query bank', 'A small set of debuggable queries for each lane rather than one giant Boolean expression that hides why the search is failing.'],
  ['7. False-positive rules', 'Patterns that repeatedly look relevant but fail the evidence standard. Record exclusions with a reason, not as permanent assumptions.'],
  ['8. Calibration questions', 'Questions that change the search: what can flex, what evidence proves the skill, what prior profiles failed, and which constraint is truly non-negotiable.'],
  ['9. Stop conditions', 'The evidence required before declaring a lane saturated, escalating a tradeoff, or opening an adjacent market.'],
] as const

export default function SourcePackMethodologyPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['Talent sourcing','Sourcing strategy','Role intake','Search methodology'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Sourcing methodology</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Stop treating a hard requisition like a blank search box. Build one artifact that records what good looks like, where the market should exist, how each lane will be tested, what the team has learned, and what must change next.</p>
        <div className="article-meta-grid">
          <div><span>Input</span><strong>Req + HM context</strong></div>
          <div><span>Output</span><strong>Evidence + lanes + queries</strong></div>
          <div><span>Tool</span><Link href="/tools/jd-search-strategy/">Build the first draft</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#why">Why searches drift</a><a href="#anatomy">9-part source pack</a><a href="#lanes">Search lanes</a><a href="#calibration">Calibration</a><a href="#measurement">Measurement</a><a href="#example">Worked example</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Operating rule</span><p>A source pack is allowed to change, but every material change should be tied to new evidence or an explicit hiring-manager tradeoff.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>A <strong>source pack</strong> is the search operating system for a requisition. It translates a vague hiring request into a testable market model: what evidence supports the role, which title families and donor companies matter, which independent source lanes will be tested, what queries belong to each lane, what noise to expect, and what evidence would justify changing the plan.</p><p>The important shift is from <em>searching for people</em> to <em>testing a market hypothesis</em>. A sourcer should be able to explain not just who they found, but which path found them, what that path missed, and what the next experiment should be.</p></section>

          <section id="why"><h2>Why difficult searches turn into random activity</h2><p>Hard requisitions usually do not fail because a recruiter forgot one Boolean synonym. They fail because the search model is unstable. A title is treated as a skill. A preferred company becomes a hidden requirement. A public clearance mention becomes stronger than the evidence supports. A manager rejects three profiles for the same unstated reason, but the search never changes.</p><p>Without a source pack, those changes live in Slack, memory, browser tabs, and individual recruiter intuition. The team keeps doing work, but it cannot tell which assumptions are producing the wrong market.</p><p>A source pack creates a controlled surface for those assumptions. It makes the search debuggable.</p></section>

          <section id="anatomy"><h2>The 9-part source pack</h2><div className="grid">{packFields.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section id="lanes"><h2>Build independent search lanes, not one giant string</h2><p>A lane is a distinct route into the same talent market. Good lanes use different evidence, not just slightly different wording.</p><h3>Title lane</h3><p>Use when titles are stable enough to carry signal. Keep an exact-title lane separate from adjacent-title expansion so you can see what the expansion actually adds.</p><h3>Skill and environment lane</h3><p>Search for the technical or operational context that proves the work: Kubernetes plus Terraform, Epic plus a specific module, RMF plus ATO work, PyTorch plus model-serving context, or another role-specific combination.</p><h3>Artifact lane</h3><p>For roles with public work, search the work itself: repositories, model cards, papers, talks, standards contributions, package ecosystems, or technical writing. Artifact evidence should support investigation, not substitute for recruiter confirmation.</p><h3>Donor-company lane</h3><p>Search organizations that produce the same environment, customer, stack, mission, compliance model, or scale. A donor company narrows where to look; it does not prove that every employee there fits.</p><h3>Owned-history lane</h3><p>ATS rediscovery, prior finalists, silver medalists, referrals, and internal networks are independent lanes because they can add people that external search never surfaces.</p><p>Use the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> when the strict market stops producing new evidence-fit leads.</p></section>

          <section className="article-callout"><h2>A source pack should contain at least three query archetypes</h2><p>Do not polish one Boolean string forever. Run a title-led query, a skill/evidence-led query, and a donor or artifact-led query, then compare the pools. The <Link href="/blog/boolean-search-benchmark/">five-query-archetype benchmark</Link> is the deeper version of this idea.</p><pre>{`TITLE: ("Platform Engineer" OR SRE) AND (Kubernetes OR Terraform)
EVIDENCE: (Kubernetes AND Terraform) AND (ArgoCD OR Helm OR "GitHub Actions")
DONOR: (Kubernetes OR Terraform) AND (Leidos OR GDIT OR CACI OR SAIC)`}</pre></section>

          <section id="calibration"><h2>Use the source pack to change hiring-manager conversations</h2><p>Weak calibration asks, “Do you like this profile?” Strong calibration asks which parameter should change after the market produces evidence.</p><ul><li><strong>Evidence:</strong> What work proves the must-have?</li><li><strong>Title:</strong> Which adjacent title is acceptable if the evidence is strong?</li><li><strong>Domain:</strong> Does the person need the industry, or the operating environment?</li><li><strong>Donors:</strong> Which companies are genuinely comparable, and why?</li><li><strong>Location:</strong> Is the constraint legal, customer-driven, team-driven, or preference?</li><li><strong>Compensation:</strong> Is the target market compatible with the approved range?</li><li><strong>Verification:</strong> Which facts can be researched publicly, and which require an authorized later process?</li></ul><p>For a ready-made sequence, use the <Link href="/blog/senior-sourcer-role-intake/">25 hiring-manager intake questions</Link>.</p></section>

          <section id="measurement"><h2>Measure the search plan, not recruiter busyness</h2><p>A source pack becomes valuable when the team can compare lanes. Track raw lead volume, evidence-fit saves, duplicate pressure, unique contribution, rejection patterns, response outcomes, and recruiter time. Do not let “profiles viewed” become the main success metric.</p><p>If a lane keeps returning people already surfaced elsewhere, its marginal discovery value may be falling. Measure that with <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link>. If multiple independent lanes are producing high duplicate pressure and very few new leads, use the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link> before declaring the market empty.</p></section>

          <section id="example"><h2>Worked example: cleared platform engineer</h2><p>Suppose the requisition asks for a platform engineer supporting a federal environment. The weak approach is a single search for “cleared DevSecOps engineer.” The source-pack approach decomposes the market.</p><ol><li><strong>Outcome:</strong> operate and automate a secure container platform in a regulated environment.</li><li><strong>Strong evidence:</strong> Kubernetes, Terraform, CI/CD, infrastructure automation, and federal security or authorization context.</li><li><strong>Adjacent titles:</strong> SRE, cloud engineer, platform engineer, DevOps engineer, infrastructure engineer.</li><li><strong>Donor groups:</strong> primes, systems integrators, cloud vendors, mission-tech companies, and subcontractors with comparable delivery environments.</li><li><strong>Independent lanes:</strong> title, secure-delivery evidence, donor companies, public technical artifacts, and owned ATS history.</li><li><strong>Boundary:</strong> public clearance language is a breadcrumb for manual follow-up, not confirmation of current status.</li><li><strong>Stop rule:</strong> do not call the market exhausted until strict, adjacent, donor, and at least one independent evidence lane have been tested and the new-lead rate has materially flattened.</li></ol><p>That pack can be reviewed with the hiring manager before the team spends another week editing the same Boolean string.</p></section>

          <section><h2>Where this connects to SourcingOS</h2><p>The <Link href="/tools/jd-search-strategy/">JD Strategy Tool</Link> creates the first source-pack draft. <Link href="/tools/boolean-generator/">BooleanOS</Link> turns a understood role into query variants. <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> opens adjacent paths. <Link href="/candidate-search/">Candidate Search</Link> keeps source evidence visible, and the <Link href="/sample-candidate-360/">Candidate 360 sample</Link> shows what the evidence can become after recruiter review.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build the first version:</strong> <Link href="/tools/jd-search-strategy/">turn a job description into a source pack</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
