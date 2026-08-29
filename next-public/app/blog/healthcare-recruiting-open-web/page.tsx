import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'Healthcare Recruiting Open-Web Sourcing: Licenses, NPI Data, Local Markets, and Healthcare IT Evidence'
const description = 'A healthcare recruiter sourcing framework that separates clinical licensure, NPI/provider data, local-market evidence, healthcare IT systems, and recruiter-confirmed fit instead of mixing every healthcare profile into one search lane.'
const canonical = '/blog/healthcare-recruiting-open-web/'

export const metadata: Metadata = {
  title: 'Healthcare Recruiting Open-Web Sourcing Guide | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['healthcare recruiting sourcing','open web healthcare recruiting','nurse license sourcing recruiters','NPI recruiting','healthcare IT sourcing','Epic recruiter sourcing'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What public sources can healthcare recruiters use?', 'The right sources depend on the role. Clinical searches may use state licensing boards and participating national verification systems such as Nursys, while NPPES/NPI data can help identify provider records and practice-location context. Healthcare IT searches may rely more on professional profiles, public resumes, conference material, technical communities, vendor ecosystems, and hospital-system donor maps.'],
  ['Does an NPI prove a provider is licensed?', 'No. CMS explicitly states that issuance of an NPI does not ensure or validate that the provider is licensed or credentialed. Treat NPI data as provider and practice-context information, then use the appropriate licensing or credentialing process separately.'],
  ['Can recruiters verify nurse licensure through Nursys?', 'NCSBN describes Nursys as the national database for nurse licensure, discipline, and practice privileges in participating jurisdictions, and its QuickConfirm service allows employers and recruiters to retrieve licensure and applicable discipline documentation. Use the current participating-board coverage and your organization’s process.'],
  ['Should clinical and healthcare IT searches use the same Boolean strategy?', 'No. Clinical sourcing should emphasize license, specialty, facility, acuity, shift, geography, and credential context. Healthcare IT sourcing should emphasize systems, modules, integrations, workflows, implementation context, and technical ownership.'],
  ['What is the biggest healthcare sourcing mistake?', 'Collapsing clinical, operational, administrative, revenue-cycle, and healthcare IT work into one generic healthcare query. Define the work pattern first and use evidence sources appropriate to that profession.'],
] as const

const lanes = [
  ['Clinical licensure lane', 'Use state boards or participating licensure verification systems for license and practice-privilege context when relevant. Keep license status separate from job interest, specialty depth, shift fit, and employment context.'],
  ['NPI / provider-context lane', 'Use NPPES/NPI records for provider identity and practice-location context where appropriate. Do not treat an NPI as licensure or credential verification.'],
  ['Facility and local-market lane', 'Map hospitals, clinics, health systems, specialty centers, ambulatory groups, long-term care, home health, or other facility types that produce the required work pattern in the target geography.'],
  ['Specialty evidence lane', 'Search specialty language, unit type, procedures, certifications, patient population, acuity, or clinical environment based on the actual requisition.'],
  ['Healthcare IT systems lane', 'Search Epic, Oracle Health/Cerner, MEDITECH, HL7, FHIR, revenue cycle, interface/integration, analytics, and module-specific evidence as a separate technical market.'],
  ['ATS and referral lane', 'Prior finalists, former applicants, internal referrals, and prior facility relationships can be highly useful because healthcare markets are local and repeat hiring patterns matter.'],
] as const

