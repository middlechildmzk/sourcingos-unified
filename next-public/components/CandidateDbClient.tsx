'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
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

  const load = useCallback(async (offset = 0, search = '') => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50', offset: String(offset) })
      if (search) params.set('q', search)
      const response = await fetch(`/api/candidate-db/list?${params.toString()}`, { headers: { accept: 'application/json' } })
      const json = await response.json()
      if (!response.ok || !json?.ok) throw new Error(text(json?.error, 'Could not load Candidate Graph.'))
      const normalized = normalizeCandidateWorkspaceSnapshot(json)
      setSnapshot(normalized)
      setStatus(normalized.persistence_mode === 'supabase' ? 'Candidate Graph is connected to durable storage.' : 'Preview records are temporary and reset between server restarts.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load Candidate Graph.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(0, '') }, [load])

  async function importResume() {
    setStatus('Importing resume into the Candidate Graph…')
    try {
      const response = await fetch('/api/candidate-db/import-resume', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: resumeText, fileName: 'pasted-resume.txt' }) })
      const json = await response.json()
      const importedName = text(json?.candidate?.canonicalName, 'candidate')
      setStatus(response.ok && json?.ok ? `Imported ${importedName}.` : text(json?.error, 'Resume import failed.'))
      if (response.ok && json?.ok) await load(0, appliedSearch)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Resume import failed.')
    }
  }

  async function importCsv() {
    setStatus('Importing CSV into the Candidate Graph…')
    try {
      const response = await fetch('/api/candidate-db/import-csv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: csvText, fileName: 'pasted-candidates.csv' }) })
      const json = await response.json()
      const recordsCreated = number(json?.recordsCreated)
      setStatus(response.ok && json?.ok ? `Imported ${recordsCreated.toLocaleString()} candidate record${recordsCreated === 1 ? '' : 's'}.` : text(json?.error, 'CSV import failed.'))
      if (response.ok && json?.ok) await load(0, appliedSearch)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'CSV import failed.')
    }
  }

  async function normalizeCandidate() {
    try {
      const response = await fetch('/api/candidate-db/normalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: resumeText, source: 'uploaded_resume' }) })
      const json = await response.json()
      setStatus(response.ok && json?.ok
        ? `Detected ${length(json?.normalized?.skills)} skills, ${length(json?.normalized?.contacts)} contact signals, and ${length(json?.normalized?.openToWorkSignals)} availability signals. Nothing was saved.`
        : text(json?.error, 'Normalization failed.'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Normalization failed.')
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
  const personCandidates = snapshot.candidates.filter(candidate => candidate.entityKind === 'person')
  const supportingCandidates = snapshot.candidates.filter(candidate => candidate.entityKind !== 'person')

  return <div className="interactive-tool">
    <div className="product-summary-grid">
      <div className="product-stat"><small>Stored identity records</small><b>{snapshot.counts.candidates.toLocaleString()}</b><span>{snapshot.counts.personCandidatesOnPage} people on this page</span></div>
      <div className="product-stat"><small>Source profiles</small><b>{snapshot.counts.sourceProfiles.toLocaleString()}</b><span>Provenance preserved</span></div>
      <div className="product-stat"><small>Evidence records</small><b>{snapshot.counts.evidenceItems.toLocaleString()}</b><span>{coverage} per candidate</span></div>
      <div className="product-stat"><small>Legacy reviews</small><b>{snapshot.counts.pendingMatchReviews.toLocaleString()}</b><span>Read-only historical queue</span></div>
    </div>

    <div className="cta" style={{ marginBottom: 14 }}>
      <strong>Durable identity review is now separate.</strong> Inspect proposal reasons and conflicts without attaching profiles or merging candidates.
      <div className="button-row" style={{ marginTop: 10 }}><Link className="btn secondary" href="/app/identity-review">Open Identity Review</Link></div>
    </div>

    <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        {!!snapshot.matchReviews.length && <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Legacy history</span><h2>Earlier identity reviews</h2></div><span>{snapshot.counts.pendingMatchReviews} pending</span></div>
          <div className="cta" style={{ marginTop: 0 }}>These array-based reviews are preserved for visibility but cannot be confirmed from this page. Use the durable proposal surface for new identity review.</div>
          <div className="product-list">{snapshot.matchReviews.map(review => <div className="product-row" key={review.id}><div className="product-row-main"><div className="product-row-title">{review.proposedCanonicalName}</div><div className="product-row-meta">Legacy score {review.score}/100 · {review.reasons.slice(0, 2).join(' · ') || 'Historical source-profile comparison'}</div>{review.conflicts.length ? <div className="cta" style={{ marginTop: 8, marginBottom: 0 }}>{review.conflicts.join('; ')}</div> : null}</div><span className="status-pill warning">read only</span></div>)}</div>
        </section>}

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Candidate Graph</span><h2>People</h2></div><span>{personCandidates.length} people · records {start.toLocaleString()}–{end.toLocaleString()}</span></div>
          <form onSubmit={search} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, marginBottom: 14 }}><input className="input" style={{ margin: 0 }} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search name, title, company, or location" /><button className="btn" type="submit">Search</button></form>
          {appliedSearch && <div className="button-row" style={{ marginBottom: 12 }}><span className="status-pill active">Search: {appliedSearch}</span><button className="btn ghost" onClick={() => { setSearchInput(''); setAppliedSearch(''); void load(0, '') }}>Clear</button></div>}
          <div className="product-list">
            {personCandidates.map(candidate => {
              const href = `/app/candidate/${candidate.id}`
              return <div className="product-row candidate-db-row" key={candidate.id}>
                <Link className="candidate-row-open-surface" href={href} aria-label={`Open ${candidate.canonicalName} in Candidate 360`} />
                <div className="product-row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="product-row-title candidate-row-link">{candidate.canonicalName}</span>
                    <span className={`status-pill ${candidate.mergeStatus === 'source_verified' || candidate.mergeStatus === 'confirmed' ? 'success' : ''}`}>{words(candidate.mergeStatus)}</span>
                  </div>
                  <div className="product-row-meta">{[candidate.headline || candidate.currentTitle, candidate.currentCompany, candidate.location].filter(Boolean).join(' · ') || 'Candidate profile'}</div>
                  {candidate.summary && <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, margin: '7px 0 0' }}>{candidate.summary.slice(0, 180)}{candidate.summary.length > 180 ? '…' : ''}</p>}
                  <div className="chips">{candidate.skills.slice(0, 6).map(skill => <span className="tag" key={skill}>{skill}</span>)}<span className="tag">{candidate.sourceProfileIds.length} source{candidate.sourceProfileIds.length === 1 ? '' : 's'}</span><span className="tag">{candidate.evidenceItemIds.length} evidence</span></div>
                </div>
                <div className="product-row-actions">
                  <Link className="btn ghost" href={href}>Open 360</Link>
                  <AddToRoleButton candidate={{ candidateId: candidate.id, name: candidate.canonicalName, headline: candidate.headline, company: candidate.currentCompany, location: candidate.location, source: 'candidate_database', contactStatus: candidate.contactSignalIds.length ? 'signals_found' : 'unknown', evidenceStatus: candidate.evidenceItemIds.length ? 'reviewed' : 'unreviewed', tags: candidate.skills }} />
                </div>
              </div>
            })}
            {!loading && !personCandidates.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No person records on this page</div><div className="product-row-meta">Continue to another page, broaden the search, or review supporting subjects below.</div></div></div>}
            {loading && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Loading candidates…</div><div className="product-row-meta">Reading the owner-scoped Candidate Graph.</div></div></div>}
          </div>
          {supportingCandidates.length > 0 && <details className="advanced-disclosure" style={{ marginTop: 14 }}>
            <summary>Supporting or unclassified subjects ({supportingCandidates.length})</summary>
            <div className="product-list" style={{ marginTop: 10 }}>
              {supportingCandidates.map(subject => <div className="product-row" key={subject.id}><div className="product-row-main"><div className="product-row-title">{subject.canonicalName}</div><div className="product-row-meta">{words(subject.entityKind)} · not available for role assignment</div></div><Link className="btn ghost" href={`/app/candidate/${subject.id}`}>Review record</Link></div>)}
            </div>
          </details>}
          <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 14 }}><button className="btn secondary" disabled={snapshot.page.offset === 0 || loading} onClick={() => void load(Math.max(0, snapshot.page.offset - snapshot.page.limit), appliedSearch)}>Previous</button><button className="btn secondary" disabled={!snapshot.page.hasMore || loading} onClick={() => void load(snapshot.page.offset + snapshot.page.limit, appliedSearch)}>Next</button></div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Graph health</h2><span className={`status-pill ${snapshot.persistence_mode === 'supabase' ? 'success' : 'warning'}`}>{snapshot.persistence_mode === 'supabase' ? 'durable' : 'preview'}</span></div><div className="product-list"><div className="product-row"><div className="product-row-main"><div className="product-row-title">Contact signals</div><div className="product-row-meta">Unverified until recruiter confirmation</div></div><b>{snapshot.counts.contactSignals.toLocaleString()}</b></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Availability signals</div><div className="product-row-meta">Signals, never verified job-seeking claims</div></div><b>{snapshot.counts.openToWorkSignals.toLocaleString()}</b></div></div><div className="button-row" style={{ marginTop: 14 }}><Link className="btn secondary" href="/app/identity-review">Open Identity Review</Link><Link className="btn secondary" href="/app/evidence-ledger">Evidence Ledger</Link></div></section>

        <details className="advanced-disclosure product-panel">
          <summary>Import authorized candidate data</summary>
          <div style={{ marginTop: 14 }}><span className="kicker">Resume or profile text</span><textarea className="textarea big" value={resumeText} onChange={event => setResumeText(event.target.value)} /><div className="button-row"><button className="btn" onClick={() => void importResume()}>Import resume</button><button className="btn secondary" onClick={() => void normalizeCandidate()}>Preview extraction</button></div><div className="sidebar-divider" style={{ margin: '18px 0' }} /><span className="kicker">CSV paste import</span><textarea className="textarea big" value={csvText} onChange={event => setCsvText(event.target.value)} /><button className="btn" onClick={() => void importCsv()}>Import CSV</button><p className="muted" style={{ fontSize: 10, lineHeight: 1.5 }}>Use only data you are authorized to store. Production imports are owner-scoped and durable; preview imports reset between server restarts.</p></div>
        </details>

        <details className="advanced-disclosure product-panel">
          <summary>Recent imports</summary>
          <div className="product-list" style={{ marginTop: 14 }}>{snapshot.importBatches.slice(0, 8).map(batch => <div className="product-row" key={batch.id}><div className="product-row-main"><div className="product-row-title">{batch.fileName || words(batch.importType)}</div><div className="product-row-meta">{batch.recordsCreated.toLocaleString()} created from {batch.rowsSeen.toLocaleString()} row{batch.rowsSeen === 1 ? '' : 's'}</div></div></div>)}</div>
        </details>
      </aside>
    </div>
    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{status}</p>
  </div>
}
