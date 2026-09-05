import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'Aging Req Rescue Framework: Diagnose Why a Hard-to-Fill Search Is Stuck'
const description = 'A senior-sourcer diagnostic framework for aging requisitions: distinguish no leads, wrong leads, no response, hiring-manager rejection, compensation/location mismatch, and late-stage fallout before choosing the next search experiment.'
const canonical = '/blog/aging-req-rescue-framework/'

export const metadata: Metadata = {
  title: 'Aging Req Rescue Framework for Hard-to-Fill Recruiting | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['aging requisition recruiting','hard to fill role sourcing','stuck requisition recruiting','recruiting req rescue','low candidate yield sourcing','hiring manager calibration sourcing'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['Why do recruiting requisitions age?', 'Different requisitions age for different reasons: the market may be too small, the search may be aimed at the wrong lane, outreach may be underperforming, the hiring-manager standard may have drifted, compensation or location may be misaligned, or candidates may be falling out later in the process. Diagnose the stage before changing the search.'],
  ['What should a sourcer do when there are no candidates?', 'First separate “no candidates exist” from “our current search paths are not finding evidence-fit leads.” Test independent title, skill, evidence, donor, adjacent, owned-history, and role-specific source lanes before declaring the market empty.'],
  ['What if the hiring manager keeps rejecting candidates?', 'Analyze the rejection pattern. Repeated rejection for the same unstated reason is a calibration defect, not a sourcing-volume problem. Bring the pattern to the hiring manager and force the hidden standard into the source pack.'],
  ['When should compensation be escalated?', 'When the search evidence repeatedly shows that the target market, level, location, or competing employers are incompatible with the approved range, document the pattern and escalate it as a market constraint rather than widening the search randomly.'],
  ['How do I know when to stop searching?', 'Use observable coverage evidence: independent lanes tested, duplicate pressure, recent new-lead rate, adjacent-title yield, donor-map coverage, and unresolved constraints. The Search Exhaustion framework is designed for that decision.'],
] as const

const failureModes = [
  ['1. No leads', 'Search returns almost no people worth reviewing. Likely causes: over-constrained intake, brittle title logic, wrong source, unrealistic geography, or a truly small market.'],
  ['2. Wrong leads', 'Volume exists, but evidence does not match the work. Likely causes: overloaded titles, weak evidence terms, bad donor companies, or a role definition built from buzzwords rather than tasks.'],
  ['3. Leads, no response', 'The search is finding plausible people, but outreach does not convert. Likely causes: channel, timing, message relevance, compensation, employer brand, location, or the role itself.'],
  ['4. HM rejection', 'Recruiter-reviewed profiles reach the manager but fail repeatedly. Likely causes: hidden criteria, inconsistent evidence standard, title bias, shifting preferences, or weak calibration.'],
  ['5. Process fallout', 'Candidates enter the process and drop later. Likely causes: interview design, speed, compensation, onsite requirements, role clarity, competing offers, or experience mismatch discovered too late.'],
] as const

