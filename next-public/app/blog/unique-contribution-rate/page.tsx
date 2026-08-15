import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Unique Contribution Rate: Measure What Each Sourcing Channel Actually Adds'
const description = 'Unique Contribution Rate measures the share of a source’s reviewed candidates that no other tested source surfaced. Use it with overlap, cost, quality, and outcomes to evaluate sourcing-channel redundancy.'
const canonical = '/blog/unique-contribution-rate/'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  keywords: ['how to measure sourcing channel effectiveness','candidate source overlap','source of hire metrics','sourcing analytics','sourcing channel comparison','unique contribution rate'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-15', modifiedTime:'2026-08-15', authors:['Dan Larson'] },
  twitter: { card:'summary_large_image', title, description },
}

const faq = [
  ['What is Unique Contribution Rate in sourcing?', 'Unique Contribution Rate is the share of a source’s reviewed candidates in a controlled comparison that were not surfaced by any of the other tested sources. It measures additive discovery, not candidate quality or hires.'],
  ['Is UCR the same as source of hire?', 'No. Source of hire is an attribution measure tied to an outcome. UCR is a discovery-overlap measure across sources or lanes. They answer different questions and can be used together.'],
  ['Does a high UCR mean a sourcing channel is worth keeping?', 'It means the source was additive in that comparison. Retention decisions should also consider candidate quality, response, outcomes, cost, time, compliance, role family, and sample size.'],
  ['How should candidates be deduplicated?', 'Use a stable identity anchor where available. If identity is uncertain, require human confirmation and record the merge decision rather than auto-merging on name similarity.'],
  ['Can UCR be calculated in a spreadsheet?', 'Yes. Use candidates as rows, sources as columns, mark whether each reviewed candidate was surfaced, and calculate the share that appears in only one source column.'],
] as const

