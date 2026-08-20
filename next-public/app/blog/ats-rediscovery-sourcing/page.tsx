import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'ATS Rediscovery Sourcing: Turn Past Candidates and Recruiting History Into a New Search Lane'
const description = 'A practical ATS rediscovery framework for prior finalists, silver medalists, past applicants, referrals, rejection reasons, stale-context checks, opt-outs, and search-pattern learning without treating old interest as current interest.'
const canonical = '/blog/ats-rediscovery-sourcing/'

export const metadata: Metadata = {
  title: 'ATS Rediscovery Sourcing for Recruiters | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['ATS rediscovery sourcing','candidate rediscovery recruiting','silver medalist recruiting','past candidates sourcing','ATS sourcing strategy','recruiting database rediscovery'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['Dan Larson'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is ATS rediscovery?', 'ATS rediscovery is a sourcing lane that uses recruiting data the organization already has, such as prior applicants, finalists, referrals, past outreach, rejection reasons, and recruiter notes, to identify people worth carefully re-evaluating for a new requisition.'],
  ['Who should recruiters rediscover first?', 'Start with prior finalists, strong candidates rejected for timing or one missing requirement, people who were too senior or junior for the old role but fit the new one, referrals, and candidates from closely related requisitions. Always review prior context before re-engaging.'],
  ['Does past interest mean someone is still interested?', 'No. Past interest is historical context, not current intent. Check recency, prior conversation outcome, opt-outs, and the relevance of the new role before deciding whether outreach is appropriate.'],
  ['How can rejection reasons improve sourcing?', 'Structured rejection reasons can reveal hidden evidence standards, recurring false positives, title patterns, donor companies, location issues, compensation mismatch, and transferable profiles. Use the pattern to improve the new source pack rather than merely searching old names.'],
  ['Should ATS rediscovery replace external sourcing?', 'No. Treat it as an independent lane and measure what it uniquely contributes against external sources, referrals, and other search paths.'],
] as const

const segments = [
  ['Prior finalists', 'People who reached late stages and were not selected. Review why, what changed, and whether the new requisition resolves the earlier mismatch.'],
  ['Silver medalists', 'Strong runners-up or candidates the team would have hired under different headcount, timing, location, or team conditions.'],
  ['Timing rejects', 'People who were unavailable, recently started a role, had a notice constraint, or encountered a hiring freeze. Historical timing should be rechecked, not assumed.'],
  ['One-gap rejects', 'Candidates who missed one requirement that may now be less important, trainable, or newly acquired. Verify the current evidence instead of recycling the old assessment.'],
  ['Adjacent requisitions', 'Past candidates from neighboring roles whose work pattern may transfer even when the old title does not match the new requisition.'],
  ['Referrals and sourced leads', 'People introduced or researched before but never fully evaluated, provided the organization can use the record under its current policy and the contact context remains appropriate.'],
] as const

