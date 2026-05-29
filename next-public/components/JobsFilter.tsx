'use client'

import { useMemo, useState } from 'react'
import { JobCard } from './JobCard'
import type { JobListing } from '@/data/jobs'

export function JobsFilter({ jobs }: { jobs: JobListing[] }) {
  const [query, setQuery] = useState('')
  const [remoteType, setRemoteType] = useState('All')
  const [category, setCategory] = useState('All')

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return jobs.filter(job => {
      const haystack = [job.title, job.company, job.location, job.category, job.specialty.join(' '), job.tags.join(' '), job.summary].join(' ').toLowerCase()
      const matchesQuery = !q || haystack.includes(q)
      const matchesRemote = remoteType === 'All' || job.remoteType === remoteType
      const matchesCategory = category === 'All' || job.category === category
      return matchesQuery && matchesRemote && matchesCategory
    })
  }, [jobs, query, remoteType, category])

  const categories = Array.from(new Set(jobs.map(job => job.category)))

  return (
    <div className="jobs-layout">
      <aside className="filter-panel">
        <h3>Filter jobs</h3>
        <label>Search</label>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="sourcer technical AI" />
        <label>Remote type</label>
        <select value={remoteType} onChange={event => setRemoteType(event.target.value)}>
          <option>All</option>
          <option>Remote</option>
          <option>Hybrid</option>
          <option>Onsite</option>
        </select>
        <label>Category</label>
        <select value={category} onChange={event => setCategory(event.target.value)}>
          <option>All</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat.replaceAll('-', ' ')}</option>)}
        </select>
        <div className="chips">
          <button className="chip" onClick={() => setQuery('technical sourcer')}>Technical sourcer</button>
          <button className="chip" onClick={() => setQuery('GovCon cleared')}>GovCon</button>
          <button className="chip" onClick={() => setQuery('healthcare nursing')}>Healthcare</button>
          <button className="chip" onClick={() => setQuery('AI ML')}>AI/ML</button>
        </div>
      </aside>
      <section className="job-list">
        <p className="muted">Showing {filtered.length} curated roles.</p>
        {filtered.map(job => <JobCard job={job} key={job.slug} />)}
      </section>
    </div>
  )
}
