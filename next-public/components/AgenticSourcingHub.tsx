'use client'

import Link from 'next/link'
import { AgenticSourcingChatV36_15 } from '@/components/AgenticSourcingChatV36_15'
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
        <h1>Ask. Search. Review. Refine.</h1>
        <p>Natural language is the control surface for SourcingOS. Describe who you need, let SourcingOS expose the criteria and sources it will use, then refine the search conversationally without losing the evidence and recruiter-control boundaries underneath.</p>
      </div>
      <div className="product-page-actions">
        <Link className="btn" href="/app/roles?new=1">+ Start a role</Link>
        <Link className="btn secondary" href="/app/roles">Open roles</Link>
      </div>
    </section>

    <AgenticSourcingChatV36_15 />

    <div className="product-summary-grid">
      <div className="product-stat"><small>Active roles</small><b>{activeRoles.length}</b><span>Available to source</span></div>
      <div className="product-stat"><small>Agentic loop</small><b>5</b><span>Brief → Strategy → Slate → Review → Learned</span></div>
      <div className="product-stat"><small>Auto-execution</small><b>Read</b><span>People search only in V36.15</span></div>
      <div className="product-stat"><small>Hiring actions</small><b>Human</b><span>No autonomous outreach, merge, or ATS write</span></div>
    </div>

    <section className="product-panel agentic-hub-explainer">
      <div className="product-panel-head">
        <div><span className="kicker">How the agent works</span><h2>Autonomous research. Human hiring decisions.</h2></div>
        <span className="status-pill success">live</span>
      </div>
      <div className="agentic-spine" aria-label="Agentic sourcing loop">
        <span><b>Brief</b><small>Role constraints</small></span><i>→</i>
        <span className="active"><b>Strategy</b><small>Explicit criteria + tools</small></span><i>→</i>
        <span><b>Slate</b><small>Provider observations</small></span><i>→</i>
        <span><b>Review</b><small>Recruiter judgment</small></span><i>→</i>
        <span><b>Learned</b><small>Approved calibration</small></span>
      </div>
      <div className="grid three">
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">Conversational search planning</div><div className="product-row-meta">The agent translates recruiter language into explicit Role/Search Brain criteria before the sourcing stack executes.</div></div><span className="status-pill success">runs</span></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">Executable professional sources</div><div className="product-row-meta">The chat calls the same universal people-search orchestration as People Search, including provider telemetry and evidence boundaries.</div></div><span className="status-pill success">runs</span></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">Search memory + refinement</div><div className="product-row-meta">Follow-up turns retain prior criteria so recruiters can narrow, expand, or redirect the search instead of starting over.</div></div><span className="status-pill">session</span></div>
      </div>
    </section>

    <section className="product-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Role context</span><h2>Continue the sourcing loop in an active role</h2></div>
        <span>{activeRoles.length} role{activeRoles.length === 1 ? '' : 's'}</span>
      </div>
      {!activeRoles.length ? <div className="product-empty-state">
        <h3>No active role yet</h3>
        <p className="muted">You can use the read-only chat above without creating a role. Create a role when you want the search, candidate slate, feedback, and approved learning to persist as a recruiting workflow.</p>
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
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">No fake source execution</div><div className="product-row-meta">A model suggestion is not presented as a searched source. Actual provider telemetry appears after execution.</div></div></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">No silent identity merge</div><div className="product-row-meta">Cross-source identity uncertainty remains reviewable.</div></div></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">No autonomous hiring or outreach action</div><div className="product-row-meta">Search may auto-run; contact enrichment, saving, outreach, rejection, stage changes, and ATS writes remain explicit recruiter-controlled workflows.</div></div></div>
        <div className="product-row"><div className="product-row-main"><div className="product-row-title">External content is untrusted data</div><div className="product-row-meta">Provider and web content is evidence input, never executable instruction and never a substitute for candidate-specific evidence.</div></div></div>
      </div>
    </section>
  </div>
}