export default function HealthcareOpenWebPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
    datePublished:'2026-06-26',dateModified:'2026-08-20',author:{'@type':'Person',name:'SourcingOS Editorial',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['Healthcare recruiting','Clinical sourcing','Healthcare IT recruiting','Open-web sourcing'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Healthcare recruiting · open-web sourcing</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Healthcare sourcing works better when clinical credentials, provider records, local labor markets, and healthcare IT evidence stay in separate lanes. The source that helps identify a provider is not automatically the source that proves license status, specialty depth, or current job interest.</p>
        <div className="article-meta-grid"><div><span>Model</span><strong>6 independent lanes</strong></div><div><span>Boundary</span><strong>NPI ≠ licensure</strong></div><div><span>Tool</span><Link href="/tools/jd-search-strategy/">Build healthcare lanes</Link></div></div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#lanes">6 lanes</a><a href="#clinical">Clinical sourcing</a><a href="#npi">NPI data</a><a href="#it">Healthcare IT</a><a href="#queries">Queries</a><a href="#market">Local market</a><a href="#sources">Primary sources</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Rule</span><p>Use the authoritative source for the fact you are trying to establish. Provider identity, licensure, credentialing, employment, and job interest are different questions.</p></div></aside>
        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>Start by separating the role into one of two broad search systems: <strong>clinical</strong> or <strong>healthcare IT / operations</strong>. Clinical roles often require license, specialty, facility, shift, geography, and patient-care context. Healthcare IT roles often require system, module, integration, workflow, implementation, or technical evidence. Mixing them produces noisy searches and weak verification logic.</p></section>

          <section id="lanes"><h2>The six-lane healthcare sourcing model</h2><div className="grid">{lanes.map(([name,copy])=><div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section id="clinical"><h2>Clinical sourcing: separate license, specialty, and work environment</h2><p>A license answers a different question than specialty depth. A nurse can have an active license without the ICU, NICU, OR, oncology, home-health, or leadership experience your requisition needs. Build the search in layers:</p><ol><li><strong>License or practice privilege:</strong> use the appropriate licensing source for the profession and jurisdiction.</li><li><strong>Specialty evidence:</strong> unit, specialty, procedures, population, acuity, certifications, or relevant public professional context.</li><li><strong>Facility environment:</strong> academic medical center, community hospital, ambulatory setting, specialty clinic, long-term care, home health, or other setting.</li><li><strong>Local-market reality:</strong> commuting radius, shift, call, onsite requirements, license compact or state-specific constraints, and compensation.</li><li><strong>Interest and timing:</strong> confirm directly; do not infer current interest from a provider record.</li></ol><p>NCSBN states that Nursys QuickConfirm is available for employers and recruiters to retrieve licensure and applicable discipline documentation in participating jurisdictions.</p></section>

          <section className="article-callout" id="npi"><h2>NPI data is useful, but it is not a license check</h2><p>CMS publishes NPPES/NPI data and states explicitly that issuance of an NPI does not ensure or validate that a healthcare provider is licensed or credentialed. In March 2026, CMS moved downloadable NPPES files to Version 2 with expanded field lengths; the current files include practice-location and endpoint reference data.</p><p>Recruiting use: NPI records can help with provider identity, taxonomy, organization, and practice-location research where appropriate. Then use the correct licensing and credentialing systems for stronger claims.</p></section>

          <section id="it"><h2>Healthcare IT is a different sourcing market</h2><p>For healthcare IT, titles can be noisy and vendor names can be overloaded. Build evidence lanes around systems and workflows.</p><h3>Epic</h3><p>Search the relevant module or workflow rather than “Epic” alone: Beaker, Willow, Ambulatory, Inpatient, Cadence, Prelude, Resolute, Clarity, Cogito, Bridges, or another module named by the requisition.</p><h3>Interoperability</h3><p>HL7, FHIR, interfaces, integration engines, API work, and clinical data exchange form a separate lane from general application support.</p><h3>Revenue cycle</h3><p>Patient access, claims, billing, coding, denial management, revenue integrity, and system implementation require different evidence than clinical application roles.</p><h3>Data and analytics</h3><p>Clinical data, population health, quality, BI, warehouse, SQL, reporting, and platform evidence should be searched separately from EHR application ownership.</p></section>

          <section id="queries"><h2>Healthcare search examples</h2><pre>{`ICU RN
("Registered Nurse" OR RN) AND (ICU OR "critical care") AND (BLS OR ACLS)

EPIC BEAKER
("Epic Beaker" OR "Beaker Analyst" OR "Epic Analyst") AND (laboratory OR lab OR LIS)

INTEROPERABILITY
(HL7 OR FHIR OR "interface analyst" OR "integration engineer") AND (Epic OR Cerner OR "Oracle Health" OR MEDITECH)

REVENUE CYCLE
("Revenue Cycle" OR "Patient Financial" OR Resolute) AND (Epic OR hospital OR healthcare)`}</pre><p>Use these as starting lanes, not universal requirements. Adapt them to the evidence standard in the requisition.</p></section>

          <section id="market"><h2>Healthcare is often a local-market mapping problem</h2><p>For location-constrained roles, build a facility map before increasing outreach volume. Group employers by facility type, specialty, geography, shift model, and likely talent transferability. A regional hospital, specialty clinic, academic center, and ambulatory network can produce very different candidate pools even inside the same metro.</p><p>Use the <Link href="/blog/talent-mapping-donor-companies/">Talent Mapping and Donor Company Strategy</Link> method to turn facilities into evidence-backed donor lanes.</p></section>

          <section><h2>Keep the evidence boundary visible</h2><p>A public provider record, license lookup, professional profile, hospital bio, conference listing, or technical artifact can each support a specific sourcing question. Do not silently combine them into a stronger claim than the sources support. Record what was observed, what it may indicate, and what needs to be confirmed before submission or another consequential step.</p><p>The <Link href="/blog/candidate-360-profile-template/">Candidate 360 template</Link> is the structured handoff for that evidence.</p></section>

          <section id="sources"><h2>Primary-source references</h2><ul><li><a href="https://download.cms.gov/nppes/NPI_Files.html" target="_blank" rel="noreferrer noopener">CMS NPPES downloadable NPI files and data notice ↗</a></li><li><a href="https://ncsbn.org/nursing-regulation/licensure/license-verification.page" target="_blank" rel="noreferrer noopener">NCSBN: License Verification with Nursys ↗</a></li></ul></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Structure the search first:</strong> <Link href="/tools/jd-search-strategy/">build healthcare source lanes</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
