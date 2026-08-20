import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'Candidate 360 Profile Template: Build Evidence-Backed Dossiers Recruiters Can Audit'
const description = 'A practical Candidate 360 template for separating observed evidence, recruiter-confirmed identity resolution, unknowns, must-have coverage, risk flags, outreach context, and verify-next actions.'
const canonical = '/blog/candidate-360-profile-template/'

export const metadata: Metadata = {
  title: 'Candidate 360 Profile Template for Recruiters | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['candidate 360 template','candidate profile template recruiter','candidate dossier template','evidence based sourcing','candidate evidence template','recruiter candidate summary'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['Dan Larson'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is a Candidate 360 profile?', 'A Candidate 360 profile is a sourcing dossier that organizes job-relevant evidence, source provenance, must-have coverage, missing information, risk flags, and next verification steps into one reviewable artifact. It is not a scraped resume and should not hide uncertainty behind a single score.'],
  ['What should a Candidate 360 include?', 'At minimum: role context, identity/source records, observed evidence, must-have and nice-to-have coverage, unknowns, source-lane provenance, risk flags, verify-next actions, and a concise hiring-manager summary.'],
  ['Should Candidate 360 use a fit score?', 'Only if the scoring methodology is explicit, auditable, job-relevant, and genuinely useful. SourcingOS currently prefers visible evidence coverage and unresolved gaps over an unexplained composite score.'],
  ['What does recruiter-confirmed mean?', 'In SourcingOS, recruiter-confirmed identity resolution means a human approved that separate source profiles refer to the same person. It does not mean every fact on those profiles has been confirmed. Candidate facts retain their own evidence and verification status.'],
  ['Can Candidate 360 include contact data?', 'Only when the organization is authorized to use the source and the workflow follows applicable law, employer policy, platform terms, relevance, and opt-out practices. Contact signals should remain separate from evidence of role fit.'],
] as const

const fields = [
  ['1. Role context', 'The requisition, must-haves, flexible constraints, hiring-manager pain, search history, and why this dossier exists.'],
  ['2. Identity records', 'The source profiles believed to represent the person, with explicit human confirmation for uncertain merges rather than silent identity stitching.'],
  ['3. Must-have coverage', 'A requirement-by-requirement view showing supporting evidence, missing evidence, and what still requires direct confirmation.'],
  ['4. Evidence ledger', 'Observed public or authorized-source evidence, provenance, recency, confidence, and the specific question that remains unresolved.'],
  ['5. Source-lane provenance', 'Which search lane surfaced the lead and which independent sources added supporting context.'],
  ['6. Risks and unknowns', 'Facts that are stale, ambiguous, self-stated, inferred, absent, or otherwise unsafe to present as confirmed.'],
  ['7. Verify-next list', 'The recruiter actions required before outreach, submission, or stronger claims.'],
  ['8. HM talking points', 'A concise explanation of why the profile deserves review, where evidence is strongest, and which tradeoff or question matters next.'],
] as const

