import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Unique Contribution Rate: Measure What Each Sourcing Channel Actually Adds'
const description = 'Unique Contribution Rate measures the share of a source’s evidence-fit leads that no other tested source surfaced in the same requisition-level test. Use it to measure additive discovery and source-stack overlap.'
const canonical = '/blog/unique-contribution-rate/'
const ucrDefinition = 'Unique Contribution Rate (UCR) is the percentage of evidence-fit leads surfaced by a source that were not surfaced by the comparison source stack in the same requisition-level test.'
const evidenceFitDefinition = 'An evidence-fit lead is a lead the recruiter actually reviewed against the same job-relevant standard used for every other source in the test. Appearing in an unreviewed result list does not qualify.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  keywords: ['how to measure sourcing channel effectiveness','candidate source overlap','source of hire metrics','sourcing analytics','sourcing channel comparison','unique contribution rate'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-15', modifiedTime:'2026-08-19', authors:['Dan Larson'] },
  twitter: { card:'summary_large_image', title, description },
}

const faq = [
  ['What is Unique Contribution Rate in sourcing?', `${ucrDefinition} ${evidenceFitDefinition} UCR measures additive discovery, not candidate quality or hires.`],
  ['Is UCR the same as source of hire?', 'No. Source of hire is an attribution measure tied to an outcome. UCR is a discovery-overlap measure across sources or lanes. They answer different questions and can be used together.'],
  ['Does a high UCR mean a sourcing channel is worth keeping?', 'It means the source was additive in that comparison. Retention decisions should also consider submittal outcomes, response, downstream results, cost, recruiter time, role family, and sample size.'],
  ['How should leads be deduplicated?', 'Use a stable identity anchor where available. If identity is uncertain, require human confirmation and record the merge decision rather than auto-merging on name similarity.'],
  ['Can UCR be calculated in a spreadsheet?', 'Yes. Use evidence-fit leads as rows, sources as columns, mark whether each lead was surfaced, and calculate the share that appears in only one source column.'],
] as const

