'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { buildTodayInbox, TODAY_KIND_LABELS, type TodayItemKind } from '@/lib/today-inbox'
import { roleMetrics } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function impactClass(value: string) {
  return value === 'high' ? 'is-high' : value === 'medium' ? 'is-medium' : 'is-low'
}

export function TodayWorkspaceV37() {
  const { roles, mode, message } = useRoleWorkspaces()
  const [kind, setKind] = useState<TodayItemKind | 'all'>('all')
  const items = useMemo(() => buildTodayInbox(roles), [roles])
  const visible = kind === 'all' ? items : items.filter(item => item.kind === kind)
  const activeRoles = useMemo(() => roles
    .filter(role => role.status === 'active' || role.status === 'calibrating')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [roles])
  const metrics = useMemo(() => roles.reduce((acc, role) => {
    const m = roleMetrics(role)
    acc.review += m.needsReview
    acc.strong += m.strongFits
    acc.conflicts += m.conflicts
    return acc
  }, { review: 0, strong: 0, conflicts: 0 }), [roles])
  const kinds = useMemo(() => Array.from(new Set(items.map(item => item.kind))), [items])

  return <div className="today-workspace-v37">
    <header className="today-v37-header">
      <div><span className="search-kicker">Today</span><h1>{items.length ? `${items.length} decision${items.length === 1 ? '' : 's'} need your attention.` : 'Your recruiting queue is clear.'}</h1><p>SourcingOS organizes the research. You make the recruiting decisions.</p></div>
      <div className="today-v37-actions"><Link href="/app/search">Search talent</Link><Link className="primary" href="/app/roles?new=1">+ New role</Link></div>
    </header>

    <section className="today-v37-metrics">
      <div><small>Decisions</small><b>{items.length}</b><span>Prioritized work</span></div>
      <div><small>Need review</small><b>{metrics.review}</b><span>Candidate judgments</span></div>
      <div><small>Strong fits</small><b>{metrics.strong}</b><span>Recruiter decisions</span></div>
      <div><small>Evidence conflicts</small><b>{metrics.conflicts}</b><span>Resolve before action</span></div>
    </section>

    <div className="today-v37-grid">
      <main className="today-v37-queue">
        <div className="today-v37-section-head"><div><span className="search-kicker">Decision queue</span><h2>Next best work</h2></div><div className="today-v37-filters"><button className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}>All</button>{kinds.map(value => <button className={kind === value ? 'active' : ''} key={value} onClick={() => setKind(value)}>{TODAY_KIND_LABELS[value]}</button>)}</div></div>
        <div className="today-v37-list">
          {visible.map((item, index) => <Link href={item.href} className={`today-v37-row ${index === 0 ? 'is-first' : ''}`} key={item.id}>
            <span className={`today-v37-impact ${impactClass(item.impact)}`} />
            <span className="today-v37-row-main"><span className="today-v37-row-meta"><b>{item.roleTitle}</b><small>{TODAY_KIND_LABELS[item.kind]} · {item.aging}</small></span><strong>{item.title}</strong><p>{item.whyItMatters}</p>{item.evidence && <span className="today-v37-evidence"><i>Evidence</i>{item.evidence}</span>}</span>
            <span className="today-v37-row-action"><small>{item.effort} effort</small><b>{item.recommendedAction} →</b></span>
          </Link>)}
          {!visible.length && <div className="today-v37-empty"><span>✓</span><h3>Nothing waiting here.</h3><p>When a role needs review, evidence resolution, search-plan approval, or calibration, it will appear in this queue.</p></div>}
        </div>
      </main>

      <aside className="today-v37-side">
        <section className="today-v37-side-section"><div className="today-v37-section-head"><div><span className="search-kicker">Active roles</span><h2>Resume work</h2></div><Link href="/app/roles">All roles</Link></div><div className="today-v37-role-list">{activeRoles.slice(0, 7).map(role => { const m = roleMetrics(role); return <Link href={`/app/roles/${encodeURIComponent(role.id)}`} key={role.id}><span className={`today-v37-role-dot is-${role.status}`} /><span><b>{role.intake.title}</b><small>{[role.intake.location, role.intake.workMode].filter(Boolean).join(' · ') || role.status}</small></span><span><strong>{m.needsReview}</strong><small>review</small></span></Link> })}{!activeRoles.length && <div className="today-v37-side-empty"><p>No active roles.</p><Link href="/app/roles?new=1">Create a role →</Link></div>}</div></section>

        <section className="today-v37-side-section"><div className="today-v37-section-head"><div><span className="search-kicker">Workspace state</span><h2>{mode === 'supabase' ? 'Connected' : mode === 'preview' ? 'Local preview' : 'Checking storage'}</h2></div></div><p className="today-v37-storage-copy">{message}</p><div className="today-v37-quick-links"><Link href="/app/search">Search</Link><Link href="/app/candidate-database">Talent</Link><Link href="/app/sources">Sources</Link></div></section>
      </aside>
    </div>
  </div>
}
