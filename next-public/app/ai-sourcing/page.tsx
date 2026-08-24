import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const canonical = '/ai-sourcing/'
const title = 'AI Sourcing for Recruiters: Workflow, Tools & Guardrails (2026)'
const description = 'A practical guide to AI sourcing for recruiters: role intake, title expansion, Boolean search, source lanes, candidate discovery, evidence review, measurement, and human-control guardrails.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical },
  keywords: [
    'ai sourcing',
    'ai sourcing for recruiters',
    'ai candidate sourcing',
    'talent sourcing ai',
    'ai recruiting sourcing',
    'ai sourcing workflow',
  ],
  robots: { index: true, follow: true },
  openGraph: { title, description, url: canonical, type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
}

const workflow = [
  ['1. Calibrate the role', 'Use AI to separate true must-haves from preferences, expose ambiguous requirements, and generate hiring-manager questions. Do not let the model silently turn a vague job description into hard filters.'],
  ['2. Expand the search language', 'Generate alternate titles, adjacent titles, skill synonyms, acronyms, product names, certifications, and exclusion terms. Keep the recruiter in control of which expansions are actually job-relevant.'],
  ['3. Build multiple search lanes', 'Use AI to create source-specific Boolean and X-Ray queries rather than one giant string. Separate professional networks, GitHub, portfolios, communities, associations, conference evidence, and other public lanes where appropriate.'],
  ['4. Discover candidates and evidence', 'Use AI to accelerate discovery and organize job-relevant evidence. Treat generated summaries as leads to inspect, not verified facts.'],
  ['5. Review before consequential action', 'A recruiter should review identity, evidence, uncertainty, exclusions, and any inferred fit before outreach, rejection, ranking, or record merging.'],
  ['6. Measure what AI uniquely adds', 'Track evidence-fit candidates, duplicates, review time, and unique contribution versus your normal sourcing workflow. Faster output is useful only if the result is also accurate and additive.'],
] as const

const useCases = [
  ['Role intake', 'Summarize a messy intake, separate requirements from preferences, and surface missing calibration questions.'],
  ['Title expansion', 'Generate relevant alternate and adjacent titles with an explanation for why each belongs in the search.'],
  ['Boolean and X-Ray search', 'Draft source-specific strings, synonym groups, exclusions, and multiple query archetypes.'],
  ['Source-lane planning', 'Identify where a talent population may leave public evidence outside a single professional network.'],
  ['Evidence organization', 'Convert reviewed public evidence into structured notes without silently upgrading inference into fact.'],
  ['Research and market mapping', 'Help organize companies, talent pools, skill clusters, and search hypotheses that the recruiter can inspect and revise.'],
] as const

const guardrails = [
  ['Do not treat AI output as verified evidence', 'A model can summarize or infer incorrectly. Preserve source links and distinguish observed evidence from recruiter interpretation.'],
  ['Do not infer protected or sensitive traits', 'Keep sourcing criteria job-related. Do not use AI to infer personal characteristics that are not appropriate hiring criteria.'],
  ['Do not let AI verify what public data cannot verify', 'Security clearances, licenses, certifications, employment status, and identity-sensitive facts may require an authorized verification process.'],
  ['Do not hide consequential automation', 'Outreach, rejection, ranking, identity merges, and other meaningful actions should have explicit human review rather than an invisible model decision.'],
] as const

const faq = [
  ['What is AI sourcing?', 'AI sourcing is the use of AI-assisted systems to help recruiters understand roles, expand search language, build queries, plan source lanes, discover potential candidates, organize evidence, and support sourcing workflows. The recruiter remains responsible for reviewing evidence and consequential decisions.'],
  ['How is AI sourcing different from AI recruiting?', 'AI sourcing is narrower. It focuses on talent discovery and search strategy. AI recruiting can also include scheduling, messaging, screening, interview support, workflow automation, and other parts of the hiring process.'],
  ['Can AI replace Boolean search?', 'AI can make Boolean construction faster, but the useful output is still inspectable search logic. Recruiters should review syntax, synonyms, exclusions, and source-specific assumptions instead of treating generated strings as automatically correct.'],
  ['What should I measure in an AI sourcing workflow?', 'Measure evidence-fit candidates, duplicate rate, unique contribution versus another search lane, review and correction time, unsupported claims, and whether the workflow preserves recruiter control.'],
  ['What is the safest way to start using AI for sourcing?', 'Start with reversible, inspectable work such as role intake, title expansion, Boolean generation, and source-lane planning. Keep evidence review and consequential actions human-approved.'],
] as const

