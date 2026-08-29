import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Federal Contract Data Is a Sourcing Lane: Build Donor-Company Maps from USAspending and SAM.gov'
const description = 'Use public federal award data to build evidence-backed donor-company maps for GovCon sourcing. A recruiter workflow using USAspending, SAM.gov, NAICS, PSC codes, and provenance.'
const canonical = '/blog/federal-contract-data-sourcing-lane/'

export const metadata: Metadata = {
  title: 'Federal Contract Data for Recruiters: Build a Donor-Company Map',
  description,
  alternates: { canonical },
  keywords: [
    'government contractor recruiting',
    'federal contract data recruiting',
    'USAspending recruiters',
    'GovCon donor companies',
    'government contractor talent mapping',
    'SAM.gov recruiting',
  ],
  openGraph: {
    title,
    description,
    type: 'article',
    url: canonical,
    publishedTime: '2026-08-15',
    modifiedTime: '2026-08-15',
    authors: ['SourcingOS Editorial'],
  },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is a donor company in recruiting?', 'A donor company is an employer whose workforce is a plausible source of candidates for a specific requisition, identified from evidence about comparable work rather than from recruiter memory alone.'],
  ['Can federal contract data verify a candidate security clearance?', 'No. Contract data describes awards and organizations. It cannot verify any individual person’s clearance, access, eligibility, or current program assignment.'],
  ['Is FPDS still the place to search federal contract awards?', 'No for public-facing search. GSA completed the public transition of FPDS functionality into SAM.gov and decommissioned FPDS ezSearch on February 24, 2026.'],
  ['Does the USAspending API require an API key?', 'The current USAspending V2 endpoint documentation says endpoints do not currently require authorization.'],
  ['Why use both USAspending and SAM.gov?', 'USAspending is a strong starting point for spending and recipient analysis. SAM.gov is the current federal contracting search surface for contract awards and subcontract reports. Using both gives a stronger evidence trail than relying on a memorized competitor list.'],
] as const

