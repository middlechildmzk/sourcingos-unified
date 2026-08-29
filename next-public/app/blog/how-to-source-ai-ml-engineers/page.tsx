import type { Metadata } from 'next'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'

const title = 'How to Source AI and Machine Learning Engineers in 2026: Evidence Lanes Beyond Job Titles'
const description = 'A recruiter-first AI/ML sourcing playbook using GitHub, Hugging Face, OpenAlex, technical artifacts, model-serving evidence, donor-company maps, and explicit human review instead of title-only search.'
const canonical = '/blog/how-to-source-ai-ml-engineers/'

export const metadata: Metadata = {
  title: 'How to Source AI & Machine Learning Engineers in 2026 | SourcingOS',
  description,
  alternates: { canonical },
  keywords: ['how to source machine learning engineers','AI engineer sourcing','ML engineer sourcing','Hugging Face recruiting','GitHub AI sourcing','machine learning recruiter search','AI talent mapping'],
  openGraph: { title, description, type: 'article', url: canonical, publishedTime: '2026-06-26', modifiedTime: '2026-08-20', authors: ['SourcingOS Editorial'] },
  twitter: { card: 'summary_large_image', title, description },
}

const faq = [
  ['What is the best place to source AI and ML engineers?', 'There is no single best source. Use the evidence surface that matches the role: GitHub for code and engineering artifacts, Hugging Face for public models, datasets, and Spaces, OpenAlex for research authors and scholarly work, plus normal professional networks, referrals, ATS rediscovery, and donor-company mapping.'],
  ['Should recruiters search for “AI Engineer”?', 'Yes, but not as the only lane. AI and ML titles are inconsistent. Build separate title, skill, artifact, research, donor-company, and production-system lanes so the search can surface adjacent profiles whose work matches even when the title does not.'],
  ['How do I distinguish an AI enthusiast from a production ML engineer?', 'Look for job-relevant evidence around model development, evaluation, serving, data pipelines, observability, GPU or inference systems, deployment, reliability, product integration, or ownership. Public artifacts support investigation, but depth and role ownership still require recruiter review.'],
  ['Is a paper enough evidence for an ML engineering role?', 'A paper can be strong research evidence, but it does not automatically prove production engineering depth. For applied or production roles, pair research evidence with code, systems, deployment, product, or employment context.'],
  ['Can AI automatically score which ML candidates are best?', 'SourcingOS does not recommend turning a black-box AI score into a hiring decision. Use AI to structure search and summarize evidence, then keep identity, fit, missing information, and consequential decisions recruiter-owned.'],
] as const

const sources = [
  ['Hugging Face Hub documentation','https://huggingface.co/docs/hub/index'],
  ['GitHub Docs: code search syntax','https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax'],
  ['OpenAlex Developers: API overview','https://developers.openalex.org/api-reference/introduction'],
  ['OpenAlex Developers: Authors','https://developers.openalex.org/api-reference/authors'],
  ['OpenAlex Developers: Works','https://developers.openalex.org/api-reference/works'],
] as const

const roleModes = [
  ['Applied / product ML', 'Search for model development plus product integration, evaluation, experimentation, inference, data quality, and measurable product or user context.'],
  ['ML platform / MLOps', 'Search for serving, orchestration, Kubernetes, model registries, feature or data pipelines, observability, GPU scheduling, CI/CD, and reliability.'],
  ['LLM / generative AI', 'Search for retrieval, evals, embeddings, vector systems, agents, model routing, fine-tuning, inference, guardrails, and production integration rather than “prompt engineering” alone.'],
  ['Research engineer', 'Blend papers and research topics with implementation evidence, experiment systems, reproducibility, code, and model-building depth.'],
  ['Research scientist', 'Weight publications, research agenda, methods, institutions, citations in context, open research artifacts, and domain depth more heavily than product deployment.'],
  ['Data / ML systems', 'Search for distributed data, training pipelines, feature generation, Spark, Ray, orchestration, storage, vector systems, and the infrastructure surrounding model work.'],
] as const