export default function UniqueContributionRatePage(){
 const articleUrl = `${siteUrl}${canonical}`
 const articleSchema = {
  '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
  datePublished:'2026-08-15',dateModified:'2026-08-15',author:{'@type':'Person',name:'Dan Larson',url:`${siteUrl}/about/`},
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
    <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>Dan Larson · Senior Technical Sourcer · Published August 15, 2026</p>
    <p className="lead">{description}</p>
    <div className="article-meta-grid"><div><span>Metric</span><strong>Additive discovery</strong></div><div><span>Formula</span><strong>Unique ÷ reviewed</strong></div><div><span>Tool</span><Link href="/tools/unique-contribution-rate-calculator/">Calculate UCR</Link></div></div>
   </div>
   <div className="article-layout">
    <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#definition">Definition</a><a href="#metrics">What UCR adds</a><a href="#protocol">Protocol</a><a href="#hypotheses">Pre-registered hypotheses</a><a href="#limits">Limitations</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Important</span><p>UCR is not a universal source score. A source can be highly additive and still produce low-quality candidates, weak response, or poor economics.</p></div></aside>
    <article className="article-main">
     <section id="answer"><h2>The short answer</h2><p>Most sourcing dashboards tell you how much a channel produced or which channel received credit for an outcome. Unique Contribution Rate asks a different question: <strong>how much of this source’s reviewed candidate set did none of the other tested sources surface?</strong> That makes it useful for detecting redundancy and identifying low-volume lanes that add genuinely different people.</p></section>

     <section id="definition"><h2>Definition: Unique Contribution Rate</h2><p><strong>Unique Contribution Rate (UCR)</strong> is the proportion of a source’s reviewed candidates, within a controlled requisition-level comparison, that were not surfaced by any other source included in the same test. UCR measures additive discovery. It should be calculated against a deduplicated candidate set and reported with the requisition, role family, review cap, source order, and collection window.</p><pre>UCR(source) = candidates unique to that source / reviewed candidates surfaced by that source</pre><p>Example: if a source contributes 20 reviewed candidates and 7 appear nowhere else in the comparison, its UCR for that test is 35%. That number describes additive discovery in that test—not overall source quality.</p></section>

     <section id="metrics"><h2>UCR complements three other views</h2><h3>Volume: how much did the source produce?</h3><p>Volume is useful for capacity, but a large candidate set can substantially overlap with other channels.</p><h3>Outcome attribution: which source received credit?</h3><p>Source-of-hire and related attribution fields are useful for outcome reporting, but attribution rules vary across recruiting systems and organizations. They do not directly measure cross-source discovery overlap.</p><h3>Overlap: which source pairs are redundant?</h3><p>Pairwise overlap shows whether two channels repeatedly surface the same people. UCR turns the comparison around and asks how much each source uniquely adds against the full tested set.</p><h3>Marginal yield: does the next lane still add people?</h3><p>When source order is controlled or rotated, marginal yield helps evaluate whether adding another lane continues to expand coverage. It pairs naturally with the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link>.</p></section>

     <section className="article-callout" id="protocol"><h2>A reproducible UCR protocol</h2><ol><li><strong>Fix the requisition set.</strong> Run repeated tests across multiple requisitions and report role families separately.</li><li><strong>Fix the sources or lanes.</strong> Define the source set before the test rather than adding or removing channels after seeing results.</li><li><strong>Fix effort or review caps.</strong> Give sources comparable opportunity to contribute.</li><li><strong>Define the reviewed set.</strong> A candidate counts when the recruiter actually reviewed the person under the same basic job-relevant standard—not merely because a search engine returned the name somewhere in an unreviewed result list.</li><li><strong>Dedupe on stable anchors.</strong> Human-confirm uncertain identity matches; never silently merge people on heuristic name similarity.</li><li><strong>Build the matrix.</strong> Candidate rows, source columns, surfaced/not-surfaced cells.</li><li><strong>Calculate UCR and overlap.</strong> Keep raw counts next to percentages so small samples remain obvious.</li><li><strong>Rotate source order across repeated tests.</strong> Otherwise the source run first can accumulate an artificial uniqueness advantage.</li></ol><p><Link href="/tools/unique-contribution-rate-calculator/">Open the free UCR Calculator →</Link></p></section>

     <section id="hypotheses"><h2>Pre-registered hypotheses for the first multi-req run</h2><p>These are expectations written before the controlled dataset exists. They are not results.</p><ol><li>The largest licensed source will produce the highest reviewed volume but not necessarily the highest UCR.</li><li>ATS rediscovery will be low-volume but materially additive on at least some requisitions because prior internal candidates are not guaranteed to appear in external search lanes.</li><li>Referral lanes will contribute a smaller volume and may show high uniqueness, but the result will vary materially by team and role family.</li><li>Public code or artifact search will contribute more on roles where job-relevant work is commonly public and less on roles where relevant work is rarely public.</li><li>Title-led and skill-led searches inside the same underlying platform will overlap substantially on some roles, but the overlap magnitude must be measured rather than assumed.</li></ol><p>The study will publish contradictions, null results, sample sizes, source order, and collection windows—not only the findings that make the framework look good.</p></section>

     <section id="limits"><h2>How not to misuse UCR</h2><ul><li><strong>Do not rank recruiters with it.</strong> UCR describes source contribution inside a search design, not recruiter performance.</li><li><strong>Do not cut a source from one requisition.</strong> A lane can be redundant for one role family and essential for another.</li><li><strong>Do not treat uniqueness as quality.</strong> Pair UCR with qualified-submittal quality, response, downstream outcomes, cost, and recruiter time.</li><li><strong>Do not reward questionable collection methods.</strong> Additive discovery does not justify scraping restricted systems, bypassing access controls, or using data with unclear provenance.</li><li><strong>Do not hide the raw counts.</strong> A 100% UCR from one reviewed person is not comparable to a stable rate from a substantial sample.</li></ul></section>

     <section><h2>Where this connects to SourcingOS</h2><p>The long-term product opportunity is to record which lane surfaced each lead, retain evidence provenance, and build the overlap matrix as the search progresses. The metric becomes useful when it is a byproduct of normal sourcing work rather than a separate spreadsheet project.</p><p>Combine UCR with the <Link href="/blog/boolean-search-benchmark/">five Boolean query archetypes</Link>, <Link href="/blog/search-path-scarcity/">Search-Path Scarcity</Link>, and the <Link href="/tools/search-exhaustion-calculator/">Search Exhaustion Calculator</Link> to measure whether the next lane is still expanding the market.</p></section>

     <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
     <div className="cta"><strong>Compare your source stack:</strong> <Link href="/tools/unique-contribution-rate-calculator/">calculate Unique Contribution Rate</Link>.</div>
    </article>
   </div>
  </main>
 </>
}
