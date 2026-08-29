import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'How to Source Cleared DevSecOps Engineers: Evidence Lanes, GovCon Donor Maps, and Verification Boundaries'
const description = 'A practical sourcing playbook for cleared DevSecOps and platform roles using Kubernetes, Terraform, CI/CD, RMF, ATO, FedRAMP, GovCloud, donor-company mapping, public technical evidence, and explicit clearance verification boundaries.'
const canonical = '/blog/cleared-devsecops-sourcing/'

export const metadata: Metadata = {
  title: 'How to Source Cleared DevSecOps Engineers | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['cleared DevSecOps sourcing','source TS SCI DevSecOps engineers','GovCon technical recruiting','cleared platform engineer sourcing','RMF ATO recruiting','federal DevSecOps sourcing'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['How do you source cleared DevSecOps engineers?', 'Separate the search into independent lanes: platform and infrastructure evidence, federal-security context, donor companies, public technical artifacts, clearance-language breadcrumbs, ATS rediscovery, and referrals. Keep current clearance status as a later authorized verification step rather than treating public wording as confirmation.'],
  ['What technical terms should recruiters search for?', 'Common platform terms include Kubernetes, Terraform, Helm, ArgoCD, GitLab CI, GitHub Actions, Jenkins, Linux, AWS, Azure, observability, containers, infrastructure as code, and policy or security tooling. The exact stack should come from the requisition rather than a generic DevSecOps keyword list.'],
  ['Should I require “DevSecOps Engineer” in the title?', 'Usually not as the only lane. Strong adjacent titles can include Platform Engineer, Site Reliability Engineer, Cloud Engineer, Infrastructure Engineer, DevOps Engineer, and Security Platform roles. Require the work evidence, then test title variants separately.'],
  ['Can public profiles prove that a clearance is active?', 'No. Public clearance language is useful as a sourcing breadcrumb, but current status belongs in the appropriate authorized employer and security process. Record the public wording and the need to confirm it rather than upgrading it into a stronger claim.'],
  ['What is the fastest way to expand a stuck cleared search?', 'Map the donor-company environment, open adjacent platform titles, separate clearance from technical evidence, and add an independent artifact or federal-contract lane. If every lane returns the same people, measure overlap before assuming the market is exhausted.'],
] as const

const sources = [
  ['NIST SP 800-37 Rev. 2: Risk Management Framework','https://csrc.nist.gov/pubs/sp/800/37/r2/final'],
  ['FedRAMP Marketplace','https://www.fedramp.gov/marketplace/'],
  ['SourcingOS: Federal Contract Data Is a Sourcing Lane','/blog/federal-contract-data-sourcing-lane/'],
] as const

const lanes = [
  ['Platform engineering lane', 'Kubernetes, Terraform, containers, Linux, cloud, observability, infrastructure automation, GitOps, deployment systems, and production platform ownership.'],
  ['Secure delivery lane', 'RMF, ATO, NIST, FedRAMP, hardening, policy-as-code, vulnerability management, secure CI/CD, supply-chain controls, or other role-specific federal security context.'],
  ['Donor-company lane', 'Primes, subcontractors, integrators, cloud providers, mission-tech firms, and federal software companies that produce comparable delivery environments.'],
  ['Public artifact lane', 'GitHub repos, talks, conference bios, technical writing, infrastructure modules, public packages, and other evidence that can support investigation.'],
  ['Clearance breadcrumb lane', 'Public TS/SCI, Secret, polygraph, SCIF, agency, mission, or cleared-program language used only to prioritize manual follow-up.'],
  ['Owned-history lane', 'ATS rediscovery, prior finalists, referrals, past project teams, and internal recruiter knowledge that can add people external search does not surface.'],
] as const

