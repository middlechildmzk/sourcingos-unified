import Link from 'next/link'
import { JobCard } from '@/components/JobCard'
import { getCategoryBySlug, jobCategories, jobsForCategory } from '@/data/jobs'

export function generateStaticParams() {
  return jobCategories.map(category => ({ category: category.slug }))
}

export function generateMetadata({ params }: { params: { category: string } }) {
  const category = getCategoryBySlug(params.category)
  return {
    title: category?.seoTitle ?? 'SourcingOS Jobs',
    description: category?.seoDescription ?? 'Curated recruiting and sourcing jobs from SourcingOS.'
  }
}

export default function JobCategoryPage({ params }: { params: { category: string } }) {
  const category = getCategoryBySlug(params.category)
  const categoryJobs = jobsForCategory(params.category)

  if (!category) {
    return <main className="wrap"><h1>Job category not found.</h1><Link className="btn" href="/jobs">Back to jobs</Link></main>
  }

  return (
    <main>
      <section className="wrap hero">
        <div className="eyebrow">SourcingOS Jobs</div>
        <h1>{category.name}</h1>
        <p className="lead">{category.description}</p>
        <div className="hero-actions">
          <Link className="btn" href="/jobs">All jobs</Link>
          <Link className="btn secondary" href="/tools">Use SourcingOS tools</Link>
          <Link className="btn ghost" href="/waitlist">Join beta</Link>
        </div>
      </section>
      <section className="wrap">
        <h2>Open roles</h2>
        <div className="job-list">
          {categoryJobs.length ? categoryJobs.map(job => <JobCard job={job} key={job.slug} />) : <div className="card"><h3>No active seed roles yet.</h3><p className="muted">This category is ready for curated listings and employer submissions.</p></div>}
        </div>
      </section>
      <section className="wrap">
        <div className="card">
          <span className="kicker">Career resource</span>
          <h2>Build the skills for these roles</h2>
          <p className="muted">SourcingOS connects recruiter career pages with practical tools, methods, Boolean strings, X-Ray launchers, and source-pack workflows.</p>
          <Link className="btn secondary" href="/methods">Explore sourcing methods</Link>
        </div>
      </section>
    </main>
  )
}
