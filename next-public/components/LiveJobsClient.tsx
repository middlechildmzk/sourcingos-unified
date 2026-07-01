'use client'
import { useEffect, useMemo, useState } from 'react'

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

const sourceOptions = [
  { id: 'persisted', label: 'SourcingOS reviewed/cache layer' },
  { id: 'ats', label: 'Curated company ATS feeds' },
  { id: 'remotive', label: 'Remotive' },
  { id: 'arbeitnow', label: 'Arbeitnow' },
  { id: 'usajobs', label: 'USAJOBS' },
]

const presets = [
  'remote recruiter',
  'technical sourcer',
  'talent acquisition partner',
  'recruiting operations',
  'healthcare recruiter',
  'cleared recruiter',
  'AI recruiter',
  'contract recruiter',
]

export function LiveJobsClient({
  initialQuery = 'recruiter sourcer talent acquisition',
  initialLocation = '',
}: {
  initialQuery?: string
  initialLocation?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState(initialLocation)
  const [jobs, setJobs] = useState<LiveJob[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [sources, setSources] = useState<Record<string, boolean>>({ persisted: true, ats: true, remotive: true, arbeitnow: true, usajobs: true })
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [salaryOnly, setSalaryOnly] = useState(false)

  const activeSources = useMemo(() => sourceOptions.filter(s => sources[s.id]).map(s => s.id), [sources])
  const visibleJobs = useMemo(() => jobs.filter(job => {
    if (remoteOnly && !`${job.remoteType} ${job.location}`.toLowerCase().includes('remote')) return false
    if (salaryOnly && (!job.salaryRange || job.salaryRange.toLowerCase().includes('not listed'))) return false
    return true
  }), [jobs, remoteOnly, salaryOnly])

  async function searchJobs(nextQuery = query) {
    const selected = activeSources.length ? activeSources : ['persisted', 'ats', 'remotive', 'arbeitnow', 'usajobs']
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams({
        q: nextQuery,
        location,
        sources: selected.join(','),
        remoteOnly: remoteOnly ? 'true' : 'false',
        salaryOnly: salaryOnly ? 'true' : 'false',
        limit: '150',
      })
      const res = await fetch(`/api/jobs/search?${params.toString()}`)
      const json = await res.json()
      const nextJobs = Array.isArray(json.jobs) ? json.jobs : []
      setJobs(nextJobs)
      setMessage(nextJobs.length ? `Found ${nextJobs.length} listings from selected sources. Always confirm details on the original source.` : 'No recruiter listings returned from the selected sources for this query. Try a broader search like recruiter, sourcer, or talent acquisition.')
    } catch {
      setMessage('Live job search is temporarily unavailable. The curated category pages are still available.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { searchJobs().catch(() => undefined) }, [])

  return <div className="interactive-tool">
    <div className="cta"><b>Job source note:</b> this search combines SourcingOS-reviewed jobs when available, public/free job sources, and curated employer ATS feeds. Apply buttons link back to the original posting. SourcingOS does not copy third-party job descriptions or present them as owned listings.</div>

    <div className="chips" style={{ marginBottom: '12px' }}>
      {presets.map(preset => <button
        type="button"
        className="tag"
        key={preset}
        onClick={() => { setQuery(preset); searchJobs(preset).catch(() => undefined) }}
        style={{ cursor: 'pointer' }}
      >{preset}</button>)}
    </div>

    <div className="grid two">
      <div><label>Search</label><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="technical sourcer remote" /></div>
      <div><label>Location</label><input className="input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Remote, United States, Minnesota" /></div>
    </div>

    <div className="card" style={{ marginTop: '12px' }}>
      <span className="kicker">Sources and filters</span>
      <div className="chips" style={{ marginTop: '8px' }}>
        {sourceOptions.map(source => <button
          type="button"
          className="tag"
          key={source.id}
          onClick={() => setSources(prev => ({ ...prev, [source.id]: !prev[source.id] }))}
          style={{ cursor: 'pointer', opacity: sources[source.id] ? 1 : 0.48 }}
        >{sources[source.id] ? '✓ ' : ''}{source.label}</button>)}
        <button type="button" className="tag" onClick={() => setRemoteOnly(v => !v)} style={{ cursor: 'pointer', opacity: remoteOnly ? 1 : 0.48 }}>{remoteOnly ? '✓ ' : ''}Remote only</button>
        <button type="button" className="tag" onClick={() => setSalaryOnly(v => !v)} style={{ cursor: 'pointer', opacity: salaryOnly ? 1 : 0.48 }}>{salaryOnly ? '✓ ' : ''}Salary listed</button>
      </div>
    </div>

    <div className="button-row"><button className="btn" onClick={() => searchJobs()} disabled={loading}>{loading ? 'Searching...' : 'Search job sources'}</button></div>
    {message ? <div className="cta">{message}{visibleJobs.length !== jobs.length ? ` Showing ${visibleJobs.length} after filters.` : ''}</div> : null}

    <div className="job-list">
      {visibleJobs.map(job => <article className="card" key={job.id}>
        <div className="job-row">
          <div>
            <span className="kicker">{job.source} · {job.remoteType}</span>
            <h3>{job.title}</h3>
            <p className="muted"><strong>{job.company}</strong> · {job.location || 'Location not listed'} · {job.employmentType}</p>
            <p>{job.description || 'View the original posting for full job details.'}</p>
            <div className="chips">{job.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
          </div>
          <aside className="job-side">
            <div className="salary">{job.salaryRange || 'Not listed'}</div>
            <a className="btn secondary" href={job.applyUrl} target="_blank" rel="noreferrer">View source</a>
          </aside>
        </div>
      </article>)}
    </div>
  </div>
}
