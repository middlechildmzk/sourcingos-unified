'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ROLE_STAGES,
  stageLabel,
  type FitDecision,
  type RoleCandidate,
  type RoleIntake,
  type RoleStage,
} from '@/lib/role-workspace'
import { ProductIcon } from '@/components/ProductIcon'
import {
  candidateEvidenceDimensions,
  candidateReviewScore,
  matchedRoleSignals,
} from '@/lib/candidate-review-pro'
export { candidateReviewScore } from '@/lib/candidate-review-pro'

type DossierEvidence = {
  id?: string
  label?: string
  detail?: string
  confidence?: string
}

type SourceProfile = {
  id?: string
  displayName?: string
  source?: string
  headline?: string
  organization?: string
  profileUrl?: string
}

type Dossier = {
  evidence?: DossierEvidence[]
  sourceProfiles?: SourceProfile[]
}

function words(value: string): string {
  return value.replaceAll('_', ' ')
}

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(/[,\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 30)
}

function listInput(value: string[]): string {
  return value.join(', ')
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function CandidateReviewDrawer({
  candidate,
  intake,
  position,
  total,
  hasNext,
  onClose,
  onNext,
  onSave,
}: {
  candidate: RoleCandidate
  intake: RoleIntake
  position: number
  total: number
  hasNext: boolean
  onClose: () => void
  onNext: () => void
  onSave: (patch: Partial<RoleCandidate>, activityMessage: string, advance: boolean) => void
}) {
  const [draft, setDraft] = useState(candidate)
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    setDraft(candidate)
    setDossier(null)
    setStatus('')
    if (!candidate.candidateId) return
    const controller = new AbortController()
    fetch(`/api/candidate-db/360/${candidate.candidateId}`, { headers: { accept: 'application/json' }, signal: controller.signal })
      .then(async response => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!response.ok || !json.ok) throw new Error(json.error || 'Candidate intelligence could not be loaded.')
        setDossier(json.dossier as Dossier)
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus(error instanceof Error ? error.message : 'Candidate intelligence could not be loaded.')
      })
    return () => controller.abort()
  }, [candidate])

  const dimensions = useMemo(() => candidateEvidenceDimensions(draft, intake), [draft, intake])
  const score = useMemo(() => candidateReviewScore(draft, intake), [draft, intake])
  const evidence = Array.isArray(dossier?.evidence) ? dossier.evidence : []
  const profiles = Array.isArray(dossier?.sourceProfiles) ? dossier.sourceProfiles : []

  async function runAction(label: string, request: () => Promise<Response>) {
    setWorking(label)
    setStatus(label)
    try {
      const response = await request()
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Action failed.')
      setStatus(json.note || 'Done.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Action failed.')
    } finally {
      setWorking('')
    }
  }

  function enrich() {
    if (!candidate.candidateId || working) return
    void runAction('Queueing enrichment…', () => fetch('/api/candidate-acquisition', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'queue_enrichment', candidateIds: [candidate.candidateId] }),
    }))
  }

  function save(advance = false) {
    const patch: Partial<RoleCandidate> = {
      fitDecision: draft.fitDecision,
      stage: draft.stage,
      evidenceStatus: draft.evidenceStatus,
      contactStatus: draft.contactStatus,
      fitReasons: draft.fitReasons,
      concerns: draft.concerns,
      tags: draft.tags,
    }
    const changes = [
      draft.fitDecision !== candidate.fitDecision ? `fit ${words(draft.fitDecision)}` : '',
      draft.stage !== candidate.stage ? `stage ${stageLabel(draft.stage)}` : '',
    ].filter(Boolean)
    onSave(patch, `Reviewed ${candidate.name}${changes.length ? `: ${changes.join(', ')}` : ''}.`, advance)
  }

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') { onClose(); return }
      if (isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === '1') setDraft(current => ({ ...current, fitDecision: 'strong_fit' }))
      if (key === '2') setDraft(current => ({ ...current, fitDecision: 'possible_fit' }))
      if (key === '3') setDraft(current => ({ ...current, fitDecision: 'not_fit' }))
      if (key === 's') setDraft(current => ({ ...current, stage: 'shortlisted' }))
      if (key === 'e') enrich()
      if (key === 'n' && hasNext) onNext()
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(hasNext)
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  })

  return <div className="candidate-drawer-layer" role="dialog" aria-modal="true" aria-label={`Review ${candidate.name}`}>
    <button className="candidate-drawer-backdrop" onClick={onClose} aria-label="Close candidate review" />
    <aside className="candidate-drawer candidate-drawer-pro">
      <div className="candidate-drawer-head candidate-review-head">
        <div>
          <span className="kicker">{intake.title}</span>
          <div className="candidate-review-title-row"><h2>{candidate.name}</h2><span className={`candidate-review-score ${score >= 70 ? 'strong' : score >= 45 ? 'supported' : ''}`}>{score}</span></div>
          <p>{[candidate.headline, candidate.company, candidate.location].filter(Boolean).join(' · ') || 'Candidate details pending review'}</p>
          <div className="candidate-review-progress">Candidate {position} of {total}</div>
        </div>
        <button className="candidate-drawer-close" onClick={onClose} aria-label="Close candidate review">×</button>
      </div>

      <div className="candidate-shortcut-bar" aria-label="Candidate review keyboard shortcuts">
        <span><kbd>1</kbd> Strong</span><span><kbd>2</kbd> Possible</span><span><kbd>3</kbd> Not fit</span><span><kbd>S</kbd> Shortlist</span><span><kbd>E</kbd> Enrich</span><span><kbd>N</kbd> Next</span>
      </div>

      <div className="candidate-drawer-actions">
        {candidate.candidateId && <Link className="btn ghost" href={`/app/candidate/${candidate.candidateId}`}>Full 360</Link>}
        {candidate.sourceUrl && <a className="btn ghost" href={candidate.sourceUrl} target="_blank" rel="noreferrer noopener">Source</a>}
        {candidate.candidateId && <button className="btn secondary" disabled={!!working} onClick={enrich}>Enrich</button>}
        {candidate.candidateId && <button className="btn secondary" disabled={!!working} onClick={() => void runAction('Building graph…', () => fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'extract_graph', candidateId: candidate.candidateId }) }))}>Build graph</button>}
      </div>
      {status && <div className="cta" role="status">{status}</div>}

      <section className="candidate-drawer-section candidate-decision-panel">
        <div className="product-panel-head"><div><span className="kicker">Role decision</span><h2>Review and disposition</h2></div><span>{stageLabel(draft.stage)}</span></div>
        <div className="candidate-fit-buttons">
          {(['strong_fit', 'possible_fit', 'not_fit'] as FitDecision[]).map((decision, index) => <button key={decision} className={draft.fitDecision === decision ? 'btn' : 'btn ghost'} onClick={() => setDraft(current => ({ ...current, fitDecision: decision }))}><kbd>{index + 1}</kbd>{words(decision)}</button>)}
          <button className={draft.fitDecision === 'unreviewed' ? 'btn' : 'btn ghost'} onClick={() => setDraft(current => ({ ...current, fitDecision: 'unreviewed' }))}>Unreviewed</button>
        </div>
        <div className="grid three candidate-review-selects">
          <label>Pipeline stage<select value={draft.stage} onChange={event => setDraft(current => ({ ...current, stage: event.target.value as RoleStage }))}>{ROLE_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></label>
          <label>Evidence state<select value={draft.evidenceStatus} onChange={event => setDraft(current => ({ ...current, evidenceStatus: event.target.value as RoleCandidate['evidenceStatus'] }))}><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option><option value="conflicting">Conflicting</option><option value="stale">Stale</option></select></label>
          <label>Contact state<select value={draft.contactStatus} onChange={event => setDraft(current => ({ ...current, contactStatus: event.target.value as RoleCandidate['contactStatus'] }))}><option value="unknown">Unknown</option><option value="signals_found">Signals found</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label>
        </div>
        <label>Why this candidate fits<input className="input" value={listInput(draft.fitReasons)} onChange={event => setDraft(current => ({ ...current, fitReasons: parseList(event.target.value) }))} placeholder="Relevant leadership, domain, technical, mission, or delivery evidence" /></label>
        <label>Concerns or missing evidence<input className="input" value={listInput(draft.concerns)} onChange={event => setDraft(current => ({ ...current, concerns: parseList(event.target.value) }))} placeholder="Missing scope, tenure, clearance verification, location, depth…" /></label>
        <label>Role tags<input className="input" value={listInput(draft.tags)} onChange={event => setDraft(current => ({ ...current, tags: parseList(event.target.value) }))} /></label>
      </section>

      <section className="candidate-drawer-section">
        <div className="product-panel-head"><div><span className="kicker">Role evidence matrix</span><h2>Why this record may fit</h2></div><span>{dimensions.filter(item => item.tone === 'strong' || item.tone === 'supported').length}/{dimensions.length} supported</span></div>
        <div className="candidate-evidence-grid">
          {dimensions.map(item => <article className={`candidate-evidence-dimension ${item.tone}`} key={item.label}><div><span>{item.label}</span><b>{item.value}</b></div><p>{item.detail}</p></article>)}
        </div>
      </section>

      <section className="candidate-drawer-section">
        <div className="product-panel-head"><div><span className="kicker">Evidence first</span><h2>Strongest source evidence</h2></div><span>{evidence.length || candidate.fitReasons.length} items</span></div>
        <div className="product-list">
          {evidence.slice(0, 6).map((item, index) => <div className="product-row" key={item.id || `${item.label}-${index}`}><div className="product-row-main"><div className="product-row-title">{item.label || 'Evidence'}</div><div className="product-row-meta normal-wrap">{item.detail || 'Evidence detail unavailable.'}</div></div><span className="status-pill">{item.confidence || 'medium'}</span></div>)}
          {!evidence.length && candidate.fitReasons.map(reason => <div className="product-row" key={reason}><div className="product-row-main"><div className="product-row-title">Role evidence</div><div className="product-row-meta normal-wrap">{reason}</div></div></div>)}
          {!evidence.length && !candidate.fitReasons.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Evidence review needed</div><div className="product-row-meta normal-wrap">Open Candidate 360 or queue enrichment before making a high-confidence decision.</div></div></div>}
        </div>
      </section>

      {!!profiles.length && <details className="advanced-disclosure candidate-drawer-section"><summary>Identity provenance ({profiles.length})</summary><div className="product-list candidate-profile-list">{profiles.slice(0, 8).map((profile, index) => <div className="product-row" key={profile.id || `${profile.source}-${index}`}><div className="product-row-main"><div className="product-row-title">{profile.displayName || candidate.name}</div><div className="product-row-meta">{[profile.source, profile.headline, profile.organization].filter(Boolean).join(' · ')}</div></div>{profile.profileUrl && <a className="btn ghost" href={profile.profileUrl} target="_blank" rel="noreferrer noopener">Open</a>}</div>)}</div></details>}

      <div className="candidate-drawer-footer candidate-review-footer">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <div><button className="btn secondary" disabled={!hasNext} onClick={onNext}>Skip to next</button><button className="btn secondary" onClick={() => save(false)}>Save review</button><button className="btn" onClick={() => save(hasNext)}>{hasNext ? 'Save & next' : 'Save & close'}</button></div>
      </div>
    </aside>
  </div>
}