export default function ClearedDevsecopsPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['Cleared recruiting','DevSecOps recruiting','GovCon sourcing','Technical sourcing'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Cleared recruiting · DevSecOps sourcing</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">The hard part is not finding people who mention DevSecOps or a clearance. It is finding evidence of platform depth and federal delivery context in the same search while preserving a strict boundary around what public clearance language can and cannot tell you.</p>
        <div className="article-meta-grid">
          <div><span>Search model</span><strong>6 independent lanes</strong></div>
          <div><span>Trust rule</span><strong>Breadcrumb ≠ confirmation</strong></div>
          <div><span>Tool</span><Link href="/tools/clearance-search/">Build cleared search lanes</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#problem">Why the search is hard</a><a href="#lanes">6 lanes</a><a href="#evidence">Evidence stack</a><a href="#donors">Donor map</a><a href="#queries">Queries</a><a href="#clearance">Clearance boundary</a><a href="#calibration">Calibration</a><a href="#references">References</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Non-negotiable</span><p>Public clearance language is a lead for recruiter research. Current clearance status must be handled through the appropriate authorized process.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>Source cleared DevSecOps as an intersection of markets, not as one title. Build separate lanes for platform engineering, secure delivery, donor companies, public artifacts, clearance breadcrumbs, and owned recruiting history. Then compare where the evidence overlaps.</p><p>A strong profile for a federal platform role may look like an SRE, cloud engineer, infrastructure engineer, or platform engineer rather than “DevSecOps Engineer.” The search should follow the work.</p></section>

          <section id="problem"><h2>Why cleared DevSecOps searches collapse</h2><p>Three scarcity problems compound each other:</p><ol><li><strong>Title scarcity:</strong> organizations name platform work differently.</li><li><strong>Evidence scarcity:</strong> sensitive environments often produce less public detail than commercial software roles.</li><li><strong>Constraint scarcity:</strong> clearance, location, onsite expectations, compensation, customer requirements, and specific tooling can shrink the market quickly.</li></ol><p>If those constraints are all embedded in one string, the sourcer cannot tell which one collapsed the pool.</p></section>

          <section id="lanes"><h2>The six-lane search model</h2><div className="grid">{lanes.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section id="evidence"><h2>Build the evidence stack in layers</h2><h3>Layer 1: platform depth</h3><p>Start with the actual operating environment: Kubernetes, Terraform, Helm, ArgoCD, containers, Linux, cloud, observability, infrastructure as code, deployment automation, secrets, networking, or the tools named by the requisition. Pair tool mentions with project or production context where possible.</p><h3>Layer 2: secure delivery context</h3><p>NIST SP 800-37 describes the Risk Management Framework as a structured process involving categorization, controls, implementation, assessment, authorization, and continuous monitoring. Recruiters do not need to become security engineers, but RMF and ATO language can help distinguish federal delivery context from generic DevOps when the role genuinely requires it.</p><h3>Layer 3: federal cloud context</h3><p>The FedRAMP Marketplace is the federal catalog for cloud service offerings and related certification status. Product and provider names from the Marketplace can help build donor-company and environment context, but the presence of a vendor in a federal ecosystem does not prove a candidate personally performed the required work.</p></section>

          <section id="donors"><h2>Build donor companies by environment, not prestige</h2><p>A useful cleared-tech donor map separates the market into groups:</p><ul><li><strong>Large primes:</strong> broad program coverage and large cleared populations, but very different internal role patterns.</li><li><strong>Systems integrators and mission contractors:</strong> often closer to program-specific platform, cyber, cloud, and systems work.</li><li><strong>Cloud and platform vendors:</strong> useful when the role needs deep product or federal-cloud expertise.</li><li><strong>Cyber and security vendors:</strong> useful for secure delivery, policy, observability, or platform-security intersections.</li><li><strong>Mission-tech companies and specialist subs:</strong> potentially smaller pools with highly relevant program environments.</li></ul><p>Use public federal award data to validate which companies actually work in the mission or agency environment. See <Link href="/blog/federal-contract-data-sourcing-lane/">Federal Contract Data Is a Sourcing Lane</Link>.</p></section>

          <section className="article-callout" id="queries"><h2>Four query archetypes for a cleared platform search</h2><pre>{`1. TITLE + PLATFORM
("DevSecOps Engineer" OR "Platform Engineer" OR SRE OR "Cloud Engineer")
AND (Kubernetes OR Terraform)

2. SECURE DELIVERY
(Kubernetes OR Terraform OR GitOps)
AND (RMF OR ATO OR FedRAMP OR NIST OR GovCloud)

3. DONOR COMPANY
(Kubernetes OR Terraform)
AND (Leidos OR GDIT OR CACI OR SAIC OR Peraton)

4. PUBLIC BREADCRUMB
("TS/SCI" OR "Top Secret" OR Secret OR polygraph)
AND (Kubernetes OR Terraform OR AWS OR Azure)`}</pre><p>Run these separately. The fourth lane only identifies public clearance language for manual follow-up. It does not confirm current status.</p></section>

          <section id="clearance"><h2>The clearance evidence boundary</h2><p>Use a three-state model:</p><ol><li><strong>Observed breadcrumb:</strong> a public source contains clearance-related language.</li><li><strong>Unresolved:</strong> the recruiter has not yet confirmed what the language means today.</li><li><strong>Authorized process:</strong> current status is handled through the organization&apos;s appropriate security and hiring workflow.</li></ol><p>Do not create a public-data score that silently promotes state 1 into state 3. The <Link href="/sample-candidate-360/">Candidate 360 sample</Link> shows how to keep the breadcrumb visible without overstating it.</p></section>

          <section id="calibration"><h2>What to ask the hiring manager when the market is thin</h2><ul><li>Which matters more: exact platform stack or exact federal domain?</li><li>Which adjacent titles have succeeded before?</li><li>Is GovCloud experience mandatory or is regulated cloud experience transferable?</li><li>Which RMF/ATO activities must the person have performed directly?</li><li>Which location and onsite constraints are customer-driven rather than preference?</li><li>Which clearance requirement is truly fixed for day one?</li><li>Which donor companies have produced successful hires, and which only look similar on paper?</li></ul><p>Record the answers in the <Link href="/blog/source-pack-methodology/">source pack</Link> so the next search reflects the tradeoff rather than restarting from memory.</p></section>

          <section><h2>How to know when the cleared market is actually exhausted</h2><p>A thin LinkedIn result is not a market-exhaustion finding. Test independent title, evidence, donor, artifact, owned-history, and clearance-breadcrumb lanes. Track duplicate pressure and new-lead yield. If multiple independent lanes flatten and mostly reproduce the same reviewed pool, then you have evidence for a calibration conversation.</p><p>Use the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link> and <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> instead of “we looked everywhere.”</p></section>

          <section id="references"><h2>Primary-source references</h2><ul>{sources.map(([label,href]) => href.startsWith('/') ? <li key={href}><Link href={href}>{label}</Link></li> : <li key={href}><a href={href} target="_blank" rel="noreferrer noopener">{label} ↗</a></li>)}</ul></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build the lanes:</strong> <Link href="/tools/clearance-search/">open Clearance Search Builder</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
