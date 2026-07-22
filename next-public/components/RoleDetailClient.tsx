'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ROLE_STAGES,
  buildSearchLanes,
  calibrationInsights,
  roleMetrics,
  stageLabel,
  type RoleActivity,
  type RoleCandidate,
  type RoleStage,
  type RoleWorkspace,
} from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import {
  CandidateComparisonDialog,
  CandidateReviewDrawer,
  candidateReviewScore,
} from '@/components/CandidateReviewPro'
import { ProductIcon } from '@/components/ProductIcon'

type Tab = 'overview' | 'candidates' | 'strategy' | 'activity'

type UndoSnapshot = {
  candidates: RoleCandidate[]
  message: string
}

function words(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(/[,\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 30)
}

function listInput(value: string[]): string {
  return value.join(', ')
}

function candidateTemplate(): RoleCandidate {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: '',
    headline: '',
    company: '',
    location: '',
    source: 'manual research',
    stage: 'needs_review',
    fitDecision: 'unreviewed',
    fitReasons: [],
    concerns: [],
    tags: [],
    contactStatus: 'unknown',
    evidenceStatus: 'unreviewed',
    addedAt: now,
    updatedAt: now,
  }
}

function candidatePriority(candidate: RoleCandidate): number {
  if (candidate.evidenceStatus === 'conflicting') return 0
  if (candidate.fitDecision === 'unreviewed') return 1
  if (candidate.stage === 'needs_review') return 2
  if (candidate.evidenceStatus === 'stale') return 3
  if (candidate.fitDecision === 'possible_fit') return 4
  if (candidate.fitDecision === 'strong_fit') return 5
  return 6
}

