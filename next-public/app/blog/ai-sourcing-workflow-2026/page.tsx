import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'AI Sourcing Tools in 2026: An 8-Task Evaluation Harness for Recruiters'
const description = 'A practical 2026 framework for testing AI sourcing tools on intake, title expansion, Boolean logic, candidate discovery, evidence accuracy, hallucination risk, recruiter control, and unsafe automation.'
const canonical = '/blog/ai-sourcing-workflow-2026/'

export const metadata: Metadata = {
  title: 'AI Sourcing Tools in 2026: 8 Tests Before You Buy',
  description,
  alternates: { canonical },
  keywords: ['ai sourcing','ai sourcing tools','ai recruiting tools','talent sourcing ai','recruiter ai tools','ai candidate sourcing'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-18', modifiedTime:'2026-08-19', authors:['SourcingOS Editorial'] },
  twitter: { card:'summary_large_image', title, description },
}

const tasks = [
  ['1. Intake interpretation','Give every product the same messy real-world job description and hiring-manager notes. Score whether it separates must-haves, preferences, ambiguity, missing information, and useful calibration questions instead of merely summarizing the JD.'],
  ['2. Alternate-title expansion','Ask for alternate and adjacent titles. Score relevance, over-expansion, duplicated synonyms, and whether the tool explains why an adjacent title belongs in the search.'],
  ['3. Boolean / query construction','Give every tool the same role and source. Score syntax validity, synonym grouping, exclusions, source-specific logic, and whether it creates multiple query archetypes rather than one giant string.'],
  ['4. Candidate discovery','On the same requisition and time window, measure evidence-fit leads, duplicates, and evidence-fit leads that another lane did not surface. Do not compare raw database-size marketing claims.'],
  ['5. Evidence accuracy','For each surfaced lead, verify a sample of claims against the underlying profile or public evidence. Score unsupported claims, stale facts, incorrect employer/title interpretation, and missing provenance.'],
  ['6. Hallucination / inference stress test','Use a requirement where overclaiming is easy—such as security clearance, licensure, certification, or a nuanced technical skill. A strong system should label missing or unverified information instead of converting breadcrumbs into facts.'],
  ['7. Recruiter control','Test whether the recruiter can inspect filters, job-relevant criteria, query logic, evidence, exclusions, and why the system made a recommendation. Black-box convenience should not be scored as equivalent to controllable search.'],
  ['8. Automation safety gate','Check whether the product can auto-send outreach, auto-reject candidates, silently merge identities, or turn an AI score into a consequential decision without an explicit human checkpoint. Record those behaviors separately from search quality.'],
] as const

const scorecard = [
  ['Search-quality lift','Does AI help the recruiter reach evidence-fit leads a sensible manual baseline misses?'],
  ['Unique contribution','What evidence-fit leads did this workflow add that the comparison workflow did not?'],
  ['Evidence fidelity','Are lead-level claims traceable to real source evidence?'],
  ['Error visibility','Does the system expose uncertainty, gaps, and failed assumptions?'],
  ['Recruiter control','Can the user inspect and change the logic instead of accepting a hidden ranking?'],
  ['Time saved','How many recruiter minutes does the workflow save after review/correction time is included?'],
  ['Unsafe-action exposure','Can AI trigger outreach, rejection, identity merge, or other consequential action without meaningful review?'],
] as const

const faq = [
  ['What is AI sourcing?', 'AI sourcing is the use of AI-assisted systems to help recruiters interpret roles, expand search language, build queries, discover or prioritize potential leads, summarize evidence, and support outreach workflows. The useful boundary is assistance with search and evidence—not treating generated output as verified fact.'],
  ['What should recruiters test in an AI sourcing tool?', 'Test intake interpretation, title expansion, query logic, candidate discovery, unique contribution, evidence accuracy, hallucination behavior, recruiter control, time saved, and whether consequential automation has an explicit human checkpoint.'],
  ['Should the AI sourcing tool with the most candidates win?', 'No. Raw volume is not the same as useful discovery. Compare evidence-fit lead yield, duplicate rate, unique contribution, evidence quality, review time, and workflow cost on the same requisitions.'],
  ['Can AI verify a security clearance from public data?', 'No. Public clearance language can be a sourcing breadcrumb, but it should not be converted into a claim of current clearance status. Current status belongs in the authorized employer and security process.'],
  ['Is SourcingOS included in the evaluation?', 'Yes, but it should be scored by the same harness. SourcingOS does not have a proprietary professional-profile index, so it should not pretend to beat indexed databases on that dimension. Its intended strengths are search strategy, source-lane expansion, public evidence, recruiter-confirmed records, and project memory.'],
] as const

const sources = [
  ['LinkedIn Recruiter: AI-Assisted Search','https://www.linkedin.com/help/recruiter/answer/a6511777'],
  ['LinkedIn Recruiter: AI features','https://www.linkedin.com/help/recruiter/answer/a7784112'],
  ['LinkedIn Recruiter: AI-Assisted Messages','https://www.linkedin.com/help/recruiter/answer/a1510867'],
  ['NIST AI Risk Management Framework','https://www.nist.gov/itl/ai-risk-management-framework'],
  ['NIST AI Resource Center / testing resources','https://airc.nist.gov/'],
] as const

export default function AiSourcingHarnessPage(){
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
    datePublished:'2026-08-18',dateModified:'2026-08-19',author:{'@type':'Person',name:'SourcingOS Editorial',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['AI sourcing','AI recruiting tools','Talent sourcing','AI evaluation'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">AI sourcing · 2026 evaluation framework</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>SourcingOS Editorial · Senior Technical Sourcer · Updated August 19, 2026</p>
        <p className="lead">Do not choose an AI sourcing product from a feature checklist or vendor demo. Give every tool the same recruiting tasks, verify the evidence, measure what it uniquely adds, and score unsafe automation separately from search quality.</p>
        <div className="article-meta-grid">
          <div><span>Harness</span><strong>8 sourcing tasks</strong></div>
          <div><span>Core metric</span><strong>Unique evidence-fit contribution</strong></div>
          <div><span>Safety gate</span><strong>Human review before consequential action</strong></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#short-answer">Short answer</a><a href="#why-now">Why this changed</a><a href="#harness">8-task harness</a><a href="#score">Scorecard</a><a href="#sourcingos">SourcingOS</a><a href="#sources">Primary sources</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">AI sourcing foundation</span><p><Link href="/ai-sourcing/">Read the broader AI sourcing workflow, tools, and guardrails pillar →</Link></p></div>
          <div className="mini-card"><span className="kicker">Research rule</span><p>No vendor ranking is published until the same controlled tasks are run across the products being compared.</p></div>
        </aside>

        <article className="article-main">
          <section id="short-answer"><h2>The short answer</h2><p>The best AI sourcing tool is not the one that generates the longest candidate list or the most polished summary. It is the one that improves evidence-fit discovery on your real requisitions while keeping evidence, uncertainty, query logic, and consequential decisions inspectable by the recruiter. Test it against a manual baseline and against competing tools on the same work.</p><p>For the broader operating model before tool evaluation, start with <Link href="/ai-sourcing/">AI sourcing for recruiters: workflow, tools, and guardrails</Link>.</p></section>

          <section id="why-now"><h2>AI sourcing is already part of mainstream recruiter search</h2><p>In 2026, the useful debate is no longer whether recruiters will use AI. Major recruiting platforms already support natural-language candidate search, AI-assisted project creation, candidate-fit summaries, Boolean assistance, and AI-assisted outreach. The more important question is whether those systems improve discovery and recruiter judgment—or simply make a familiar workflow faster and harder to inspect.</p><p>This is why SourcingOS treats <strong>AI sourcing evaluation</strong> as a test harness rather than a “best tools” roundup.</p></section>

          <section><h2>Definition: sourcing tool evaluation harness</h2><p>A <strong>sourcing tool evaluation harness</strong> is a repeatable set of recruiting tasks, inputs, scoring rules, and safety checks used to compare sourcing products on the same requisitions. It prevents the evaluation from changing based on whichever feature a vendor demonstrates best.</p></section>

          <section id="harness"><h2>The 8-task AI sourcing evaluation harness</h2>{tasks.map(([name,copy])=><div key={name}><h3>{name}</h3><p>{copy}</p></div>)}</section>

          <section className="article-callout"><h2>The sharpest hallucination test: ask about something public data cannot safely verify</h2><p>Security clearance is a useful stress test because public profiles may contain clearance language while current eligibility, access, investigation status, and suitability require an authorized process. If a sourcing system silently converts “mentions TS/SCI” into “has an active TS/SCI,” the problem is not just a bad summary—it is an evidence-boundary failure.</p><p>The same principle applies to licenses, certifications, employment dates, identity merges, and nuanced skills: distinguish what the evidence says from what the model inferred.</p></section>

          <section id="score"><h2>Score outcomes, not demo polish</h2><div className="grid">{scorecard.map(([metric,question])=><div className="card authority-card" key={metric}><span className="kicker">{metric}</span><p>{question}</p></div>)}</div></section>

          <section><h2>Pre-registered benchmark plan</h2><ol><li>Select at least three live or recently worked requisitions across different role families.</li><li>Freeze the intake notes and success criteria before any tool runs.</li><li>Run the same eight tasks in each product and in a reasonable manual baseline.</li><li>Time the work, including correction and evidence-review time.</li><li>Human-review lead identity and job-relevant evidence before deduping or scoring.</li><li>Measure unique contribution with the same evidence-fit denominator and review threshold across tools.</li><li>Log unsupported claims and unsafe-action capabilities separately.</li><li>Publish the protocol, sample size, collection window, limitations, and full scoring rubric with any future ranking.</li></ol><p><strong>Benchmark status:</strong> harness published; cross-vendor result table not yet published. No winner is claimed before the controlled runs exist.</p></section>

          <section id="sourcingos"><h2>Where SourcingOS should score well—and badly</h2><p>SourcingOS should score well when the task is intake interpretation, search-lane design, query expansion, evidence organization, recruiter-confirmed project memory, and identifying what another lane missed. It should score badly on proprietary candidate-index breadth because it does not own a LinkedIn-scale or contact-database-scale professional index.</p><p>That tradeoff should be visible in the benchmark instead of hidden by declaring the home product the winner.</p><div className="nav-links"><Link className="button ghost compact" href="/ai-sourcing/">AI sourcing pillar</Link><Link className="button ghost compact" href="/tools/boolean-generator/">Test Boolean generation</Link><Link className="button ghost compact" href="/tools/search-lane-expander/">Expand search lanes</Link><Link className="button ghost compact" href="/tools/unique-contribution-rate-calculator/">Measure unique contribution</Link><Link className="button ghost compact" href="/blog/linkedin-recruiter-alternatives/">Build a source stack</Link></div></section>

          <section id="sources"><h2>Primary-source context</h2><p>The product examples and risk-management framing on this page are anchored to current platform-owned and standards-body documentation rather than software roundups.</p><ul>{sources.map(([label,href])=><li key={href}><a href={href} target="_blank" rel="noreferrer noopener">{label} ↗</a></li>)}</ul></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Start with a transparent task:</strong> <Link href="/tools/boolean-generator/">run BooleanOS</Link>, then compare its output with your current workflow.</div>
        </article>
      </div>
    </main>
  </>
}