export default function AgingReqRescuePage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
    datePublished:'2026-06-26',dateModified:'2026-08-20',author:{'@type':'Person',name:'SourcingOS Editorial',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['Aging requisitions','Hard-to-fill recruiting','Sourcing strategy','Hiring manager calibration'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Req rescue · sourcing diagnostics</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">An old requisition is not a diagnosis. Before adding tools, widening Boolean, or increasing outreach, identify exactly where the recruiting system is failing and run the smallest experiment that can distinguish the causes.</p>
        <div className="article-meta-grid"><div><span>Diagnosis</span><strong>5 failure modes</strong></div><div><span>Next step</span><strong>One controlled experiment</strong></div><div><span>Tool</span><Link href="/tools/aging-req-rescue/">Run Req Rescue</Link></div></div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#modes">5 failure modes</a><a href="#tree">Decision tree</a><a href="#evidence">Evidence pack</a><a href="#experiments">Rescue experiments</a><a href="#hm">HM escalation</a><a href="#stop">Stop rule</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Rule</span><p>Do not treat every aging requisition as a sourcing-volume problem. The failure may be upstream in intake or downstream in the hiring process.</p></div></aside>
        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>Classify the failure before choosing the fix. “We need more candidates” can mean five completely different things: no leads, wrong leads, no response, hiring-manager rejection, or later-stage fallout. Each needs a different rescue plan.</p></section>

          <section id="modes"><h2>The five aging-req failure modes</h2><div className="grid">{failureModes.map(([name,copy])=><div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section id="tree"><h2>The diagnostic decision tree</h2><ol><li><strong>Are there enough leads to review?</strong> If no, inspect search design and market constraints.</li><li><strong>Do reviewed leads meet the evidence standard?</strong> If no, inspect titles, evidence terms, donor companies, and intake clarity.</li><li><strong>Do relevant leads respond?</strong> If no, inspect outreach, channel, employer/role value, compensation, and timing.</li><li><strong>Does the hiring manager advance recruiter-reviewed profiles?</strong> If no, inspect calibration and hidden rejection criteria.</li><li><strong>Do candidates survive later stages?</strong> If no, inspect interview process, speed, offer competitiveness, onsite expectations, and late-discovered mismatches.</li></ol><p>Do not jump from step 4 back to “source more.” A calibration failure will simply create more rejected profiles.</p></section>

          <section className="article-callout" id="evidence"><h2>Build a one-page req rescue evidence pack</h2><p>Bring these facts to the rescue conversation:</p><ul><li>req age and business priority</li><li>must-have evidence standard</li><li>independent search lanes already tested</li><li>evidence-fit lead yield by lane</li><li>duplicate pressure and recent new-lead rate</li><li>top false-positive patterns</li><li>hiring-manager rejection reasons</li><li>response outcomes by channel or message angle</li><li>location and compensation constraints</li><li>process fallout points</li><li>the single next decision needed from the hiring manager</li></ul><p>Use evidence, not “the market is tough.”</p></section>

          <section id="experiments"><h2>Match the rescue experiment to the failure</h2><h3>No leads</h3><p>Open one independent lane: adjacent titles, donor companies, GitHub/artifact evidence, registries, federal contract data, ATS rediscovery, referrals, or another source that changes the search path. Use the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link>.</p><h3>Wrong leads</h3><p>Add or change the evidence standard. Remove overloaded titles. Split a blended role into separate work patterns. Rebuild the source pack with <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link>.</p><h3>No response</h3><p>Keep the same evidence-fit cohort and test message angle, channel, timing, or value proposition before concluding the search pool is wrong. If compensation or onsite expectations are the real objection, document them.</p><h3>HM rejection</h3><p>Cluster rejection reasons and ask which search parameter each reason should change. If the manager cannot articulate what evidence would have changed the decision, the req is not calibrated enough for more volume.</p><h3>Late-stage fallout</h3><p>Stop blaming sourcing for a process leak. Identify the stage, reason, and repeat pattern, then route the issue to interview, scheduling, compensation, offer, or role-design owners.</p></section>

          <section id="hm"><h2>Use tradeoff language with the hiring manager</h2><p>Examples:</p><ul><li>“We can preserve exact domain and open titles, or preserve exact title and open domain. Which matters more?”</li><li>“The accepted platform evidence exists, but mostly outside your preferred donor companies. Is company pedigree a true requirement?”</li><li>“The current compensation range is repeatedly losing the target level. Do we lower level, change geography, or revisit range?”</li><li>“The same three profiles would pass if GovCloud were trainable. Is that a day-one requirement or a 90-day ramp item?”</li></ul><p>Record approved tradeoffs so the source pack and next search actually change.</p></section>

          <section id="stop"><h2>When the rescue becomes a search-exhaustion finding</h2><p>If strict, adjacent, donor, and independent evidence lanes have been tested; duplicate pressure is high; recent new-lead rate is low; and the hiring manager has reviewed the tradeoffs, then the team has evidence for an exhaustion or constraint escalation. Use the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link> rather than a subjective “we looked everywhere.”</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Diagnose the req:</strong> <Link href="/tools/aging-req-rescue/">open Aging Req Rescue Planner</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
