'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import { buildTodayInbox, todayInboxSummary, TODAY_KIND_LABELS, type TodayItemKind } from '@/lib/today-inbox'
import { applyInsightAction, reconcileCalibrationState } from '@/lib/calibration-intelligence'
import { ProductIcon } from '@/components/ProductIcon'

const IMPACT_PILL: Record<string, string> = { high: 'status-pill warning', medium: 'status-pill active', low: 'status-pill' }

export function TodayInboxClient() {
  const { roles, mode, message, updateRole } = useRoleWorkspaces()
  const [kindFilter, setKindFilter] = useState<TodayItemKind | 'all'>('all')
  const [notice, setNotice] = useState('')

  const items = useMemo(() => buildTodayInbox(roles), [roles])
  const visible = kindFilter === 'all' ? items : items.filter(item => item.kind === kindFilter)
  const kinds = useMemo(() => {
    const present = new Map<TodayItemKind, number>()
    for (const item of items) present.set(item.kind, (present.get(item.kind) || 0) + 1)
    return Array.from(present.entries())
  }, [items])

  // The only batch action offered here is approving a role's proposed calibration
  // insights. It is safe: reversible per insight via rollback, and it never touches
  // candidates, lanes, evidence, or outreach.
  function approveRoleInsights(roleId: string) {
    updateRole(roleId, workspace => {
      let state = workspace.calibration || reconcileCalibrationState(workspace, undefined)
      const proposed = state.insights.filter(insight => insight.status === 'proposed')
      for (const insight of proposed) {
        const result = applyInsightAction(state, insight.id, 'approve')
        if (!result.error) state = result.state
      }
      setNotice(`Approved ${proposed.length} learned pattern${proposed.length === 1 ? '' : 's'}. Each one can be rolled back in the role's calibration tab.`)
      return { ...workspace, calibration: state, updatedAt: new Date().toISOString() }
    })
  }

  return (
    <div className="role-section-stack">
      <section className="product-panel">
        <div className="product-panel-head">
          <div>
            <span className="kicker">Today</span>
            <h1>Your decision inbox</h1>
          </div>
          <span className="status-pill">{mode === 'supabase' ? 'account storage' : mode === 'preview' ? 'this device only' : mode}</span>
        </div>
        <p className="muted normal-wrap">{todayInboxSummary(items)} Every item links to the surface where you make the actual decision. Nothing here acts on its own.</p>
        {message && <p className="muted normal-wrap">{message}</p>}
        {notice && <p className="muted normal-wrap" role="status">{notice}</p>}
        {kinds.length > 1 && (
          <div className="button-row" role="group" aria-label="Filter decisions by type">
            <button className={kindFilter === 'all' ? 'btn' : 'btn ghost'} onClick={() => setKindFilter('all')}>All ({items.length})</button>
            {kinds.map(([kind, count]) => (
              <button key={kind} className={kindFilter === kind ? 'btn' : 'btn ghost'} onClick={() => setKindFilter(kind)}>
                {TODAY_KIND_LABELS[kind]} ({count})
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="product-panel">
        <div className="product-list">
          {visible.map(item => (
            <div className="product-row" key={item.id}>
              <div className="product-row-main">
                <div className="product-row-title normal-wrap">{item.roleTitle}: {item.title}</div>
                <div className="product-row-meta normal-wrap">{item.whyItMatters}</div>
                {item.evidence && <div className="product-row-meta normal-wrap">Evidence: {item.evidence}</div>}
                <div className="product-row-meta">
                  <span className={IMPACT_PILL[item.impact]}>{item.impact} impact</span>{' '}
                  <span className="status-pill">{item.effort} effort</span>{' '}
                  <span className="status-pill">{item.aging}</span>
                </div>
                <div className="button-row role-panel-actions">
                  <Link className="btn" href={item.href} aria-label={`${item.recommendedAction} for ${item.roleTitle}`}>{item.recommendedAction}</Link>
                  {item.kind === 'calibration_approval' && (
                    <button className="btn secondary" onClick={() => approveRoleInsights(item.roleId)}>
                      Approve all {item.count} for this role
                    </button>
                  )}
                </div>
              </div>
              <span className="status-pill">{TODAY_KIND_LABELS[item.kind]}</span>
            </div>
          ))}
          {!visible.length && (
            <div className="product-row">
              <div className="product-row-main">
                <div className="product-row-title">Inbox zero</div>
                <div className="product-row-meta normal-wrap">
                  No decisions are waiting{kindFilter !== 'all' ? ' in this category' : ''}. New candidate reviews, evidence
                  conflicts, lane approvals, and learned patterns will appear here as your searches move.
                </div>
              </div>
              <span className="status-pill success">clear</span>
            </div>
          )}
        </div>
      </section>

      <section className="product-panel">
        <div className="product-panel-head">
          <div>
            <span className="kicker">Go deeper</span>
            <h2>Canonical surfaces</h2>
          </div>
        </div>
        <div className="button-row role-panel-actions">
          <Link className="btn secondary" href="/app/roles"><ProductIcon name="roles" /> Roles</Link>
          <Link className="btn secondary" href="/app/autosource"><ProductIcon name="autosource" /> AutoSource</Link>
          <Link className="btn secondary" href="/app/candidate-database"><ProductIcon name="candidates" /> Candidates</Link>
          <Link className="btn ghost" href="/app/agent-os">Agent OS</Link>
        </div>
      </section>
    </div>
  )
}
