import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = '15 AI Prompts for Recruiters: Source Packs, Boolean Search, Talent Maps, and Evidence Review'
const description = 'Fifteen recruiter-safe AI prompts for role intake, title expansion, search lanes, Boolean critique, donor-company mapping, evidence review, no-results rescue, hiring-manager calibration, and sourcing retrospectives.'
const canonical = '/blog/recruiter-ai-prompts-source-pack/'

export const metadata: Metadata = {
  title: '15 AI Prompts for Recruiters and Sourcers | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['AI prompts recruiters','recruiter AI prompts','sourcing prompts ChatGPT','AI sourcing prompts','Boolean prompt recruiter','talent mapping AI prompt'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['Dan Larson'] },
  twitter: { card: 'summary_large_image', title, description },
}

const guardrail = `Rules for every response:
- Do not invent candidates, profiles, employers, jobs, URLs, contact data, credentials, or verification.
- Label assumptions explicitly.
- Keep public clearance language as a breadcrumb only; current status requires the appropriate authorized process.
- Do not infer protected or sensitive traits.
- Do not silently merge identities.
- Separate observed evidence from inference and missing information.
- Do not recommend automated rejection, auto-outreach, or another consequential action without human review.`

const prompts = [
  ['1. Role-intake critic', `Act as a senior technical sourcer reviewing this requisition before search begins.
Return:
1. Stated must-haves
2. Hidden or ambiguous requirements
3. Preferences disguised as requirements
4. Missing evidence standards
5. Constraints that could collapse the market
6. Ten hiring-manager questions that would materially change the search
Do not solve the ambiguities yourself. Label them.`],
  ['2. Evidence-standard builder', `For each must-have in this role, define what job-relevant evidence could support it.
Use four columns:
- Requirement
- Strong evidence
- Weak breadcrumb
- What must be confirmed later
Avoid title-only evidence when the underlying work can be described more precisely.`],
  ['3. Adjacent-title map', `Build a title map for this role.
Return:
- Exact titles
- Common equivalents
- Adjacent titles with transferable work
- Legacy titles
- Company-specific variants to investigate
- Titles that look similar but usually create false positives
For every adjacent title, explain the transferability hypothesis in one sentence.`],
  ['4. Three-lane search plan', `Turn this requisition into three independent search lanes:
1. Precision lane
2. Evidence-led lane
3. Adjacent-market lane
For each lane return:
- hypothesis
- titles
- evidence terms
- likely source surfaces
- false-positive risks
- what outcome would justify more effort
Do not combine the lanes into one giant query.`],
  ['5. Boolean generator + critic', `Create three Boolean variants for this role:
- strict title-led
- skill/evidence-led
- adjacency-led
Then critique each string for:
- brittle title assumptions
- missing synonyms
- unnecessary AND conditions
- false-positive risk
- source-specific syntax concerns
Make one change at a time in the recommended revisions.`],
  ['6. X-Ray lane builder', `Create open-web search lanes for this role using only public evidence surfaces that plausibly match the profession.
For each surface return:
- why it belongs
- one Google site-search query
- one noise/exclusion strategy
- what the result can support
- what it cannot verify
Do not invent profile URLs or people.`],
  ['7. Donor-company hypothesis map', `Build donor-company categories before naming companies.
Score each category on:
- work-pattern similarity
- technical/operational environment
- customer or mission similarity
- regulation/risk similarity
- geography/work model
- compensation/career-path plausibility
Then propose Primary, Adjacent, and Stretch donor examples with a written rationale. Treat company membership as a search hypothesis, not proof of fit.`],
  ['8. Search-result noise diagnosis', `Here are examples of profiles my search keeps returning and why they are wrong.
Diagnose the recurring false-positive patterns.
Return:
- likely query cause
- evidence term to add
- title or keyword to remove
- exclusion worth testing
- whether the problem is title, skill, domain, location, donor, or source-lane design
Do not rewrite the entire search unless necessary.`],
  ['9. No-results rescue', `This sourcing lane is producing too few evidence-fit leads.
Propose an expansion sequence that changes one assumption at a time.
Rank changes by likely information value, not by how broad they make the search.
Consider title, evidence, donor companies, location, domain, source surface, and nice-to-have tools.
Preserve the true non-negotiables.`],
  ['10. Candidate evidence reviewer', `Review the supplied candidate evidence against this requisition.
Return only:
1. Observed evidence
2. Which requirement each item may support
3. Missing information
4. Ambiguous or stale claims
5. Verify-next questions
6. A short hiring-manager summary that preserves uncertainty
Do not infer facts not present in the evidence.`],
  ['11. Identity-merge critic', `I have two source profiles that may represent the same person.
List the non-sensitive anchors that support or weaken the identity hypothesis.
Return:
- evidence for same person
- evidence against
- unresolved conflicts
- what a recruiter should inspect next
Do not decide the merge automatically if meaningful uncertainty remains.`],
  ['12. Hiring-manager calibration brief', `Summarize this week of sourcing evidence for a hiring manager.
Use this structure:
- what we tested
- what the market produced
- repeated false positives
- donor/title lanes that added signal
- constraints that appear to be collapsing the market
- two tradeoff decisions needed from the HM
- next experiment after each possible decision
Keep individual candidate judgments secondary to market patterns.`],
  ['13. ATS rediscovery strategy', `Use these past candidate outcomes and rejection reasons to design an ATS rediscovery lane.
Return:
- segments worth revisiting
- stale-context checks
- opt-out or prior-contact checks
- patterns from prior successful profiles
- new search terms or donor hypotheses derived from history
Do not assume past interest is current interest.`],
  ['14. Search-exhaustion critic', `Challenge the statement: "we have searched the market."
Given these lanes, query variants, duplicate rates, donor coverage, adjacent-title tests, and recent new-lead rates, identify what has and has not actually been tested.
Return:
- evidence supporting exhaustion
- missing independent lanes
- repeated search paths masquerading as new coverage
- the single highest-information next experiment.`],
  ['15. Friday sourcing retrospective', `Turn this week's sourcing notes into project memory.
Return:
- hypotheses tested
- evidence that supported or contradicted each
- queries worth preserving
- false-positive rules learned
- donor companies promoted/demoted
- HM tradeoffs approved
- source lanes with unique contribution
- unresolved questions
- next week's first experiment
Do not rewrite history to make the strategy look successful.`],
] as const

