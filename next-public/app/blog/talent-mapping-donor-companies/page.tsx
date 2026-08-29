import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Talent Mapping and Donor Company Strategy: How Sourcers Build Searchable Market Maps'
const description = 'A practical donor-company and talent-mapping framework for technical, AI/ML, GovCon, healthcare, and enterprise recruiting. Rank companies by work environment, stack, customer, regulation, scale, geography, and talent transferability.'
const canonical = '/blog/talent-mapping-donor-companies/'

export const metadata: Metadata = {
  title: 'Talent Mapping & Donor Company Strategy for Sourcers | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['talent mapping donor companies','donor company sourcing','talent market mapping recruiters','competitor talent mapping','recruiting market map','target company sourcing strategy'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is a donor company in recruiting?', 'A donor company is an organization likely to contain people with a transferable work pattern for the requisition. It is a search hypothesis based on environment, stack, customer, regulation, scale, mission, or operating model, not a claim that every employee there fits.'],
  ['How is talent mapping different from a target-company list?', 'A target-company list is usually a static set of names. A talent map explains why each company belongs, what type of talent it is expected to produce, which roles or teams matter, what evidence to search for, and how the map changes when the market pushes back.'],
  ['How many donor companies should a sourcer use?', 'Use enough to create distinct primary, adjacent, and stretch lanes without turning the map into a directory. The right number depends on market size. Ten carefully reasoned donors can be more useful than one hundred unranked logos.'],
  ['Should competitors always be the best donor companies?', 'No. Competitors may share product category but not engineering environment, compensation, geography, customer type, regulation, or role design. Sometimes an adjacent infrastructure provider, systems integrator, hospital system, research institution, or mission contractor is a more transferable donor.'],
  ['How do I know whether a donor lane is working?', 'Track evidence-fit lead yield, duplicate pressure, unique contribution, hiring-manager pass-through, and recurring rejection reasons by donor group. Keep the rationale next to the results so the map becomes project memory.'],
] as const

const dimensions = [
  ['Work pattern', 'Does the organization produce the same type of work the requisition needs: platform operations, applied ML, ICU care, RMF/ATO delivery, enterprise sales, data engineering, or another concrete pattern?'],
  ['Technical / operational stack', 'Do teams work with comparable systems, tooling, workflows, scale, or delivery constraints?'],
  ['Customer / mission', 'Does the company serve similar buyers, missions, users, industries, or regulated environments?'],
  ['Scale and complexity', 'Is the operating scale transferable: startup ambiguity, large distributed systems, high transaction volume, enterprise process, clinical acuity, federal mission complexity?'],
  ['Regulation and risk', 'Do teams operate under comparable security, privacy, safety, quality, or compliance expectations?'],
  ['Geography and work model', 'Does the company actually produce talent in the locations, onsite patterns, or labor markets relevant to the role?'],
  ['Compensation / career path', 'Is the move economically and professionally plausible, or does the donor map create a pool that the requisition cannot realistically attract?'],
] as const

