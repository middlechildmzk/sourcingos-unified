'use client'

import { useMemo, useState } from 'react'

const jobs = [
  { id: 'identity', label: 'Identity discovery', note: 'Find that a person exists and may fit the work.' },
  { id: 'history', label: 'Professional history', note: 'Understand roles, employers, scope, and chronology.' },
  { id: 'technical', label: 'Technical evidence', note: 'Find public proof of capability beyond profile claims.' },
  { id: 'academic', label: 'Academic / research evidence', note: 'Find papers, patents, citations, theses, and research context.' },
  { id: 'contact', label: 'Contact discovery', note: 'Find an appropriate professional route to reach someone.' },
  { id: 'messaging', label: 'Messaging & delivery', note: 'Actually deliver outreach and manage replies.' },
  { id: 'memory', label: 'Project memory', note: 'Preserve searches, decisions, notes, status, and source history.' },
  { id: 'mapping', label: 'Market mapping', note: 'Understand companies, locations, skills, and talent-pool shape.' },
]

type State = Record<string, { weekly: boolean; outside: boolean }>

const initial: State = Object.fromEntries(jobs.map(job => [job.id, { weekly: false, outside: false }]))

export function SourceStackCoverageClient() {
  const [state, setState] = useState<State>(initial)

  const summary = useMemo(() => {
    const weekly = jobs.filter(job => state[job.id].weekly)
    const covered = weekly.filter(job => state[job.id].outside)
    const gaps = weekly.filter(job => !state[job.id].outside)
    return { weekly, covered, gaps }
  }, [state])

  const toggle = (id: string, field: 'weekly' | 'outside') => {
    setState(prev => ({ ...prev, [id]: { ...prev[id], [field]: !prev[id][field] } }))
  }

  return <div>
    <div className="preview-banner" style={{ marginBottom: 18 }}>
      <span className="pb-icon">◈</span>
      <span><strong>Decision rule:</strong> do not start with “what replaces LinkedIn Recruiter?” Start with the jobs your team actually depends on, then identify what would become uncovered.</span>
    </div>

    <div className="stack" style={{ display: 'grid', gap: 12 }}>
      {jobs.map(job => {
        const item = state[job.id]
        return <div className="card" key={job.id} style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.5fr) 1fr 1fr', gap: 16, alignItems: 'center' }}>
            <div><strong>{job.label}</strong><div className="muted" style={{ marginTop: 4 }}>{job.note}</div></div>
            <label style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={item.weekly} onChange={() => toggle(job.id, 'weekly')} /> We need this weekly</label>
            <label style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={item.outside} onChange={() => toggle(job.id, 'outside')} /> Covered outside LinkedIn</label>
          </div>
        </div>
      })}
    </div>

    <div className="grid three" style={{ marginTop: 20 }}>
      <div className="card"><span className="kicker">Weekly dependencies</span><div className="big-number">{summary.weekly.length}</div><p className="muted">Jobs your team says it uses every week.</p></div>
      <div className="card"><span className="kicker">Covered elsewhere</span><div className="big-number">{summary.covered.length}</div><p className="muted">Weekly jobs with an existing non-LinkedIn workflow.</p></div>
      <div className="card"><span className="kicker">Coverage gaps</span><div className="big-number">{summary.gaps.length}</div><p className="muted">Dependencies that would need a tested replacement before changing seats.</p></div>
    </div>

    <div className="cta" style={{ marginTop: 22 }}>
      {summary.weekly.length === 0 ? <><strong>Start by observing actual use.</strong> Ask your most active sourcers which jobs they use weekly, then mark them above.</> : summary.gaps.length === 0 ? <><strong>You have no self-reported coverage gaps.</strong> That does not prove you should cancel. It means you have a reasonable basis for a controlled workflow and cost comparison before renewal.</> : <><strong>Do not change the seat yet.</strong> Your current self-assessment shows uncovered dependencies: {summary.gaps.map(job => job.label).join(', ')}. Test those workflows first.</>}
    </div>

    <p className="muted" style={{ marginTop: 12 }}>This worksheet does not estimate legal compliance, data quality, reply rate, candidate coverage, or total cost. Those need real workflow tests on your reqs.</p>
  </div>
}