export default function FederalContractDataSourcingLanePage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url: articleUrl,
    mainEntityOfPage: articleUrl,
    datePublished: '2026-08-15',
    dateModified: '2026-08-15',
    author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl },
    about: ['Federal contract data', 'GovCon recruiting', 'Donor-company mapping', 'Talent sourcing'],
  }
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })),
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">GovCon sourcing methodology</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize:13, margin:'4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published August 15, 2026</p>
        <p className="lead">{description}</p>
        <div className="article-meta-grid">
          <div><span>Core artifact</span><strong>Evidence-backed donor map</strong></div>
          <div><span>Primary systems</span><strong>USAspending + SAM.gov</strong></div>
          <div><span>Boundary</span><strong>Company evidence, never clearance verification</strong></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card">
            <span className="kicker">In this guide</span>
            <a href="#short-answer">Short answer</a>
            <a href="#definition">Donor-company definition</a>
            <a href="#sources">Current federal sources</a>
            <a href="#workflow">Six-step workflow</a>
            <a href="#provenance">Provenance standard</a>
            <a href="#research">Open research plan</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="mini-card"><span className="kicker">Safety boundary</span><p>A company holding federal work says something about the company. It says nothing definitive about any individual employee’s clearance, eligibility, access, or current assignment.</p></div>
        </aside>

        <article className="article-main">
          <section id="short-answer">
            <h2>The short answer</h2>
            <p>Federal award data can turn donor-company selection from memory into evidence. Start with the agency, work category, geography, and active time window. Use USAspending and SAM.gov to identify organizations performing comparable work, validate the entity, record the award evidence, and then use those organizations as search lanes inside the sourcing tools you are authorized to use.</p>
          </section>

          <section id="definition">
            <h2>Definition: donor company</h2>
            <p><strong>A donor company</strong> is an employer whose workforce composition makes it a plausible source of candidates for a specific requisition, identified from evidence rather than assumption. In federal recruiting, award records can support donor-company selection when they show comparable scope, customer, location, or period of performance. Donor-company status describes the employer. It does not establish anything about a particular person.</p>
          </section>

          <section id="sources">
            <h2>The current federal data stack</h2>
            <h3>USAspending.gov</h3>
            <p><a href="https://api.usaspending.gov/" target="_blank" rel="noreferrer">USAspending’s official API</a> provides public access to federal spending and award data. Its V2 documentation includes award, agency, recipient, geography, and search endpoints, and the current endpoint documentation states that authorization is not required.</p>

            <h3>SAM.gov Contracting</h3>
            <p><a href="https://sam.gov/fpds" target="_blank" rel="noreferrer">SAM.gov is now the public-facing federal contract award search surface</a>. GSA states that all public-facing FPDS functionality has transitioned to SAM.gov and that FPDS ezSearch was decommissioned on February 24, 2026. Contract awards and subcontract reports can be searched from the Contracting domain.</p>

            <h3>NAICS and Product Service Codes</h3>
            <p>Translate a requisition into procurement language before searching. Use the <a href="https://www.census.gov/naics/" target="_blank" rel="noreferrer">U.S. Census Bureau NAICS system</a> for industry classification and the <a href="https://www.acquisition.gov/psc-manual" target="_blank" rel="noreferrer">official Product and Service Code Manual</a> for federal product/service categories. The current PSC library available from Acquisition.gov includes the April 2025 manual and data files.</p>
          </section>

          <section id="workflow">
            <h2>A six-step recruiter workflow</h2>
            <h3>1. Convert the req into procurement terms</h3>
            <p>Write down the awarding agency or sub-agency, likely NAICS and PSC families, place of performance, relevant time window, and the type of work. Do this before searching so the query reflects the work rather than a favorite contractor list.</p>

            <h3>2. Build the initial recipient set</h3>
            <p>Use USAspending or SAM.gov to identify recipients associated with comparable awards. Capture recipient name, award identifier, awarding agency, work classification, place of performance, dates, and the exact source URL or query used.</p>

            <h3>3. Separate direct evidence from adjacency</h3>
            <p>A recipient doing highly comparable work is a direct donor candidate. A recipient doing adjacent work for the same customer may be an adjacency lane. Keep those labels separate so a broad market map does not quietly become a claim of exact program experience.</p>

            <h3>4. Validate the organization</h3>
            <p>Confirm the legal entity and whether the record represents an operating company, joint venture, vehicle, reseller, or another structure. Keep the legal name and the employer-facing brand name when they differ.</p>

            <h3>5. Turn organizations into independent sourcing lanes</h3>
            <p>Use the validated company set in the search environments your team is licensed or authorized to use. Search current employees, alumni, adjacent titles, and public evidence separately. The award data chooses where to look; it does not choose which person is qualified.</p>

            <h3>6. Record why each company is on the map</h3>
            <p>Every donor-company row should explain itself. Keep the award or source identifier, agency, classification, geography, verification date, and a short reason for inclusion. Six weeks later, you should be able to defend the map without relying on memory.</p>
          </section>

          <section className="article-callout" id="provenance">
            <h2>Minimum provenance fields</h2>
            <ul>
              <li>Canonical company or legal entity name</li>
              <li>Public award or contract source</li>
              <li>Award or record identifier where available</li>
              <li>Awarding agency or sub-agency</li>
              <li>NAICS and/or PSC used for inclusion</li>
              <li>Place of performance when relevant</li>
              <li>Period of performance or award date</li>
              <li>Date the recruiter verified the record</li>
              <li>Direct-match vs adjacent-lane label</li>
            </ul>
          </section>

          <section>
            <h2>What this method does not prove</h2>
            <p>Federal contract data can support a company-level market map. It cannot verify a person’s security clearance, current access, customer assignment, exact technical scope, availability, or interest. Those remain separate recruiter-confirmed facts.</p>
          </section>

          <section id="research">
            <h2>Open research plan: measure whether the lane adds unique candidates</h2>
            <p>We have not published a universal effectiveness percentage for donor-company mapping. The next experiment is pre-registered here: select one closed, non-sensitive historical requisition; build a donor-company set from public award data; record how many entities survive validation; then measure how many produce profile-like leads and how many of those leads were unique versus the original search lanes.</p>
            <p>Any customer-specific worked example will be reviewed for external publishability before it is added. Publicly accessible procurement data and externally publishable recruiting context are different bars.</p>
          </section>

          <section>
            <h2>Connect this to the rest of the search</h2>
            <p>Donor-company mapping works best as one lane inside a broader source pack. Pair it with the <Link href="/blog/search-path-scarcity/">Search-Path Scarcity framework</Link>, the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link>, <Link href="/tools/xray-search/">X-Ray Search</Link>, and the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link>.</p>
          </section>

          <section id="faq">
            <h2>FAQ</h2>
            {faq.map(([question, answer]) => <div className="faq" key={question}><h3>{question}</h3><p>{answer}</p></div>)}
          </section>

          <div className="cta"><strong>Next action:</strong> <Link href="/tools/jd-search-strategy/">turn your requisition into an evidence-backed sourcing strategy</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
