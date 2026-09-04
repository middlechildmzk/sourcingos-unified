'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

export function RoleActivityV37({ roleId }: { roleId: string }) {
  const { roles, mode, message } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  if (!role && mode === 'checking') return <div className="wrap"><p className="muted">Loading role activity…</p></div>
  if (!role) return <div className="wrap"><h1>Role not found</h1><p className="muted">{message}</p><Link className="btn" href="/app/roles">Back to roles</Link></div>
  return <div className="wrap role-section-stack">
    <section className="product-page-head"><div><span className="kicker">Role activity</span><h1>{role.intake.title}</h1><p>Audit trail for recruiter decisions, brief changes, sourcing events, and candidate review.</p></div><div className="product-page-actions"><Link className="btn secondary" href={`/app/roles/${encodeURIComponent(role.id)}`}>← Workspace</Link></div></section>
    <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Timeline</span><h2>{role.activity.length} recorded events</h2></div><span className="status-pill">{mode}</span></div><div className="product-list">{role.activity.map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.message}</div><div className="product-row-meta">{label(item.type)} · {new Date(item.createdAt).toLocaleString()}</div></div></div>)}{!role.activity.length && <div className="product-empty-state"><h3>No activity yet</h3><p className="muted">Role changes and recruiter decisions will appear here.</p></div>}</div></section>
  </div>
}
