'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { roleMetrics, type RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import { RoleIntakeWizardV33_4 } from '@/components/RoleIntakeWizardV33_4'
import { RolePortfolioIntelligenceV33_4 } from '@/components/RolePortfolioIntelligenceV33_4'

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
    { done: Boolean(role.intake.title.trim() && role.intake.title !== 'Untitled role'), next: 'Confirm the search' },
    { done: role.searchLanes.some(lane => lane.status === 'approved'), next: 'Start the sourcing agent' },
    { done: metrics.candidateCount > 0, next: 'Review the first slate' },
    { done: reviewed > 0, next: 'Review the first candidates' },
  ]
  const completed = steps.filter(step => step.done).length
  return {
    score: completed * 25,
    next: steps.find(step => !step.done)?.next || (metrics.needsReview ? `Review ${metrics.needsReview} waiting candidate${metrics.needsReview === 1 ? '' : 's'}` : 'Keep the search warm'),
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
  const [showCreate, setShowCreate] = useState(true)
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
    return summary
  }, { active: 0, candidates: 0, needsReview: 0, strongFits: 0 }), [roles])

  function openWizard(text = '') {
    setWizardText(text)
    setWizardKey(current => current + 1)
    setShowCreate(true)
    setStatus('')
  }

  function createRole(role: RoleWorkspace) {
    addRole(role)
    setShowCreate(false)
    setStatus(`Starting the sourcing agent for ${role.intake.title}.`)
    router.push(`/app/roles/${role.id}?start=1`)
  }

  return <div className="role-portfolio-v30 role-portfolio-agent-first-v33-4">
    {status && <div className="cta" role="status">{status}</div>}

    {showCreate ? <div className="role-create-stage role-create-stage-primary-v33-4">
      <RoleIntakeWizardV33_4 key={wizardKey} initialText={wizardText} onCreate={createRole} />
    </div> : <div className="role-new-search-bar-v33-4">
      <div><b>Ready for another search?</b><span>Describe the person and let the agent do the setup.</span></div>
      <button className="btn" onClick={() => openWizard()}>+ New search</button>
    </div>}

    {!!roles.length && <>
      <div className="role-portfolio-context-v33-4">
        <div><span className={`app-connection-pill ${mode === 'preview' ? 'preview' : ''}`}><span />{mode === 'checking' ? 'Connecting' : mode === 'supabase' ? 'Account storage' : mode === 'preview' ? 'Browser local' : 'Reconnect needed'}</span><small>{message}</small></div>
      </div>

      <RolePortfolioIntelligenceV33_4 roles={roles} />

      <div className="product-summary-grid role-portfolio-summary">
        <div className="product-stat"><small>Active searches</small><b>{totals.active}</b><span>Currently sourcing</span></div>
        <div className="product-stat"><small>Decisions waiting</small><b>{totals.needsReview}</b><span>Recruiter review required</span></div>
        <div className="product-stat"><small>Yes decisions</small><b>{totals.strongFits}</b><span>Recruiter-confirmed</span></div>
        <div className="product-stat"><small>Talent in searches</small><b>{totals.candidates}</b><span>Canonical candidate links</span></div>
      </div>

      <section className="role-portfolio-panel-v30">
        <div className="role-portfolio-panel-head">
          <div><span className="kicker">Recent searches</span><h2>Your sourcing work</h2></div>
          <div className="role-portfolio-toolbar">
            <input className="input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roles…" aria-label="Search roles" />
            {query && <button className="btn ghost" onClick={() => setQuery('')}>Clear</button>}
          </div>
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
                <span className="role-card-updated">Brief v{briefVersion} · {formatUpdated(role.updatedAt)}</span>
              </div>
              <div className="role-card-title">
                <h3>{role.intake.title}</h3>
                <p>{[role.intake.location !== 'Not specified' ? role.intake.location : '', role.intake.workMode !== 'unknown' ? role.intake.workMode : '', role.intake.clearance !== 'Not specified' ? role.intake.clearance : ''].filter(Boolean).join(' · ') || 'Open search'}</p>
              </div>
              <div className="role-readiness-block">
                <div><span>Progress</span><b>{readiness.score}%</b></div>
                <div className="role-progress-line"><span style={{ width: `${readiness.score}%` }} /></div>
                <small>Next: {readiness.next}</small>
              </div>
              <div className="role-card-metrics">
                <span><b>{metrics.candidateCount}</b><small>candidates</small></span>
                <span><b>{metrics.needsReview}</b><small>to review</small></span>
                <span><b>{metrics.strongFits}</b><small>yes</small></span>
                <span><b>{approvedLanes}</b><small>angles</small></span>
              </div>
              <div className="role-card-footer">
                <div>{pendingLearning ? <span className="status-pill warning">{pendingLearning} learning review</span> : <span className="status-pill success">calibration clear</span>}</div>
                <span className="role-card-open">Open →</span>
              </div>
            </Link>
          })}

          {!filteredRoles.length && <div className="role-portfolio-empty-v30"><div className="role-portfolio-empty-mark">✦</div><div><h3>No searches match</h3><p>Try a title, location, clearance term, or status.</p></div></div>}
        </div>
      </section>
    </>}
  </div>
}
