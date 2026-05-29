import Link from 'next/link'
import type { JobListing } from '@/data/jobs'

export function JobCard({ job }: { job: JobListing }) {
  return (
    <article className={`card ${job.featured ? 'featured' : ''}`}>
      <div className="job-row">
        <div>
          <div className="eyebrow">{job.remoteType} · {job.employmentType}</div>
          <h3><Link href={`/jobs/job/${job.slug}`}>{job.title}</Link></h3>
          <p className="muted"><strong>{job.company}</strong> · {job.location} · {job.ats}</p>
          <p>{job.summary}</p>
          <div className="chips">
            {job.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}
          </div>
        </div>
        <aside className="job-side">
          <div className="salary">{job.salaryRange}</div>
          <Link className="btn secondary" href={`/jobs/job/${job.slug}`}>View role</Link>
        </aside>
      </div>
    </article>
  )
}
