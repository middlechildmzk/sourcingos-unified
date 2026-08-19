import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Recruiter Search Exhaustion: How to Know When You Have Actually Searched the Market'
const description = 'A seven-signal framework for separating a tired search from a genuinely covered market using lane coverage, duplicate pressure, new-lead yield, query variation, donor maps, adjacency, and geography.'
const canonical = '/blog/search-exhaustion-framework/'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  keywords: ['search exhaustion','when to stop sourcing','candidate market exhausted','candidate pool saturation','sourcing coverage metrics','market mapping recruiting'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-15', modifiedTime:'2026-08-19', authors:['Dan Larson'] },
  twitter: { card:'summary_large_image', title, description },
}

const signals = [
  ['1. Lane coverage', 'How many of the distinct, job-relevant lanes you deliberately planned have actually been worked to a consistent cap? This is a coverage denominator, not a claim that every imaginable sourcing lane can be enumerated.'],
  ['2. Duplicate rate', 'Of a consistent recent sample of saved leads, what share was already known to your team or ATS? Rising duplication across multiple sessions is more informative than a single frustrating session.'],
  ['3. New-lead yield', 'How many net-new, profile-like leads are recent active sourcing sessions producing per hour? Compare the current rate with earlier sessions on the same req instead of comparing unlike markets.'],
  ['4. Query variation yield', 'When you materially change the query archetype—title to evidence, skill to adjacency, or another genuinely different signal—what share of the saved leads is new?'],
  ['5. Donor-map coverage', 'If a validated donor-company map exists, how much of it has actually been searched? A map sitting in a spreadsheet is not market coverage.'],
  ['6. Adjacent-title yield', 'Does the adjacent-title lane still produce unique, evidence-fit leads? If it does, the requirement may be narrower than the work itself and that belongs in calibration.'],
  ['7. Geographic expansion yield', 'When the role allows it, how many unique leads appear after a legitimate geographic or location-policy expansion? Measure the gain before assuming compensation is the only lever.'],
] as const

const faq = [
  ['What is search-lane exhaustion?', 'Search-lane exhaustion is the point at which continued work inside a defined sourcing lane stops producing meaningful net-new leads. It is measured per lane; requisition-level conclusions require reviewing the set of planned, job-relevant lanes.'],
  ['How long should I source before saying the market is exhausted?', 'Time alone is weak evidence. A recruiter can spend many hours inside one saturated lane. Track which lanes were worked, duplication, and net-new yield instead.'],
  ['What duplicate rate means I am done?', 'SourcingOS does not publish a universal validated cutoff. Track the rate consistently and interpret it alongside unique yield from genuinely different lanes.'],
  ['Does the calculator decide whether I should change the requisition?', 'No. It exposes coverage metrics and calibration questions. The recruiter and hiring team own the decision.'],
  ['Can this framework be used for high-volume recruiting?', 'The same concepts can help, but the useful signals and expected yields differ by role family and hiring model. Do not reuse thresholds from hard-to-fill technical searches without validation.'],
] as const

