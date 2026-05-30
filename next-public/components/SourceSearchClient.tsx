'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CandidateGraphProfile, identityMatchScore } from '@/lib/candidate-graph'
import { allSourceNames, SourceResult, sourceGroups, sourceLabels, SourceName } from '@/lib/source-types'

type ApiResponse = {
  ok: boolean
  results: SourceResult[]
  candidateGraph: CandidateGraphProfile[]
  warnings: string[]
  guardrails?: string[]
  generatedAt: string
  error?: string
}

type QueueResponse = { ok: boolean; candidates: CandidateGraphProfile[]; due: CandidateGraphProfile[]; events: { id: string; type: string; detail: string; at: string }[] }

const presets = [
  { label: 'Cleared DevSecOps', query: 'DevSecOps Kubernetes Terraform AWS GovCloud', location: 'Virginia', sources: sourceGroups.technical.concat(['openalex']) },
  { label: 'Cyber RMF', query: 'ISSO RMF NIST Security+', location: 'Maryland', sources: ['github', 'stackoverflow', 'npi'] as SourceName[] },
  { label: 'AI ML Research', query: 'retrieval augmented generation embeddings NLP', location: '', sources: sourceGroups.ai },
  { label: 'RN Healthcare', query: 'Registered Nurse ICU', location: 'Minnesota', sources: sourceGroups.healthcare },
  { label: 'Clinical Research', query: 'clinical trials oncology principal investigator', location: '', sources: ['pubmed', 'openalex', 'semantic_scholar', 'orcid'] as SourceName[] }
]

