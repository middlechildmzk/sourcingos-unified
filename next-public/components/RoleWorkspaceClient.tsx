'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { roleMetrics, type RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import { RoleIntakeWizard } from '@/components/RoleIntakeWizard'

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

function roleHealth(role: RoleWorkspace): number {
  const metrics = roleMetrics(role)
  const approved = role.searchLanes.filter(lane => lane.status === 'approved').length
  let score = role.status === 'active' ? 35 : role.status === 'calibrating' ? 22 : 12
  score += Math.min(24, approved * 8)
  score += Math.min(21, metrics.strongFits * 7)
  score += Math.min(12, metrics.contactReady * 6)
  if (metrics.candidateCount && !metrics.needsReview) score += 8
  return Math.min(score, 100)
}

export function RoleWorkspaceClient() {
  const router = useRouter()
  const { roles, mode, message, addRole } = useRoleWorkspaces()
  const [showCreate, setShowCreate] = useState(false)
  const [wizardText, setWizardText] = useState('')
  const [wizardKey, setWizardKey] = useState(0)
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setWizardText('')
      setWizardKey(current => current + 1)
      setShowCreate(true)
    }
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

  function openWizard(text = '') {
    setWizardText(text)
    setWizardKey(current => current + 1)
    setShowCreate(true)
    setStatus('')
  }

  function createRole(role: RoleWorkspace) {
    addRole(role)
    setShowCreate(false)
    setStatus(`Created ${role.intake.title}. The calibrated workspace is ready for strategy review and discovery.`)
    router.push(`/app/roles/${role.id}`)
  }

  return <div className="interactive-tool">
    {status && <div className="cta" role="status">{status}</div>}

    <div className="role-portfolio-actions">
      <div>
        <button className="btn" onClick={() => showCreate ? setShowCreate(false) : openWizard()}>{showCreate ? 'Close guided setup' : 'Create role'}</button>
        {!showCreate && <button className="btn secondary" onClick={() => openWizard(demoJd)}>Try POTFF demo</button>}
      </div>
      <div className="role-portfolio-status">
        <span className={`status-pill ${mode === 'supabase' ? 'success' : mode === 'error' ? 'warning' : ''}`}>{mode === 'checking' ? 'connecting' : mode}</span>
        <span>{message}</span>
      </div>
    </div>

    {showCreate && <RoleIntakeWizard
      key={wizardKey}
      initialText={wizardText}
      onCancel={() => setShowCreate(false)}
      onCreate={createRole}
    />}

    <div className="product-summary-grid role-portfolio-summary">
      <div className="product-stat"><small>Active searches</small><b>{totals.active}</b><span>Currently sourcing</span></div>
      <div className="product-stat"><small>In calibration</small><b>{totals.calibrating}</b><span>Need intake or strategy review</span></div>
      <div className="product-stat"><small>Role candidates</small><b>{totals.candidates}</b><span>Across every requisition</span></div>
      <div className="product-stat"><small>Decisions waiting</small><b>{totals.needsReview}</b><span>Human review required</span></div>
    </div>

    <section className="product-panel role-portfolio-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Search portfolio</span><h2>Role workspaces</h2></div>
        <span>{roles.length} total</span>
      </div>

      {!!roles.length && <div className="role-portfolio-toolbar">
        <input className="input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title, location, status, or clearance" aria-label="Search roles" />
        <button className="btn ghost" onClick={() => setQuery('')} disabled={!query}>Clear</button>
      </div>}

      <div className="product-list">
        {filteredRoles.map(role => {
          const metrics = roleMetrics(role)
          const health = roleHealth(role)
          const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved').length
          return <Link className="product-row role-portfolio-row role-portfolio-row-v26" href={`/app/roles/${role.id}`} key={role.id}>
            <div className="role-portfolio-health" aria-label={`${health}% search health`}>
              <div style={{ background: `conic-gradient(var(--app-accent) ${health}%, rgba(148,169,198,.12) 0)` }}><span>{health}</span></div>
              <small>health</small>
            </div>
            <div className="product-row-main">
              <div className="role-portfolio-title-row">
                <div className="product-row-title">{role.intake.title}</div>
                <span className={`status-pill ${statusClass(role.status)}`}>{role.status}</span>
              </div>
              <div className="product-row-meta">{[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? role.intake.clearance : ''].filter(Boolean).join(' · ') || 'Location and work mode pending'}</div>
              <div className="role-portfolio-signal-row">
                <span><b>{metrics.candidateCount}</b> candidates</span>
                <span><b>{metrics.needsReview}</b> to review</span>
                <span><b>{metrics.strongFits}</b> strong fits</span>
                <span><b>{approvedLanes}</b> lanes approved</span>
              </div>
              <div className="role-progress-line"><span style={{ width: `${health}%` }} /></div>
            </div>
            <div className="product-row-actions"><span className="btn ghost">Open workspace →</span></div>
          </Link>
        })}

        {!filteredRoles.length && <div className="role-portfolio-empty">
          <div className="role-portfolio-empty-mark">✦</div>
          <div>
            <div className="product-row-title">{roles.length ? 'No roles match this search' : 'Create your first calibrated search'}</div>
            <div className="product-row-meta">{roles.length
              ? 'Try a title, location, clearance, or role status.'
              : 'Paste a JD, confirm the intake, approve search lanes, and open a role workspace in one guided flow.'}</div>
          </div>
          {!roles.length && <button className="btn" onClick={() => openWizard()}>Start guided setup</button>}
        </div>}
      </div>
    </section>
  </div>
}
