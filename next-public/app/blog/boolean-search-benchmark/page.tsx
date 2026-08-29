import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import { safeJsonLd } from '@/lib/safe-json-ld'

const title = 'Boolean Search Benchmark: Five Query Archetypes, One Role, Different Talent Pools'
const description = 'Five Boolean query archetypes for recruiters—title-heavy, skill-heavy, evidence-based, adjacent-title, and donor-company—plus a pre-registered benchmark for measuring what each lane uniquely contributes.'
const canonical = '/blog/boolean-search-benchmark/'

export const metadata: Metadata = {
  title: 'Boolean Search Benchmark for Recruiters: 5 Query Archetypes',
  description,
  alternates: { canonical },
  keywords: ['boolean search for recruiters','boolean search generator','boolean search examples recruiting','technical recruiter boolean strings','recruiting search operators','query archetype'],
  openGraph: { title, description, type:'article', url:canonical, publishedTime:'2026-08-15', modifiedTime:'2026-08-15', authors:['SourcingOS Editorial'] },
  twitter: { card:'summary_large_image', title, description },
}

const archetypes = [
  {
    name:'1. Title-heavy',
    selects:'Employer title vocabulary',
    query:'("Middleware Engineer" OR "Integration Engineer" OR "MQ Engineer" OR "Messaging Engineer" OR "Middleware Administrator") AND ("IBM MQ" OR "WebSphere MQ" OR "MQSeries")',
    finds:'People whose profile uses titles close to the requisition.',
    misses:'People doing equivalent work under broader or company-specific titles.',
  },
  {
    name:'2. Skill-heavy',
    selects:'Stated tooling and capability',
    query:'("IBM MQ" OR "WebSphere MQ" OR "MQSeries") AND ("MQSC" OR "queue manager" OR "channel" OR "AMQP" OR "JMS") AND ("clustering" OR "high availability" OR "failover" OR "TLS")',
    finds:'Practitioners who document the technical details of how they work.',
    misses:'Strong practitioners with sparse or outdated public profiles.',
  },
  {
    name:'3. Evidence-based',
    selects:'Public work artifacts',
    query:'site:github.com ("MQSC" OR "queue manager" OR "ibm-mq") ("Terraform" OR "Ansible" OR "Helm")',
    finds:'People whose public work reveals relevant evidence even when conventional profile text is thin.',
    misses:'People whose work is closed or non-public, which is especially important in cleared environments.',
  },
  {
    name:'4. Adjacent-title',
    selects:'Neighboring roles and transferable capability',
    query:'("Systems Engineer" OR "Application Support Engineer" OR "Platform Engineer" OR "ESB Developer" OR "Integration Architect") AND ("Kafka" OR "RabbitMQ" OR "ActiveMQ" OR "TIBCO" OR "MQ") AND ("enterprise messaging" OR "message queue" OR "middleware")',
    finds:'People one step away from the exact title who may have transferable capability.',
    misses:'It is intentionally broader, so false-positive review cost rises and must be measured.',
  },
  {
    name:'5. Donor-company',
    selects:'Employer context supported by market evidence',
    query:'(validated donor-company set) AND ("middleware" OR "integration" OR "messaging" OR "MQ")',
    finds:'People whose work environment is relevant even when their vocabulary differs from the req.',
    misses:'People at employers your donor map did not include, which is why provenance and refresh dates matter.',
  },
] as const

const faq = [
  ['Which Boolean archetype is best?', 'There is no universal winner. The five archetypes select different signal types. The useful question is which archetype still adds net-new qualified leads for the requisition you are working.'],
  ['What is a query archetype?', 'A query archetype is a structural family of search string defined by the type of evidence it selects—such as titles, skills, work artifacts, adjacency, or employer context—rather than by its exact keywords.'],
  ['Does Boolean still matter when recruiters use AI?', 'Yes. AI can help draft and expand strings, but recruiters still need to understand which signal type the query selects and which market segment it is structurally unable to reach.'],
  ['Can recruiters use site: searches on Google?', 'Google documents site:, quoted exact matches, and minus exclusions as supported search operators. Search publicly indexed pages manually and follow the terms and policies of the underlying sites.'],
  ['How long should each benchmark lane run?', 'The initial SourcingOS protocol caps each archetype at 30 minutes so effort is comparable. The final benchmark will report the cap and reviewed-result counts with the results.'],
] as const