export default function AiSourcingPage() {
  const pageUrl = `${siteUrl}${canonical}`
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: pageUrl,
    dateModified: '2026-08-24',
    about: ['AI sourcing', 'Talent sourcing', 'Recruiting', 'Recruiter workflows'],
    isPartOf: { '@type': 'WebSite', name: 'SourcingOS', url: siteUrl },
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

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <section className="wrap hero">
        <div className="eyebrow">AI sourcing · recruiter-controlled</div>
        <h1>AI sourcing for recruiters</h1>
        <p className="lead">
          Use AI to widen the search, improve query construction, organize evidence, and reduce repetitive sourcing work—without turning generated output into verified fact or handing consequential decisions to a black box.
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/candidate-search/">Try Candidate Search</Link>
          <Link className="btn secondary" href="/tools/boolean-generator/">Build a Boolean search</Link>
          <Link className="btn ghost" href="/blog/ai-sourcing-workflow-2026/">Evaluate AI sourcing tools</Link>
        </div>
      </section>

      <section className="wrap">
        <div className="grid two">
          <div className="card featured">
            <span className="kicker">Definition</span>
            <h2>What is AI sourcing?</h2>
            <p className="muted">
              AI sourcing is the use of AI-assisted systems in talent sourcing: interpreting roles, expanding titles and skills, constructing Boolean and X-Ray queries, planning search lanes, discovering potential candidates, and organizing job-relevant evidence.
            </p>
            <p className="muted">
              The useful boundary is assistance. AI can propose a search strategy; the recruiter should still inspect the logic, review the evidence, and control consequential actions.
            </p>
          </div>
          <div className="card">
            <span className="kicker">AI sourcing vs. AI recruiting</span>
            <h2>Sourcing is the discovery layer.</h2>
            <p className="muted">
              AI recruiting is broader and can include messaging, scheduling, screening, interview support, analytics, and workflow automation. AI sourcing is specifically about finding and researching talent populations and improving the search process.
            </p>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">Practical workflow</div>
        <h2>A six-step AI sourcing workflow</h2>
        <div className="grid two">
          {workflow.map(([heading, copy]) => (
            <div className="card" key={heading}>
              <h3>{heading}</h3>
              <p className="muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">Where AI helps most</div>
        <h2>High-value AI sourcing use cases</h2>
        <div className="grid three">
          {useCases.map(([heading, copy]) => (
            <div className="card" key={heading}>
              <span className="kicker">{heading}</span>
              <p className="muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="card featured">
          <span className="kicker">SourcingOS workflow</span>
          <h2>Use AI as a search copilot, then inspect the work.</h2>
          <p className="muted">
            SourcingOS is designed around visible search logic, multiple source lanes, public evidence, recruiter-confirmed project memory, and explicit human review. It does not require AI output to be treated as a hidden candidate score.
          </p>
          <div className="hero-actions">
            <Link className="btn" href="/tools/search-lane-expander/">Expand search lanes</Link>
            <Link className="btn secondary" href="/tools/boolean-generator/">Generate Boolean</Link>
            <Link className="btn secondary" href="/tools/unique-contribution-rate-calculator/">Measure unique contribution</Link>
            <Link className="btn ghost" href="/training/ai-sourcing-prompts/">AI sourcing prompts</Link>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">Guardrails</div>
        <h2>What AI sourcing should not do silently</h2>
        <div className="grid two">
          {guardrails.map(([heading, copy]) => (
            <div className="card" key={heading}>
              <h3>{heading}</h3>
              <p className="muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="grid two">
          <div className="card">
            <span className="kicker">Tool evaluation</span>
            <h2>Do not choose an AI sourcing tool from a demo.</h2>
            <p className="muted">
              Run competing tools through the same requisitions and tasks. Compare evidence-fit yield, unique contribution, correction time, unsupported claims, recruiter control, and unsafe automation separately from feature count.
            </p>
            <Link className="btn secondary" href="/blog/ai-sourcing-workflow-2026/">Use the 8-task evaluation harness →</Link>
          </div>
          <div className="card">
            <span className="kicker">Buyer guide</span>
            <h2>Comparing AI recruiting products?</h2>
            <p className="muted">
              The buyer guide covers current tool categories, tradeoffs, and what sourcers should verify before paying for another AI layer.
            </p>
            <Link className="btn secondary" href="/blog/best-ai-recruiting-tools-for-sourcers-2026/">See the AI recruiting tools guide →</Link>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">FAQ</div>
        <div className="grid two">
          {faq.map(([question, answer]) => (
            <div className="card" key={question}>
              <h3>{question}</h3>
              <p className="muted">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
