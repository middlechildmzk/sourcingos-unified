'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ROLE_STAGES,
  buildSearchLanes,
  calibrationInsights,
  createRoleWorkspace,
  roleMetrics,
  stageLabel,
  type FitDecision,
  type RoleCandidate,
  type RoleStage,
  type RoleWorkspace,
} from '@/lib/role-workspace'

const STORAGE_KEY = 'sourcingos.v20.role-workspaces'
type Tab = 'overview' | 'intake' | 'search' | 'candidates' | 'pipeline' | 'activity'

const demoJd = `Program Director - Human Performance and Readiness
Location: Tampa, FL / Hybrid
Compensation: $150,000-$185,000
Clearance: Secret
Lead a complex human performance, readiness, wellness, and family support program serving the special operations community. Must have program management, operations, stakeholder management, federal contracting, and human performance experience. Experience with POTFF, H2F, warrior care, military health, recovery care, or force and family readiness is strongly preferred.`

function saveRoles(roles: RoleWorkspace[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roles))
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
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

export function RoleWorkspaceClient() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [tab, setTab] = useState<Tab>('overview')
  const [newRoleText, setNewRoleText] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [candidateDraft, setCandidateDraft] = useState<RoleCandidate>(candidateTemplate())
  const [status, setStatus] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) as RoleWorkspace[] : []
      setRoles(parsed)
      if (parsed[0]) setSelectedId(parsed[0].id)
    } catch {
      setStatus('Stored role data could not be read. No data was changed.')
    }
  }, [])

  useEffect(() => {
    if (!roles.length) return
    try { saveRoles(roles) } catch { setStatus('Role changes could not be saved in this browser.') }
  }, [roles])

  const selected = useMemo(() => roles.find(role => role.id === selectedId) || roles[0], [roles, selectedId])
  const metrics = selected ? roleMetrics(selected) : null

  function commitRoles(next: RoleWorkspace[]) {
    setRoles(next)
    try { saveRoles(next) } catch { setStatus('Role changes could not be saved in this browser.') }
  }

  function updateSelected(updater: (role: RoleWorkspace) => RoleWorkspace) {
    if (!selected) return
    const next = roles.map(role => role.id === selected.id ? updater(role) : role)
    commitRoles(next)
  }

  function createRole() {
    if (newRoleText.trim().length < 80) {
      setStatus('Paste a complete job description or intake summary before creating the role.')
      return
    }
    const role = createRoleWorkspace(newRoleText)
    const next = [role, ...roles]
    commitRoles(next)
    setSelectedId(role.id)
    setNewRoleText('')
    setShowCreate(false)
    setTab('intake')
    setStatus(`Created ${role.intake.title}. Review the calibrated intake before activating search.`)
  }

  function addCandidate() {
    if (!selected || !candidateDraft.name.trim()) {
      setStatus('Candidate name is required.')
      return
    }
    const now = new Date().toISOString()
    updateSelected(role => ({
      ...role,
      candidates: [{ ...candidateDraft, name: candidateDraft.name.trim(), updatedAt: now }, ...role.candidates],
      activity: [{ id: crypto.randomUUID(), type: 'candidate_added', message: `Added ${candidateDraft.name.trim()} from ${candidateDraft.source}.`, createdAt: now }, ...role.activity],
      updatedAt: now,
    }))
    setCandidateDraft(candidateTemplate())
    setStatus('Candidate added to the role review queue. Identity and evidence remain unverified until reviewed.')
  }

  function updateCandidate(candidateId: string, patch: Partial<RoleCandidate>, activityMessage?: string) {
    const now = new Date().toISOString()
    updateSelected(role => ({
      ...role,
      candidates: role.candidates.map(candidate => candidate.id === candidateId ? { ...candidate, ...patch, updatedAt: now } : candidate),
      activity: activityMessage ? [{ id: crypto.randomUUID(), type: patch.stage ? 'stage_changed' : 'candidate_reviewed', message: activityMessage, createdAt: now }, ...role.activity] : role.activity,
      updatedAt: now,
    }))
  }

  function updateIntake(field: keyof RoleWorkspace['intake'], value: string | string[]) {
    const now = new Date().toISOString()
    updateSelected(role => {
      const intake = { ...role.intake, [field]: value }
      return {
        ...role,
        intake,
        searchLanes: buildSearchLanes(intake),
        activity: [{ id: crypto.randomUUID(), type: 'intake_updated', message: `Updated role intake field: ${field}. Search lanes were regenerated for review.`, createdAt: now }, ...role.activity],
        updatedAt: now,
      }
    })
  }

  function listInput(value: string[]) {
    return value.join(', ')
  }

  function parseList(value: string) {
    return Array.from(new Set(value.split(/[,\n]/).map(item => item.trim()).filter(Boolean))).slice(0, 30)
  }

  if (!roles.length && !showCreate) {
    return (
      <div className="interactive-tool">
        <section className="card">
          <span className="kicker">SourcingOS V20</span>
          <h1>Build your first active role workspace.</h1>
          <p className="lead">The role becomes the center of sourcing: intake, search plan, candidate review, evidence, contact research, pipeline, and activity.</p>
          <div className="button-row">
            <button className="btn" onClick={() => setShowCreate(true)}>Create a role</button>
            <button className="btn secondary" onClick={() => { setNewRoleText(demoJd); setShowCreate(true) }}>Load POTFF-style demo</button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="interactive-tool">
      {status && <div className="cta" role="status">{status}</div>}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="result-head">
          <div>
            <span className="kicker">Daily sourcing command center</span>
            <h1 style={{ marginBottom: 6 }}>Role Workspaces</h1>
            <p className="muted">Role-centered workflow with recruiter-controlled calibration and no automatic outreach or identity merge.</p>
          </div>
          <button className="btn" onClick={() => setShowCreate(value => !value)}>{showCreate ? 'Close' : 'New role'}</button>
        </div>
        {showCreate && (
          <div style={{ marginTop: 16 }}>
            <label htmlFor="role-jd">Job description or intake summary</label>
            <textarea id="role-jd" value={newRoleText} onChange={event => setNewRoleText(event.target.value)} style={{ width: '100%', minHeight: 200 }} placeholder="Paste the full JD, hiring-manager notes, or role intake..." />
            <div className="button-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={createRole}>Create calibrated workspace</button>
              <button className="btn secondary" onClick={() => setNewRoleText(demoJd)}>Load demo role</button>
            </div>
          </div>
        )}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, 300px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <aside className="card" style={{ position: 'sticky', top: 16 }}>
          <span className="kicker">Active req load</span>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {roles.map(role => {
              const roleMetric = roleMetrics(role)
              return (
                <button key={role.id} onClick={() => { setSelectedId(role.id); setTab('overview') }} style={{ textAlign: 'left', padding: 12, border: role.id === selected?.id ? '1px solid var(--accent)' : '1px solid var(--line)', borderRadius: 10, background: 'var(--panel)', color: 'var(--text)' }}>
                  <strong style={{ display: 'block' }}>{role.intake.title}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>{role.intake.location} · {roleMetric.candidateCount} candidates</span>
                </button>
              )
            })}
          </div>
        </aside>

        {selected && metrics ? (
          <main style={{ minWidth: 0 }}>
            <section className="card" style={{ marginBottom: 16 }}>
              <div className="result-head">
                <div>
                  <span className="kicker">{selected.status}</span>
                  <h2>{selected.intake.title}</h2>
                  <p className="muted">{selected.intake.location} · {selected.intake.workMode} · Clearance: {selected.intake.clearance}</p>
                </div>
                <select value={selected.status} onChange={event => updateSelected(role => ({ ...role, status: event.target.value as RoleWorkspace['status'], updatedAt: new Date().toISOString() }))} aria-label="Role status">
                  <option value="draft">Draft</option><option value="calibrating">Calibrating</option><option value="active">Active</option><option value="paused">Paused</option><option value="closed">Closed</option>
                </select>
              </div>
              <div className="chips" style={{ marginTop: 12 }}>
                {(['overview', 'intake', 'search', 'candidates', 'pipeline', 'activity'] as Tab[]).map(item => <button key={item} className={tab === item ? 'btn' : 'btn ghost'} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
              </div>
            </section>

            {tab === 'overview' && (
              <>
                <div className="grid">
                  <div className="card"><span className="kicker">Candidates</span><div className="big-number">{metrics.candidateCount}</div></div>
                  <div className="card"><span className="kicker">Needs review</span><div className="big-number">{metrics.needsReview}</div></div>
                  <div className="card"><span className="kicker">Strong fits</span><div className="big-number">{metrics.strongFits}</div></div>
                  <div className="card"><span className="kicker">Contact ready</span><div className="big-number">{metrics.contactReady}</div></div>
                </div>
                <section className="card">
                  <span className="kicker">Next-best actions</span>
                  <h2>Move this search forward.</h2>
                  <ul>
                    {selected.status === 'calibrating' && <li>Review intake and approve the role before broad sourcing.</li>}
                    {selected.searchLanes.some(lane => lane.status === 'proposed') && <li>Approve or pause proposed search lanes.</li>}
                    {metrics.needsReview > 0 && <li>Review {metrics.needsReview} candidate record(s) and record fit rationale.</li>}
                    {metrics.candidateCount === 0 && <li>Add an initial calibration batch of three to five candidates.</li>}
                    {metrics.conflicts > 0 && <li>Resolve {metrics.conflicts} evidence conflict(s) before outreach.</li>}
                  </ul>
                  <div className="button-row">
                    <button className="btn" onClick={() => setTab('candidates')}>Open review queue</button>
                    <Link href="/app/candidate-search" className="btn secondary">Search candidates</Link>
                    <Link href="/app/evidence-ledger" className="btn secondary">Evidence Ledger</Link>
                  </div>
                </section>
                <section className="card">
                  <span className="kicker">Calibration intelligence</span>
                  <h2>Patterns from recruiter feedback</h2>
                  <ul>{calibrationInsights(selected).map(insight => <li key={insight}>{insight}</li>)}</ul>
                </section>
              </>
            )}

            {tab === 'intake' && (
              <section className="card">
                <span className="kicker">Approved search brief</span>
                <h2>Calibrate before sourcing.</h2>
                <div className="grid two">
                  <label>Role title<input value={selected.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label>
                  <label>Location<input value={selected.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label>
                  <label>Work mode<select value={selected.intake.workMode} onChange={event => updateIntake('workMode', event.target.value)}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label>
                  <label>Compensation<input value={selected.intake.compensation} onChange={event => updateIntake('compensation', event.target.value)} /></label>
                  <label>Clearance<input value={selected.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label>
                  <label>Target companies<input value={listInput(selected.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} /></label>
                </div>
                <label>Must-haves<textarea value={listInput(selected.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} /></label>
                <label>Nice-to-haves<textarea value={listInput(selected.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label>
                <label>Disqualifiers<textarea value={listInput(selected.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label>
                <label>Adjacent backgrounds<textarea value={listInput(selected.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} /></label>
                <label>Hiring-manager notes<textarea value={selected.intake.hiringManagerNotes} onChange={event => updateIntake('hiringManagerNotes', event.target.value)} /></label>
                <p className="muted">Edits regenerate proposed search lanes. Activation remains recruiter-controlled.</p>
              </section>
            )}

            {tab === 'search' && (
              <section className="card">
                <span className="kicker">Multi-lane sourcing plan</span>
                <h2>Approve lanes, then launch deliberately.</h2>
                <div className="results">
                  {selected.searchLanes.map(lane => (
                    <article className="result-card" key={lane.id}>
                      <div className="result-head"><span>{lane.source.replaceAll('_', ' ')}</span><span>{lane.status}</span></div>
                      <h3>{lane.label}</h3><p>{lane.purpose}</p><code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{lane.query}</code>
                      <div className="button-row" style={{ marginTop: 12 }}>
                        <button className="btn" onClick={() => updateSelected(role => ({ ...role, searchLanes: role.searchLanes.map(item => item.id === lane.id ? { ...item, status: 'approved' } : item), updatedAt: new Date().toISOString() }))}>Approve</button>
                        <button className="btn secondary" onClick={() => updateSelected(role => ({ ...role, searchLanes: role.searchLanes.map(item => item.id === lane.id ? { ...item, status: 'paused' } : item), updatedAt: new Date().toISOString() }))}>Pause</button>
                        {lane.source === 'candidate_database' && <Link className="btn ghost" href="/app/candidate-database">Open database</Link>}
                        {lane.source === 'network' && <Link className="btn ghost" href="/app/network">Open network</Link>}
                        {lane.source !== 'candidate_database' && lane.source !== 'network' && <Link className="btn ghost" href={`/app/candidate-search?q=${encodeURIComponent(lane.query)}`}>Launch search</Link>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {tab === 'candidates' && (
              <>
                <section className="card">
                  <span className="kicker">Add calibration candidate</span>
                  <h2>Capture a lead without overstating identity or fit.</h2>
                  <div className="grid two">
                    <label>Name<input value={candidateDraft.name} onChange={event => setCandidateDraft({ ...candidateDraft, name: event.target.value })} /></label>
                    <label>Headline<input value={candidateDraft.headline} onChange={event => setCandidateDraft({ ...candidateDraft, headline: event.target.value })} /></label>
                    <label>Company<input value={candidateDraft.company} onChange={event => setCandidateDraft({ ...candidateDraft, company: event.target.value })} /></label>
                    <label>Location<input value={candidateDraft.location} onChange={event => setCandidateDraft({ ...candidateDraft, location: event.target.value })} /></label>
                    <label>Source<input value={candidateDraft.source} onChange={event => setCandidateDraft({ ...candidateDraft, source: event.target.value })} /></label>
                    <label>Source URL<input value={candidateDraft.sourceUrl || ''} onChange={event => setCandidateDraft({ ...candidateDraft, sourceUrl: event.target.value })} /></label>
                  </div>
                  <button className="btn" onClick={addCandidate}>Add to review queue</button>
                </section>
                <section className="card">
                  <span className="kicker">Candidate review queue</span>
                  <h2>{selected.candidates.length} candidate record(s)</h2>
                  {!selected.candidates.length ? <p className="muted">No candidates yet. Add the first calibration batch or launch an approved search lane.</p> : (
                    <div className="results">
                      {selected.candidates.map(candidate => (
                        <article className="result-card" key={candidate.id}>
                          <div className="result-head"><span>{candidate.source}</span><span>{stageLabel(candidate.stage)}</span></div>
                          <h3>{candidate.name}</h3>
                          <p className="muted">{[candidate.headline, candidate.company, candidate.location].filter(Boolean).join(' · ') || 'Details pending review'}</p>
                          <div className="grid two">
                            <label>Fit decision<select value={candidate.fitDecision} onChange={event => updateCandidate(candidate.id, { fitDecision: event.target.value as FitDecision }, `Reviewed ${candidate.name}: ${event.target.value.replaceAll('_', ' ')}.`)}><option value="unreviewed">Unreviewed</option><option value="strong_fit">Strong fit</option><option value="possible_fit">Possible fit</option><option value="not_fit">Not a fit</option></select></label>
                            <label>Pipeline stage<select value={candidate.stage} onChange={event => updateCandidate(candidate.id, { stage: event.target.value as RoleStage }, `Moved ${candidate.name} to ${stageLabel(event.target.value as RoleStage)}.`)}>{ROLE_STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></label>
                            <label>Evidence state<select value={candidate.evidenceStatus} onChange={event => updateCandidate(candidate.id, { evidenceStatus: event.target.value as RoleCandidate['evidenceStatus'] })}><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option><option value="conflicting">Conflicting</option><option value="stale">Stale</option></select></label>
                            <label>Contact state<select value={candidate.contactStatus} onChange={event => updateCandidate(candidate.id, { contactStatus: event.target.value as RoleCandidate['contactStatus'] })}><option value="unknown">Unknown</option><option value="signals_found">Signals found</option><option value="verified">Verified</option><option value="blocked">Blocked</option></select></label>
                          </div>
                          <label>Fit reasons<input value={candidate.fitReasons.join(', ')} onChange={event => updateCandidate(candidate.id, { fitReasons: parseList(event.target.value) })} /></label>
                          <label>Concerns<input value={candidate.concerns.join(', ')} onChange={event => updateCandidate(candidate.id, { concerns: parseList(event.target.value) })} /></label>
                          <label>Tags<input value={candidate.tags.join(', ')} onChange={event => updateCandidate(candidate.id, { tags: parseList(event.target.value) })} /></label>
                          <div className="button-row">
                            {candidate.sourceUrl && <a className="btn ghost" href={candidate.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}
                            {candidate.candidateId && <Link className="btn ghost" href={`/app/candidate/${candidate.candidateId}`}>Candidate 360</Link>}
                            <Link className="btn ghost" href="/app/evidence-ledger">Review evidence</Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {tab === 'pipeline' && (
              <section className="card">
                <span className="kicker">Recruiter-controlled pipeline</span>
                <h2>Move candidates only after review.</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 12, overflowX: 'auto' }}>
                  {ROLE_STAGES.filter(stage => metrics.byStage[stage] > 0 || ['needs_review', 'shortlisted', 'contact_research', 'ready_for_outreach', 'contacted', 'responded', 'submitted', 'interviewing'].includes(stage)).map(stage => (
                    <div className="card" key={stage} style={{ minWidth: 220 }}>
                      <div className="result-head"><strong>{stageLabel(stage)}</strong><span>{metrics.byStage[stage]}</span></div>
                      {selected.candidates.filter(candidate => candidate.stage === stage).map(candidate => <button key={candidate.id} className="btn ghost" style={{ width: '100%', textAlign: 'left', marginTop: 8 }} onClick={() => { setTab('candidates'); setStatus(`Reviewing ${candidate.name}.`) }}>{candidate.name}</button>)}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tab === 'activity' && (
              <section className="card">
                <span className="kicker">Audit trail</span><h2>Role activity</h2>
                <div className="results">{selected.activity.map(item => <div className="card" key={item.id}><div className="result-head"><span>{item.type.replaceAll('_', ' ')}</span><span>{formatDate(item.createdAt)}</span></div><p>{item.message}</p></div>)}</div>
              </section>
            )}
          </main>
        ) : null}
      </div>
    </div>
  )
}
