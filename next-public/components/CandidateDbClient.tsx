'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AddToRoleButton } from '@/components/AddToRoleButton'
import {
  EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT,
  normalizeCandidateWorkspaceSnapshot,
  type CandidateWorkspaceSnapshot,
} from '@/lib/candidate-workspace-normalization'

const sampleResume = `Jordan Rivera
Senior DevSecOps Engineer
Minneapolis, MN | jordan.rivera@example.com | https://github.com/jrivera-platform

Kubernetes, Terraform, AWS GovCloud, FedRAMP, NIST RMF, Python, Linux, security automation.
Built CI/CD controls for regulated cloud environments. Available for contract consulting. Resume updated May 2026.`

function words(value: string) { return value.replaceAll('_', ' ') }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback }
function length(value: unknown) { return Array.isArray(value) ? value.length : 0 }
function number(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function CandidateDbClient() {
  const [snapshot, setSnapshot] = useState<CandidateWorkspaceSnapshot>(EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT)
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [resumeText, setResumeText] = useState(sampleResume)
  const [csvText, setCsvText] = useState('name,title,company,location,email,skills\nTaylor Chen,Technical Sourcer,Acme AI,Remote,taylor@example.com,"AI sourcing, GitHub, Boolean"')
  const [status, setStatus] = useState('Loading Candidate Graph…')
  const [loading, setLoading] = useState(true)

  async function load(offset = 0, search = appliedSearch) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50', offset: String(offset) })
      if (search) params.set('q', search)
      const res = await fetch(`/api/candidate-db/list?${params.toString()}`, { headers: { accept: 'application/json' } })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(text(json?.error, 'Could not load Candidate Graph.'))
      const normalized = normalizeCandidateWorkspaceSnapshot(json)
      setSnapshot(normalized)
      setStatus(normalized.persistence_mode === 'supabase' ? 'Candidate Graph is connected to durable storage.' : 'Preview records are temporary and reset between server restarts.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load Candidate Graph.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load(0, '') }, [])

  async function importResume() {
    setStatus('Importing resume into the Candidate Graph…')
    try {
      const res = await fetch('/api/candidate-db/import-resume', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: resumeText, fileName: 'pasted-resume.txt' }) })
      const json = await res.json()
      const importedName = text(json?.candidate?.canonicalName, 'candidate')
      setStatus(res.ok && json?.ok ? `Imported ${importedName}.` : text(json?.error, 'Resume import failed.'))
      if (res.ok && json?.ok) await load(0, appliedSearch)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Resume import failed.')
    }
  }

  async function importCsv() {
    setStatus('Importing CSV into the Candidate Graph…')
    try {
      const res = await fetch('/api/candidate-db/import-csv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: csvText, fileName: 'pasted-candidates.csv' }) })
      const json = await res.json()
      const recordsCreated = number(json?.recordsCreated)
      setStatus(res.ok && json?.ok ? `Imported ${recordsCreated.toLocaleString()} candidate record${recordsCreated === 1 ? '' : 's'}.` : text(json?.error, 'CSV import failed.'))
      if (res.ok && json?.ok) await load(0, appliedSearch)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'CSV import failed.')
    }
  }

  async function normalizeCandidate() {
    try {
      const res = await fetch('/api/candidate-db/normalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: resumeText, source: 'uploaded_resume' }) })
      const json = await res.json()
      setStatus(res.ok && json?.ok
        ? `Detected ${length(json?.normalized?.skills)} skills, ${length(json?.normalized?.contacts)} contact signals, and ${length(json?.normalized?.openToWorkSignals)} availability signals. Nothing was saved.`
        : text(json?.error, 'Normalization failed.'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Normalization failed.')
    }
  }

  async function createMatchReview() {
    const ids = snapshot.sourceProfiles.slice(0, 2).map(profile => text(profile.id)).filter(Boolean)
    if (ids.length < 2) { setStatus('At least two loaded source profiles are required for a match review.'); return }
    try {
      const res = await fetch('/api/candidate-db/match-review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceProfileIds: ids }) })
      const json = await res.json()
      const score = number(json?.review?.match_score ?? json?.review?.score)
      setStatus(res.ok && json?.ok ? `Created an identity review with score ${score}/100.` : text(json?.error, 'Could not create identity review.'))
      if (res.ok && json?.ok) await load(snapshot.page.offset, appliedSearch)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create identity review.')
    }
  }

  async function decide(reviewId: string, decision: 'confirmed' | 'rejected') {
    try {
      const res = await fetch('/api/candidate-db/confirm-merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewId, decision }) })
      const json = await res.json()
      setStatus(res.ok && json?.ok ? decision === 'confirmed' ? 'Confirmed the identity match.' : 'Kept the source profiles separate.' : text(json?.error, 'Could not save identity decision.'))
      if (res.ok && json?.ok) await load(snapshot.page.offset, appliedSearch)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save identity decision.')
    }
  }

  function search(event: FormEvent) {
    event.preventDefault()
    const next = searchInput.trim()
    setAppliedSearch(next)
    void load(0, next)
  }

  const coverage = useMemo(() => snapshot.counts.candidates ? Math.round((snapshot.counts.evidenceItems / snapshot.counts.candidates) * 10) / 10 : 0, [snapshot.counts])
  const start = snapshot.counts.filteredCandidates ? snapshot.page.offset + 1 : 0
  const end = snapshot.page.offset + snapshot.candidates.length

  return <div className="interactive-tool">
    <div className="product-summary-grid">
      <div className="product-stat"><small>Canonical candidates</small><b>{snapshot.counts.candidates.toLocaleString()}</b><span>Owner-scoped identities</span></div>
      <div className="product-stat"><small>Source profiles</small><b>{snapshot.counts.sourceProfiles.toLocaleString()}</b><span>Provenance preserved</span></div>
      <div className="product-stat"><small>Evidence records</small><b>{snapshot.counts.evidenceItems.toLocaleString()}</b><span>{coverage} per candidate</span></div>
      <div className="product-stat"><small>Identity review</small><b>{snapshot.counts.pendingMatchReviews.toLocaleString()}</b><span>Pending recruiter decisions</span></div>
    </div>

    <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        {!!snapshot.matchReviews.length && <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Needs attention</span><h2>Identity match review</h2></div><span>{snapshot.counts.pendingMatchReviews} pending</span></div>
          <div className="product-list">{snapshot.matchReviews.map(review => <div className="product-row" key={review.id}><div className="product-row-main"><div className="product-row-title">{review.proposedCanonicalName}</div><div className="product-row-meta">Match score {review.score}/100 · {review.reasons.slice(0, 2).join(' · ') || 'Review source-profile identity evidence'}</div>{review.conflicts.length ? <div className="cta" style={{ marginTop: 8, marginBottom: 0 }}>{review.conflicts.join('; ')}</div> : null}</div><div className="product-row-actions"><button className="btn secondary" onClick={() => void decide(review.id, 'rejected')}>Keep separate</button><button className="btn" onClick={() => void decide(review.id, 'confirmed')}>Confirm match</button></div></div>)}</div>
        </section>}

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Candidate Graph</span><h2>Candidates</h2></div><span>{start.toLocaleString()}–{end.toLocaleString()} of {snapshot.counts.filteredCandidates.toLocaleString()}</span></div>
          <form onSubmit={search} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, marginBottom: 14 }}><input className="input" style={{ margin: 0 }} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search name, title, company, or location" /><button className="btn" type="submit">Search</button></form>
          {appliedSearch && <div className="button-row" style={{ marginBottom: 12 }}><span className="status-pill active">Search: {appliedSearch}</span><button className="btn ghost" onClick={() => { setSearchInput(''); setAppliedSearch(''); void load(0, '') }}>Clear</button></div>}
          <div className="product-list">
            {snapshot.candidates.map(candidate => <div className="product-row" key={candidate.id}>
              <div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><div className="product-row-title">{candidate.canonicalName}</div><span className={`status-pill ${candidate.mergeStatus === 'source_verified' || candidate.mergeStatus === 'confirmed' ? 'success' : ''}`}>{words(candidate.mergeStatus)}</span></div><div className="product-row-meta">{[candidate.headline || candidate.currentTitle, candidate.currentCompany, candidate.location].filter(Boolean).join(' · ') || 'Candidate profile'}</div>{candidate.summary && <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '7px 0 0' }}>{candidate.summary.slice(0, 220)}{candidate.summary.length > 220 ? '…' : ''}</p>}<div className="chips">{candidate.skills.slice(0, 6).map(skill => <span className="tag" key={skill}>{skill}</span>)}<span className="tag">{candidate.sourceProfileIds.length} source{candidate.sourceProfileIds.length === 1 ? '' : 's'}</span><span className="tag">{candidate.evidenceItemIds.length} evidence</span></div></div>
              <div className="product-row-actions"><Link className="btn ghost" href={`/app/candidate/${candidate.id}`}>Open 360</Link><AddToRoleButton candidate={{ candidateId: candidate.id, name: candidate.canonicalName, headline: candidate.headline, company: candidate.currentCompany, location: candidate.location, source: 'candidate_database', contactStatus: candidate.contactSignalIds.length ? 'signals_found' : 'unknown', evidenceStatus: candidate.evidenceItemIds.length ? 'reviewed' : 'unreviewed', tags: candidate.skills }} /></div>
            </div>)}
            {!loading && !snapshot.candidates.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No matching candidates</div><div className="product-row-meta">Try a broader search or import an authorized candidate file.</div></div></div>}
            {loading && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Loading candidates…</div><div className="product-row-meta">Reading the owner-scoped Candidate Graph.</div></div></div>}
          </div>
          <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 14 }}><button className="btn secondary" disabled={snapshot.page.offset === 0 || loading} onClick={() => void load(Math.max(0, snapshot.page.offset - snapshot.page.limit), appliedSearch)}>Previous</button><button className="btn secondary" disabled={!snapshot.page.hasMore || loading} onClick={() => void load(snapshot.page.offset + snapshot.page.limit, appliedSearch)}>Next</button></div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Graph health</h2><span className={`status-pill ${snapshot.persistence_mode === 'supabase' ? 'success' : 'warning'}`}>{snapshot.persistence_mode === 'supabase' ? 'durable' : 'preview'}</span></div><div className="product-list"><div className="product-row"><div className="product-row-main"><div className="product-row-title">Contact signals</div><div className="product-row-meta">Unverified until recruiter confirmation</div></div><b>{snapshot.counts.contactSignals.toLocaleString()}</b></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Availability signals</div><div className="product-row-meta">Signals, never verified job-seeking claims</div></div><b>{snapshot.counts.openToWorkSignals.toLocaleString()}</b></div></div><Link className="btn secondary" style={{ marginTop: 14 }} href="/app/evidence-ledger">Open Evidence Ledger</Link></section>

        <details className="advanced-disclosure product-panel">
          <summary>Import authorized candidate data</summary>
          <div style={{ marginTop: 14 }}><span className="kicker">Resume or profile text</span><textarea className="textarea big" value={resumeText} onChange={event => setResumeText(event.target.value)} /><div className="button-row"><button className="btn" onClick={() => void importResume()}>Import resume</button><button className="btn secondary" onClick={() => void normalizeCandidate()}>Preview extraction</button></div><div className="sidebar-divider" style={{ margin: '18px 0' }} /><span className="kicker">CSV paste import</span><textarea className="textarea big" value={csvText} onChange={event => setCsvText(event.target.value)} /><button className="btn" onClick={() => void importCsv()}>Import CSV</button><p className="muted" style={{ fontSize: 10, lineHeight: 1.5 }}>Use only data you are authorized to store. Production imports are owner-scoped and durable; preview imports reset between server restarts.</p></div>
        </details>

        <details className="advanced-disclosure product-panel">
          <summary>Identity tools and recent imports</summary>
          <div style={{ marginTop: 14 }}><button className="btn secondary" onClick={() => void createMatchReview()}>Compare first two loaded source profiles</button><div className="product-list" style={{ marginTop: 14 }}>{snapshot.importBatches.slice(0, 8).map(batch => <div className="product-row" key={batch.id}><div className="product-row-main"><div className="product-row-title">{batch.fileName || words(batch.importType)}</div><div className="product-row-meta">{batch.recordsCreated.toLocaleString()} created from {batch.rowsSeen.toLocaleString()} row{batch.rowsSeen === 1 ? '' : 's'}</div></div></div>)}</div></div>
        </details>
      </aside>
    </div>
    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{status}</p>
  </div>
}
