import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'The Cleared Talent Sourcing Map: Where Recruiters Actually Find Cleared Candidates'
const description = 'A working 2026 map of eleven sourcing lanes for cleared recruiting, plus a strict rule for treating public clearance language as an unverified breadcrumb rather than proof.'
const canonical = '/blog/where-to-find-cleared-candidates/'

export const metadata: Metadata = {
  title: 'Where to Find Cleared Candidates: The 2026 Sourcing Map',
  description,
  alternates: { canonical },
  keywords: ['where to find cleared candidates','cleared candidate sourcing','security clearance recruiting','sourcing TS SCI candidates','cleared talent sourcing','GovCon recruiting'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-15', modifiedTime:'2026-08-15', authors:['SourcingOS Editorial'] },
  twitter: { card:'summary_large_image', title, description },
}

const lanes = [
  ['1. Clearance-focused recruiting platforms', 'Use clearance-focused talent platforms as a baseline lane, not the whole strategy. Segment by role family, geography, agency context, employer history, and technical evidence instead of relying on a clearance-level keyword alone.'],
  ['2. Federal contract and award records', 'Public award data can identify companies performing comparable work for a customer or in a geography. That creates an evidence-backed donor-company map. Award data describes organizations, not individual clearance status.'],
  ['3. Prime and subcontractor employee footprints', 'Once donor companies are validated, search current employees and alumni in the sources your team is licensed to use. Company and program context can justify a conversation, but it must never be represented as proof of an individual’s eligibility.'],
  ['4. Military transition pipelines', 'SkillBridge relationships, transition assistance ecosystems, veteran hiring events, and military occupational-code translation can surface relevant technical talent. Search for transferable work evidence first rather than assuming current clearance eligibility.'],
  ['5. Technical evidence surfaces', 'GitHub, technical talks, papers, patents, professional portfolios, and other public work artifacts can reveal skill evidence that a thin professional profile does not. Treat these as sourcing breadcrumbs, not hiring decisions.'],
  ['6. Professional associations and public chapter activity', 'AFCEA, NDIA, ISSA, ISACA, engineering groups, and other role-relevant associations can reveal speakers, volunteers, chapter leaders, and public professional activity. Use only public or authorized member information.'],
  ['7. Public training, certification, and conference evidence', 'Public certification announcements, speaker rosters, conference programs, and training-related posts can create technical and domain-specific lanes without asking anyone to disclose sensitive work.'],
  ['8. Job-relevant geography', 'For genuinely onsite work, locations near major federal, defense, and intelligence hubs can be a legitimate search parameter. Geography can shape a lane. It does not prove anything about an individual’s clearance, employer, background, or protected characteristics.'],
  ['9. Referral chains', 'Referrals are a distinct sourcing lane because they access relationship networks rather than the same searchable profile population. Keep referral requests professional and role-specific, and never ask for sensitive program or access details.'],
  ['10. Alumni and prior-employer networks', 'Former employees of validated donor companies, military alumni groups, and relevant university or professional alumni communities can surface experienced people who are not actively advertising themselves to recruiters.'],
  ['11. Your own ATS and project history', 'Rediscovery is an independent lane. Prior finalists, silver medalists, people who were unavailable, and candidates previously screened under different constraints may be relevant now. Treat prior notes as historical evidence and reconfirm current facts.'],
] as const

const faq = [
  ['Can a recruiter verify a security clearance from public information?', 'No. Public information can support an unverified breadcrumb. Formal eligibility and access determinations belong to authorized government and security processes.'],
  ['What is an unverified clearance breadcrumb?', 'It is a public or user-imported signal suggesting that a person may hold or may have held clearance eligibility, without constituting proof of current status.'],
  ['Should recruiters search exact clearance terms like TS/SCI?', 'They can be useful as discovery terms when job-relevant, but a self-stated term should remain an unverified breadcrumb until the proper security process confirms status.'],
  ['Is employer history enough to say someone is cleared?', 'No. An employer may perform cleared work, but that fact does not establish any individual employee’s eligibility, access level, or current assignment.'],
  ['What should a cleared-candidate note say before verification?', 'Separate the source from the fact. For example: candidate states a clearance status; public work history is consistent with cleared environments; status is not verified and must be routed through the authorized security process.'],
] as const

export default function ClearedTalentMapPage(){
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org', '@type':'Article', headline:title, description, url:articleUrl, mainEntityOfPage:articleUrl,
    datePublished:'2026-08-15', dateModified:'2026-08-15',
    author:{'@type':'Person',name:'SourcingOS Editorial',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},
    about:['Cleared recruiting','GovCon sourcing','Security clearance recruiting','Talent sourcing'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Cleared & GovCon sourcing</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>SourcingOS Editorial · Senior Technical Sourcer · Published August 15, 2026</p>
        <p className="lead">{description}</p>
        <div className="article-meta-grid">
          <div><span>Map</span><strong>11 independent sourcing lanes</strong></div>
          <div><span>Core trust rule</span><strong>Breadcrumb ≠ verification</strong></div>
          <div><span>Next action</span><Link href="/tools/clearance-search/">Build cleared search lanes</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#short-answer">Short answer</a><a href="#breadcrumb">Clearance breadcrumb</a><a href="#lanes">Eleven lanes</a><a href="#methodology">Methodology</a><a href="#evidence-scale">Evidence scale</a><a href="#sources">Primary sources</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Trust note</span><p>Do not turn public profile language, company history, geography, or program context into a claim of current clearance eligibility.</p></div>
        </aside>

        <article className="article-main">
          <section id="short-answer"><h2>The short answer</h2><p>Cleared candidates are not discoverable through one database or one Boolean string. Build separate lanes across clearance-focused platforms, contract records, validated donor companies, military transition ecosystems, public technical evidence, professional associations, public events, job-relevant geography, referrals, alumni networks, and your own ATS. Any clearance-related signal remains unverified until the proper security process confirms it.</p></section>

          <section id="breadcrumb"><h2>Definition: unverified clearance breadcrumb</h2><p><strong>An unverified clearance breadcrumb</strong> is a public or user-imported signal suggesting that a person may hold or may have held security-clearance eligibility without constituting proof of current eligibility or access. Examples can include self-stated clearance language, work history in a cleared environment, or program context. A breadcrumb is a reason to investigate and route to formal verification. It is never a reason to represent someone as currently cleared.</p></section>

          <section id="lanes"><h2>The eleven sourcing lanes</h2>{lanes.map(([h,b])=><div key={h}><h3>{h}</h3><p>{b}</p></div>)}</section>

          <section id="methodology"><h2>Methodology: use lane coverage, not folklore</h2><p>This map is a practitioner framework built from technical, federal, and cleared sourcing work. We are not publishing per-lane effectiveness percentages until those numbers have been collected under a repeatable protocol. The pre-registered test is three cleared requisitions across different role families, a fixed time cap per lane, and logging of reviewed results, saved leads, net-new leads, duplicate rate, and time to first useful lead.</p><p>Results will be reported by role family with sample size stated. We will not blend different markets into one industry-wide number.</p></section>

          <section className="article-callout" id="evidence-scale"><h2>How to log clearance-related evidence</h2><ul><li><strong>Self-stated clearance language:</strong> supports outreach and a verification question, not a verified field.</li><li><strong>Employer or contract context:</strong> supports a company or market lane, not an individual status claim.</li><li><strong>Prior military or federal work:</strong> supports work-history context, not current eligibility.</li><li><strong>Program names or customer context:</strong> may support role relevance when public, but never ask for classified details.</li><li><strong>Secondhand recruiter notes:</strong> historical context only. Reconfirm the fact through the proper process.</li></ul></section>

          <section><h2>What a recruiter note should separate</h2><p>Record the candidate’s statement, the public evidence that prompted the conversation, and the verification state as three different things. A safe pattern is: “Candidate states current Secret eligibility. Public work history is consistent with cleared environments. Eligibility not verified; route through the authorized security process before representing status externally.”</p></section>

          <section id="sources"><h2>Primary-source context</h2><p>The <a href="https://www.dni.gov/index.php/ncsc-how-we-work/ncsc-security-executive-agent" target="_blank" rel="noreferrer">Office of the Director of National Intelligence Security Executive Agent</a> is responsible for government-wide policy and oversight for eligibility determinations. For most DoD personnel, <a href="https://www.dcsa.mil/Trust-Decision-Adjudications/" target="_blank" rel="noreferrer">DCSA Trust Decision (Adjudications)</a> describes the formal adjudicative role. These are the kinds of primary sources to use when defining clearance and eligibility, rather than recruiter blogs or vendor shorthand.</p><p>For donor-company research, use the <Link href="/blog/federal-contract-data-sourcing-lane/">Federal Contract Data sourcing lane</Link>, which is based on current USAspending and SAM.gov public systems.</p></section>

          <section><h2>Where SourcingOS fits</h2><p>Use the <Link href="/tools/clearance-search/">Clearance Search tool</Link> to structure clearance-aware queries, the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> to open independent lanes, and the <Link href="/blog/search-path-scarcity/">Search-Path Scarcity framework</Link> to decide whether your problem is true supply or limited search coverage.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build your next cleared search:</strong> <Link href="/tools/clearance-search/">open the Clearance Search tool</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