export default function AiMlSourcingPage() {
  const articleUrl = `${siteUrl}${canonical}`
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description, url: articleUrl, mainEntityOfPage: articleUrl,
    datePublished: '2026-06-26', dateModified: '2026-08-20', author: { '@type': 'Person', name: 'SourcingOS Editorial', url: `${siteUrl}/about/` },
    publisher: { '@type': 'Organization', name: 'SourcingOS', url: siteUrl }, about: ['AI recruiting','Machine learning recruiting','Technical sourcing','AI talent mapping'],
  }
  const faqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q,a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    <main className="wrap article article-pro">
      <div className="article-hero-card">
        <span className="kicker">AI/ML recruiting · 2026 sourcing playbook</span>
        <h1>{title}</h1>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>SourcingOS Editorial · Senior Technical Sourcer · Published June 26, 2026 · Updated August 20, 2026</p>
        <p className="lead">AI hiring is especially vulnerable to title inflation and keyword noise. Build the search around evidence of the actual work: model development, evaluation, inference, research, deployment, data systems, and product ownership.</p>
        <div className="article-meta-grid">
          <div><span>Core idea</span><strong>Search work, not hype</strong></div>
          <div><span>Best lanes</span><strong>Code + models + research</strong></div>
          <div><span>Tool</span><Link href="/candidate-search/">Try Candidate Search</Link></div>
        </div>
      </div>

      <div className="article-layout">
        <aside className="article-sidebar">
          <div className="mini-card"><span className="kicker">In this guide</span><a href="#answer">Short answer</a><a href="#role-mode">Role modes</a><a href="#evidence">Evidence map</a><a href="#sources">Source lanes</a><a href="#queries">Queries</a><a href="#review">Review framework</a><a href="#donors">Donor companies</a><a href="#references">References</a><a href="#faq">FAQ</a></div>
          <div className="mini-card"><span className="kicker">Boundary</span><p>Public AI/ML artifacts can support discovery and technical research. They do not prove employment ownership, current interest, identity across accounts, or final role fit.</p></div>
        </aside>

        <article className="article-main">
          <section id="answer"><h2>The short answer</h2><p>The strongest AI/ML sourcing strategy uses several independent evidence lanes. Search professional titles, but also search code, public model work, datasets, papers, technical writing, package ecosystems, donor companies, and owned recruiting history. Each lane should answer a different question about the market.</p><p>The mistake is treating “AI engineer” as a coherent population. A research scientist building novel methods, an MLOps engineer running inference infrastructure, and a product engineer integrating LLM APIs may all contain “AI” in their profile while requiring radically different evidence.</p></section>

          <section id="role-mode"><h2>Start by classifying the role mode</h2><p>Before writing Boolean, decide what kind of AI/ML work the requisition actually needs.</p><div className="grid">{roleModes.map(([name,copy]) => <div className="card authority-card" key={name}><span className="kicker">{name}</span><p>{copy}</p></div>)}</div><p>If the hiring manager cannot distinguish these modes, that is an intake problem. Use the <Link href="/blog/source-pack-methodology/">Source Pack Methodology</Link> to define the evidence standard before building the search.</p></section>

          <section id="evidence"><h2>Build an evidence map before a title map</h2><h3>Model and framework evidence</h3><p>PyTorch, JAX, TensorFlow, Transformers, diffusion systems, multimodal work, or domain-specific model stacks can be useful signals, but framework mentions alone are weak. Pair them with what the person appears to have built or operated.</p><h3>Evaluation evidence</h3><p>Look for eval design, offline and online metrics, benchmark construction, red-team or safety evaluation, retrieval evaluation, experiment design, human evaluation, or production quality measurement. In 2026, evaluation work is often more informative than generic “LLM experience.”</p><h3>Serving and systems evidence</h3><p>Inference servers, Triton, vLLM, Kubernetes, Ray, model gateways, batching, latency, GPU utilization, observability, autoscaling, caching, feature or embedding pipelines, and deployment architecture can separate production ML systems work from experimentation-only profiles.</p><h3>Research evidence</h3><p>Publications, preprints, datasets, model cards, conference talks, and research repositories can reveal topic depth. For engineering roles, pair them with implementation and systems evidence.</p><h3>Product evidence</h3><p>For applied roles, search for shipped features, customer or user context, experimentation, model iteration, cost/latency tradeoffs, guardrails, and collaboration with product or application teams.</p></section>

          <section id="sources"><h2>Use source lanes that match the evidence</h2><h3>GitHub</h3><p>GitHub is useful for public repositories, code, README files, issues, packages, and project context. Native code search supports Boolean logic and qualifiers including repository, organization, language, and path. Use it as an evidence surface, not as a substitute resume.</p><h3>Hugging Face</h3><p>The Hugging Face Hub exposes public model, dataset, and Space repositories. Model cards, dataset cards, demos, discussions, and linked repos can reveal applied or research work that a normal title search misses.</p><h3>OpenAlex</h3><p>OpenAlex organizes scholarly works, authors, institutions, topics, and related research entities. It is especially useful for research-heavy searches, emerging technical topics, and author-to-institution mapping. A paper is a research signal, not automatic evidence of production engineering ownership.</p><h3>Professional networks and ATS history</h3><p>Employment history, recruiter notes, prior finalists, referrals, and rediscovery remain important. Open-web sourcing should expand the source stack, not pretend that public artifacts replace every licensed or owned recruiting system.</p></section>

          <section className="article-callout" id="queries"><h2>Six AI/ML search lanes to test</h2><pre>{`1. TITLE
("Machine Learning Engineer" OR "ML Engineer" OR "AI Engineer") AND (PyTorch OR JAX OR TensorFlow)

2. PRODUCTION ML
(PyTorch OR transformers) AND ("model serving" OR inference OR Triton OR vLLM OR Kubernetes)

3. LLM SYSTEMS
(RAG OR embeddings OR "vector database") AND (evals OR evaluation OR inference OR agents)

4. ML PLATFORM
(MLOps OR "ML Platform" OR "Machine Learning Infrastructure") AND (Kubernetes OR Ray OR Airflow OR Kubeflow)

5. RESEARCH
("machine learning" OR "computer vision" OR NLP) AND (paper OR publication OR arXiv OR OpenAlex)

6. PUBLIC ARTIFACT
site:github.com (PyTorch OR transformers OR JAX) (evaluation OR inference OR "model serving")`}</pre><p>Run these as separate lanes and compare what each adds. Do not combine them all into a single un-debuggable query.</p></section>

          <section id="review"><h2>Review AI/ML evidence with five questions</h2><ol><li><strong>What was built?</strong> Model, feature, platform, dataset, evaluation system, research result, infrastructure, or integration?</li><li><strong>What appears to be owned?</strong> Was the person a contributor, maintainer, lead, author, collaborator, or simply associated with the project?</li><li><strong>What scale or environment matters?</strong> Research prototype, internal tool, public open-source project, high-throughput inference, regulated product, consumer application?</li><li><strong>What is recent?</strong> AI/ML stacks move quickly. Recency may matter differently for foundational research versus production tooling.</li><li><strong>What remains unknown?</strong> Employment context, depth, team role, current location, work authorization, compensation, interest, or another fact that needs recruiter confirmation.</li></ol><p>Record those fields explicitly rather than compressing everything into an opaque fit score. The <Link href="/sample-candidate-360/">Candidate 360 sample</Link> demonstrates that separation.</p></section>

          <section id="donors"><h2>Build donor companies by AI operating model</h2><p>A donor map should not be “famous AI companies.” It should map organizations that create the work pattern you need.</p><ul><li><strong>Foundation-model labs:</strong> useful for model research, training, eval, inference, safety, and AI infrastructure patterns.</li><li><strong>AI-native product companies:</strong> useful for applied model integration, product experimentation, retrieval, agents, and production economics.</li><li><strong>Cloud and infrastructure companies:</strong> useful for GPU platforms, orchestration, serving, data systems, and developer tooling.</li><li><strong>Research institutions:</strong> useful for research scientists, research engineers, and specialized domain expertise.</li><li><strong>Traditional companies with mature ML platforms:</strong> useful for ranking, recommendations, forecasting, fraud, ads, personalization, computer vision, or domain ML at production scale.</li></ul><p>Map by environment and work pattern, not brand prestige. The <Link href="/blog/talent-mapping-donor-companies/">Talent Mapping and Donor Company Strategy</Link> guide shows the broader method.</p></section>

          <section><h2>How to know whether an AI/ML lane is actually adding coverage</h2><p>Track the evidence-fit leads from each lane and deduplicate them against the comparison stack. A technically interesting source that repeatedly surfaces the same people as your primary database may still be useful for evidence enrichment, but it is not adding the same discovery value as a lane that contributes new evidence-fit leads.</p><p>Use <Link href="/blog/unique-contribution-rate/">Unique Contribution Rate</Link> to measure additive discovery and the <Link href="/blog/search-exhaustion-framework/">Search Exhaustion framework</Link> to decide when the market has actually been tested across independent paths.</p></section>

          <section id="references"><h2>Primary-source references</h2><p>These links document the public evidence surfaces referenced in this playbook.</p><ul>{sources.map(([label,href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer noopener">{label} ↗</a></li>)}</ul></section>

          <section id="faq"><h2>FAQ</h2>{faq.map(([q,a]) => <div className="faq" key={q}><h3>{q}</h3><p>{a}</p></div>)}</section>
          <div className="cta"><strong>Build the search:</strong> <Link href="/candidate-search/">open Candidate Search</Link> or <Link href="/tools/xray-search/">launch an open-web lane</Link>.</div>
        </article>
      </div>
    </main>
  </>
}