export default function SearchExhaustionFrameworkPage(){
 const articleUrl = `${siteUrl}${canonical}`
 const articleSchema = {'@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,datePublished:'2026-08-15',dateModified:'2026-08-19',author:{'@type':'Person',name:'Dan Larson',url:`${siteUrl}/about/`},publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['Search-lane exhaustion','Talent sourcing','Market mapping','Recruiting analytics']}
 const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
 return <>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
  <main className="wrap article article-pro">
   <div className="article-hero-card">
    <span className="kicker">Sourcing coverage methodology</span>
    <h1>{title}</h1>
    <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>Dan Larson · Senior Technical Sourcer · Published August 15, 2026 · Updated August 19, 2026</p>
    <p className="lead">{description}</p>
    <div className="article-meta-grid"><div><span>Framework</span><strong>7 observable signals</strong></div><div><span>Tool</span><Link href="/tools/search-exhaustion-calculator/">Calculate your coverage evidence</Link></div><div><span>Validation status</span><strong>Framework published · universal thresholds not claimed</strong></div></div>
   </div>
   <div className="article-layout">
    <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#definition">Definition</a><a href="#signals">Seven signals</a><a href="#calibration">Calibration</a><a href="#research">Research plan</a><a href="#sources">Primary context</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Method note</span><p>The original working draft proposed weights and thresholds. They are deliberately not presented here as validated facts. The live calculator exposes raw metrics instead.</p></div></aside>
    <article className="article-main">
     <section id="answer"><h2>The short answer</h2><p>A search is not defensibly “exhausted” because many hours were spent on it. A stronger case shows which planned lanes were worked, whether recent saves are increasingly duplicates, whether new query archetypes still contribute unique leads, how much of the donor map has been covered, and whether adjacent-title or geographic expansion still adds evidence-fit leads.</p></section>
     <section id="definition"><h2>Definition: search-lane exhaustion</h2><p><strong>Search-lane exhaustion</strong> is the point at which continued searching within a defined sourcing lane stops producing meaningful net-new leads under a consistent review standard. It is a lane-level coverage state, not an effort state. A requisition-level exhaustion claim should therefore summarize the planned job-relevant lanes and the evidence from each rather than treating hours spent as market coverage.</p></section>
     <section id="signals"><h2>The seven observable signals</h2>{signals.map(([h,b])=><div key={h}><h3>{h}</h3><p>{b}</p></div>)}</section>
     <section className="article-callout" id="calibration"><h2>What to bring to the hiring-manager meeting</h2><ul><li>The planned lane list and which lanes were actually worked.</li><li>A recent duplicate-rate window.</li><li>Recent net-new lead yield using the same review standard.</li><li>Unique contribution from a materially different query archetype.</li><li>Donor-company map coverage where applicable.</li><li>Unique yield from adjacent titles.</li><li>Unique yield from any legitimate geographic or location-policy expansion.</li></ul><p>Then ask a decision question: <strong>which remaining lane or requirement change is most likely to surface additional evidence-fit leads?</strong></p></section>
     <section><h2>Why there is no magic exhaustion score here</h2><p>A universal weighted score sounds precise but would be false precision until it is fitted against completed searches across multiple role families. SourcingOS therefore calculates the component metrics and surfaces open questions. It does not label a req “exhausted” automatically.</p><p><Link href="/tools/search-exhaustion-calculator/">Use the Search Exhaustion Evidence Calculator →</Link></p></section>
     <section id="research"><h2>Pre-registered validation plan</h2><p>The next step is to instrument at least 20 completed requisitions across multiple role families and capture the seven signals at repeated points in each search. The outcome dataset should record which lane ultimately produced the hire, whether a requirement change preceded the fill, and which signals predicted that additional sourcing would still produce useful evidence-fit leads.</p><p>If we later publish a weighted model, the sample size, role families, fitted weights, misses, and limitations will be disclosed. Until then, the framework remains a transparent practitioner model rather than a validated predictive score.</p></section>
     <section id="sources"><h2>Primary-source context</h2><p>Use occupation-level sources to distinguish your search coverage from broader labor-market context. The <a href="https://www.bls.gov/jlt/" target="_blank" rel="noreferrer">BLS Job Openings and Labor Turnover Survey</a> provides economy and industry-level labor-demand context, while <a href="https://www.onetonline.org/" target="_blank" rel="noreferrer">O*NET OnLine</a> is useful for occupation tasks, alternate titles, skills, and related occupations. Neither replaces req-level sourcing evidence.</p></section>
     <section><h2>Connect the framework</h2><p>If coverage is incomplete, open another lane with the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link>. Use the <Link href="/blog/boolean-search-benchmark/">Boolean Query Archetype benchmark</Link> to change the signal type rather than simply rewriting synonyms, and the <Link href="/blog/search-path-scarcity/">Search-Path Scarcity framework</Link> to distinguish limited coverage from genuine supply constraints.</p></section>
     <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
     <div className="cta"><strong>Measure before you escalate:</strong> <Link href="/tools/search-exhaustion-calculator/">open the Search Exhaustion Evidence Calculator</Link>.</div>
    </article>
   </div>
  </main>
 </>
}
