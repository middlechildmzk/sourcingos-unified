'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import { buildTodayInbox, TODAY_KIND_LABELS, type TodayItemKind } from '@/lib/today-inbox'
import { applyInsightAction, reconcileCalibrationState } from '@/lib/calibration-intelligence'
import { roleMetrics } from '@/lib/role-workspace'
import { ProductIcon } from '@/components/ProductIcon'

const IMPACT_PILL: Record<string, string> = { high: 'status-pill warning', medium: 'status-pill active', low: 'status-pill' }

export function TodayInboxClient() {
  const { roles, mode, message, updateRole } = useRoleWorkspaces()
  const [kindFilter, setKindFilter] = useState<TodayItemKind | 'all'>('all')
  const [notice, setNotice] = useState('')

  const items = useMemo(() => buildTodayInbox(roles), [roles])
  const visible = kindFilter === 'all' ? items : items.filter(item => item.kind === kindFilter)
  const priorityItem = visible[0]
  const remainingItems = priorityItem ? visible.slice(1) : visible
  const kinds = useMemo(() => {
    const present = new Map<TodayItemKind, number>()
    for (const item of items) present.set(item.kind, (present.get(item.kind) || 0) + 1)
    return Array.from(present.entries())
  }, [items])

  const activeRoles = useMemo(() => roles
    .filter(role => role.status === 'active' || role.status === 'calibrating')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [roles])

  const portfolio = useMemo(() => roles.reduce((summary, role) => {
    const metrics = roleMetrics(role)
    summary.review += metrics.needsReview
    summary.strong += metrics.strongFits
    summary.calibration += role.calibration?.insights.filter(insight => insight.status === 'proposed').length || 0
    return summary
  }, { review: 0, strong: 0, calibration: 0 }), [roles])

  function approveRoleInsights(roleId: string) {
    updateRole(roleId, workspace => {
      let state = workspace.calibration || reconcileCalibrationState(workspace, undefined)
      const proposed = state.insights.filter(insight => insight.status === 'proposed')
      for (const insight of proposed) {
        const result = applyInsightAction(state, insight.id, 'approve')
        if (!result.error) state = result.state
      }
      setNotice(`Approved ${proposed.length} learned pattern${proposed.length === 1 ? '' : 's'}. Each can be rolled back from the role calibration view.`)
      return { ...workspace, calibration: state, updatedAt: new Date().toISOString() }
    })
  }

  return (
    <div className="today-v30">
      <section className="today-hero">
        <div className="today-hero-copy">
          <span className="kicker">Recruiter focus</span>
          <h1>{items.length ? 'Your next best decisions.' : 'Nothing urgent. Keep the searches moving.'}</h1>
          <p>{items.length
            ? `${items.length} decision${items.length === 1 ? '' : 's'} across ${activeRoles.length} active role${activeRoles.length === 1 ? '' : 's'}. SourcingOS prioritizes the work; you make the call.`
            : 'Your role workspaces are clear of immediate review, strategy, evidence, and calibration blockers.'}</p>
          <div className="today-hero-actions">
            <Link className="btn" href="/app/roles?new=1">+ Start a role</Link>
            <Link className="btn secondary" href="/app/roles">Open role portfolio</Link>
          </div>
        </div>
        <div className="today-system-card">
          <div><span className={`app-trust-dot ${mode === 'preview' ? 'preview' : ''}`} /><b>{mode === 'supabase' ? 'Account workspace connected' : mode === 'preview' ? 'Browser-local workspace' : 'Storage reconnecting'}</b></div>
          <p>{message || 'SourcingOS preserves recruiter control and source provenance.'}</p>
          <span>Autonomous research · Human hiring decisions</span>
        </div>
      </section>

      {notice && <div className="cta today-notice" role="status">{notice}</div>}

      <section className="today-metric-grid" aria-label="Recruiting workload summary">
        <div className="today-metric"><span>Decisions waiting</span><b>{items.length}</b><small>Prioritized by impact and age</small></div>
        <div className="today-metric"><span>Candidates to review</span><b>{portfolio.review}</b><small>Human fit decisions pending</small></div>
        <div className="today-metric"><span>Strong fits</span><b>{portfolio.strong}</b><small>Recorded role decisions</small></div>
        <div className="today-metric"><span>Learning to review</span><b>{portfolio.calibration}</b><small>Never applied without approval</small></div>
      </section>

      <div className="today-workspace-grid">
        <section className="today-focus-column">
          <div className="today-section-head">
            <div><span className="kicker">Decision queue</span><h2>Focus</h2></div>
            <span>{visible.length} shown</span>
          </div>

          {kinds.length > 1 && <div className="today-filter-row" role="group" aria-label="Filter decisions by type">
            <button className={kindFilter === 'all' ? 'btn' : 'btn ghost'} onClick={() => setKindFilter('all')}>All <span>{items.length}</span></button>
            {kinds.map(([kind, count]) => <button key={kind} className={kindFilter === kind ? 'btn' : 'btn ghost'} onClick={() => setKindFilter(kind)}>{TODAY_KIND_LABELS[kind]} <span>{count}</span></button>)}
          </div>}

          {priorityItem && <article className="today-priority-card">
            <div className="today-priority-topline">
              <span className={IMPACT_PILL[priorityItem.impact]}>{priorityItem.impact} impact</span>
              <span className="status-pill">{TODAY_KIND_LABELS[priorityItem.kind]}</span>
            </div>
            <span className="today-role-label">{priorityItem.roleTitle}</span>
            <h2>{priorityItem.title}</h2>
            <p>{priorityItem.whyItMatters}</p>
            {priorityItem.evidence && <div className="today-evidence-note"><b>Evidence</b><span>{priorityItem.evidence}</span></div>}
            <div className="today-priority-footer">
              <div><span>{priorityItem.effort} effort</span><span>{priorityItem.aging}</span></div>
              <div className="button-row">
                <Link className="btn" href={priorityItem.href}>{priorityItem.recommendedAction}</Link>
                {priorityItem.kind === 'calibration_approval' && <button className="btn secondary" onClick={() => approveRoleInsights(priorityItem.roleId)}>Approve all {priorityItem.count}</button>}
              </div>
            </div>
          </article>}

          <div className="today-decision-list">
            {remainingItems.map(item => <article className="today-decision-row" key={item.id}>
              <div className="today-decision-marker" data-impact={item.impact} />
              <div className="today-decision-copy">
                <div className="today-decision-meta"><span>{item.roleTitle}</span><span>{TODAY_KIND_LABELS[item.kind]}</span></div>
                <h3>{item.title}</h3>
                <p>{item.whyItMatters}</p>
                <div className="today-decision-foot"><span>{item.aging}</span><span>{item.effort} effort</span></div>
              </div>
              <div className="today-decision-action"><Link className="btn ghost" href={item.href}>{item.recommendedAction} →</Link></div>
            </article>)}

            {!visible.length && <div className="today-empty-state">
              <div className="today-empty-icon">✓</div>
              <div><h3>Inbox zero</h3><p>No decisions are waiting{kindFilter !== 'all' ? ' in this category' : ''}. SourcingOS will surface review, evidence, search-plan, and calibration work here.</p></div>
            </div>}
          </div>
        </section>

        <aside className="today-side-column">
          <section className="today-side-card">
            <div className="today-section-head"><div><span className="kicker">Active searches</span><h2>Resume a role</h2></div><Link href="/app/roles">View all</Link></div>
            <div className="today-role-list">
              {activeRoles.slice(0, 6).map(role => {
                const metrics = roleMetrics(role)
                return <Link href={`/app/roles/${role.id}`} className="today-role-card" key={role.id}>
                  <div><span className={`today-role-status ${role.status}`} /><div><b>{role.intake.title}</b><small>{[role.intake.location, role.intake.workMode].filter(Boolean).join(' · ') || role.status}</small></div></div>
                  <div className="today-role-numbers"><span><b>{metrics.needsReview}</b> review</span><span><b>{metrics.strongFits}</b> strong</span></div>
                </Link>
              })}
              {!activeRoles.length && <div className="today-side-empty"><p>No active roles yet.</p><Link className="btn secondary" href="/app/roles?new=1">Create a role</Link></div>}
            </div>
          </section>

          <section className="today-side-card today-trust-card">
            <span className="kicker">Operating model</span>
            <h2>Evidence before action.</h2>
            <p>Search strategy, public-source signals, and recruiter feedback can guide research. Unknown stays unknown, and consequential actions stay recruiter-controlled.</p>
            <div className="today-trust-links">
              <Link href="/app/candidate-database"><ProductIcon name="candidates" /> Talent graph</Link>
              <Link href="/app/evidence-ledger"><ProductIcon name="ledger" /> Evidence ledger</Link>
              <Link href="/app/agent-os"><ProductIcon name="autosource" /> Ask SourcingOS</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
