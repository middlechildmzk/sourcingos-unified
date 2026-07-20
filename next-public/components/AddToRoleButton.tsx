'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ROLE_WORKSPACE_CHANGED_EVENT,
  addCandidateToRole,
  readRoleWorkspaces,
  type RoleCandidateInput,
} from '@/lib/role-workspace-storage'
import type { RoleWorkspace } from '@/lib/role-workspace'

type Props = {
  candidate: RoleCandidateInput
  compact?: boolean
}

export function AddToRoleButton({ candidate, compact = false }: Props) {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [open, setOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [message, setMessage] = useState('')

  function refreshRoles() {
    const next = readRoleWorkspaces()
    setRoles(next)
    setSelectedRoleId(current => current && next.some(role => role.id === current) ? current : next[0]?.id || '')
  }

  useEffect(() => {
    refreshRoles()
    const listener = () => refreshRoles()
    window.addEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
    window.addEventListener('storage', listener)
    return () => {
      window.removeEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
      window.removeEventListener('storage', listener)
    }
  }, [])

  const selectedRole = useMemo(() => roles.find(role => role.id === selectedRoleId), [roles, selectedRoleId])

  function add() {
    if (!selectedRoleId) return
    const result = addCandidateToRole(selectedRoleId, candidate)
    setMessage(result.message)
    if (result.ok) setOpen(false)
  }

  if (!roles.length) {
    return (
      <Link
        href="/app/roles"
        className="btn ghost"
        style={{ fontSize: compact ? '11px' : '12px', padding: compact ? '4px 9px' : '5px 12px' }}
      >
        Create role first
      </Link>
    )
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        className="btn ghost"
        onClick={() => { setOpen(value => !value); setMessage('') }}
        style={{ fontSize: compact ? '11px' : '12px', padding: compact ? '4px 9px' : '5px 12px' }}
      >
        + Add to role
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 80,
            width: 300,
            padding: 12,
            border: '1px solid var(--line)',
            borderRadius: 10,
            background: 'var(--panel)',
            boxShadow: '0 18px 45px rgba(0,0,0,.35)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 7 }}>Add as an unreviewed role candidate</div>
          <select
            value={selectedRoleId}
            onChange={event => setSelectedRoleId(event.target.value)}
            style={{ width: '100%', padding: '8px 9px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8 }}
          >
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.intake.title}</option>
            ))}
          </select>
          {selectedRole && (
            <div style={{ marginTop: 7, fontSize: 11, color: 'var(--muted)' }}>
              {selectedRole.candidates.length} candidate{selectedRole.candidates.length === 1 ? '' : 's'} already in this role
            </div>
          )}
          <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={() => setOpen(false)} style={{ fontSize: 11, padding: '5px 9px' }}>Cancel</button>
            <button type="button" className="btn secondary" onClick={add} style={{ fontSize: 11, padding: '5px 10px' }}>Add to review queue</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
            This does not confirm identity, qualification, contact permission, clearance, or availability.
          </div>
        </div>
      )}

      {message && <span style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 280, textAlign: 'right' }}>{message}</span>}
    </div>
  )
}
