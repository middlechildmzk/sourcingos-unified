'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ROLE_WORKSPACE_CHANGED_EVENT,
  readRoleWorkspaces,
} from '@/lib/role-workspace-storage'
import type { RoleWorkspace } from '@/lib/role-workspace'

const WORKBENCH_DRAFT_KEY = 'sourcingos.workbench.intake-draft.v1'
const ACTIVE_ROLE_CONTEXT_KEY = 'sourcingos.active-role-context.v1'

export function RoleSearchLaunchPanel() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [roleId, setRoleId] = useState('')
  const [laneId, setLaneId] = useState('')
  const [message, setMessage] = useState('')

  function refresh() {
    const next = readRoleWorkspaces()
    setRoles(next)
    setRoleId(current => current && next.some(role => role.id === current) ? current : next[0]?.id || '')
  }

  useEffect(() => {
    refresh()
    const listener = () => refresh()
    window.addEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
    window.addEventListener('storage', listener)
    return () => {
      window.removeEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
      window.removeEventListener('storage', listener)
    }
  }, [])

  const role = useMemo(() => roles.find(item => item.id === roleId), [roles, roleId])
  const approvedLanes = useMemo(() => role?.searchLanes.filter(lane => lane.status === 'approved') || [], [role])
  const lane = approvedLanes.find(item => item.id === laneId) || approvedLanes[0]

  useEffect(() => {
    setLaneId(current => current && approvedLanes.some(item => item.id === current) ? current : approvedLanes[0]?.id || '')
  }, [roleId, approvedLanes])

  function launch() {
    if (!role) return
    const intakeDraft = {
      jobTitle: role.intake.title,
      jobDescription: role.intake.rawDescription,
      mustHaves: role.intake.mustHaves.join(', '),
      niceToHaves: role.intake.niceToHaves.join(', '),
      location: role.intake.location,
      workType: role.intake.workMode === 'unknown' ? 'any' : role.intake.workMode,
      clearanceNeeds: role.intake.clearance === 'Not specified' ? '' : role.intake.clearance,
      targetCompanies: role.intake.targetCompanies.join(', '),
      disqualifiers: role.intake.disqualifiers.join(', '),
      compensationNotes: role.intake.compensation === 'Not specified' ? '' : role.intake.compensation,
      hiringManagerNotes: role.intake.hiringManagerNotes,
    }
    try {
      localStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(intakeDraft))
      localStorage.setItem(ACTIVE_ROLE_CONTEXT_KEY, JSON.stringify({
        roleId: role.id,
        roleTitle: role.intake.title,
        laneId: lane?.id || null,
        laneQuery: lane?.query || null,
        launchedAt: new Date().toISOString(),
      }))
      const query = lane?.query ? `?q=${encodeURIComponent(lane.query)}&role=${encodeURIComponent(role.id)}` : `?role=${encodeURIComponent(role.id)}`
      window.location.assign(`/app/candidate-search${query}`)
    } catch {
      setMessage('Candidate Search could not be prepared in this browser.')
    }
  }

  if (!roles.length) return null

  return (
    <section className="card" style={{ marginBottom: 18, padding: 16 }}>
      <div className="kicker">Connected sourcing flow</div>
      <h2 style={{ margin: '5px 0 8px', fontSize: 18 }}>Launch Candidate Search from an approved role</h2>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.55 }}>
        Copies the calibrated intake into Candidate Search and preserves the active role context. It does not run external searches or add candidates automatically.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr) auto', gap: 10, alignItems: 'end' }}>
        <label style={{ fontSize: 12 }}>Role
          <select value={roleId} onChange={event => setRoleId(event.target.value)} style={{ width: '100%', marginTop: 5 }}>
            {roles.map(item => <option key={item.id} value={item.id}>{item.intake.title}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Approved lane
          <select value={lane?.id || ''} onChange={event => setLaneId(event.target.value)} style={{ width: '100%', marginTop: 5 }}>
            {!approvedLanes.length && <option value="">No approved lane yet</option>}
            {approvedLanes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn secondary" onClick={launch}>Open Candidate Search →</button>
      </div>
      {lane && <div style={{ marginTop: 9, fontSize: 11, color: 'var(--muted)' }}>Prepared query: {lane.query}</div>}
      {message && <div style={{ marginTop: 9, fontSize: 12, color: 'var(--amber)' }}>{message}</div>}
    </section>
  )
}
