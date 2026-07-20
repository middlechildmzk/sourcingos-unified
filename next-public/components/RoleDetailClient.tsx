'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ROLE_STAGES,
  buildSearchLanes,
  calibrationInsights,
  roleMetrics,
  stageLabel,
  type FitDecision,
  type RoleCandidate,
  type RoleStage,
  type RoleWorkspace,
} from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type Tab = 'overview' | 'candidates' | 'strategy' | 'activity'

function words(value: string) { return value.replaceAll('_', ' ') }
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}
function parseList(value: string) {
  return Array.from(new Set(value.split(/[,\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 30)
}
function listInput(value: string[]) { return value.join(', ') }

function candidateTemplate(): RoleCandidate {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(), name: '', headline: '', company: '', location: '', source: 'manual research',
    stage: 'needs_review', fitDecision: 'unreviewed', fitReasons: [], concerns: [], tags: [],
    contactStatus: 'unknown', evidenceStatus: 'unreviewed', addedAt: now, updatedAt: now,
  }
}

function CandidateReviewDrawer({
  candidate,
  roleTitle,
  onClose,
  onSave,
}: {
  candidate: RoleCandidate
  roleTitle: string
  onClose: () => void
  onSave: (patch: Partial<RoleCandidate>, activityMessage: string) => void
}) {
  const [draft, setDraft] = useState(candidate)
  const [dossier, setDossier] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')

  useEffect(() => {
    setDraft(candidate)
    setDossier(null)
    setStatus('')
    if (!candidate.candidateId) return
    fetch(`/api/candidate-db/360/${candidate.candidateId}`, { headers: { accept: 'application/json' } })
      .then(async response => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!response.ok || !json.ok) throw new Error(json.error || 'Candidate intelligence could not be loaded.')
        setDossier(json.dossier)
      })
      .catch(error => setStatus(error instanceof Error ? error.message : 'Candidate intelligence could not be loaded.'))
  }, [candidate])

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

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

  const evidence = Array.isArray(dossier?.evidence) ? dossier.evidence : []
  const profiles = Array.isArray(dossier?.sourceProfiles) ? dossier.sourceProfiles : []
  const fitChanged = draft.fitDecision !== candidate.fitDecision
  const stageChanged = draft.stage !== candidate.stage

  function save() {
    const patch: Partial<RoleCandidate> = {
      fitDecision: draft.fitDecision,
      stage: draft.stage,
      evidenceStatus: draft.evidenceStatus,
      contactStatus: draft.contactStatus,
      fitReasons: draft.fitReasons,
      concerns: draft.concerns,
      tags: draft.tags,
    }
    const changes = [fitChanged ? `fit ${words(draft.fitDecision)}` : '', stageChanged ? `stage ${stageLabel(draft.stage)}` : ''].filter(Boolean)
    onSave(patch, `Reviewed ${candidate.name}${changes.length ? `: ${changes.join(', ')}` : ''}.`)
    onClose()
  }

  return <div className="candidate-drawer-layer" role="dialog" aria-modal="true" aria-label={`Review ${candidate.name}`}>
    <button className="candidate-drawer-backdrop" onClick={onClose} aria-label="Close candidate review" />
    <aside className="candidate-drawer">
      <div className="candidate-drawer-head">
        <div><span className="kicker">{roleTitle}</span><h2>{candidate.name}</h2><p>{[candidate.headline, candidate.company, candidate.location].filter(Boolean).join(' · ') || 'Candidate details pending review'}</p></div>
        <button className="candidate-drawer-close" onClick={onClose} aria-label="Close candidate review">×</button>
      </div>

      <div className="candidate-drawer-actions">
        {candidate.candidateId && <Link className="btn ghost" href={`/app/candidate/${candidate.candidateId}`}>Full 360</Link>}
        {candidate.sourceUrl && <a className="btn ghost" href={candidate.sourceUrl} target="_blank" rel="noreferrer noopener">Source</a>}
        {candidate.candidateId && <button className="btn secondary" disabled={!!working} onClick={() => runAction('Queueing enrichment…', () => fetch('/api/candidate-acquisition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'queue_enrichment', candidateIds: [candidate.candidateId] }) }))}>Enrich</button>}
        {candidate.candidateId && <button className="btn secondary" disabled={!!working} onClick={() => runAction('Building graph…', () => fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'extract_graph', candidateId: candidate.candidateId }) }))}>Build graph</button>}
      </div>
      {status && <div className="cta">{status}</div>}

      <section className="candidate-drawer-section">
        <div className="product-panel-head"><div><span className="kicker">Role decision</span><h2>Review and disposition</h2></div><span>{stageLabel(draft.stage)}</span></div>
        <div className="candidate-fit-buttons">
          {(['strong_fit', 'possible_fit', 'not_fit'] as FitDecision[]).map(decision => <button key={decision} className={draft.fitDecision === decision ? 'btn' : 'btn ghost'} onClick={() => setDraft(current => ({ ...current, fitDecision: decision }))}>{words(decision)}</button>)}
          <button className={draft.fitDecision === 'unreviewed' ? 'btn' : 'btn ghost'} onClick={() => setDraft(current => ({ ...current, fitDecision: 'unreviewed' }))}>Unreviewed</button>
        </div>
        <div className="grid two">
          <label>Pipeline stage<select value={draft.stage} onChange={event => setDraft(current => ({ ...current, stage: event.target.value as RoleStage }))}>{ROLE_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></label>
          <label>Evidence state<select value={draft.evidenceStatus} onChange={event => setDraft(current => ({ ...current, evidenceStatus: event.target.value as RoleCandidate['evidenceStatus'] }))}><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option><option value="conflicting">Conflicting</option><option value="stale">Stale</option></select></label>
          <label>Contact state<select value={draft.contactStatus} onChange={event => setDraft(current => ({ ...current, contactStatus: event.target.value as RoleCandidate['contactStatus'] }))}><option value="unknown">Unknown</option><option value="signals_found">Signals found</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label>
        </div>
        <label>Why this candidate fits<input className="input" value={listInput(draft.fitReasons)} onChange={event => setDraft(current => ({ ...current, fitReasons: parseList(event.target.value) }))} placeholder="Relevant leadership, domain, technical, mission, or delivery evidence" /></label>
        <label>Concerns or missing evidence<input className="input" value={listInput(draft.concerns)} onChange={event => setDraft(current => ({ ...current, concerns: parseList(event.target.value) }))} placeholder="Missing scope, tenure, clearance verification, location, depth…" /></label>
        <label>Role tags<input className="input" value={listInput(draft.tags)} onChange={event => setDraft(current => ({ ...current, tags: parseList(event.target.value) }))} /></label>
      </section>

      <section className="candidate-drawer-section">
        <div className="product-panel-head"><div><span className="kicker">Evidence first</span><h2>Strongest evidence</h2></div><span>{evidence.length || candidate.fitReasons.length} items</span></div>
        <div className="product-list">
          {evidence.slice(0, 6).map((item: any) => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.label}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item.detail}</div></div><span className="status-pill">{item.confidence || 'medium'}</span></div>)}
          {!evidence.length && candidate.fitReasons.map(reason => <div className="product-row" key={reason}><div className="product-row-main"><div className="product-row-title">Role evidence</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{reason}</div></div></div>)}
          {!evidence.length && !candidate.fitReasons.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Evidence review needed</div><div className="product-row-meta">Open Candidate 360 or queue enrichment before making a high-confidence decision.</div></div></div>}
        </div>
      </section>

      {!!profiles.length && <details className="advanced-disclosure candidate-drawer-section"><summary>Identity provenance ({profiles.length})</summary><div className="product-list" style={{ marginTop: 12 }}>{profiles.slice(0, 8).map((profile: any) => <div className="product-row" key={profile.id}><div className="product-row-main"><div className="product-row-title">{profile.displayName || candidate.name}</div><div className="product-row-meta">{[profile.source, profile.headline, profile.organization].filter(Boolean).join(' · ')}</div></div>{profile.profileUrl && <a className="btn ghost" href={profile.profileUrl} target="_blank" rel="noreferrer noopener">Open</a>}</div>)}</div></details>}

      <div className="candidate-drawer-footer"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save review</button></div>
    </aside>
  </div>
}

