'use client'
import { useEffect, useState } from 'react'

type LiveJob = {
  id: string
  title: string
  company: string
  location: string
  remoteType: string
  employmentType: string
  salaryRange: string
  source: string
  applyUrl: string
  postedDate: string
  description: string
  tags: string[]
}

export function LiveJobsClient({ initialQuery = 'recruiter sourcer talent acquisition' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState('')
  const [jobs, setJobs] = useState<LiveJob[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function searchJobs() {
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams({ q: query, location })
      const res = await fetch(`/api/jobs/search?${params.toString()}`)
      const json = await res.json()
      setJobs(json.jobs || [])
      setMessage(json.jobs?.length ? `Found ${json.jobs.length} live listings from public/free job sources.` : 'No live recruiter listings returned from the free sources for this query. Try a broader search like recruiter, sourcer, or talent acquisition.')
    } catch {
      setMessage('Live job search is temporarily unavailable. The curated category pages are still available.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { searchJobs().catch(() => undefined) }, [])

  return <div className="interactive-tool">
    <div className="cta"><b>Live job source note:</b> Google Jobs does not provide a simple free public pull API for job-board aggregation. This search uses free/public sources where available and links back to the original posting source. SourcingOS does not copy or host third-party job descriptions as its own.</div>
    <div className="grid two">
      <div><label>Search</label><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="technical sourcer remote" /></div>
      <div><label>Location</label><input className="input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Remote, United States, Minnesota" /></div>
    </div>
    <div className="button-row"><button className="btn" onClick={searchJobs} disabled={loading}>{loading ? 'Searching...' : 'Search live job sources'}</button></div>
    {message ? <div className="cta">{message}</div> : null}
    <div className="job-list">
      {jobs.map(job => <article className="card" key={job.id}>
        <div className="job-row">
          <div>
            <span className="kicker">{job.source} · {job.remoteType}</span>
            <h3>{job.title}</h3>
            <p className="muted"><strong>{job.company}</strong> · {job.location} · {job.employmentType}</p>
            <p>{job.description || 'View the original posting for full job details.'}</p>
            <div className="chips">{job.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
          </div>
          <aside className="job-side">
            <div className="salary">{job.salaryRange}</div>
            <a className="btn secondary" href={job.applyUrl} target="_blank" rel="noreferrer">View source</a>
          </aside>
        </div>
      </article>)}
    </div>
  </div>
}
