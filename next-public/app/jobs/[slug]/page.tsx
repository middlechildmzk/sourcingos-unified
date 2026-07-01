import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LiveJobsClient } from '@/components/LiveJobsClient'
import { getCategoryBySlug, jobCategories } from '@/data/jobs'

type Props = {
  params: { slug: string }
}

type CategoryGuide = { query: string; location?: string; titles: string[]; skills: string[]; tips: string[] }

const categorySearch: Record<string, CategoryGuide> = {
  'remote-recruiter-jobs': {
    query: 'remote recruiter talent acquisition partner full cycle recruiter',
    location: 'Remote',
    titles: ['Recruiter', 'Talent Acquisition Partner', 'Corporate Recruiter', 'Full-Cycle Recruiter'],
    skills: ['sourcing', 'screening', 'ATS workflows', 'hiring manager partnership', 'candidate experience'],
    tips: ['Search both recruiter and talent acquisition partner titles.', 'Use Remote first, then broaden to United States if results are thin.', 'Confirm remote status on the original source before applying.'],
  },
  'remote-talent-sourcer-jobs': {
    query: 'remote talent sourcer sourcing specialist recruiter sourcer',
    location: 'Remote',
    titles: ['Talent Sourcer', 'Technical Sourcer', 'Sourcing Specialist', 'Talent Researcher'],
    skills: ['Boolean search', 'X-Ray search', 'pipeline generation', 'market mapping', 'outbound messaging'],
    tips: ['Search sourcer and sourcing specialist separately.', 'Look for postings that mention outbound pipeline ownership.', 'Use portfolio examples to show your search strategy, not just years of experience.'],
  },
  'technical-sourcer-jobs': {
    query: 'technical sourcer engineering sourcer technical recruiter software sourcer',
    titles: ['Technical Sourcer', 'Engineering Sourcer', 'Technical Recruiter', 'AI Sourcer'],
    skills: ['GitHub sourcing', 'Stack Overflow sourcing', 'technical calibration', 'cloud roles', 'AI/ML terminology'],
    tips: ['Search technical sourcer and engineering sourcer separately.', 'Look for roles that mention GitHub, open source, AI, cloud, or infrastructure.', 'Prepare examples of how you learned a technical role and built a search strategy.'],
  },
  'recruiting-operations-jobs': {
    query: 'recruiting operations talent acquisition operations TA ops recruiting systems',
    titles: ['Recruiting Operations Specialist', 'TA Operations Specialist', 'Recruiting Systems Analyst', 'Talent Operations Manager'],
    skills: ['ATS administration', 'reporting', 'dashboards', 'process design', 'automation'],
    tips: ['Search TA operations and talent operations too.', 'Look for ATS names like Greenhouse, Lever, Workday, iCIMS, Ashby, and Avature.', 'Highlight process, reporting, and workflow improvements.'],
  },
  'healthcare-recruiter-jobs': {
    query: 'healthcare recruiter clinical recruiter nurse recruiter allied health recruiter provider recruiter',
    titles: ['Healthcare Recruiter', 'Clinical Recruiter', 'Nurse Recruiter', 'Provider Recruiter'],
    skills: ['clinical titles', 'license awareness', 'high-volume recruiting', 'hospital hiring', 'provider sourcing'],
    tips: ['Search clinical recruiter, nurse recruiter, and provider recruiter separately.', 'Try metro and state searches because clinical roles are often location-sensitive.', 'Look for postings that mention licensure, credentialing, or hospital systems.'],
  },
  'cleared-recruiter-jobs': {
    query: 'cleared recruiter govcon recruiter federal recruiter defense recruiter security clearance sourcer',
    titles: ['Cleared Recruiter', 'GovCon Recruiter', 'Federal Recruiter', 'Defense Recruiter'],
    skills: ['federal recruiting', 'mission hiring', 'cyber roles', 'cloud roles', 'compliance-aware sourcing'],
    tips: ['Search cleared recruiter, federal recruiter, defense recruiter, and GovCon sourcer.', 'Look for role text mentioning federal contracts, cyber, cloud, or mission programs.', 'Treat any clearance language as recruiter-verified only through proper processes.'],
  },
  'ai-recruiter-jobs': {
    query: 'AI recruiter ML recruiter machine learning sourcer AI talent acquisition technical sourcer',
    titles: ['AI Recruiter', 'Machine Learning Recruiter', 'AI Sourcer', 'Research Recruiter'],
    skills: ['LLM terminology', 'MLOps', 'research profiles', 'GitHub evidence', 'technical calibration'],
    tips: ['Search AI recruiter, ML recruiter, research recruiter, and technical sourcer.', 'Look for postings that mention LLMs, MLOps, AI infrastructure, or applied AI.', 'Study where AI candidates publish code, papers, models, and package work.'],
  },
  'contract-recruiter-jobs': {
    query: 'contract recruiter fractional recruiter embedded recruiter contract sourcer freelance recruiter',
    titles: ['Contract Recruiter', 'Fractional Recruiter', 'Embedded Recruiter', 'Contract Sourcer'],
    skills: ['fast ramp-up', 'pipeline building', 'client communication', 'contract hiring', 'stakeholder updates'],
    tips: ['Search contract recruiter, embedded recruiter, fractional recruiter, and contract sourcer.', 'Check duration, hourly rate, tools, and employment type carefully.', 'Highlight speed, independence, and proof of pipeline impact.'],
  },
}