export function SourceSearchClient() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || 'DevSecOps Kubernetes Terraform AWS GovCloud'
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState('Virginia')
  const [sources, setSources] = useState<SourceName[]>(['github','stackoverflow','openalex'])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [queue, setQueue] = useState<QueueResponse | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [notice, setNotice] = useState('')

  const selectedResults = useMemo(() => (data?.results || []).filter(r => selected.includes(r.id)), [data, selected])
  const pairScores = useMemo(() => {
    const pairs: { a: SourceResult; b: SourceResult; score: number; reasons: string[]; status: string }[] = []
    for (let i = 0; i < selectedResults.length; i++) for (let j = i + 1; j < selectedResults.length; j++) {
      const m = identityMatchScore(selectedResults[i], selectedResults[j])
      pairs.push({ a: selectedResults[i], b: selectedResults[j], ...m })
    }
    return pairs.sort((a, b) => b.score - a.score)
  }, [selectedResults])

  async function refreshQueue() {
    const res = await fetch('/api/candidates/list')
    const json = await res.json()
    setQueue(json)
  }

  useEffect(() => { refreshQueue().catch(() => undefined) }, [])

  async function runSearch() {
    setLoading(true)
    setData(null)
    setNotice('')
    try {
      const res = await fetch('/api/sources/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, location, sources, limit: 5, buildGraph: true })
      })
      const json = await res.json()
      setData(json)
      setSelected([])
    } finally {
      setLoading(false)
    }
  }

  async function refreshCandidate(profile: CandidateGraphProfile) {
    setLoading(true)
    try {
      const res = await fetch('/api/candidates/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidateId: profile.id, sources: profile.refreshPolicy.sourceNames })
      })
      const json = await res.json()
      if (json.ok) setNotice(`Checked for profile updates for ${json.candidate.canonicalName}`)
      else setNotice(json.error || 'Profile update check failed')
      await refreshQueue()
    } finally {
      setLoading(false)
    }
  }

  async function saveGraph() {
    if (!data?.candidateGraph?.length) return
    const res = await fetch('/api/candidates/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateGraph: data.candidateGraph })
    })
    const json = await res.json()
    if (json.ok) setNotice(`Saved ${json.savedCount} candidate research profile(s) for review.`)
    else setNotice(json.error || 'Save failed')
    await refreshQueue()
  }

  async function scheduledRefresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/candidates/scheduled-refresh', { method: 'POST' })
      const json = await res.json()
      if (json.ok) setNotice(`Checked saved profiles for updates. Updated ${json.refreshed.length} candidate record(s).`)
      else setNotice(json.error || 'Update check failed')
      await refreshQueue()
    } finally {
      setLoading(false)
    }
  }

  async function decideMerge(profile: CandidateGraphProfile, decision: 'confirmed' | 'rejected') {
    const ids = profile.sourceProfiles.map(p => p.id)
    const res = await fetch('/api/candidates/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateId: profile.id, sourceProfileIds: ids, decision, decidedBy: 'preview-recruiter' })
    })
    const json = await res.json()
    setNotice(json.ok ? `${decision === 'confirmed' ? 'Confirmed' : 'Rejected'} source-profile match for ${profile.canonicalName}` : json.error || 'Merge decision failed')
    await refreshQueue()
  }

  function toggleSource(source: SourceName) {
    setSources(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source])
  }
  function toggleSelected(id: string) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function exportGraph() {
    const payload = JSON.stringify({ query, location, selectedResults, candidateGraph: data?.candidateGraph || [], savedCandidates: queue?.candidates || [], exportedAt: new Date().toISOString() }, null, 2)
    navigator.clipboard.writeText(payload)
    setNotice('Candidate evidence JSON copied to clipboard')
  }

  return <div className="interactive-tool">
    <div className="cta"><b>How this works:</b> search public evidence sources, review source profiles separately, compare identity signals, and confirm matches manually. SourcingOS does not silently merge people.</div>
    <div className="grid two">
      <div>
        <label>Search query</label>
        <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="DevSecOps Kubernetes Terraform" />
      </div>
      <div>
        <label>Location or market</label>
        <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Virginia, Minnesota, Remote" />
      </div>
    </div>
    <div className="button-row">
      {presets.map(p => <button key={p.label} onClick={() => { setQuery(p.query); setLocation(p.location); setSources(Array.from(new Set(p.sources))) }}>{p.label}</button>)}
    </div>
    <div className="mode-row">
      {allSourceNames.map(s => <button className={sources.includes(s) ? 'active' : ''} key={s} onClick={() => toggleSource(s)}>{sourceLabels[s]}</button>)}
    </div>
    <div className="button-row">
      <button className="btn" onClick={runSearch} disabled={loading}>{loading ? 'Searching...' : 'Search public evidence'}</button>
      <button className="btn secondary" onClick={scheduledRefresh} disabled={loading}>Check saved profiles for updates</button>
    </div>
    {notice ? <div className="cta"><b>{notice}</b></div> : null}
    {data?.warnings?.length ? <div className="cta"><b>Search notes</b><ul>{data.warnings.map(w => <li key={w}>{w}</li>)}</ul></div> : null}
    {data?.guardrails?.length ? <div className="cta"><b>Responsible-use guardrails</b><ul>{data.guardrails.map(g => <li key={g}>{g}</li>)}</ul></div> : null}

    {data?.results?.length ? <section><h2>Source profiles</h2><p className="muted">Each result stays separate until a recruiter reviews identity signals. Public evidence is not identity verification.</p><div className="results">{data.results.map(r => <div className="result-card" key={r.id}>
      <div className="result-head"><span>{sourceLabels[r.source]}</span><span>{r.evidence.length} evidence items · {r.contactSignals.length} contact signals</span></div>
      <h3>{r.displayName}</h3><p className="muted">{r.headline}</p>
      {r.location ? <p><b>Location:</b> {r.location}</p> : null}
      {r.organization ? <p><b>Org:</b> {r.organization}</p> : null}
      {r.profileUrl ? <p><a className="kicker" href={r.profileUrl} target="_blank">Open source profile</a></p> : null}
      <div className="button-row"><button onClick={() => toggleSelected(r.id)}>{selected.includes(r.id) ? 'Selected for identity review' : 'Select for identity review'}</button></div>
      <ul>{r.evidence.slice(0, 3).map(e => <li key={e.id}>{e.label}: {e.detail}</li>)}</ul>
    </div>)}</div></section> : null}

    {pairScores.length ? <section><h2>Identity match review</h2><div className="results">{pairScores.map(p => <div className="result-card" key={`${p.a.id}-${p.b.id}`}><div className="result-head"><span>{p.status}</span><span>{p.score}/100</span></div><h3>{p.a.displayName} ↔ {p.b.displayName}</h3><p className="muted">Recruiter must confirm before any source profiles are treated as the same person.</p><ul>{p.reasons.map(r => <li key={r}>{r}</li>)}</ul></div>)}</div></section> : null}

    {data?.candidateGraph?.length ? <section><h2>Candidate evidence preview</h2><p className="muted">SourcingOS groups evidence into candidate research records while keeping source profiles, match reasons, and refresh timestamps visible.</p><div className="results">{data.candidateGraph.map(c => <div className="result-card" key={c.id}><div className="result-head"><span>{c.status}</span><span>{c.matchScore}/100 max match</span></div><h3>{c.canonicalName}</h3><p className="muted">{c.sourceProfiles.length} source profile(s), {c.evidenceCount} evidence items, {c.contactSignalCount} contact signals.</p><p><b>Next update check:</b> {new Date(c.nextRefreshAt).toLocaleString()}</p><ul>{c.sourceProfiles.map(sp => <li key={sp.id}>{sourceLabels[sp.source]}: {sp.profileUrl || sp.sourceProfileId}</li>)}</ul></div>)}</div><div className="button-row"><button className="btn" onClick={saveGraph}>Save for review</button><button className="btn secondary" onClick={exportGraph}>Copy evidence JSON</button></div></section> : null}

    <section>
      <h2>Your candidate research list</h2>
      <p className="muted">Saved profiles are available for this preview session. Production persistence is designed for Supabase/Postgres.</p>
      {queue?.candidates?.length ? <div className="results">{queue.candidates.map(c => <div className="result-card" key={c.id}><div className="result-head"><span>{c.status}</span><span>{c.sourceProfiles.length} source(s)</span></div><h3>{c.canonicalName}</h3><p className="muted">Last checked {new Date(c.lastRefreshedAt).toLocaleString()} · next check {new Date(c.nextRefreshAt).toLocaleString()}</p><div className="button-row"><button onClick={() => refreshCandidate(c)}>Check for updates</button><button onClick={() => decideMerge(c, 'confirmed')}>Confirm match</button><button onClick={() => decideMerge(c, 'rejected')}>Keep separate</button></div></div>)}</div> : <p className="muted">No saved profiles yet. Search public evidence, review source profiles, then save a candidate research record.</p>}
      {queue?.events?.length ? <div className="cta"><b>Recent research events</b><ul>{queue.events.slice(0, 6).map(e => <li key={e.id}>{e.type}: {e.detail}</li>)}</ul></div> : null}
    </section>
  </div>
}