export function RoleDetailClient({ roleId }: { roleId: string }) {
  const { roles, mode, message, updateRole, syncWorkspace } = useRoleWorkspaces()
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [candidateQuery, setCandidateQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [candidateDraft, setCandidateDraft] = useState<RoleCandidate>(candidateTemplate())
  const [bulkStage, setBulkStage] = useState<RoleStage>('shortlisted')
  const [compareOpen, setCompareOpen] = useState(false)
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null)
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')

  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const metrics = role ? roleMetrics(role) : null
  const selectedCandidate = role?.candidates.find(candidate => candidate.id === selectedCandidateId)

  const filteredCandidates = useMemo(() => {
    if (!role) return []
    const needle = candidateQuery.trim().toLowerCase()
    return role.candidates
      .filter(candidate => {
        if (stageFilter !== 'all' && candidate.stage !== stageFilter) return false
        if (!needle) return true
        return [candidate.name, candidate.headline, candidate.company, candidate.location, candidate.source, ...candidate.tags, ...candidate.fitReasons].join(' ').toLowerCase().includes(needle)
      })
      .sort((a, b) => candidatePriority(a) - candidatePriority(b) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [candidateQuery, role, stageFilter])

  const selectedCandidates = useMemo(() => role?.candidates.filter(candidate => selectedIds.includes(candidate.id)) || [], [role, selectedIds])
  const reviewedCount = role?.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length || 0
  const reviewProgress = role?.candidates.length ? Math.round((reviewedCount / role.candidates.length) * 100) : 0
  const conflictCount = role?.candidates.filter(candidate => candidate.evidenceStatus === 'conflicting').length || 0

  useEffect(() => {
    if (!role) return
    setSelectedIds(current => current.filter(id => role.candidates.some(candidate => candidate.id === id)))
  }, [role])

  useEffect(() => {
    if (!undoSnapshot) return
    const timer = window.setTimeout(() => setUndoSnapshot(null), 9000)
    return () => window.clearTimeout(timer)
  }, [undoSnapshot])

  function updateSelected(updater: (workspace: RoleWorkspace) => RoleWorkspace) {
    return updateRole(roleId, current => ({ ...updater(current), updatedAt: new Date().toISOString() }))
  }

  function rememberUndo(messageText: string) {
    if (!role) return
    setUndoSnapshot({ candidates: role.candidates.map(candidate => ({ ...candidate })), message: messageText })
  }

  function addActivity(type: RoleActivity['type'], messageText: string, createdAt: string): RoleActivity {
    return { id: crypto.randomUUID(), type, message: messageText, createdAt }
  }

  function updateCandidate(candidateId: string, patch: Partial<RoleCandidate>, activityMessage: string, advance = false) {
    if (!role) return
    const nextId = advance ? nextCandidateId(candidateId) : ''
    rememberUndo(activityMessage)
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: current.candidates.map(candidate => candidate.id === candidateId ? { ...candidate, ...patch, updatedAt: now } : candidate),
      activity: [addActivity('candidate_reviewed', activityMessage, now), ...current.activity],
    }))
    setStatus(activityMessage)
    setSelectedCandidateId(nextId)
  }

  function updateCandidates(candidateIds: string[], patch: Partial<RoleCandidate>, activityMessage: string, activityType: RoleActivity['type'] = 'candidate_reviewed') {
    if (!role || !candidateIds.length) return
    rememberUndo(activityMessage)
    const idSet = new Set(candidateIds)
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: current.candidates.map(candidate => idSet.has(candidate.id) ? { ...candidate, ...patch, updatedAt: now } : candidate),
      activity: [addActivity(activityType, activityMessage, now), ...current.activity],
    }))
    setSelectedIds([])
    setStatus(activityMessage)
  }

  function undoLastCandidateChange() {
    if (!undoSnapshot) return
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: undoSnapshot.candidates,
      activity: [addActivity('note_added', `Undid candidate change: ${undoSnapshot.message}`, now), ...current.activity],
    }))
    setStatus('Candidate change undone.')
    setUndoSnapshot(null)
  }

  function nextCandidateId(candidateId: string): string {
    const index = filteredCandidates.findIndex(candidate => candidate.id === candidateId)
    if (index >= 0 && index < filteredCandidates.length - 1) return filteredCandidates[index + 1].id
    return ''
  }

  function openNextReview() {
    const candidate = filteredCandidates.find(item => item.evidenceStatus === 'conflicting')
      || filteredCandidates.find(item => item.fitDecision === 'unreviewed')
      || filteredCandidates.find(item => item.stage === 'needs_review')
      || filteredCandidates[0]
    if (candidate) setSelectedCandidateId(candidate.id)
  }

  function toggleSelected(candidateId: string) {
    setSelectedIds(current => current.includes(candidateId) ? current.filter(id => id !== candidateId) : [...current, candidateId])
  }

  function toggleAllFiltered() {
    const filteredIds = filteredCandidates.map(candidate => candidate.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id))
    setSelectedIds(current => allSelected ? current.filter(id => !filteredIds.includes(id)) : Array.from(new Set([...current, ...filteredIds])))
  }

  function updateIntake(field: keyof RoleWorkspace['intake'], value: string | string[]) {
    const now = new Date().toISOString()
    updateSelected(current => {
      const intake = { ...current.intake, [field]: value }
      return {
        ...current,
        intake,
        searchLanes: buildSearchLanes(intake),
        activity: [addActivity('intake_updated', `Updated ${field}. Search lanes were regenerated for review.`, now), ...current.activity],
      }
    })
  }

  function addCandidate() {
    if (!candidateDraft.name.trim()) { setStatus('Candidate name is required.'); return }
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: [{ ...candidateDraft, name: candidateDraft.name.trim(), updatedAt: now }, ...current.candidates],
      activity: [addActivity('candidate_added', `Added ${candidateDraft.name.trim()} from ${candidateDraft.source}.`, now), ...current.activity],
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
    {status && <div className="cta role-status-banner" role="status"><span>{status}</span>{undoSnapshot && <button className="btn ghost" onClick={undoLastCandidateChange}>Undo</button>}</div>}

    <div className="product-page-head role-detail-head">
      <div><div className="role-title-status"><span className="kicker">Role workspace</span><span className={`status-pill ${role.status === 'active' ? 'active' : role.status === 'calibrating' ? 'warning' : ''}`}>{role.status}</span></div><h1>{role.intake.title}</h1><p>{[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? `Clearance: ${role.intake.clearance}` : ''].filter(Boolean).join(' · ')}</p></div>
      <div className="product-page-actions"><select value={role.status} onChange={event => updateSelected(current => ({ ...current, status: event.target.value as RoleWorkspace['status'] }))} aria-label="Role status"><option value="draft">Draft</option><option value="calibrating">Calibrating</option><option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option></select><button className="btn secondary" onClick={() => void syncWorkspace(role)}>Sync now</button><button className="btn" disabled={!!working} onClick={launchAgent}>{working || 'Launch agent'}</button></div>
    </div>

    <nav className="role-tabs" aria-label="Role workspace sections">
      {(['overview', 'candidates', 'strategy', 'activity'] as Tab[]).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}{item === 'candidates' && metrics.needsReview ? <span>{metrics.needsReview}</span> : null}</button>)}
    </nav>

    {tab === 'overview' && <div className="role-section-stack">
      <div className="product-summary-grid">
        <div className="product-stat"><small>Candidates</small><b>{metrics.candidateCount}</b><span>In this role</span></div>
        <div className="product-stat"><small>Needs review</small><b>{metrics.needsReview}</b><span>Human decisions pending</span></div>
        <div className="product-stat"><small>Strong fits</small><b>{metrics.strongFits}</b><span>Role-specific decisions</span></div>
        <div className="product-stat"><small>Outreach ready</small><b>{metrics.contactReady}</b><span>Still requires recruiter action</span></div>
      </div>
      <div className="product-layout">
        <div className="role-section-stack">
          <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Next best actions</span><h2>Move this search forward</h2></div><span>{nextActions.length} actions</span></div><div className="product-list">{nextActions.map((action, index) => <div className="product-row" key={action}><span className="role-action-number">{index + 1}</span><div className="product-row-main"><div className="product-row-title">{action}</div></div></div>)}{!nextActions.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Role is moving</div><div className="product-row-meta">No urgent calibration or review blockers are visible.</div></div><span className="status-pill success">clear</span></div>}</div><div className="button-row role-panel-actions"><button className="btn" onClick={() => setTab('candidates')}>Review candidates</button><button className="btn secondary" onClick={() => setTab('strategy')}>Review strategy</button><Link className="btn ghost" href={`/app/candidate-database?q=${encodeURIComponent(role.intake.title)}`}>Search graph</Link></div></section>
          <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Pipeline</span><h2>Role flow</h2></div><span>{metrics.candidateCount} candidates</span></div><div className="role-stage-summary">{ROLE_STAGES.filter(stage => metrics.byStage[stage] > 0).map(stage => <button key={stage} onClick={() => { setStageFilter(stage); setTab('candidates') }}><b>{metrics.byStage[stage]}</b><span>{stageLabel(stage)}</span></button>)}{!metrics.candidateCount && <p className="muted">No candidates have entered the role yet.</p>}</div></section>
        </div>
        <aside className="role-aside-stack">
          <section className="product-panel"><div className="product-panel-head"><h2>Search strategy</h2><span>{role.searchLanes.filter(lane => lane.status === 'approved').length}/{role.searchLanes.length} approved</span></div><div className="product-list">{role.searchLanes.slice(0, 5).map(lane => <div className="product-row" key={lane.id}><div className="product-row-main"><div className="product-row-title">{lane.label}</div><div className="product-row-meta">{words(lane.source)}</div></div><span className={`status-pill ${lane.status === 'approved' ? 'success' : lane.status === 'proposed' ? 'warning' : ''}`}>{lane.status}</span></div>)}</div><button className="btn ghost role-panel-button" onClick={() => setTab('strategy')}>Open full strategy</button></section>
          <section className="product-panel"><div className="product-panel-head"><h2>Calibration</h2><span>Recruiter feedback</span></div><div className="product-list">{calibrationInsights(role).map(insight => <div className="product-row" key={insight}><div className="product-row-main"><div className="product-row-meta normal-wrap">{insight}</div></div></div>)}</div></section>
        </aside>
      </div>
    </div>}

    {tab === 'candidates' && <div className="role-section-stack">
      <section className="candidate-review-command product-panel">
        <div className="candidate-review-command-copy"><span className="kicker">Candidate Review Pro</span><h2>Clear the role queue without losing evidence context</h2><p>Review conflicts first, make role-specific decisions, compare finalists, and use keyboard shortcuts for repetitive work.</p></div>
        <div className="candidate-review-command-progress"><div><span>Reviewed</span><b>{reviewedCount}/{role.candidates.length}</b></div><div className="candidate-review-progress-track"><span style={{ width: `${reviewProgress}%` }} /></div><small>{conflictCount ? `${conflictCount} evidence conflict${conflictCount === 1 ? '' : 's'} require attention` : 'No evidence conflicts in the current role queue'}</small></div>
        <button className="btn" disabled={!filteredCandidates.length} onClick={openNextReview}>Review next candidate</button>
      </section>

      <section className="product-panel">
        <div className="product-panel-head"><div><span className="kicker">Role review queue</span><h2>Candidates</h2></div><div className="product-page-actions"><button className="btn secondary" onClick={() => setShowAddCandidate(value => !value)}>{showAddCandidate ? 'Close' : 'Add candidate'}</button><Link className="btn" href={`/app/candidate-database?q=${encodeURIComponent(role.intake.title)}`}>Search graph</Link></div></div>
        {showAddCandidate && <div className="role-inline-form"><div className="grid two"><label>Name<input className="input" value={candidateDraft.name} onChange={event => setCandidateDraft(current => ({ ...current, name: event.target.value }))} /></label><label>Headline<input className="input" value={candidateDraft.headline} onChange={event => setCandidateDraft(current => ({ ...current, headline: event.target.value }))} /></label><label>Company<input className="input" value={candidateDraft.company} onChange={event => setCandidateDraft(current => ({ ...current, company: event.target.value }))} /></label><label>Location<input className="input" value={candidateDraft.location} onChange={event => setCandidateDraft(current => ({ ...current, location: event.target.value }))} /></label><label>Source<input className="input" value={candidateDraft.source} onChange={event => setCandidateDraft(current => ({ ...current, source: event.target.value }))} /></label><label>Source URL<input className="input" value={candidateDraft.sourceUrl || ''} onChange={event => setCandidateDraft(current => ({ ...current, sourceUrl: event.target.value }))} /></label></div><button className="btn" onClick={addCandidate}>Add to review queue</button></div>}

        <div className="role-candidate-toolbar candidate-review-toolbar"><input className="input" value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} placeholder="Search candidates in this role" aria-label="Search candidates in this role" /><select value={stageFilter} onChange={event => setStageFilter(event.target.value)} aria-label="Filter candidates by stage"><option value="all">All stages</option>{ROLE_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></div>

        {!!filteredCandidates.length && <div className="candidate-selection-row"><label><input type="checkbox" checked={filteredCandidates.every(candidate => selectedIds.includes(candidate.id))} onChange={toggleAllFiltered} /> Select all {filteredCandidates.length} visible candidates</label><span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select candidates for bulk actions or comparison'}</span></div>}

        {!!selectedIds.length && <div className="candidate-bulk-bar" role="region" aria-label="Bulk candidate actions"><div><b>{selectedIds.length} selected</b><span>Changes remain role-specific and can be undone.</span></div><select value={bulkStage} onChange={event => setBulkStage(event.target.value as RoleStage)} aria-label="Bulk pipeline stage">{ROLE_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select><button className="btn secondary" onClick={() => updateCandidates(selectedIds, { stage: bulkStage }, `Moved ${selectedIds.length} candidates to ${stageLabel(bulkStage)}.`, 'stage_changed')}>Apply stage</button><button className="btn ghost" onClick={() => updateCandidates(selectedIds, { fitDecision: 'strong_fit' }, `Marked ${selectedIds.length} candidates strong fit.`)}>Strong fit</button><button className="btn ghost" onClick={() => updateCandidates(selectedIds, { fitDecision: 'not_fit', stage: 'archived' }, `Archived ${selectedIds.length} candidates as not fit.`, 'stage_changed')}>Not fit</button><button className="btn secondary" disabled={selectedIds.length < 2 || selectedIds.length > 5} onClick={() => setCompareOpen(true)}>Compare {selectedIds.length >= 2 && selectedIds.length <= 5 ? selectedIds.length : ''}</button><button className="btn ghost" onClick={() => setSelectedIds([])}>Clear</button></div>}

        <div className="candidate-review-list">
          {filteredCandidates.map(candidate => {
            const score = candidateReviewScore(candidate, role.intake)
            const selected = selectedIds.includes(candidate.id)
            return <article className={`candidate-review-row ${selected ? 'selected' : ''}`} key={candidate.id}>
              <label className="candidate-review-checkbox"><input type="checkbox" checked={selected} onChange={() => toggleSelected(candidate.id)} aria-label={`Select ${candidate.name}`} /></label>
              <button className="candidate-review-open" onClick={() => setSelectedCandidateId(candidate.id)}>
                <span className="candidate-review-avatar"><ProductIcon name="candidates" /></span>
                <span className="candidate-review-main"><span className="candidate-review-name-row"><b>{candidate.name}</b><span className={`status-pill ${candidate.fitDecision === 'strong_fit' ? 'success' : candidate.fitDecision === 'possible_fit' ? 'active' : candidate.fitDecision === 'not_fit' ? 'warning' : ''}`}>{words(candidate.fitDecision)}</span>{candidate.evidenceStatus === 'conflicting' && <span className="status-pill warning">evidence conflict</span>}</span><span className="candidate-review-meta">{[candidate.headline, candidate.company, candidate.location, candidate.source].filter(Boolean).join(' · ') || 'Details pending review'}</span><span className="candidate-review-signals">{candidate.fitReasons[0] || candidate.concerns[0] || 'Role evidence has not been summarized yet.'}</span><span className="chips">{candidate.tags.slice(0, 5).map(tag => <span className="tag" key={tag}>{tag}</span>)}</span></span>
                <span className="candidate-review-row-aside"><span className={`candidate-review-score ${score >= 70 ? 'strong' : score >= 45 ? 'supported' : ''}`}>{score}</span><span className="status-pill">{stageLabel(candidate.stage)}</span><span className="candidate-review-link">Review →</span></span>
              </button>
            </article>
          })}
          {!filteredCandidates.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">{role.candidates.length ? 'No candidates match these filters' : 'No candidates yet'}</div><div className="product-row-meta normal-wrap">{role.candidates.length ? 'Clear the search or stage filter.' : 'Search the Candidate Graph, launch AutoSource, or add a calibration candidate.'}</div></div></div>}
        </div>
      </section>

      {!!role.candidates.length && <details className="advanced-disclosure product-panel"><summary>Pipeline board</summary><div className="role-pipeline-board">{ROLE_STAGES.filter(stage => metrics.byStage[stage] > 0 || ['needs_review', 'shortlisted', 'contact_research', 'ready_for_outreach', 'contacted', 'responded', 'submitted', 'interviewing'].includes(stage)).map(stage => <div className="role-pipeline-column" key={stage}><div className="product-panel-head"><h2>{stageLabel(stage)}</h2><span>{metrics.byStage[stage]}</span></div>{role.candidates.filter(candidate => candidate.stage === stage).map(candidate => <button key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)}>{candidate.name}<small>{candidate.company || candidate.headline || 'Review candidate'}</small></button>)}</div>)}</div></details>}
    </div>}

    {tab === 'strategy' && <div className="product-layout">
      <div className="role-section-stack"><section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Approved search brief</span><h2>Intake and calibration</h2></div><span>Edits regenerate proposed lanes</span></div><div className="grid two"><label>Role title<input className="input" value={role.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label><label>Location<input className="input" value={role.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label><label>Work mode<select value={role.intake.workMode} onChange={event => updateIntake('workMode', event.target.value)}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label><label>Compensation<input className="input" value={role.intake.compensation} onChange={event => updateIntake('compensation', event.target.value)} /></label><label>Clearance<input className="input" value={role.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label><label>Target companies<input className="input" value={listInput(role.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} /></label></div><label>Must-haves<textarea className="textarea" value={listInput(role.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} /></label><label>Nice-to-haves<textarea className="textarea" value={listInput(role.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label><label>Disqualifiers<textarea className="textarea" value={listInput(role.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label><label>Adjacent backgrounds<textarea className="textarea" value={listInput(role.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} /></label><label>Hiring-manager notes<textarea className="textarea" value={role.intake.hiringManagerNotes} onChange={event => updateIntake('hiringManagerNotes', event.target.value)} /></label><details className="advanced-disclosure"><summary>Original job description</summary><pre className="normal-wrap">{role.intake.rawDescription}</pre></details></section></div>
      <aside className="role-aside-stack"><section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Sourcing lanes</span><h2>Approve the search plan</h2></div><span>{role.searchLanes.length} lanes</span></div><div className="product-list">{role.searchLanes.map(lane => <div className="product-row role-lane-row" key={lane.id}><div className="product-row-main"><div className="product-row-title">{lane.label}</div><div className="product-row-meta normal-wrap">{lane.purpose}</div><details className="advanced-disclosure"><summary>View query</summary><code>{lane.query}</code></details></div><div className="product-row-actions"><span className={`status-pill ${lane.status === 'approved' ? 'success' : lane.status === 'proposed' ? 'warning' : ''}`}>{lane.status}</span>{lane.status !== 'approved' && <button className="btn secondary" onClick={() => updateSelected(current => ({ ...current, searchLanes: current.searchLanes.map(item => item.id === lane.id ? { ...item, status: 'approved' } : item) }))}>Approve</button>}{lane.status !== 'paused' && <button className="btn ghost" onClick={() => updateSelected(current => ({ ...current, searchLanes: current.searchLanes.map(item => item.id === lane.id ? { ...item, status: 'paused' } : item) }))}>Pause</button>}</div></div>)}</div></section></aside>
    </div>}

    {tab === 'activity' && <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Audit trail</span><h2>Role activity</h2></div><span>{role.activity.length} events</span></div><div className="product-list">{role.activity.map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{words(item.type)}</div><div className="product-row-meta normal-wrap">{item.message}</div></div><span className="status-pill">{formatDate(item.createdAt)}</span></div>)}</div></section>}

    {selectedCandidate && <CandidateReviewDrawer
      candidate={selectedCandidate}
      intake={role.intake}
      position={Math.max(1, filteredCandidates.findIndex(candidate => candidate.id === selectedCandidate.id) + 1)}
      total={filteredCandidates.length || role.candidates.length}
      hasNext={Boolean(nextCandidateId(selectedCandidate.id))}
      onClose={() => setSelectedCandidateId('')}
      onNext={() => setSelectedCandidateId(nextCandidateId(selectedCandidate.id))}
      onSave={(patch, activityMessage, advance) => updateCandidate(selectedCandidate.id, patch, activityMessage, advance)}
    />}

    {compareOpen && <CandidateComparisonDialog candidates={selectedCandidates} intake={role.intake} onClose={() => setCompareOpen(false)} onReview={candidateId => { setCompareOpen(false); setSelectedCandidateId(candidateId) }} />}
  </div>
}