export default function AtsRediscoveryPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
    datePublished:'2026-06-26',dateModified:'2026-08-20',author:{'@type':'Person',name:'Dan Larson',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['ATS rediscovery','Candidate rediscovery','Talent sourcing','Recruiting operations'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Rediscovery · owned recruiting history</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>Dan Larson · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Your ATS is not only an archive of old applicants. It is a record of markets already explored, candidates already evaluated, reasons searches failed, and patterns that can make the next requisition smarter, if you preserve context and do not treat historical interest as current intent.</p>
        <div className="article-meta-grid"><div><span>Lane</span><strong>Owned history</strong></div><div><span>Best use</span><strong>Context + pattern reuse</strong></div><div><span>Measure</span><Link href="/tools/unique-contribution-rate-calculator/">Unique contribution</Link></div></div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#segments">6 segments</a><a href="#protocol">Rediscovery protocol</a><a href="#rejections">Rejection learning</a><a href="#outreach">Re-engagement</a><a href="#patterns">Search-pattern mining</a><a href="#measure">Measurement</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Rule</span><p>Old candidate data is context, not current truth. Recheck recency, identity, prior outcome, opt-outs, and role relevance before acting.</p></div></aside>
        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>ATS rediscovery is most valuable when it does two jobs at once: it reopens strong historical leads and it teaches the new search what the organization has already learned. A prior finalist may be worth revisiting, but the rejected pool may also reveal which titles, donors, evidence patterns, or requirements actually predict hiring-manager acceptance.</p></section>

          <section id="segments"><h2>Six rediscovery segments worth testing</h2><div className="grid">{segments.map(([name,copy])=><div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section className="article-callout" id="protocol"><h2>The ATS rediscovery protocol</h2><ol><li><strong>Define the new evidence standard.</strong> Do not start by searching names from the old req.</li><li><strong>Select relevant historical requisitions.</strong> Similar work pattern matters more than matching job title.</li><li><strong>Segment the old pool.</strong> Finalist, timing, one-gap, adjacent, referral, or other documented reason.</li><li><strong>Read the prior notes.</strong> Why did the conversation end? Was there an opt-out, bad experience, compensation issue, or process concern?</li><li><strong>Refresh stale facts.</strong> Employment, location, skill recency, title, and interest may have changed.</li><li><strong>Re-review against the new role.</strong> Do not inherit the old assessment blindly.</li><li><strong>Choose whether re-engagement is appropriate.</strong> Use the organization&apos;s approved contact and outreach process.</li><li><strong>Measure the lane separately.</strong> Track what the ATS added that external search did not.</li></ol></section>

          <section id="rejections"><h2>Rejection reasons are search intelligence</h2><p>Unstructured “not a fit” notes teach the next sourcer almost nothing. Better rejection categories describe what changed the search:</p><ul><li>missing must-have evidence</li><li>adjacent title but wrong work pattern</li><li>wrong domain or customer context</li><li>too junior / too senior for scope</li><li>location or onsite mismatch</li><li>compensation mismatch</li><li>timing / availability</li><li>candidate withdrew</li><li>hidden HM criterion discovered</li><li>interview-process concern</li></ul><p>Aggregate those patterns. If five candidates were rejected for the same unstated platform depth, that evidence belongs in the next <Link href="/blog/source-pack-methodology/">source pack</Link>.</p></section>

          <section id="outreach"><h2>Re-engagement needs context, not a blast</h2><p>Before contacting a past candidate, answer:</p><ol><li>What happened last time?</li><li>Why is this role materially different or more relevant?</li><li>Is the previous contact channel still appropriate?</li><li>Is there an opt-out, do-not-contact note, or policy restriction?</li><li>Is the old interest too stale to mention as if it were current?</li></ol><p>A strong re-engagement note acknowledges prior context and gives a specific reason the new role may be relevant. Rediscovery should reduce spam because the organization has more context, not justify more volume.</p></section>

          <section id="patterns"><h2>Mine prior successful profiles for search patterns</h2><p>Use hired candidates and strong finalists to extract hypotheses, not clones:</p><ul><li>title families that transferred successfully</li><li>donor companies and environments</li><li>skills that were more predictive than the original title</li><li>evidence combinations accepted by the hiring manager</li><li>geographies and work models that actually converted</li><li>source lanes that produced unusual candidates</li></ul><p>Then test those patterns in external search. Do not turn the last hire into an overly narrow persona that excludes different but capable profiles.</p></section>

          <section id="measure"><h2>Measure ATS rediscovery as an independent source lane</h2><p>Track reviewed leads, evidence-fit saves, downstream outcomes, recruiter time, and the people the ATS contributed that your comparison sources did not. A small rediscovery lane can be strategically valuable if it repeatedly adds distinct people or useful market history.</p><p>Use <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> to quantify additive discovery and <Link href="/blog/technical-sourcer-operating-system/">the Technical Sourcer Operating System</Link> to preserve what the lane teaches each week.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Measure the lane:</strong> <Link href="/tools/unique-contribution-rate-calculator/">calculate its unique contribution</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
