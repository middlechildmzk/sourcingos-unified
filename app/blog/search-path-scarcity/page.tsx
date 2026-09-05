import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'Why Your Candidate Search Returns the Same People Everyone Else Finds'
const description = 'Search-path scarcity makes a healthy talent market look exhausted. Learn the seven collapse points, how to diagnose them, and how to open independent sourcing lanes.'
const canonical = '/blog/search-path-scarcity/'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  keywords: [
    'why recruiters find the same candidates',
    'candidate pool too small',
    'sourcing the same people',
    'search path scarcity',
    'expand candidate search',
    'technical sourcing strategy',
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

const collapses = [
  ['1. Title monoculture', 'A req says Site Reliability Engineer, so every search starts and ends with that title. The same work may sit under Platform Engineer, Infrastructure Engineer, DevOps Engineer, Systems Engineer, or older infrastructure titles. Titles are company taxonomy. Capability is evidence.'],
  ['2. Platform monoculture', 'One index produces one population subset, shaped by one ranking system and one set of profile-maintenance behaviors. If every sourcer starts and ends in the same place, different recruiters can still work nearly identical markets.'],
  ['3. Obvious-keyword clustering', 'The obvious terms are copied from the job description, which means competing recruiters are likely to use them too. Independent lanes search for the tools, protocols, frameworks, certifications, artifacts, or work outputs that prove the capability instead.'],
  ['4. Competition compounding', 'The easiest people to find are also the easiest people for everyone else to find. Search overlap therefore becomes outreach overlap. More effort inside the same lane can increase candidate fatigue without increasing market coverage.'],
  ['5. Ignoring adjacent evidence', 'Capability often leaves public evidence outside a conventional profile: code, talks, papers, patents, certifications, technical writing, architecture, or professional communities. These are investigation surfaces, not hiring decisions.'],
  ['6. Zero rediscovery', 'Your ATS can contain people who were close on a previous search, unavailable at the time, or evaluated under different constraints. Searching your own history is a distinct lane and should not be treated as an afterthought.'],
  ['7. Unchallenged constraints', 'A radius, onsite assumption, seniority band, industry requirement, or exact-stack requirement can silently remove a large part of the market before sourcing begins. Every hard constraint should have an owner and a reason.'],
] as const

const faq = [
  ['What is search-path scarcity?', 'Search-path scarcity is when a market appears exhausted because the available search paths have been exhausted, not because the underlying population is truly too small.'],
  ['How is search-path scarcity different from talent scarcity?', 'Talent scarcity is a supply problem. Search-path scarcity is a coverage problem. The first may require changing the requirement; the second requires opening independent sourcing lanes.'],
  ['How can recruiters tell whether a search is exhausted?', 'Track duplicate rate, unique leads by lane, time to first useful lead, and whether new query archetypes continue to produce net-new people. A search is not exhausted just because one Boolean string stopped producing useful results.'],
  ['Can AI make search-path scarcity worse?', 'It can if every sourcer accepts the same conventional title and keyword suggestions. AI is more useful when it helps generate distinct search lanes and exposes assumptions rather than producing one polished query.'],
  ['Does SourcingOS replace LinkedIn Recruiter or other sourcing databases?', 'No. SourcingOS is a search-strategy and evidence layer. It is designed to help sourcers build and track multiple lanes across the tools and licensed sources they already use.'],
] as const

export default function SearchPathScarcityPage() {
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
    about: ['Talent sourcing', 'Search-path scarcity', 'Candidate sourcing strategy'],
  }
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Sourcing methodology</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published August 15, 2026</p>
        <p className="lead">{description}</p>
        <div className="article-meta-grid">
          <div><span>Core concept</span><strong>Search-path scarcity</strong></div>
          <div><span>Next action</span><Link href="/tools/search-lane-expander/">Open new search lanes</Link></div>
          <div><span>SourcingOS rule</span><strong>Evidence first, recruiter confirmed</strong></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card">
            <span className="kicker">In this guide</span>
            <a href="#short-answer">Short answer</a>
            <a href="#definition">Definition</a>
            <a href="#collapse-points">Seven collapse points</a>
            <a href="#self-audit">15-minute self-audit</a>
            <a href="#research-protocol">Research protocol</a>
            <a href="#sources">Primary-source context</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="mini-card"><span className="kicker">Trust note</span><p>This is a sourcing-strategy framework, not a claim that every hard role has abundant supply. Market constraints still require evidence and hiring-manager calibration.</p></div>
        </aside>

        <article className="article-main">
          <section id="short-answer">
            <h2>The short answer</h2>
            <p>When every recruiter working a role finds the same people, the cause may be a small set of search paths rather than a small talent pool. Reusing near-identical titles, keywords, platforms, and filters produces overlapping result sets. The fix is to measure coverage and open independent lanes before declaring the market exhausted.</p>
          </section>

          <section id="definition">
            <h2>Definition: search-path scarcity</h2>
            <p><strong>Search-path scarcity</strong> is the condition where a recruiting market appears exhausted because the available search paths, not necessarily the available people, have been exhausted. It shows up when additional effort inside the same titles, keywords, sources, and filters produces high duplicate rates and little unique-candidate yield. It is distinct from true talent scarcity, where the underlying population genuinely cannot support the requirement.</p>
            <p>Talent scarcity is a supply problem. Search-path scarcity is a coverage problem. They demand different responses.</p>
          </section>

          <section id="collapse-points">
            <h2>The seven collapse points</h2>
            {collapses.map(([heading, body]) => <div key={heading}><h3>{heading}</h3><p>{body}</p></div>)}
          </section>

          <section className="article-callout" id="self-audit">
            <h2>A 15-minute search-path self-audit</h2>
            <ol>
              <li><strong>Title check:</strong> list five titles other employers use for the same work. Did your search cover them?</li>
              <li><strong>Source check:</strong> count independent indexes or evidence surfaces actually searched.</li>
              <li><strong>Evidence check:</strong> did any lane search for what people built, published, operated, or supported rather than only profile text?</li>
              <li><strong>Duplicate check:</strong> how many of the last 20 saved leads were already known to your ATS or team?</li>
              <li><strong>Rediscovery check:</strong> when was your own ATS last searched for this role family?</li>
              <li><strong>Constraint check:</strong> which requirement removes the most people, and who confirmed it is truly non-negotiable?</li>
              <li><strong>Adjacency check:</strong> what role can grow into this one step away, and did you search that population?</li>
            </ol>
          </section>

          <section>
            <h2>What to show a hiring manager instead of “the market is dry”</h2>
            <p>Bring lane coverage. Show which search lanes have been worked, which produced net-new people, which collapsed into duplicates, which remain open, and which constraint is suppressing the most supply. That turns a vague scarcity claim into a decision about search strategy or requirement flexibility.</p>
          </section>

          <section id="research-protocol">
            <h2>Pre-registered research protocol</h2>
            <p>We have not published an overlap percentage for AI-generated sourcing queries because the test has not been run yet. The protocol is registered here before results exist: take one requisition, ask three widely used assistant models for sourcing queries using the same prompt, run the queries in the same licensed search environment with the same filters and date, then measure pairwise overlap and unique contribution per query.</p>
            <p>When the study is complete, this page will be updated with the models, exact prompt, test date, reviewed-result count, overlap method, and raw aggregate outputs. Until then, the AI convergence point above is presented as a hypothesis and operating argument, not a measured finding.</p>
          </section>

          <section id="sources">
            <h2>Primary-source context</h2>
            <p>Search-path coverage should not be confused with occupation-level labor supply. For broader market calibration, use primary labor-market sources such as the <a href="https://www.bls.gov/ooh/" target="_blank" rel="noreferrer">U.S. Bureau of Labor Statistics Occupational Outlook Handbook</a>, the <a href="https://www.bls.gov/jlt/" target="_blank" rel="noreferrer">BLS Job Openings and Labor Turnover Survey</a>, and <a href="https://www.onetonline.org/" target="_blank" rel="noreferrer">O*NET OnLine</a>. O*NET is especially useful for alternate titles, tasks, skills, and occupation adjacency.</p>
          </section>

          <section>
            <h2>Put the framework into practice</h2>
            <p>The <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> turns a rough target into Precision, Balanced, Broad, and Market Map lanes. Pair it with <Link href="/tools/boolean-generator/">BooleanOS</Link>, the <Link href="/tools/jd-search-strategy/">JD Search Strategy tool</Link>, and the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link> so each new lane is measurable instead of just another string.</p>
          </section>

          <section id="faq">
            <h2>FAQ</h2>
            {faq.map(([question, answer]) => <div className="faq" key={question}><h3>{question}</h3><p>{answer}</p></div>)}
          </section>

          <div className="cta"><strong>Open another lane:</strong> <Link href="/tools/search-lane-expander/">Run the Search Lane Expander</Link></div>
        </article>
      </div>
    </main>
  </>
}