export default function Candidate360GuidePage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'Dan Larson', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['Candidate 360','Evidence review','Talent sourcing','Candidate research'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">Candidate research · evidence methodology</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>Dan Larson · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">A strong candidate summary should make it easier to inspect the recommendation, not easier to hide uncertainty. Candidate 360 keeps observed evidence, identity decisions, missing facts, and verification work visible all the way to the hiring manager.</p>
        <div className="article-meta-grid">
          <div><span>Artifact</span><strong>HM-ready dossier</strong></div>
          <div><span>Trust model</span><strong>Evidence + unknowns</strong></div>
          <div><span>Example</span><Link href="/sample-candidate-360/">View synthetic sample</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#why">Why normal summaries fail</a><a href="#template">8-part template</a><a href="#ledger">Evidence ledger</a><a href="#coverage">Coverage vs score</a><a href="#identity">Identity resolution</a><a href="#hm">HM handoff</a><a href="#example">Example</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Boundary</span><p>Recruiter-confirmed identity resolution means the profile merge was reviewed by a human. It does not upgrade every underlying candidate fact to confirmed status.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>A Candidate 360 dossier is a structured answer to a hiring-manager question: <strong>why is this person worth reviewing, what evidence supports that recommendation, and what still needs to be confirmed?</strong></p><p>It should not be a polished narrative that erases uncertainty. The artifact should make uncertainty easier to see.</p></section>

          <section id="why"><h2>Why normal candidate summaries break trust</h2><p>Traditional sourcing notes often collapse several different things into one paragraph: facts from a resume, public technical evidence, inferred seniority, recruiter opinion, identity assumptions, contact data, and current-interest guesses. Once blended together, the hiring manager cannot tell which sentence came from where.</p><p>The problem gets worse when AI summarizes multiple sources. A fluent paragraph can make a weak breadcrumb sound like a strong fact. Candidate 360 solves this by separating the layers instead of improving the prose.</p></section>

          <section id="template"><h2>The 8-part Candidate 360 template</h2><div className="grid">{fields.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div></section>

          <section id="ledger"><h2>The evidence ledger is the center of the dossier</h2><p>An evidence ledger records the smallest useful unit of a sourcing claim. Each row should answer five questions:</p><ol><li><strong>What signal are we evaluating?</strong> Example: Kubernetes production work, model evaluation, RMF/ATO context, Epic Beaker, or leadership scope.</li><li><strong>What did the source actually show?</strong> Keep the observation narrower than the conclusion.</li><li><strong>Where did it come from?</strong> Resume, GitHub, conference page, professional profile, company mapping, ATS note, registry, or another authorized source.</li><li><strong>How strong is the evidence?</strong> Direct, indirect, stale, self-stated, ambiguous, or missing.</li><li><strong>What must be checked next?</strong> Ownership, recency, scale, employment context, credential status, interest, or another unresolved fact.</li></ol><p>This turns “seems like a fit” into a reviewable chain of evidence.</p></section>

          <section className="article-callout" id="coverage"><h2>Prefer auditable coverage over unexplained scores</h2><p>A composite score looks precise even when the weights, inputs, and missing-data rules are invisible. SourcingOS therefore treats requirement coverage as the default public artifact: how many must-haves have supporting evidence, which are weak, and which remain unresolved.</p><pre>{`Must-have evidence coverage
3 of 4 have supporting signals
1 of 4 remains pending direct confirmation

This is a coverage summary, not a judgment of the person.`}</pre><p>If an organization later uses a score, the formula, weights, missing-data behavior, and decision role should be explicit. Otherwise the score creates more certainty than the evidence supports.</p></section>

          <section id="identity"><h2>Identity resolution is its own decision</h2><p>Public-source recruiting often finds multiple profiles that may refer to the same person. The safe workflow is:</p><ol><li>Keep source profiles separate by default.</li><li>Let the system propose a possible identity match using non-sensitive, job-relevant anchors.</li><li>Require a recruiter to approve the merge when identity is uncertain.</li><li>Record that the merge was human-confirmed.</li><li>Do not treat the confirmed merge as confirmation of the candidate facts contained in the profiles.</li></ol><p>This is the Candidate Graph rule behind SourcingOS: no silent identity merges.</p></section>

          <section><h2>Separate evidence, contact signals, and interest</h2><p>A work email, public phone number, open-to-work phrase, conference bio, or GitHub profile can each be useful in a recruiting workflow, but they represent different things. Contact availability does not prove fit. Public job-interest language may be stale. A technical artifact does not imply consent to contact someone through every available channel.</p><p>Keep these fields separate in the dossier so an outreach decision can be reviewed on its own merits.</p></section>

          <section id="hm"><h2>Write the hiring-manager handoff last</h2><p>Once the ledger and gaps are visible, write a short HM summary with four components:</p><ol><li><strong>Why review:</strong> the strongest job-relevant evidence.</li><li><strong>What is unusual:</strong> the combination of evidence or source lane that made the profile additive.</li><li><strong>What is unresolved:</strong> the one or two facts that should not be overstated.</li><li><strong>What the HM needs to answer:</strong> a calibration question or tradeoff that affects the search.</li></ol><p>This keeps the summary useful without turning it into sales copy.</p></section>

          <section id="example"><h2>Worked example: synthetic cleared DevSecOps dossier</h2><p>The public SourcingOS sample uses a fictional profile to demonstrate the format. It shows supporting Kubernetes, Terraform, CI/CD, GovCon-adjacent, and RMF/ATO signals while keeping a self-stated clearance breadcrumb explicitly unresolved. The dossier separately records source provenance, what to verify next, lane context, must-have coverage, and a hiring-manager talking point.</p><p><Link href="/sample-candidate-360/">Open the full synthetic Candidate 360 sample →</Link></p></section>

          <section><h2>Where Candidate 360 fits in the sourcing workflow</h2><p>Start with the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link> to define what evidence matters. Use <Link href="/candidate-search/">Candidate Search</Link> to review public-source evidence. Use the <Link href="/training/evidence-review-checklist/">Evidence Review Checklist</Link> to separate facts, signals, assumptions, and missing information. Candidate 360 is the final sourcing artifact that carries those distinctions into the hiring-manager conversation.</p></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>See the artifact:</strong> <Link href="/sample-candidate-360/">open the synthetic Candidate 360 sample</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