export default function TalentMappingPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['Talent mapping','Donor companies','Market mapping','Talent sourcing'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Talent mapping · donor-company methodology</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">A useful donor map is not a list of famous competitors. It is a ranked theory of where the required work pattern is produced, why the talent should transfer, and which search evidence will prove or disprove that theory.</p>
        <div className="article-meta-grid">
          <div><span>Output</span><strong>Primary + adjacent + stretch</strong></div>
          <div><span>Unit</span><strong>Company + rationale + lane</strong></div>
          <div><span>Tool</span><Link href="/tools/jd-search-strategy/">Build donor hypotheses</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#dimensions">7 dimensions</a><a href="#tiers">Three donor tiers</a><a href="#workflow">Workflow</a><a href="#examples">Examples</a><a href="#federal">Federal data</a><a href="#measurement">Measurement</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Rule</span><p>Company membership is never evidence of role fit by itself. The donor map tells the sourcer where to look and what transferability hypothesis to test.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>A donor-company map is a prioritized set of organizations expected to produce transferable talent for one requisition or role family. Every company should have a reason for being on the map and an expected evidence pattern.</p><p>The best donor maps are dynamic. If a company repeatedly produces the wrong kind of profile, change its tier or remove it. If an adjacent company produces strong evidence-fit leads the hiring manager accepts, move it closer to the core.</p></section>

          <section id="dimensions"><h2>Score donors on seven transferability dimensions</h2><div className="grid">{dimensions.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div><p>You do not need a fake precision score. A simple High / Medium / Low assessment with a written rationale is enough to expose why a company belongs in the search.</p></section>

          <section id="tiers"><h2>Use three donor tiers</h2><h3>Tier 1: direct environment match</h3><p>Organizations where the work pattern, stack, customer, and operating environment are close to the target role. These are the first places to test, not necessarily the biggest brands.</p><h3>Tier 2: adjacent transfer</h3><p>Companies that match several dimensions but require one meaningful transfer: industry, customer type, scale, title, regulation, or technology. This tier is often where the market expands without abandoning the core evidence standard.</p><h3>Tier 3: stretch hypothesis</h3><p>Organizations that could produce a useful adjacent profile if the hiring manager approves a specific tradeoff. Keep the tradeoff explicit so the stretch lane does not silently redefine the requisition.</p></section>

          <section className="article-callout" id="workflow"><h2>The donor-map workflow</h2><ol><li><strong>Define the work outcome.</strong> What must the hire actually accomplish?</li><li><strong>List the environmental constraints.</strong> Stack, customer, regulation, scale, geography, mission, and compensation.</li><li><strong>Generate candidate donor groups.</strong> Think in categories before logos: primes, cloud platforms, regional hospital systems, AI labs, SaaS infrastructure firms, fintech platforms, research institutions.</li><li><strong>Add named organizations with a rationale.</strong> One sentence explaining why each belongs.</li><li><strong>Assign a tier.</strong> Direct, adjacent, or stretch.</li><li><strong>Define search evidence.</strong> Which titles, skills, artifacts, teams, products, programs, or public data would indicate the right work inside that company?</li><li><strong>Run the donor lane separately.</strong> Do not mix every donor into the title lane and lose measurement.</li><li><strong>Review results with the HM.</strong> Promote, demote, or remove donor groups based on actual profile evidence and rejection patterns.</li></ol></section>

          <section id="examples"><h2>Examples by recruiting market</h2><h3>AI/ML platform engineer</h3><p>Do not map only foundation-model companies. Build groups for model labs, AI-native applications, cloud/GPU platforms, data infrastructure, ML tooling, mature consumer ML organizations, and research-heavy engineering teams. The donor rationale should state whether you are targeting model development, inference, eval, data systems, or platform reliability.</p><h3>Cleared platform / DevSecOps</h3><p>Separate large primes, systems integrators, cloud vendors, cyber platforms, mission-tech firms, and specialist subcontractors. Search for program and federal-delivery context as a distinct evidence layer. See <Link href="/blog/cleared-devsecops-sourcing/">How to Source Cleared DevSecOps Engineers</Link>.</p><h3>Healthcare</h3><p>Map by facility type, specialty, clinical acuity, regional labor market, EMR environment, or healthcare-IT stack rather than assuming every hospital or health system produces interchangeable talent.</p><h3>Enterprise software</h3><p>Map by customer segment, sales motion, product complexity, implementation model, technical stack, or scale. A competitor with the same category but a completely different customer and operating model may be a poor donor.</p></section>

          <section id="federal"><h2>For GovCon, replace recruiter memory with public award data</h2><p>Federal markets offer an additional evidence layer: public award and contract data can help identify which companies actually work with an agency, mission, program area, NAICS category, or technology environment. That produces a donor map grounded in observable federal business rather than “companies I remember from previous searches.”</p><p>The <Link href="/blog/federal-contract-data-sourcing-lane/">Federal Contract Data sourcing lane</Link> explains how SourcingOS uses USAspending and SAM.gov context to build a more defensible GovCon market map.</p></section>

          <section id="measurement"><h2>Measure donor groups like search lanes</h2><p>For each donor tier or group, track:</p><ul><li>raw leads reviewed</li><li>evidence-fit saves</li><li>duplicate pressure against other lanes</li><li>unique contribution</li><li>hiring-manager pass-through</li><li>rejection reasons</li><li>response or outreach outcomes where appropriate</li><li>compensation or location mismatch patterns</li></ul><p>If a donor group produces many profiles but almost nothing unique, it may be redundant with another source lane. If a small adjacent group repeatedly contributes distinct evidence-fit leads, it may deserve more search effort. Use <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> to quantify the additive part.</p></section>

          <section><h2>Turn the map into project memory</h2><p>A donor map should survive the requisition. Record which companies produced signal, which titles were transferable, which assumptions failed, and what the hiring manager learned. On the next similar role, the team should start from tested market knowledge instead of a blank spreadsheet.</p><p>The <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link> is the container for that memory. Donor companies are one lane inside a broader evidence-first search plan.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build the market map:</strong> <Link href="/tools/jd-search-strategy/">open the JD Strategy Tool</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
