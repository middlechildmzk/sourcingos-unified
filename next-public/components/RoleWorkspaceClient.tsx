'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createRoleWorkspace, roleMetrics, type RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

const demoJd = `Program Director - Human Performance and Readiness
Location: Tampa, FL / Hybrid
Compensation: $150,000-$185,000
Clearance: Secret
Lead a complex human performance, readiness, wellness, and family support program serving the special operations community. Must have program management, operations, stakeholder management, federal contracting, and human performance experience. Experience with POTFF, H2F, warrior care, military health, recovery care, or force and family readiness is strongly preferred.`

function statusClass(status: RoleWorkspace['status']) {
  if (status === 'active') return 'active'
  if (status === 'calibrating') return 'warning'
  if (status === 'closed') return 'success'
  return ''
}

export function RoleWorkspaceClient() {
  const { roles, mode, message, addRole } = useRoleWorkspaces()
  const [newRoleText, setNewRoleText] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setShowCreate(true)
  }, [])

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return roles
    return roles.filter(role => [role.intake.title, role.intake.location, role.status, role.intake.clearance]
      .join(' ').toLowerCase().includes(needle))
  }, [query, roles])

  const totals = useMemo(() => roles.reduce((summary, role) => {
    const metrics = roleMetrics(role)
    summary.candidates += metrics.candidateCount
    summary.needsReview += metrics.needsReview
    if (role.status === 'active') summary.active += 1
    if (role.status === 'calibrating') summary.calibrating += 1
    return summary
  }, { active: 0, calibrating: 0, candidates: 0, needsReview: 0 }), [roles])

  function createRole() {
    if (newRoleText.trim().length < 80) {
      setStatus('Paste a complete job description or intake summary before creating the role.')
      return
    }
    const role = createRoleWorkspace(newRoleText)
    addRole(role)
    setNewRoleText('')
    setShowCreate(false)
    setStatus(`Created ${role.intake.title}. Open the role to calibrate strategy and launch the agent.`)
  }

  return <div className="interactive-tool">
    {status && <div className="cta" role="status">{status}</div>}

    <div className="product-page-actions" style={{ marginBottom: 18 }}>
      <button className="btn" onClick={() => setShowCreate(value => !value)}>{showCreate ? 'Close intake' : 'New role'}</button>
      {!showCreate && <button className="btn secondary" onClick={() => { setNewRoleText(demoJd); setShowCreate(true) }}>Load demo intake</button>}
      <span className={`status-pill ${mode === 'supabase' ? 'success' : mode === 'error' ? 'warning' : ''}`}>{mode === 'checking' ? 'connecting' : mode}</span>
    </div>

    {showCreate && <section className="product-panel" style={{ marginBottom: 18 }}>
      <div className="product-panel-head"><div><span className="kicker">New role</span><h2>Create a calibrated workspace</h2></div><span>JD or intake notes</span></div>
      <textarea className="textarea big" value={newRoleText} onChange={event => setNewRoleText(event.target.value)} placeholder="Paste the full job description, hiring-manager notes, or calibrated intake…" style={{ minHeight: 220 }} />
      <div className="button-row"><button className="btn" onClick={createRole}>Create role workspace</button><button className="btn ghost" onClick={() => setNewRoleText(demoJd)}>Use demo</button></div>
      <p className="muted" style={{ fontSize: 11, marginBottom: 0 }}>SourcingOS proposes intake fields and search lanes. The recruiter still approves strategy, identity, fit, disposition, and outreach.</p>
    </section>}

    <div className="product-summary-grid">
      <div className="product-stat"><small>Active roles</small><b>{totals.active}</b><span>Currently sourcing</span></div>
      <div className="product-stat"><small>Calibrating</small><b>{totals.calibrating}</b><span>Need intake or strategy review</span></div>
      <div className="product-stat"><small>Role candidates</small><b>{totals.candidates}</b><span>Across every req</span></div>
      <div className="product-stat"><small>Needs review</small><b>{totals.needsReview}</b><span>Human decisions pending</span></div>
    </div>

    <section className="product-panel">
      <div className="product-panel-head"><div><span className="kicker">Req portfolio</span><h2>Role workspaces</h2></div><span>{roles.length} total</span></div>
      {!!roles.length && <input className="input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roles, locations, status, or clearance" aria-label="Search roles" />}
      <div className="product-list">
        {filteredRoles.map(role => {
          const metrics = roleMetrics(role)
          return <Link className="product-row role-portfolio-row" href={`/app/roles/${role.id}`} key={role.id}>
            <div className="product-row-main">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div className="product-row-title">{role.intake.title}</div><span className={`status-pill ${statusClass(role.status)}`}>{role.status}</span></div>
              <div className="product-row-meta">{[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? role.intake.clearance : '', `${metrics.candidateCount} candidates`, `${metrics.needsReview} to review`].filter(Boolean).join(' · ')}</div>
              <div className="role-progress-line"><span style={{ width: `${Math.min(100, metrics.candidateCount ? 35 + metrics.strongFits * 12 + metrics.contactReady * 8 : role.status === 'active' ? 28 : 14)}%` }} /></div>
            </div>
            <div className="product-row-actions"><span className="status-pill">{role.searchLanes.filter(lane => lane.status === 'approved').length} lanes</span><span className="btn ghost">Open workspace →</span></div>
          </Link>
        })}
        {!filteredRoles.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">{roles.length ? 'No roles match this search' : 'Create your first role'}</div><div className="product-row-meta">{roles.length ? 'Try a title, location, clearance, or role status.' : 'A role becomes the shared home for intake, strategy, candidate review, pipeline, and agent activity.'}</div></div>{!roles.length && <button className="btn" onClick={() => setShowCreate(true)}>Create role</button>}</div>}
      </div>
    </section>

    <div className="role-storage-note">{message}</div>
  </div>
}
