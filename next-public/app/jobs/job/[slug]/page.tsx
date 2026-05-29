import Link from 'next/link'
import { getJobBySlug, jobs } from '@/data/jobs'

export function generateStaticParams() {
  return jobs.map(job => ({ slug: job.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const job = getJobBySlug(params.slug)
  return {
    title: job ? `${job.title} at ${job.company} | SourcingOS Jobs` : 'SourcingOS Job',
    description: job?.summary ?? 'Curated recruiting and sourcing job from SourcingOS Jobs.'
  }
}

export default function JobDetailPage({ params }: { params: { slug: string } }) {
  const job = getJobBySlug(params.slug)

  if (!job) {
    return <main className="wrap"><h1>Job not found.</h1><Link className="btn" href="/jobs">Back to jobs</Link></main>
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: `${job.summary}\n\n${job.description.join('\n')}`,
    datePosted: job.postedDate,
    validThrough: job.expiresAt,
    employmentType: job.employmentType.toUpperCase().replace('-', '_'),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      sameAs: job.sourceUrl
    },
    jobLocationType: job.remoteType === 'Remote' ? 'TELECOMMUTE' : undefined,
    applicantLocationRequirements: job.remoteType === 'Remote' ? { '@type': 'Country', name: 'United States' } : undefined,
    baseSalary: job.salaryRange
  }

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="wrap hero">
        <div className="eyebrow">{job.remoteType} · {job.employmentType}</div>
        <h1>{job.title}</h1>
        <p className="lead">{job.company} · {job.location} · {job.salaryRange}</p>
        <div className="hero-actions">
          <a className="btn" href={job.applyUrl} target="_blank" rel="noreferrer">Apply / view source</a>
          <Link className="btn secondary" href="/jobs">Back to jobs</Link>
          <Link className="btn ghost" href="/waitlist">Join SourcingOS beta</Link>
        </div>
      </section>
      <section className="wrap grid two">
        <article className="card">
          <span className="kicker">Role summary</span>
          <h2>{job.summary}</h2>
          {job.description.map(item => <p key={item}>{item}</p>)}
          <div className="chips">{job.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
        </article>
        <aside className="card">
          <span className="kicker">Job metadata</span>
          <p><strong>Company:</strong> {job.company}</p>
          <p><strong>Location:</strong> {job.location}</p>
          <p><strong>Remote type:</strong> {job.remoteType}</p>
          <p><strong>Employment:</strong> {job.employmentType}</p>
          <p><strong>Salary:</strong> {job.salaryRange}</p>
          <p><strong>ATS/source:</strong> {job.ats}</p>
          <p><strong>Posted:</strong> {job.postedDate}</p>
          <p><strong>Expires:</strong> {job.expiresAt}</p>
        </aside>
      </section>
      <section className="wrap">
        <div className="card">
          <span className="kicker">SourcingOS connection</span>
          <h2>Use the skills behind this role.</h2>
          <p className="muted">Practice Boolean search, X-Ray search, source-pack design, and candidate evidence workflows inside SourcingOS.</p>
          <div className="hero-actions"><Link className="btn secondary" href="/tools">Open tools</Link><Link className="btn ghost" href="/methods">Explore methods</Link></div>
        </div>
      </section>
    </main>
  )
}