export default function UniqueContributionRatePage(){
 const articleUrl = `${siteUrl}${canonical}`
 const articleSchema = {
  '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
  datePublished:'2026-08-15',dateModified:'2026-08-19',author:{'@type':'Person',name:'Dan Larson',url:`${siteUrl}/about/`},
  publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['Sourcing analytics','Unique Contribution Rate','Candidate source overlap','Talent sourcing']
 }
 const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
 return <>
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
  <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
  <main className="wrap article article-pro">
   <div className="article-hero-card">
    <span className="kicker">Sourcing analytics methodology</span>
    <h1>{title}</h1>
    <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>Dan Larson · Senior Technical Sourcer · Published August 15, 2026 · Updated August 19, 2026</p>
    <p className="lead">{description}</p>
    <div className="article-meta-grid"><div><span>Metric</span><strong>Additive discovery</strong></div><div><span>Formula</span><strong>Unique evidence-fit leads ÷ evidence-fit leads from source</strong></div><div><span>Tool</span><Link href="/tools/unique-contribution-rate-calculator/">Calculate UCR</Link></div></div>
   </div>
   <div className="article-layout">
    <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#definition">Definition</a><a href="#metrics">What UCR adds</a><a href="#protocol">Protocol</a><a href="#hypotheses">Pre-registered hypotheses</a><a href="#limits">Limitations</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Important</span><p>UCR is not a universal source score. A source can be highly additive and still produce weak response, downstream outcomes, or economics.</p></div></aside>
    <article className="article-main">
     <section id="answer"><h2>The short answer</h2><p>Most sourcing dashboards tell you how much a channel produced or which channel received credit for an outcome. Unique Contribution Rate asks a different question: <strong>what share of this source’s evidence-fit leads did none of the other tested sources surface?</strong> That makes it useful for detecting redundancy and identifying low-volume lanes that add genuinely different people.</p></section>

     <section id="definition"><h2>Definition: Unique Contribution Rate</h2><p><strong>{ucrDefinition}</strong></p><p>{evidenceFitDefinition}</p><p>UCR measures additive discovery. It should be calculated against a deduplicated lead set and reported with the requisition, role family, review cap, source order, and collection window.</p><pre>UCR(source) = evidence-fit leads unique to that source / evidence-fit leads surfaced by that source</pre><p>Example: if a source contributes 20 evidence-fit leads and 7 appear nowhere else in the comparison, its UCR for that test is 35%. That number describes additive discovery in that test, not overall source quality.</p></section>

     <section id="metrics"><h2>UCR complements three other views</h2><h3>Volume: how much did the source produce?</h3><p>Volume is useful for capacity, but a large lead set can substantially overlap with other channels.</p><h3>Outcome attribution: which source received credit?</h3><p>Source-of-hire and related attribution fields are useful for outcome reporting, but attribution rules vary across recruiting systems and organizations. They do not directly measure cross-source discovery overlap.</p><h3>Overlap: which source pairs are redundant?</h3><p>Pairwise overlap shows whether two channels repeatedly surface the same people. UCR turns the comparison around and asks how much each source uniquely adds against the full tested set.</p><h3>Marginal yield: does the next lane still add people?</h3><p>When source order is controlled or rotated, marginal yield helps evaluate whether adding another lane continues to expand coverage. It pairs naturally with the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link>.</p></section>

     <section className="article-callout" id="protocol"><h2>A reproducible UCR protocol</h2><ol><li><strong>Fix the requisition set.</strong> Run repeated tests across multiple requisitions and report role families separately.</li><li><strong>Fix the sources or lanes.</strong> Define the source set before the test rather than adding or removing channels after seeing results.</li><li><strong>Fix effort or review caps.</strong> Give sources comparable opportunity to contribute.</li><li><strong>Define evidence-fit consistently.</strong> A lead counts when the recruiter actually reviewed the person against the same job-relevant standard used for every other source in the test. An unreviewed result-list appearance does not count.</li><li><strong>Dedupe on stable anchors.</strong> Human-confirm uncertain identity matches; never silently merge people on heuristic name similarity.</li><li><strong>Build the matrix.</strong> Lead rows, source columns, surfaced/not-surfaced cells.</li><li><strong>Calculate UCR and overlap.</strong> Keep raw counts next to percentages so small samples remain obvious.</li><li><strong>Rotate source order across repeated tests.</strong> Otherwise the source run first can accumulate an artificial uniqueness advantage.</li></ol><p><Link href="/tools/unique-contribution-rate-calculator/">Open the free UCR Calculator →</Link></p></section>

     <section id="hypotheses"><h2>Pre-registered hypotheses for the first multi-req run</h2><p>These are expectations written before the controlled dataset exists. They are not results.</p><ol><li>The largest licensed source will produce the highest evidence-fit lead volume but not necessarily the highest UCR.</li><li>ATS rediscovery will be low-volume but materially additive on at least some requisitions because prior internal leads are not guaranteed to appear in external search lanes.</li><li>Referral lanes will contribute a smaller volume and may show high uniqueness, but the result will vary materially by team and role family.</li><li>Public code or artifact search will contribute more on roles where job-relevant work is commonly public and less on roles where relevant work is rarely public.</li><li>Title-led and skill-led searches inside the same underlying platform will overlap substantially on some roles, but the overlap magnitude must be measured rather than assumed.</li></ol><p>The study will publish contradictions, null results, sample sizes, source order, and collection windows, not only the findings that make the framework look good.</p></section>

     <section id="limits"><h2>How not to misuse UCR</h2><ul><li><strong>Do not rank recruiters with it.</strong> UCR describes source contribution inside a search design, not recruiter performance.</li><li><strong>Do not cut a source from one requisition.</strong> A lane can be redundant for one role family and essential for another.</li><li><strong>Do not treat uniqueness as quality.</strong> Pair UCR with submittal outcomes, response, downstream results, cost, and recruiter time.</li><li><strong>Do not reward questionable collection methods.</strong> Additive discovery does not justify scraping restricted systems, bypassing access controls, or using data with unclear provenance.</li><li><strong>Do not hide the raw counts.</strong> A 100% UCR from one evidence-fit lead is not comparable to a stable rate from a substantial sample.</li></ul></section>

     <section><h2>Where this connects to SourcingOS</h2><p>The long-term product opportunity is to record which lane surfaced each lead, retain evidence provenance, and build the overlap matrix as the search progresses. The metric becomes useful when it is a byproduct of normal sourcing work rather than a separate spreadsheet project.</p><p>Combine UCR with the <Link href="/blog/boolean-search-benchmark/">five Boolean query archetypes</Link>, <Link href="/blog/search-path-scarcity/">Search-Path Scarcity</Link>, the <Link href="/tools/source-stack-coverage/">Source Stack Coverage Worksheet</Link>, and the <Link href="/tools/search-exhaustion-calculator/">Search Exhaustion Calculator</Link> to measure whether the next lane is still expanding the market.</p></section>

     <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
     <div className="cta"><strong>Compare your source stack:</strong> <Link href="/tools/unique-contribution-rate-calculator/">calculate Unique Contribution Rate</Link>.</div>
    </article>
   </div>
  </main>
 </>
}
