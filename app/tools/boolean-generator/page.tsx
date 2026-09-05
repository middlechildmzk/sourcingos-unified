import Link from 'next/link'
import { BooleanTool } from '@/components/BooleanTool'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'Free Boolean Search Generator & String Builder for Recruiters'
const description = 'Free Boolean search generator and string builder for recruiters. Paste a job description and create Boolean strings for LinkedIn, Google/Bing X-Ray, and GitHub with Precision, Balanced, and Market Map lanes.'
const canonical = '/tools/boolean-generator/'

export const metadata = {
  title,
  description,
  alternates: { canonical },
  keywords: ['boolean search generator','boolean string generator','boolean builder','boolean search creator','free boolean generator','recruiter boolean search','boolean string builder'],
  openGraph: { title, description, url: canonical, type: 'website' },
  twitter: { card: 'summary', title, description },
}

const faq = [
  ['What is a Boolean search generator?', 'A Boolean search generator converts role requirements into search logic using operators such as AND, OR, quotes, parentheses, and exclusions. A useful recruiting generator should also separate synonyms, must-have signals, adjacent titles, and source-specific syntax instead of producing one oversized string.'],
  ['Is this also a Boolean string builder or Boolean search creator?', 'Yes. Boolean generator, Boolean string builder, Boolean creator, and Boolean search generator describe the same core job: turning recruiting requirements into inspectable search logic. SourcingOS adds multiple search lanes so the output is not limited to one giant string.'],
  ['How do I create a Boolean search string from a job description?', 'Extract the evidence that actually predicts fit: role/title concepts, hard skills, systems, domain context, credentials, and meaningful exclusions. Group true synonyms with OR, combine distinct required concepts deliberately, then test more than one query archetype.'],
  ['Should I use one Boolean string or multiple searches?', 'Use multiple lanes when coverage matters. A title-heavy query, a skill-heavy query, an adjacent-title query, an evidence query, and a donor-company query can surface different candidate populations even when they target the same requisition.'],
  ['Does Boolean search still matter with AI sourcing tools?', 'Yes. AI can draft and expand queries, but the recruiter still needs to understand what evidence each query selects, what it excludes, and which candidate populations another search lane may reach.'],
] as const

export default function Page(){
  const appSchema = {
    '@context':'https://schema.org',
    '@type':'WebApplication',
    name:'SourcingOS Boolean Search Generator & String Builder',
    applicationCategory:'BusinessApplication',
    operatingSystem:'Web',
    url:`${siteUrl}${canonical}`,
    description,
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
        <span className="kicker">Free Boolean generator · builder · search creator</span>
        <h1>Free Boolean search generator and string builder for recruiters.</h1>
        <p className="lead">Paste the JD. SourcingOS extracts search-relevant evidence, removes HR noise, and creates three ready-to-run Boolean search lanes—Precision, Balanced, and Market Map—with LinkedIn, Google/Bing X-Ray, and GitHub versions.</p>
        <div className="article-meta-grid">
          <div><span>Price</span><strong>Free · no account</strong></div>
          <div><span>Outputs</span><strong>3 search lanes</strong></div>
          <div><span>Sources</span><strong>LinkedIn · X-Ray · GitHub</strong></div>
        </div>
      </section>

      <section className="card" style={{margin:'20px 0'}}>
        <span className="kicker">Quick answer</span>
        <h2>How do you build a better Boolean search for recruiting?</h2>
        <p>A strong recruiting Boolean search groups true synonyms with OR, separates distinct evidence concepts deliberately, avoids unnecessary exclusions, and is tested as one search lane rather than treated as the entire sourcing strategy. The fastest way to improve coverage is often to run multiple query archetypes instead of endlessly polishing one giant string.</p>
        <p><Link href="/blog/boolean-search-benchmark/">See the five-query-archetype benchmark →</Link></p>
      </section>

      <BooleanTool />

      <section className="grid" style={{marginTop:28}}>
        <div className="card authority-card"><span className="kicker">Precision</span><h2>Start narrow.</h2><p>Use the clearest titles, must-have technical evidence, and the smallest synonym set that still reflects how relevant professionals describe the work.</p></div>
        <div className="card authority-card"><span className="kicker">Balanced</span><h2>Expand vocabulary.</h2><p>Add realistic title variants, alternate product names, transferable skill language, and adjacent evidence without collapsing everything into one broad OR block.</p></div>
        <div className="card authority-card"><span className="kicker">Market Map</span><h2>Search beyond the obvious profile.</h2><p>Use adjacent roles, donor-company context, public technical evidence, and broader source lanes to find evidence-fit leads the title-first search may miss.</p></div>
      </section>

      <section className="card" style={{marginTop:28}}>
        <span className="kicker">SourcingOS methodology</span>
        <h2>One Boolean string is one lane—not the market.</h2>
        <p>The SourcingOS <strong>query archetype</strong> framework separates title-heavy, skill-heavy, evidence-based, adjacent-title, and donor-company searches because each selects a different type of signal. The benchmark protocol is published before results so future data can contradict the hypothesis rather than merely demonstrate the tool.</p>
        <div className="nav-links" style={{marginTop:14}}><Link className="button ghost compact" href="/blog/boolean-search-benchmark/">Read the Boolean benchmark</Link><Link className="button ghost compact" href="/tools/search-lane-expander/">Expand search lanes</Link><Link className="button ghost compact" href="/blog/search-path-scarcity/">Why searches converge</Link></div>
      </section>

      <section className="card" style={{marginTop:28}}>
        <h2>Boolean search generator FAQ</h2>
        {faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}
      </section>
    </main>
  </>
}