export function RoleDetailClient({ roleId }: { roleId: string }) {
  const { roles, mode, message, updateRole, syncWorkspace } = useRoleWorkspaces()
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [candidateQuery, setCandidateQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [candidateDraft, setCandidateDraft] = useState<RoleCandidate>(candidateTemplate())
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')

  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const metrics = role ? roleMetrics(role) : null
  const selectedCandidate = role?.candidates.find(candidate => candidate.id === selectedCandidateId)

  const filteredCandidates = useMemo(() => {
    if (!role) return []
    const needle = candidateQuery.trim().toLowerCase()
    return role.candidates.filter(candidate => {
      if (stageFilter !== 'all' && candidate.stage !== stageFilter) return false
      if (!needle) return true
      return [candidate.name, candidate.headline, candidate.company, candidate.location, candidate.source, ...candidate.tags].join(' ').toLowerCase().includes(needle)
    })
  }, [candidateQuery, role, stageFilter])

  function updateSelected(updater: (workspace: RoleWorkspace) => RoleWorkspace) {
    return updateRole(roleId, current => ({ ...updater(current), updatedAt: new Date().toISOString() }))
  }

  function updateCandidate(candidateId: string, patch: Partial<RoleCandidate>, activityMessage: string) {
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: current.candidates.map(candidate => candidate.id === candidateId ? { ...candidate, ...patch, updatedAt: now } : candidate),
      activity: [{ id: crypto.randomUUID(), type: patch.stage ? 'stage_changed' : 'candidate_reviewed', message: activityMessage, createdAt: now }, ...current.activity],
    }))
    setStatus(activityMessage)
  }

  function updateIntake(field: keyof RoleWorkspace['intake'], value: string | string[]) {
    const now = new Date().toISOString()
    updateSelected(current => {
      const intake = { ...current.intake, [field]: value }
      return { ...current, intake, searchLanes: buildSearchLanes(intake), activity: [{ id: crypto.randomUUID(), type: 'intake_updated', message: `Updated ${field}. Search lanes were regenerated for review.`, createdAt: now }, ...current.activity] }
    })
  }

  function addCandidate() {
    if (!candidateDraft.name.trim()) { setStatus('Candidate name is required.'); return }
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: [{ ...candidateDraft, name: candidateDraft.name.trim(), updatedAt: now }, ...current.candidates],
      activity: [{ id: crypto.randomUUID(), type: 'candidate_added', message: `Added ${candidateDraft.name.trim()} from ${candidateDraft.source}.`, createdAt: now }, ...current.activity],
    }))
    setCandidateDraft(candidateTemplate())
    setShowAddCandidate(false)
    setStatus('Candidate added to the role review queue. Identity and fit remain unconfirmed until reviewed.')
  }

  async function launchAgent() {
    if (!role) return
    setWorking('Launching recruiter agent…')
    try {
      const response = await fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create_from_role', roleId: role.id }) })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Agent launch failed.')
      setStatus('Recruiter agent launched. Strategy changes will stop for approval.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Agent launch failed.')
    } finally {
      setWorking('')
    }
  }

  if (!role && mode === 'checking') return <div className="product-panel"><p className="muted">Loading role workspace…</p></div>
  if (!role) return <div className="product-panel"><span className="kicker">Role not found</span><h1>This workspace is not available yet.</h1><p className="muted">Open Roles to restore account workspaces or choose another req.</p><div className="button-row"><Link className="btn" href="/app/roles">Back to roles</Link></div></div>
  if (!metrics) return null

  const nextActions = [
    role.status === 'calibrating' ? 'Finish intake calibration and activate the role.' : '',
    role.searchLanes.some(lane => lane.status === 'proposed') ? `Review ${role.searchLanes.filter(lane => lane.status === 'proposed').length} proposed search lanes.` : '',
    metrics.needsReview ? `Review ${metrics.needsReview} candidate${metrics.needsReview === 1 ? '' : 's'}.` : '',
    !metrics.candidateCount ? 'Launch discovery or add a three-to-five person calibration batch.' : '',
    metrics.conflicts ? `Resolve ${metrics.conflicts} evidence conflict${metrics.conflicts === 1 ? '' : 's'} before outreach.` : '',
  ].filter(Boolean)

  return <div className="interactive-tool">
    <div className="role-detail-topbar"><Link href="/app/roles" className="btn ghost">← All roles</Link><span className={`status-pill ${mode === 'supabase' ? 'success' : mode === 'error' ? 'warning' : ''}`}>{mode}</span><span className="role-storage-note">{message}</span></div>
    {status && <div className="cta" role="status">{status}</div>}

    <div className="product-page-head role-detail-head">
      <div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className="kicker">Role workspace</span><span className={`status-pill ${role.status === 'active' ? 'active' : role.status === 'calibrating' ? 'warning' : ''}`}>{role.status}</span></div><h1>{role.intake.title}</h1><p>{[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? `Clearance: ${role.intake.clearance}` : ''].filter(Boolean).join(' · ')}</p></div>
      <div className="product-page-actions"><select value={role.status} onChange={event => updateSelected(current => ({ ...current, status: event.target.value as RoleWorkspace['status'] }))} aria-label="Role status"><option value="draft">Draft</option><option value="calibrating">Calibrating</option><option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option></select><button className="btn secondary" onClick={() => void syncWorkspace(role)}>Sync now</button><button className="btn" disabled={!!working} onClick={launchAgent}>{working || 'Launch agent'}</button></div>
    </div>

    <nav className="role-tabs" aria-label="Role workspace sections">
      {(['overview', 'candidates', 'strategy', 'activity'] as Tab[]).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}{item === 'candidates' && metrics.needsReview ? <span>{metrics.needsReview}</span> : null}</button>)}
    </nav>

    {tab === 'overview' && <div style={{ display: 'grid', gap: 14 }}>
      <div className="product-summary-grid">
        <div className="product-stat"><small>Candidates</small><b>{metrics.candidateCount}</b><span>In this role</span></div>
        <div className="product-stat"><small>Needs review</small><b>{metrics.needsReview}</b><span>Human decisions pending</span></div>
        <div className="product-stat"><small>Strong fits</small><b>{metrics.strongFits}</b><span>Role-specific decisions</span></div>
        <div className="product-stat"><small>Outreach ready</small><b>{metrics.contactReady}</b><span>Still requires recruiter action</span></div>
      </div>
      <div className="product-layout">
        <div style={{ display: 'grid', gap: 14 }}>
          <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Next best actions</span><h2>Move this search forward</h2></div><span>{nextActions.length} actions</span></div><div className="product-list">{nextActions.map((action, index) => <div className="product-row" key={action}><span className="role-action-number">{index + 1}</span><div className="product-row-main"><div className="product-row-title">{action}</div></div></div>)}{!nextActions.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Role is moving</div><div className="product-row-meta">No urgent calibration or review blockers are visible.</div></div><span className="status-pill success">clear</span></div>}</div><div className="button-row" style={{ marginTop: 14 }}><button className="btn" onClick={() => setTab('candidates')}>Review candidates</button><button className="btn secondary" onClick={() => setTab('strategy')}>Review strategy</button><Link className="btn ghost" href={`/app/candidate-database?q=${encodeURIComponent(role.intake.title)}`}>Search graph</Link></div></section>
          <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Pipeline</span><h2>Role flow</h2></div><span>{metrics.candidateCount} candidates</span></div><div className="role-stage-summary">{ROLE_STAGES.filter(stage => metrics.byStage[stage] > 0).map(stage => <button key={stage} onClick={() => { setStageFilter(stage); setTab('candidates') }}><b>{metrics.byStage[stage]}</b><span>{stageLabel(stage)}</span></button>)}{!metrics.candidateCount && <p className="muted">No candidates have entered the role yet.</p>}</div></section>
        </div>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section className="product-panel"><div className="product-panel-head"><h2>Search strategy</h2><span>{role.searchLanes.filter(lane => lane.status === 'approved').length}/{role.searchLanes.length} approved</span></div><div className="product-list">{role.searchLanes.slice(0, 5).map(lane => <div className="product-row" key={lane.id}><div className="product-row-main"><div className="product-row-title">{lane.label}</div><div className="product-row-meta">{words(lane.source)}</div></div><span className={`status-pill ${lane.status === 'approved' ? 'success' : lane.status === 'proposed' ? 'warning' : ''}`}>{lane.status}</span></div>)}</div><button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setTab('strategy')}>Open full strategy</button></section>
          <section className="product-panel"><div className="product-panel-head"><h2>Calibration</h2><span>Recruiter feedback</span></div><div className="product-list">{calibrationInsights(role).map(insight => <div className="product-row" key={insight}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{insight}</div></div></div>)}</div></section>
        </aside>
      </div>
    </div>}

    {tab === 'candidates' && <div style={{ display: 'grid', gap: 14 }}>
      <section className="product-panel">
        <div className="product-panel-head"><div><span className="kicker">Role review queue</span><h2>Candidates</h2></div><div className="product-page-actions"><button className="btn secondary" onClick={() => setShowAddCandidate(value => !value)}>{showAddCandidate ? 'Close' : 'Add candidate'}</button><Link className="btn" href={`/app/candidate-database?q=${encodeURIComponent(role.intake.title)}`}>Search graph</Link></div></div>
        {showAddCandidate && <div className="role-inline-form"><div className="grid two"><label>Name<input className="input" value={candidateDraft.name} onChange={event => setCandidateDraft(current => ({ ...current, name: event.target.value }))} /></label><label>Headline<input className="input" value={candidateDraft.headline} onChange={event => setCandidateDraft(current => ({ ...current, headline: event.target.value }))} /></label><label>Company<input className="input" value={candidateDraft.company} onChange={event => setCandidateDraft(current => ({ ...current, company: event.target.value }))} /></label><label>Location<input className="input" value={candidateDraft.location} onChange={event => setCandidateDraft(current => ({ ...current, location: event.target.value }))} /></label><label>Source<input className="input" value={candidateDraft.source} onChange={event => setCandidateDraft(current => ({ ...current, source: event.target.value }))} /></label><label>Source URL<input className="input" value={candidateDraft.sourceUrl || ''} onChange={event => setCandidateDraft(current => ({ ...current, sourceUrl: event.target.value }))} /></label></div><button className="btn" onClick={addCandidate}>Add to review queue</button></div>}
        <div className="role-candidate-toolbar"><input className="input" value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} placeholder="Search candidates in this role" /><select value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="all">All stages</option>{ROLE_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></div>
        <div className="product-list">{filteredCandidates.map(candidate => <button className="product-row role-candidate-row" key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)}><div className="product-row-main"><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div className="product-row-title">{candidate.name}</div><span className={`status-pill ${candidate.fitDecision === 'strong_fit' ? 'success' : candidate.fitDecision === 'possible_fit' ? 'active' : candidate.fitDecision === 'not_fit' ? 'warning' : ''}`}>{words(candidate.fitDecision)}</span></div><div className="product-row-meta">{[candidate.headline, candidate.company, candidate.location, candidate.source].filter(Boolean).join(' · ') || 'Details pending review'}</div><div className="chips">{candidate.tags.slice(0, 5).map(tag => <span className="tag" key={tag}>{tag}</span>)}</div></div><div className="product-row-actions"><span className="status-pill">{stageLabel(candidate.stage)}</span><span className="btn ghost">Review →</span></div></button>)}{!filteredCandidates.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">{role.candidates.length ? 'No candidates match these filters' : 'No candidates yet'}</div><div className="product-row-meta">{role.candidates.length ? 'Clear the search or stage filter.' : 'Search the Candidate Graph, launch AutoSource, or add a calibration candidate.'}</div></div></div>}</div>
      </section>
      {!!role.candidates.length && <details className="advanced-disclosure product-panel"><summary>Pipeline board</summary><div className="role-pipeline-board">{ROLE_STAGES.filter(stage => metrics.byStage[stage] > 0 || ['needs_review', 'shortlisted', 'contact_research', 'ready_for_outreach', 'contacted', 'responded', 'submitted', 'interviewing'].includes(stage)).map(stage => <div className="role-pipeline-column" key={stage}><div className="product-panel-head"><h2>{stageLabel(stage)}</h2><span>{metrics.byStage[stage]}</span></div>{role.candidates.filter(candidate => candidate.stage === stage).map(candidate => <button key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)}>{candidate.name}<small>{candidate.company || candidate.headline || 'Review candidate'}</small></button>)}</div>)}</div></details>}
    </div>}

    {tab === 'strategy' && <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Approved search brief</span><h2>Intake and calibration</h2></div><span>Edits regenerate proposed lanes</span></div><div className="grid two"><label>Role title<input className="input" value={role.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label><label>Location<input className="input" value={role.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label><label>Work mode<select value={role.intake.workMode} onChange={event => updateIntake('workMode', event.target.value)}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label><label>Compensation<input className="input" value={role.intake.compensation} onChange={event => updateIntake('compensation', event.target.value)} /></label><label>Clearance<input className="input" value={role.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label><label>Target companies<input className="input" value={listInput(role.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} /></label></div><label>Must-haves<textarea className="textarea" value={listInput(role.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} /></label><label>Nice-to-haves<textarea className="textarea" value={listInput(role.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label><label>Disqualifiers<textarea className="textarea" value={listInput(role.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label><label>Adjacent backgrounds<textarea className="textarea" value={listInput(role.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} /></label><label>Hiring-manager notes<textarea className="textarea" value={role.intake.hiringManagerNotes} onChange={event => updateIntake('hiringManagerNotes', event.target.value)} /></label><details className="advanced-disclosure"><summary>Original job description</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{role.intake.rawDescription}</pre></details></section>
      </div>
      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}><section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Sourcing lanes</span><h2>Approve the search plan</h2></div><span>{role.searchLanes.length} lanes</span></div><div className="product-list">{role.searchLanes.map(lane => <div className="product-row role-lane-row" key={lane.id}><div className="product-row-main"><div className="product-row-title">{lane.label}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{lane.purpose}</div><details className="advanced-disclosure"><summary>View query</summary><code>{lane.query}</code></details></div><div className="product-row-actions"><span className={`status-pill ${lane.status === 'approved' ? 'success' : lane.status === 'proposed' ? 'warning' : ''}`}>{lane.status}</span>{lane.status !== 'approved' && <button className="btn secondary" onClick={() => updateSelected(current => ({ ...current, searchLanes: current.searchLanes.map(item => item.id === lane.id ? { ...item, status: 'approved' } : item) }))}>Approve</button>}{lane.status !== 'paused' && <button className="btn ghost" onClick={() => updateSelected(current => ({ ...current, searchLanes: current.searchLanes.map(item => item.id === lane.id ? { ...item, status: 'paused' } : item) }))}>Pause</button>}</div></div>)}</div></section></aside>
    </div>}

    {tab === 'activity' && <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Audit trail</span><h2>Role activity</h2></div><span>{role.activity.length} events</span></div><div className="product-list">{role.activity.map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{words(item.type)}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item.message}</div></div><span className="status-pill">{formatDate(item.createdAt)}</span></div>)}</div></section>}

    {selectedCandidate && <CandidateReviewDrawer candidate={selectedCandidate} roleTitle={role.intake.title} onClose={() => setSelectedCandidateId('')} onSave={(patch, activityMessage) => updateCandidate(selectedCandidate.id, patch, activityMessage)} />}
  </div>
}