const faq = [
  ['What makes a good AI prompt for recruiters?', 'A useful prompt creates an inspectable sourcing artifact: evidence standards, title maps, search lanes, Boolean variants, donor hypotheses, calibration questions, or evidence-review structure. It should expose assumptions rather than invent candidate facts.'],
  ['Should recruiters ask AI to find candidates by name?', 'Only when the workflow uses real authorized search tools and returns source evidence that can be checked. A language model should not fabricate candidate lists, profile links, contact details, or identity claims from memory.'],
  ['How do I stop AI from hallucinating sourcing data?', 'Use explicit guardrails, require source evidence for factual candidate claims, label assumptions, keep missing information visible, and evaluate the output before it becomes part of a candidate record. Guardrails reduce risk but do not eliminate the need for human review.'],
  ['Are these prompts a replacement for the AI sourcing training module?', 'No. This page is a reference library of copy-paste prompts. The training module teaches the safe prompt pattern and how to use the outputs inside a sourcing workflow.'],
  ['Can AI draft recruiter outreach?', 'It can help draft language after the recruiter has evidence and an appropriate contact path, but outreach should stay relevant, human-reviewed, and inside the organization’s approved process.'],
] as const

export default function RecruiterAiPromptsPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context':'https://schema.org','@type':'Article',headline:title,description,url:articleUrl,mainEntityOfPage:articleUrl,
    datePublished:'2026-06-26',dateModified:'2026-08-20',author:{'@type':'Person',name:'Dan Larson',url:`${siteUrl}/about/`},
    publisher:{'@type':'Organization',name:'SourcingOS',url:siteUrl},about:['AI recruiting prompts','Talent sourcing','Source packs','Recruiter workflows'],
  }
  const faqSchema = {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(articleSchema)}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(faqSchema)}} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">AI sourcing · prompt reference library</span>
        <h1>{title}</h1>
        <p className="muted" style={{fontSize:13,margin:'4px 0 12px'}}>Dan Larson · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">Use AI to structure sourcing work you can inspect. These prompts create search plans, evidence frameworks, market maps, and retrospectives without asking a model to invent people or turn uncertainty into candidate facts.</p>
        <div className="article-meta-grid"><div><span>Library</span><strong>15 prompts</strong></div><div><span>Guardrail</span><strong>Evidence stays visible</strong></div><div><span>Training</span><Link href="/training/ai-sourcing-prompts/">Open the workshop</Link></div></div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar"><div className="mini-card"><span className="kicker">In this guide</span><a href="#pattern">Prompt pattern</a><a href="#guardrail">Guardrail block</a><a href="#library">15 prompts</a><a href="#workflow">Workflow</a><a href="#faq">FAQ</a></div><div className="mini-card"><span className="kicker">Rule</span><p>Prompt quality does not convert generated text into evidence. Candidate-level factual claims still need a real source and recruiter review.</p></div></aside>
        <article className="article-main">
          <section id="pattern"><h2>The reusable prompt pattern</h2><p>Strong sourcing prompts contain four things: <strong>role context</strong>, a <strong>specific artifact</strong> to produce, a <strong>structured output format</strong>, and <strong>trust constraints</strong>. “Find me great candidates” is weak because it asks the model to skip the search and evidence layers.</p><pre>{`Context: [paste req + HM notes]
Task: [one sourcing artifact]
Return: [explicit sections or table]
Rules: [append the guardrail block below]`}</pre></section>

          <section className="article-callout" id="guardrail"><h2>Append this guardrail block</h2><pre>{guardrail}</pre><p>These instructions are not a guarantee against model error. They make the expected evidence boundary explicit so the recruiter can detect when the output crosses it.</p></section>

          <section id="library"><h2>15 recruiter AI prompts</h2>{prompts.map(([name,prompt])=><div key={name}><h3>{name}</h3><pre>{`${prompt}\n\n${guardrail}`}</pre></div>)}</section>

          <section id="workflow"><h2>How to use the prompt library in SourcingOS</h2><p>Start with role intake and evidence standards, then create search lanes. Use <Link href="/tools/jd-search-strategy/">JD Strategy Tool</Link> for the source-pack draft, <Link href="/tools/boolean-generator/">BooleanOS</Link> for syntax variants, <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> for a thin market, and <Link href="/candidate-search/">Candidate Search</Link> when you move from strategy into evidence review.</p><p>If you want the instructional version rather than a reference library, use the <Link href="/training/ai-sourcing-prompts/">AI Sourcing Prompts training module</Link>. For product evaluation, use the <Link href="/blog/ai-sourcing-workflow-2026/">8-task AI sourcing harness</Link>.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a])=><div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Turn a prompt into a real search plan:</strong> <Link href="/tools/jd-search-strategy/">open JD Strategy Tool</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