export function CandidateComparisonDialog({
  candidates,
  intake,
  onClose,
  onReview,
}: {
  candidates: RoleCandidate[]
  intake: RoleIntake
  onClose: () => void
  onReview: (candidateId: string) => void
}) {
  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const limited = candidates.slice(0, 5)
  const rows = [
    { label: 'Fit decision', value: (candidate: RoleCandidate) => words(candidate.fitDecision) },
    { label: 'Pipeline', value: (candidate: RoleCandidate) => stageLabel(candidate.stage) },
    { label: 'Must-have signals', value: (candidate: RoleCandidate) => { const matches = matchedRoleSignals(candidate, intake.mustHaves); return matches.length ? matches.join(', ') : 'None recorded' } },
    { label: 'Role evidence', value: (candidate: RoleCandidate) => candidate.fitReasons.join('; ') || 'Not recorded' },
    { label: 'Concerns', value: (candidate: RoleCandidate) => candidate.concerns.join('; ') || 'None recorded' },
    { label: 'Evidence state', value: (candidate: RoleCandidate) => words(candidate.evidenceStatus) },
    { label: 'Contact', value: (candidate: RoleCandidate) => words(candidate.contactStatus) },
    { label: 'Source', value: (candidate: RoleCandidate) => candidate.source || 'Unknown' },
  ]

  return <div className="candidate-compare-layer" role="dialog" aria-modal="true" aria-label="Compare selected candidates">
    <button className="candidate-compare-backdrop" onClick={onClose} aria-label="Close candidate comparison" />
    <section className="candidate-compare-dialog">
      <header className="candidate-compare-head"><div><span className="kicker">Candidate comparison</span><h2>Compare role evidence side by side</h2><p>Signals below come from the role workspace. Unknown stays unknown until a recruiter verifies it.</p></div><button className="candidate-drawer-close" onClick={onClose} aria-label="Close comparison">×</button></header>
      <div className="candidate-compare-scroll">
        <table className="candidate-compare-table">
          <thead><tr><th>Dimension</th>{limited.map(candidate => <th key={candidate.id}><div className="candidate-compare-person"><span><ProductIcon name="candidates" /></span><div><b>{candidate.name}</b><small>{candidate.company || candidate.headline || 'Details pending'}</small></div></div><div className="candidate-compare-score">Review score {candidateReviewScore(candidate, intake)}</div><button className="btn ghost" onClick={() => onReview(candidate.id)}>Open review</button></th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.label}><th>{row.label}</th>{limited.map(candidate => <td key={candidate.id}>{row.value(candidate)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <footer className="candidate-compare-footer"><span>{limited.length} candidates compared</span><button className="btn" onClick={onClose}>Done</button></footer>
    </section>
  </div>
}