export function generateStaticParams() {
  return jobCategories.map(category => ({ slug: category.slug }))
}

export function generateMetadata({ params }: Props) {
  const category = getCategoryBySlug(params.slug)
  if (!category) return {}
  return {
    title: category.seoTitle,
    description: category.seoDescription,
  }
}

export default function JobCategoryPage({ params }: Props) {
  const category = getCategoryBySlug(params.slug)
  if (!category) notFound()
  const guide: CategoryGuide = categorySearch[category.slug] || {
    query: category.name,
    location: '',
    titles: [category.name.replace(' Jobs', '')],
    skills: ['sourcing', 'recruiting', 'candidate experience'],
    tips: ['Start broad, then narrow by title, location, and source.', 'Always verify the original source before applying.'],
  }

  const faq = [
    {
      question: `What should I search for besides ${category.name.toLowerCase()}?`,
      answer: `Try related titles such as ${guide.titles.slice(0, 3).join(', ')}. Recruiter job titles vary a lot by company, so title expansion usually matters.`,
    },
    {
      question: 'Are these jobs hosted by SourcingOS?',
      answer: 'Live results link back to original public job sources or reviewed employer submissions. SourcingOS does not present third-party job posts as its own openings.',
    },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="wrap hero">
        <div className="eyebrow">Recruiter career hub</div>
        <h1>{category.name}</h1>
        <p className="lead">{category.description}</p>
        <div className="hero-actions">
          <a className="btn" href="#live-jobs">Search live listings</a>
          <Link className="btn secondary" href="/jobs/guides">Career guides</Link>
          <Link className="btn ghost" href="/waitlist">Join SourcingOS beta</Link>
        </div>
      </section>

      <section className="wrap">
        <div className="grid">
          <div className="card">
            <span className="kicker">Common titles</span>
            <h2>Search beyond one title.</h2>
            <div className="chips">{guide.titles.map(title => <span className="tag" key={title}>{title}</span>)}</div>
          </div>
          <div className="card">
            <span className="kicker">Skills to show</span>
            <h2>Position your proof.</h2>
            <div className="chips">{guide.skills.map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>
          </div>
          <div className="card">
            <span className="kicker">SourcingOS angle</span>
            <h2>Use the tools.</h2>
            <p className="muted">Turn job descriptions into source lanes, Boolean searches, evidence cards, and candidate discovery workflows.</p>
          </div>
        </div>
      </section>

      <section className="wrap" id="live-jobs">
        <div className="eyebrow">Live source search</div>
        <h2>Search live {category.name.toLowerCase()}.</h2>
        <LiveJobsClient initialQuery={guide.query} initialLocation={guide.location || ''} />
      </section>

      <section className="wrap">
        <div className="grid two">
          <div className="card">
            <span className="kicker">Search strategy</span>
            <h2>How to search smarter.</h2>
            <ul className="muted">
              {guide.tips.map(tip => <li key={tip}>{tip}</li>)}
            </ul>
          </div>
          <div className="card">
            <span className="kicker">Candidate-side tools</span>
            <h2>Use SourcingOS as your edge.</h2>
            <p className="muted">SourcingOS is built for the work behind these roles: market mapping, technical evidence review, source discovery, and recruiter-owned candidate intelligence.</p>
            <Link className="btn secondary" href="/waitlist">Join the private beta →</Link>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="eyebrow">FAQ</div>
        <div className="grid two">
          {faq.map(item => (
            <div className="card" key={item.question}>
              <h3>{item.question}</h3>
              <p className="muted">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