export default function BooleanSearchBenchmarkPage(){
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org', '@type':'Article', headline:title, description, url:articleUrl, mainEntityOfPage:articleUrl,
    datePublished:'2026-08-15', dateModified:'2026-08-15', author:{'@type':'Person',name:'SourcingOS Editorial',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl}, about:['Boolean search','Talent sourcing','Query archetypes','Technical recruiting'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Boolean sourcing methodology</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>SourcingOS Editorial · Senior Technical Sourcer · Published August 15, 2026</p>
        <p className="lead">{description}</p>
        <div className="article-meta-grid">
          <div><span>Framework</span><strong>5 query archetypes</strong></div>
          <div><span>Benchmark status</span><strong>Protocol published · results pending</strong></div>
          <div><span>Next action</span><Link href="/tools/boolean-generator/">Build the five lanes</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#short-answer">Short answer</a><a href="#definition">Query archetype</a><a href="#five">Five archetypes</a><a href="#protocol">Benchmark protocol</a><a href="#failures">Common failures</a><a href="#sources">Primary sources</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Research rule</span><p>No yield table is published until the controlled runs are complete. The protocol is visible now so the data can contradict our expectations later.</p></div>
        </aside>

        <article className="article-main">
          <section id="short-answer"><h2>The short answer</h2><p>A Boolean string is not good or bad in isolation. It selects a population. Title-heavy strings select title vocabulary. Skill-heavy strings select self-described capability. Evidence lanes select public work. Adjacent-title strings select transferable backgrounds. Donor-company strings select employer context. Run multiple archetypes and measure what each adds instead of endlessly polishing one string.</p></section>

          <section id="definition"><h2>Definition: query archetype</h2><p><strong>A query archetype</strong> is a structural family of search string defined by the evidence type it selects rather than the exact keywords it contains. Two queries belong to the same archetype when they rely on the same underlying signal—for example titles, tools, public artifacts, adjacent roles, or employer context. The concept is useful because a more precise version of the same archetype can still be structurally blind to the populations another archetype reaches.</p></section>

          <section><h2>Why “better Boolean” is the wrong benchmark</h2><p>Precision matters, but precision is not coverage. A highly refined title query cannot return a person whose employer used a different title. A narrow skill query cannot return a strong practitioner who barely maintains a public profile. The benchmark therefore measures <strong>result composition and unique contribution</strong>, not which string looks the cleverest.</p></section>

          <section id="five"><h2>The five archetypes</h2><p>The examples below use a senior middleware or integration engineer working with IBM MQ for consistency. Adapt the terms; preserve the structural shape.</p>{archetypes.map(a=><div key={a.name}><h3>{a.name}</h3><p><strong>Selects:</strong> {a.selects}</p><pre>{a.query}</pre><p><strong>What it can find:</strong> {a.finds}</p><p><strong>Structural blind spot:</strong> {a.misses}</p></div>)}</section>

          <section className="article-callout" id="protocol"><h2>Pre-registered benchmark protocol</h2><ol><li>Choose three requisitions across three role families.</li><li>Build all five archetypes for each requisition.</li><li>Run them in the same licensed search environment, with the same filters and a 30-minute cap per archetype.</li><li>Record total results where available, reviewed results, saved profile-like leads, and saved leads not found by earlier archetypes.</li><li>Rotate archetype order between requisitions so first-run advantage does not automatically inflate the same lane.</li><li>Dedupe only on a stable identity anchor and require human confirmation before merging.</li><li>Report results by role family with sample size and collection window; do not blend unlike markets into a single headline number.</li></ol><p><strong>Results status:</strong> not yet collected. This page will be updated when the controlled benchmark is complete.</p></section>

          <section id="failures"><h2>Three failures that ruin Boolean coverage</h2><h3>ANDing synonyms</h3><p>If two terms are genuine alternatives for the same signal, putting them in separate AND blocks requires both and can collapse the result set. Group alternatives deliberately.</p><h3>Overusing exclusions</h3><p>Every NOT or minus exclusion trades recall for cleanliness. Exclusions should target known noise patterns, not become a substitute for reviewing imperfect results.</p><h3>Calling one string a search strategy</h3><p>One string is one lane. If it is title-heavy, polishing it does not magically turn it into a skill, evidence, adjacency, or donor-company lane.</p></section>

          <section><h2>Where BooleanOS fits</h2><p>Use the <Link href="/tools/boolean-generator/">Boolean Generator</Link> to draft narrow and expanded logic, then pair it with the <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> so the search is organized by coverage rather than by one giant expression. The <Link href="/blog/search-path-scarcity/">Search-Path Scarcity framework</Link> explains why that matters, and the <Link href="/blog/federal-contract-data-sourcing-lane/">Federal Contract Data lane</Link> shows how to build employer-context inputs from public evidence.</p></section>

          <section id="sources"><h2>Primary-source context</h2><p><a href="https://support.google.com/websearch/answer/2466433" target="_blank" rel="noreferrer">Google Search Help</a> documents operators including quoted exact matches, <code>site:</code>, and minus exclusions. <a href="https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax" target="_blank" rel="noreferrer">GitHub Docs</a> documents the syntax for GitHub code search. For occupation adjacency and alternate-title research, <a href="https://www.onetonline.org/" target="_blank" rel="noreferrer">O*NET OnLine</a> publishes current occupation tasks, related occupations, and reported job titles.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build the next five lanes:</strong> <Link href="/tools/boolean-generator/">open the Boolean Generator</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
