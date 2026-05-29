'use client'
import { useEffect, useState } from 'react'

type Dossier = any

export function Candidate360Client({ candidateId }: { candidateId: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [status, setStatus] = useState('')
  async function load() {
    const res = await fetch(`/api/candidate-db/360/${candidateId}`)
    const json = await res.json()
    setDossier(json.ok ? json.dossier : null)
    if (!json.ok) setStatus(json.error || 'Candidate not found')
  }
  useEffect(() => { load().catch(() => undefined) }, [candidateId])
  async function refresh() {
    setStatus('Checking source freshness...')
    const res = await fetch('/api/candidate-db/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ candidateId }) })
    const json = await res.json()
    setStatus(json.ok ? json.note : json.error || 'Refresh failed')
    await load()
  }
  if (!dossier) return <div className="interactive-tool"><div className="cta">{status || 'Loading Candidate 360...'}</div></div>
  const c = dossier.candidate
  return <div className="interactive-tool">
    <div className="result-head"><span>{dossier.freshness.label} · {dossier.freshness.days} days</span><span>{c.mergeStatus}</span></div>
    <h2>{c.canonicalName}</h2>
    <p className="lead">{c.headline}{c.location ? ` · ${c.location}` : ''}</p>
    <p>{c.summary}</p>
    <div className="button-row"><button className="btn" onClick={refresh}>Check source freshness</button></div>
    {status ? <div className="cta">{status}</div> : null}
    <div className="grid">
      <div className="card"><span className="kicker">Evidence</span><div className="big-number">{dossier.evidence.length}</div><p className="muted">Score {dossier.scores.evidenceScore}/100</p></div>
      <div className="card"><span className="kicker">Sources</span><div className="big-number">{dossier.sourceProfiles.length}</div></div>
      <div className="card"><span className="kicker">Contact</span><div className="big-number">{dossier.scores.bestContactScore}</div><p className="muted">Unverified until confirmed</p></div>
      <div className="card"><span className="kicker">Open-to-work</span><div className="big-number">{dossier.scores.openToWorkScore}</div><p className="muted">Signals require review</p></div>
    </div>
    <section><h2>Source profiles</h2><div className="results">{dossier.sourceProfiles.map((p:any)=><div className="result-card" key={p.id}><div className="result-head"><span>{p.source}</span><span>{p.status}</span></div><h3>{p.displayName}</h3><p className="muted">{p.headline} {p.organization ? `· ${p.organization}` : ''}</p>{p.profileUrl ? <a className="kicker" href={p.profileUrl} target="_blank" rel="noreferrer">Open source profile</a> : null}<ul>{p.matchReasons?.map((r:string)=><li key={r}>{r}</li>)}</ul></div>)}</div></section>
    <section><h2>Evidence matrix</h2><div className="results">{dossier.evidence.map((e:any)=><div className="result-card" key={e.id}><div className="result-head"><span>{e.source}</span><span>{e.confidence}</span></div><h3>{e.label}</h3><p>{e.detail}</p>{e.url ? <a className="kicker" href={e.url} target="_blank" rel="noreferrer">Open evidence</a> : null}</div>)}</div></section>
    <section><h2>Contact signals</h2><div className="results">{dossier.contacts.map((ct:any)=><div className="result-card" key={ct.id}><div className="result-head"><span>{ct.type}</span><span>{ct.score}/100</span></div><h3>{ct.value}</h3><p className="muted">Source: {ct.source} · Verified: {String(ct.verified)} · Permission: {ct.permissionStatus}</p></div>)}</div></section>
    <section><h2>Open-to-work signals</h2><div className="results">{dossier.openToWorkSignals.map((s:any)=><div className="result-card" key={s.id}><div className="result-head"><span>{s.confidence}</span><span>{s.score}/100</span></div><h3>{s.label}</h3><p>{s.detail}</p><p className="muted">Requires recruiter review: {String(s.requiresReview)}</p></div>)}</div></section>
    <section><h2>Verify next</h2><div className="card"><ul>{dossier.verifyNext.map((v:string)=><li key={v}>{v}</li>)}</ul></div></section>
  </div>
}
