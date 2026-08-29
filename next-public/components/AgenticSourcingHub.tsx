'use client'

import Link from 'next/link'
import { roleMetrics } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

export function AgenticSourcingHub() {
  const { roles, mode } = useRoleWorkspaces()
  const activeRoles = roles
    .filter(role => role.status !== 'closed')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  if (mode === 'checking') {
    return <section className="product-panel"><span className="kicker">Agentic Sourcing</span><h1>Loading role intelligence…</h1><p className="muted">Restoring your roles and sourcing state.</p></section>
  }

  return <div className="role-section-stack agentic-hub">
    <section className="product-page-head agentic-hub-head">
      <div>
        <span className="kicker">Agentic Sourcing</span>
        <h1>Plan, run, review, and learn by role.</h1>
        <p>SourcingOS turns each active req into distinct sourcing hypotheses, executes the public sources it can actually access, guides restricted-source work, and carries recruiter-approved learning into the next search.</p>
      </div>
      <div className="product-page-actions">
        <Link className="btn" href="/app/roles?new=1">+ Start a role</Link>
        <Link className="btn secondary" href="/app/roles">Open roles</Link>
      </div>
    </section>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Active roles</small><b>{activeRoles.length}</b><span>Available to source</span></div>
      <div className="product-stat"><small>Agentic loop</small><b>5</b><span>Brief → Strategy → Slate → Review → Learned</span></div>
      <div className="product-stat"><small>Source truth</small><b>4</b><span>Executable · guided · optional · unavailable</span></div>
      <div className="product-stat"><small>Hiring actions</small><b>Human</b><span>No autonomous rejection or outreach</span></div>
    </div>

    <section className="product-panel agentic-hub-explainer">
      <div className="product-panel-head">
        <div><span className="kicker">How the agent works</span><h2>Autonomous research. Human hiring decisions.</h2></div>
        <span className="status-pill success">live</span>
      </div>
      <div className="agentic-spine" aria-label="Agentic sourcing loop">
        <span><b>Brief</b><small>Role constraints</small></span><i>→</i>
        <span className="active"><b>Strategy</b><small>Distinct hypotheses</small></span><i>→</i>
        <span><b>Slate</b><small>Evidence-backed people</small></span><i>→</i>
        <span><b>Review</b><small>Recruiter judgment</small></span><i>→</i>
        <span><b>Learned</b><small>Approved calibration</small></span>
      </div>
      <div className="grid three">
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">Executable public research</div><div className="product-row-meta">Supported connectors can run read-only searches and return discoveries with source context.</div></div><span className="status-pill success">runs</span></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">Guided recruiter sources</div><div className="product-row-meta">Restricted or recruiter-controlled surfaces get strategy and queries without false execution claims.</div></div><span className="status-pill active">guided</span></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">Search memory + novelty</div><div className="product-row-meta">Exact repeats can be blocked and new discoveries measured against role-level search history.</div></div><span className="status-pill">memory</span></div>
      </div>
    </section>

    <section className="product-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Choose a role</span><h2>Run the sourcing loop in role context</h2></div>
        <span>{activeRoles.length} role{activeRoles.length === 1 ? '' : 's'}</span>
      </div>
      {!activeRoles.length ? <div className="product-empty-state">
        <h3>No active role yet</h3>
        <p className="muted">Agentic sourcing starts from a role brief so search hypotheses, evidence, recruiter decisions, and learning stay connected.</p>
        <Link className="btn" href="/app/roles?new=1">Create your first role</Link>
      </div> : <div className="product-list">
        {activeRoles.map(role => {
          const metrics = roleMetrics(role)
          const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
          return <div className="product-row agentic-role-row" key={role.id}>
            <div className="product-row-main">
              <div className="product-row-title">{role.intake.title}</div>
              <div className="product-row-meta">{[role.intake.location, role.intake.workMode, role.status].filter(Boolean).join(' · ')}</div>
              <div className="chips">
                <span className="chip">{metrics.candidateCount} candidates</span>
                <span className="chip">{metrics.needsReview} need review</span>
                <span className="chip">{reviewed} reviewed</span>
                <span className="chip">{role.calibration?.insights?.filter(item => item.status === 'approved').length || 0} approved learnings</span>
              </div>
            </div>
            <div className="product-row-actions">
              <Link className="btn" href={`/app/agentic-sourcing/${encodeURIComponent(role.id)}`}>Open agentic workspace</Link>
              <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(role.id)}?tab=candidates`}>Review slate</Link>
            </div>
          </div>
        })}
      </div>}
    </section>

    <section className="product-panel">
      <div className="product-panel-head"><div><span className="kicker">Trust boundary</span><h2>What the agent will not silently do</h2></div></div>
      <div className="grid two">
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">No fake source execution</div><div className="product-row-meta">A generated query is not presented as a searched source.</div></div></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">No silent identity merge</div><div className="product-row-meta">Cross-source identity uncertainty remains reviewable.</div></div></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">No autonomous hiring decision</div><div className="product-row-meta">Research can automate; outreach, rejection, stage changes, and consequential actions remain recruiter-controlled.</div></div></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">External content is untrusted data</div><div className="product-row-meta">Fetched content is evidence input, never executable instruction.</div></div></div>
      </div>
    </section>
  </div>
}
