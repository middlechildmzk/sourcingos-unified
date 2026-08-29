import Link from 'next/link'
import { ClearanceSearchTool } from '@/components/ClearanceSearchTool'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

export const metadata = {
  title: 'Cleared Candidate Search Builder | Find Cleared Talent | SourcingOS',
  description: 'Free sourcing tool for cleared and GovCon recruiting. Build LinkedIn, ClearanceJobs, public X-Ray, certification, donor-company, and adjacent-role search lanes without treating public clearance language as verification.',
  alternates: { canonical: '/tools/clearance-search/' },
}

const faq = [
  ['Where can recruiters find cleared candidates?', 'Use multiple sourcing lanes: cleared-talent platforms, licensed professional search, donor-company maps, military-transition sources, technical communities, public professional evidence, referrals, and ATS rediscovery. No single source represents the whole cleared market.'],
  ['Can a recruiter verify a security clearance from a public profile?', 'No. Public profile language can be a sourcing breadcrumb, but it is not authoritative verification of current eligibility, access, investigation status, or suitability. Verification belongs in the authorized employer/security process.'],
  ['Should clearance terms go into every Google X-Ray query?', 'Not automatically. On the open web, clearance keywords often surface job postings, contract language, and stale self-descriptions. Public X-Ray is often more useful for technical evidence, employer context, certifications, and adjacent-role discovery.'],
  ['What is a donor company in cleared recruiting?', 'A donor company is an employer identified through evidence—such as relevant federal awards, mission work, locations, contracts, or technical scope—as a plausible source of people with adjacent experience. It is a sourcing hypothesis, not proof that every employee is cleared.'],
] as const

export default function Page() {
  const appSchema = {
    '@context':'https://schema.org',
    '@type':'WebApplication',
    name:'SourcingOS Cleared Candidate Search Builder',
    applicationCategory:'BusinessApplication',
    operatingSystem:'Web',
    url:`${siteUrl}/tools/clearance-search/`,
    description: metadata.description,
    offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},
  }
  const faqSchema = {
    '@context':'https://schema.org',
    '@type':'FAQPage',
    mainEntity: faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}})),
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(appSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(faqSchema)}} />
    <main className="wrap article-pro">
      <section className="article-hero-card">
        <span className="kicker">Free cleared candidate sourcing tool</span>
        <h1>Build better search lanes for cleared and GovCon talent.</h1>
        <p className="lead">Choose the clearance language, polygraph context, certification focus, role, and market. SourcingOS builds multiple search lanes instead of pretending one clearance-heavy Boolean string can represent the market.</p>
        <div className="article-meta-grid">
          <div><span>Use case</span><strong>Cleared / GovCon sourcing</strong></div>
          <div><span>Rule</span><strong>Breadcrumb ≠ verification</strong></div>
          <div><span>Price</span><strong>Free · no account</strong></div>
        </div>
      </section>

      <section className="card" style={{margin:'20px 0'}}>
        <span className="kicker">Quick answer</span>
        <h2>Where should recruiters look for cleared candidates?</h2>
        <p>Search more than one lane. Cleared-talent databases and licensed professional search can capture explicit self-reported clearance language, while donor-company mapping, federal contract data, military-transition sources, technical evidence, certifications, ATS rediscovery, and referrals can reveal qualified people who do not surface in the obvious clearance-keyword search.</p>
        <p><strong>Important:</strong> public clearance language is a sourcing clue—not authoritative verification of current clearance eligibility or access.</p>
        <p><Link href="/blog/where-to-find-cleared-candidates/">Read the full 2026 cleared talent sourcing map →</Link></p>
      </section>

      <ClearanceSearchTool />

      <section className="grid" style={{marginTop:28}}>
        <div className="card authority-card"><span className="kicker">Lane 1</span><h2>Explicit clearance language</h2><p>Use appropriate licensed or candidate-facing sources when the search depends on self-reported TS/SCI, Secret, polygraph, or related language.</p></div>
        <div className="card authority-card"><span className="kicker">Lane 2</span><h2>Employer and mission context</h2><p>Build donor-company maps from public federal award, program, location, and technical-scope evidence instead of relying only on the employers already in your head.</p></div>
        <div className="card authority-card"><span className="kicker">Lane 3</span><h2>Technical evidence</h2><p>Search for the actual engineering, cyber, cloud, program, or mission evidence required by the role, then let the authorized hiring process resolve clearance status.</p></div>
      </section>

      <section className="card" style={{marginTop:28}}>
        <span className="kicker">SourcingOS cleared cluster</span>
        <h2>Turn one clearance search into a market map.</h2>
        <p>The cleared-candidate guide explains the broader source map. The federal-contract-data framework shows how USAspending and SAM.gov can inform donor-company hypotheses. Search Lane Expander helps organize the resulting search paths so one title/clearance query does not become the entire strategy.</p>
        <div className="nav-links" style={{marginTop:14}}><Link className="button ghost compact" href="/blog/where-to-find-cleared-candidates/">Cleared talent sourcing map</Link><Link className="button ghost compact" href="/blog/federal-contract-data-sourcing-lane/">Federal contract donor mapping</Link><Link className="button ghost compact" href="/tools/search-lane-expander/">Expand search lanes</Link></div>
      </section>

      <section className="card" style={{marginTop:28}}>
        <h2>Cleared candidate sourcing FAQ</h2>
        {faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}
      </section>
    </main>
  </>
}
