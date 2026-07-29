'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

export function RoleSearchActions({ roleId }: { roleId: string }) {
  const { roles, mode } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])

  if (!role || mode === 'checking') return null

  const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved')
  const baseHref = `/app/candidate-search?roleId=${encodeURIComponent(role.id)}`

  return (
    <section className="product-panel" style={{ marginBottom: 14 }} aria-label="Role sourcing actions">
      <div className="product-panel-head">
        <div>
          <span className="kicker">Role sourcing loop</span>
          <h2>Search in this role context</h2>
          <p className="muted" style={{ margin: '5px 0 0', fontSize: 13 }}>
            Carry the approved intake into Candidate Search, save a canonical person once, and return them to this role review queue.
          </p>
        </div>
        <Link className="btn" href={baseHref}>Search this role</Link>
      </div>

      {approvedLanes.length > 0 && (
        <div className="button-row" style={{ marginTop: 12 }}>
          {approvedLanes.map(lane => (
            <Link
              key={lane.id}
              className="btn secondary"
              href={`${baseHref}&laneId=${encodeURIComponent(lane.id)}`}
              title={lane.purpose}
            >
              Search {lane.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
