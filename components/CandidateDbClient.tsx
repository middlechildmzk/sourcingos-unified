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
      if (search && normalized.searchMode === 'candidate_graph') {
        setStatus(`Candidate Graph search matched ${normalized.counts.filteredCandidates.toLocaleString()} canonical person record${normalized.counts.filteredCandidates === 1 ? '' : 's'} across attached profile, skill, evidence, URL, and allowed contact observations.`)
      } else if (search && normalized.searchMode === 'legacy_scalar') {
        setStatus('Candidate Graph search migration is not active in this environment yet. Search is temporarily limited to canonical candidate header fields.')
      } else {
        setStatus(normalized.persistence_mode === 'supabase' ? 'Candidate Graph is connected to durable storage.' : 'Preview records are temporary and reset between server restarts.')
      }
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
      const artifactNote = text(json?.warning)
      setStatus(response.ok && json?.ok ? `Imported ${importedName}.${artifactNote ? ` ${artifactNote}` : ' Resume provenance and identity anchors were captured.'}` : text(json?.error, 'Resume import failed.'))
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
      <div className="product-stat"><small>Canonical people</small><b>{snapshot.counts.candidates.toLocaleString()}</b><span>{snapshot.counts.personCandidatesOnPage} people on this page</span></div>
      <div className="product-stat"><small>Source observations</small><b>{snapshot.counts.sourceProfiles.toLocaleString()}</b><span>Provenance preserved</span></div>
      <div className="product-stat"><small>Evidence records</small><b>{snapshot.counts.evidenceItems.toLocaleString()}</b><span>{coverage} per candidate</span></div>
      <div className="product-stat"><small>Identity review</small><b>{snapshot.counts.pendingMatchReviews.toLocaleString()}</b><span>Pending recruiter decisions</span></div>
    </div>

    <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        {snapshot.counts.pendingMatchReviews > 0 && <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Identity resolution</span><h2>{snapshot.counts.pendingMatchReviews} possible duplicate{snapshot.counts.pendingMatchReviews === 1 ? '' : 's'} need review</h2></div><Link className="btn" href="/app/identity-review">Open Identity Review</Link></div>
          <p className="muted" style={{ margin: 0 }}>SourcingOS found deterministic cross-source identity anchors. Review the source observations side by side before attaching them to one canonical person.</p>
        </section>}

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Canonical Candidate Graph</span><h2>People</h2></div><span>{personCandidates.length} people · records {start.toLocaleString()}–{end.toLocaleString()}</span></div>
          <div className="cta" style={{ marginBottom: 14 }}><b>Search the person, not just the row.</b> When the V36.10 graph-search migration is active, SourcingOS searches canonical fields plus attached skills, source profiles, evidence, profile URLs and allowed stored contact signals, then returns each canonical person once.</div>
          <form onSubmit={search} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, marginBottom: 14 }}><input className="input" style={{ margin: 0 }} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search John Doe, RHEL, Acme, email, LinkedIn/GitHub URL…" /><button className="btn" type="submit">Search graph</button></form>
          {appliedSearch && <div className="button-row" style={{ marginBottom: 12 }}><span className="status-pill active">Search: {appliedSearch}</span><span className={`status-pill ${snapshot.searchMode === 'candidate_graph' ? 'success' : 'warning'}`}>{snapshot.searchMode === 'candidate_graph' ? 'Graph-wide search' : snapshot.searchMode === 'legacy_scalar' ? 'Header-only fallback' : 'Search'}</span><button className="btn ghost" onClick={() => { setSearchInput(''); setAppliedSearch(''); void load(0, '') }}>Clear</button></div>}
          <div className="product-list">
            {personCandidates.map(candidate => {
              const href = `/app/candidate/${candidate.id}`
              return <div className="product-row candidate-db-row" key={candidate.id}>
                <Link
                  className="candidate-row-open-surface"
                  href={href}
                  aria-label={`Open ${candidate.canonicalName} in Candidate 360`}
                />
                <div className="product-row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="product-row-title candidate-row-link">{candidate.canonicalName}</span>
                    <span className={`status-pill ${candidate.mergeStatus === 'source_verified' || candidate.mergeStatus === 'confirmed' ? 'success' : ''}`}>{words(candidate.mergeStatus)}</span>
                    {appliedSearch && candidate.searchRank !== undefined && <span className="status-pill">Graph match · retrieval relevance only</span>}
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
            {!loading && !personCandidates.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">{appliedSearch ? 'No canonical people matched this search' : 'No person records on this page'}</div><div className="product-row-meta">{appliedSearch ? 'Try a broader skill, name, company, email, or professional profile URL. Source observations stay attached to canonical people rather than appearing as duplicate result rows.' : 'Continue to another page, import authorized data, or save discoveries from Talent Universe.'}</div></div></div>}
            {loading && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Searching Candidate Graph…</div><div className="product-row-meta">Resolving canonical people from owner-scoped candidate and source observations.</div></div></div>}
          </div>
          {supportingCandidates.length > 0 && (
            <details className="advanced-disclosure" style={{ marginTop: 14 }}>
              <summary>Supporting or unclassified subjects ({supportingCandidates.length})</summary>
              <div className="product-list" style={{ marginTop: 10 }}>
                {supportingCandidates.map(subject => (
                  <div className="product-row" key={subject.id}>
                    <div className="product-row-main">
                      <div className="product-row-title">{subject.canonicalName}</div>
                      <div className="product-row-meta">{words(subject.entityKind)} · not available for role assignment</div>
                    </div>
                    <Link className="btn ghost" href={`/app/candidate/${subject.id}`}>Review record</Link>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 14 }}><button className="btn secondary" disabled={snapshot.page.offset === 0 || loading} onClick={() => void load(Math.max(0, snapshot.page.offset - snapshot.page.limit), appliedSearch)}>Previous</button><button className="btn secondary" disabled={!snapshot.page.hasMore || loading} onClick={() => void load(snapshot.page.offset + snapshot.page.limit, appliedSearch)}>Next</button></div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Graph health</h2><span className={`status-pill ${snapshot.persistence_mode === 'supabase' ? 'success' : 'warning'}`}>{snapshot.persistence_mode === 'supabase' ? 'durable' : 'preview'}</span></div><div className="product-list"><div className="product-row"><div className="product-row-main"><div className="product-row-title">Contact signals</div><div className="product-row-meta">Ownership/deliverability and permission remain separate</div></div><b>{snapshot.counts.contactSignals.toLocaleString()}</b></div><div className="product-row"><div className="product-row-main"><div className="product-row-title">Availability signals</div><div className="product-row-meta">Signals, never verified job-seeking claims</div></div><b>{snapshot.counts.openToWorkSignals.toLocaleString()}</b></div></div><div className="button-row" style={{ marginTop: 14 }}><Link className="btn secondary" href="/app/evidence-ledger">Evidence Ledger</Link><Link className="btn secondary" href="/app/identity-review">Identity Review</Link></div></section>

        <details className="advanced-disclosure product-panel">
          <summary>Import authorized candidate data</summary>
          <div style={{ marginTop: 14 }}><span className="kicker">Resume or profile text</span><textarea className="textarea big" value={resumeText} onChange={event => setResumeText(event.target.value)} /><div className="button-row"><button className="btn" onClick={() => void importResume()}>Import resume</button><button className="btn secondary" onClick={() => void normalizeCandidate()}>Preview extraction</button></div><p className="muted" style={{ fontSize: 10, lineHeight: 1.5 }}>V36.10 preserves resume provenance as a first-class artifact with a content hash and observed identity anchors instead of flattening the document into the candidate row.</p><div className="sidebar-divider" style={{ margin: '18px 0' }} /><span className="kicker">CSV paste import</span><textarea className="textarea big" value={csvText} onChange={event => setCsvText(event.target.value)} /><button className="btn" onClick={() => void importCsv()}>Import CSV</button><p className="muted" style={{ fontSize: 10, lineHeight: 1.5 }}>Use only data you are authorized to store. Production imports are owner-scoped and durable; preview imports reset between server restarts.</p></div>
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
