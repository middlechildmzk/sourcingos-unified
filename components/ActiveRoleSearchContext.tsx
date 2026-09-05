'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const ACTIVE_ROLE_CONTEXT_KEY = 'sourcingos.active-role-context.v1'

type Context = {
  roleId: string
  roleTitle: string
  laneId?: string | null
  laneQuery?: string | null
  launchedAt?: string
}

export function ActiveRoleSearchContext() {
  const [context, setContext] = useState<Context | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_ROLE_CONTEXT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.roleId && parsed?.roleTitle) setContext(parsed)
    } catch {
      setContext(null)
    }
  }, [])

  if (!context) return null

  return (
    <div className="card" style={{ margin: '0 0 18px', padding: 14, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <div className="kicker">Active role context</div>
        <div style={{ fontWeight: 650, marginTop: 3 }}>{context.roleTitle}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
          Candidate Search was prepared from this role’s calibrated intake{context.laneQuery ? ` · lane: ${context.laneQuery}` : ''}.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link className="btn ghost" href="/app/roles" style={{ fontSize: 12, padding: '6px 11px' }}>Back to role</Link>
        <button
          type="button"
          className="btn ghost"
          style={{ fontSize: 12, padding: '6px 11px' }}
          onClick={() => { localStorage.removeItem(ACTIVE_ROLE_CONTEXT_KEY); setContext(null) }}
        >
          Clear context
        </button>
      </div>
    </div>
  )
}
