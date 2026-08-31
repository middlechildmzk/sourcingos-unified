'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { roleMetrics, type RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import { RoleIntakeWizardV33_4 } from '@/components/RoleIntakeWizardV33_4'

function statusClass(status: RoleWorkspace['status']) {
  if (status === 'active') return 'active'
  if (status === 'calibrating') return 'warning'
  if (status === 'closed') return 'success'
  return ''
}

function workflowReadiness(role: RoleWorkspace): { score: number; next: string } {
  const metrics = roleMetrics(role)
  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
  const steps = [
    { done: Boolean(role.intake.title.trim() && role.intake.mustHaves.length), next: 'Confirm the Role Brief' },
    { done: role.searchLanes.some(lane => lane.status === 'approved'), next: 'Approve a sourcing angle' },
    { done: metrics.candidateCount > 0, next: 'Build the first slate' },
    { done: reviewed > 0, next: 'Review the first candidates' },
  ]
  const completed = steps.filter(step => step.done).length
  return {
    score: completed * 25,
    next: steps.find(step => !step.done)?.next || (metrics.needsReview ? `Review ${metrics.needsReview} waiting candidate${metrics.needsReview === 1 ? '' : 's'}` : 'Keep the role warm'),
  }
}

function formatUpdated(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Recently updated'
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
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
    summary.strongFits += metrics.strongFits
    if (role.status === 'active') summary.active += 1
    if (role.status === 'calibrating') summary.calibrating += 1
    return summary
  }, { active: 0, calibrating: 0, candidates: 0, needsReview: 0, strongFits: 0 }), [roles])

  function openWizard(text = '') {
    setWizardText(text)
    setWizardKey(current => current + 1)
    setShowCreate(true)
    setStatus('')
  }

  function createRole(role: RoleWorkspace) {
    addRole(role)
    setShowCreate(false)
    setStatus(`Created ${role.intake.title}. Role Brief v1 and the recruiter-approved search angles are now attached to the same persistent role workspace.`)
    router.push(`/app/roles/${role.id}`)
  }

  return <div className="interactive-tool role-portfolio-v30">
    {status && <div className="cta" role="status">{status}</div>}

    <section className="role-portfolio-command">
      <div>
        <span className="kicker">Role portfolio</span>
        <h2>One brief. One sourcing workspace.</h2>
        <p>Describe who you need, approve what SourcingOS understood, then keep sourcing, evidence, review decisions, and calibration attached to that role.</p>
      </div>
      <div className="role-portfolio-command-actions">
        <button className="btn" onClick={() => showCreate ? setShowCreate(false) : openWizard()}>{showCreate ? 'Close setup' : '+ Create role'}</button>
        <span className={`app-connection-pill ${mode === 'preview' ? 'preview' : ''}`}><span />{mode === 'checking' ? 'Connecting' : mode === 'supabase' ? 'Account storage' : mode === 'preview' ? 'Browser local' : 'Reconnect needed'}</span>
      </div>
    </section>

    {showCreate && <div className="role-create-stage">
      <RoleIntakeWizardV33_4 key={wizardKey} initialText={wizardText} onCancel={() => setShowCreate(false)} onCreate={createRole} />
    </div>}

    <div className="product-summary-grid role-portfolio-summary">
      <div className="product-stat"><small>Active roles</small><b>{totals.active}</b><span>Currently sourcing</span></div>
      <div className="product-stat"><small>Decisions waiting</small><b>{totals.needsReview}</b><span>Recruiter review required</span></div>
      <div className="product-stat"><small>Strong fits</small><b>{totals.strongFits}</b><span>Recorded recruiter decisions</span></div>
      <div className="product-stat"><small>Talent in roles</small><b>{totals.candidates}</b><span>Canonical candidate links</span></div>
    </div>

    <section className="role-portfolio-panel-v30">
      <div className="role-portfolio-panel-head">
        <div><span className="kicker">Searches</span><h2>{roles.length ? 'Your role workspaces' : 'Create your first role workspace'}</h2><p>{message}</p></div>
        {!!roles.length && <div className="role-portfolio-toolbar">
          <input className="input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roles…" aria-label="Search roles" />
          {query && <button className="btn ghost" onClick={() => setQuery('')}>Clear</button>}
        </div>}
      </div>

      <div className="role-card-grid">
        {filteredRoles.map(role => {
          const metrics = roleMetrics(role)
          const readiness = workflowReadiness(role)
          const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved').length
          const pendingLearning = role.calibration?.insights.filter(insight => insight.status === 'proposed').length || 0
          const briefVersion = role.roleBriefVersions?.find(version => version.id === role.activeRoleBriefVersionId)?.version || role.roleBriefVersions?.at(-1)?.version || 1
          return <Link className="role-card-v30" href={`/app/roles/${role.id}`} key={role.id}>
            <div className="role-card-topline">
              <span className={`status-pill ${statusClass(role.status)}`}>{role.status}</span>
              <span className="role-card-updated">Role Brief v{briefVersion} · {formatUpdated(role.updatedAt)}</span>
            </div>
            <div className="role-card-title">
              <h3>{role.intake.title}</h3>
              <p>{[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? role.intake.clearance : ''].filter(Boolean).join(' · ') || 'Location and work mode pending'}</p>
            </div>
            <div className="role-readiness-block">
              <div><span>Workflow readiness</span><b>{readiness.score}%</b></div>
              <div className="role-progress-line"><span style={{ width: `${readiness.score}%` }} /></div>
              <small>Next: {readiness.next}</small>
            </div>
            <div className="role-card-metrics">
              <span><b>{metrics.candidateCount}</b><small>candidates</small></span>
              <span><b>{metrics.needsReview}</b><small>to review</small></span>
              <span><b>{metrics.strongFits}</b><small>strong</small></span>
              <span><b>{approvedLanes}</b><small>angles</small></span>
            </div>
            <div className="role-card-footer">
              <div>{pendingLearning ? <span className="status-pill warning">{pendingLearning} learning review</span> : <span className="status-pill success">calibration clear</span>}</div>
              <span className="role-card-open">Open role →</span>
            </div>
          </Link>
        })}

        {!filteredRoles.length && <div className="role-portfolio-empty-v30">
          <div className="role-portfolio-empty-mark">✦</div>
          <div><h3>{roles.length ? 'No roles match this search' : 'Who are you looking for?'}</h3><p>{roles.length ? 'Try a title, location, clearance term, or role status.' : 'Describe the person in plain English. SourcingOS will turn it into an approved Role Brief and search plan before any research runs.'}</p></div>
          {!roles.length && <button className="btn" onClick={() => openWizard()}>Create first role</button>}
        </div>}
      </div>
    </section>
  </div>
}
