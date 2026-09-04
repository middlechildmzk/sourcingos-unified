'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RoleIntakeWizardV33_4 } from '@/components/RoleIntakeWizardV33_4'
import { roleMetrics, type RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function progress(role: RoleWorkspace) {
  const metrics = roleMetrics(role)
  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed').length
  const checks = [
    Boolean(role.intake.title && role.intake.title !== 'Untitled role'),
    role.searchLanes.some(lane => lane.status === 'approved'),
    metrics.candidateCount > 0,
    reviewed > 0,
  ]
  const score = checks.filter(Boolean).length * 25
  const next = !checks[0] ? 'Confirm role brief' : !checks[1] ? 'Approve search strategy' : !checks[2] ? 'Run candidate search' : !checks[3] ? 'Review first candidates' : metrics.needsReview ? `Review ${metrics.needsReview} waiting` : 'Keep search warm'
  return { score, next }
}

export function RolesPortfolioV37() {
  const router = useRouter()
  const { roles, mode, message, addRole } = useRoleWorkspaces()
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | RoleWorkspace['status']>('all')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') {
      setWizardKey(value => value + 1)
      setCreateOpen(true)
    }
  }, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return roles
      .filter(role => filter === 'all' || role.status === filter)
      .filter(role => !needle || [role.intake.title, role.intake.location, role.intake.clearance, role.status].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [filter, query, roles])

  const totals = useMemo(() => roles.reduce((acc, role) => {
    const m = roleMetrics(role)
    if (role.status === 'active') acc.active += 1
    acc.review += m.needsReview
    acc.strong += m.strongFits
    acc.candidates += m.candidateCount
    return acc
  }, { active: 0, review: 0, strong: 0, candidates: 0 }), [roles])

  function createRole(role: RoleWorkspace) {
    addRole(role)
    setCreateOpen(false)
    router.push(`/app/roles/${encodeURIComponent(role.id)}`)
  }

  return <div className="roles-portfolio-v37">
    <header className="roles-v37-header"><div><span className="search-kicker">Roles</span><h1>Your searches, slates, and decisions.</h1><p>Each role keeps one approved brief, one evolving search strategy, one candidate slate, and an auditable recruiter decision trail.</p></div><div className="roles-v37-header-actions"><Link href="/app/search">Explore without a role</Link><button onClick={() => { setWizardKey(value => value + 1); setCreateOpen(true) }}>+ New role</button></div></header>

    {createOpen && <section className="roles-v37-create"><div className="roles-v37-create-head"><div><span className="search-kicker">New role</span><h2>Start with the hiring need.</h2></div><button onClick={() => setCreateOpen(false)} aria-label="Close new role">×</button></div><RoleIntakeWizardV33_4 key={wizardKey} initialText="" onCreate={createRole} /></section>}

    <section className="roles-v37-metrics"><div><small>Active roles</small><b>{totals.active}</b></div><div><small>Need review</small><b>{totals.review}</b></div><div><small>Strong fits</small><b>{totals.strong}</b></div><div><small>Candidates in roles</small><b>{totals.candidates}</b></div></section>

    <section className="roles-v37-table-shell">
      <div className="roles-v37-toolbar"><div><span className="search-kicker">Role portfolio</span><h2>{visible.length} role{visible.length === 1 ? '' : 's'}</h2></div><div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roles…" /><select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">All statuses</option><option value="active">Active</option><option value="calibrating">Calibrating</option><option value="paused">Paused</option><option value="draft">Draft</option><option value="closed">Closed</option></select></div></div>
      <div className="roles-v37-list">{visible.map(role => {
        const m = roleMetrics(role)
        const p = progress(role)
        const approved = role.searchLanes.filter(lane => lane.status === 'approved').length
        return <Link href={`/app/roles/${encodeURIComponent(role.id)}`} className="roles-v37-row" key={role.id}>
          <span className={`roles-v37-status is-${role.status}`} />
          <span className="roles-v37-main"><span><strong>{role.intake.title}</strong><em>{role.status}</em></span><small>{[role.intake.location !== 'Not specified' ? role.intake.location : '', role.intake.workMode !== 'unknown' ? role.intake.workMode : '', role.intake.clearance !== 'Not specified' ? role.intake.clearance : ''].filter(Boolean).join(' · ') || 'Open role'}</small><span className="roles-v37-progress"><i><b style={{ width: `${p.score}%` }} /></i><small>{p.score}% · Next: {p.next}</small></span></span>
          <span className="roles-v37-numbers"><span><b>{m.candidateCount}</b><small>candidates</small></span><span><b>{m.needsReview}</b><small>review</small></span><span><b>{m.strongFits}</b><small>strong</small></span><span><b>{approved}</b><small>lanes</small></span></span>
          <span className="roles-v37-open">Open →</span>
        </Link>
      })}{!visible.length && <div className="roles-v37-empty"><h3>{roles.length ? 'No roles match these filters.' : 'No roles yet.'}</h3><p>{roles.length ? 'Clear the search or status filter.' : 'Create a role when you want the brief, candidate slate, feedback, and approved learning to persist.'}</p>{!roles.length && <button onClick={() => setCreateOpen(true)}>Create your first role</button>}</div>}</div>
    </section>

    <footer className="roles-v37-storage"><span className={`roles-v37-storage-dot is-${mode}`} /> <span>{message}</span><Link href="/app/sources">Workspace & source settings →</Link></footer>
  </div>
}
