'use client'

import { useEffect, useState } from 'react'
import {
  ROLE_WORKSPACE_CHANGED_EVENT,
  readRoleWorkspaces,
} from '@/lib/role-workspace-storage'
import type { RoleWorkspace } from '@/lib/role-workspace'

type SyncState = 'idle' | 'checking' | 'syncing' | 'done' | 'error'

export function RoleWorkspaceSyncPanel() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [state, setState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('Browser-local role workspaces are available immediately. Durable account sync requires a healthy Supabase project.')
  const [mode, setMode] = useState<'unknown' | 'preview' | 'supabase'>('unknown')

  function refreshLocal() {
    setRoles(readRoleWorkspaces())
  }

  useEffect(() => {
    refreshLocal()
    const listener = () => refreshLocal()
    window.addEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
    window.addEventListener('storage', listener)
    return () => {
      window.removeEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
      window.removeEventListener('storage', listener)
    }
  }, [])

  async function check() {
    setState('checking')
    try {
      const res = await fetch('/api/roles/sync', { headers: { accept: 'application/json' } })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Storage check failed.')
      setMode(json.mode)
      setMessage(json.mode === 'supabase'
        ? `Durable storage is available. ${json.workspaces?.length || 0} server workspace(s) found.`
        : json.note || 'Preview mode is active. Workspaces remain in this browser.')
      setState('done')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Storage check failed.')
    }
  }

  async function sync() {
    if (!roles.length) {
      setMessage('Create a role workspace before syncing.')
      return
    }
    setState('syncing')
    try {
      const results = await Promise.all(roles.map(async workspace => {
        const res = await fetch('/api/roles/sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ workspace }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) throw new Error(json.error || `Could not sync ${workspace.intake.title}.`)
        return json
      }))
      const durable = results.filter(result => result.persisted).length
      const preview = results.length - durable
      setMode(durable ? 'supabase' : 'preview')
      setMessage(durable
        ? `Synced ${durable} role workspace${durable === 1 ? '' : 's'} to your account.`
        : `${preview} role workspace${preview === 1 ? '' : 's'} checked. Durable storage is still unavailable, so browser-local data was preserved without change.`)
      setState('done')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Role workspace sync failed.')
    }
  }

  return (
    <section className="card" style={{ marginBottom: 18, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240, flex: '1 1 420px' }}>
          <div className="kicker">Storage and continuity</div>
          <h2 style={{ margin: '5px 0 7px', fontSize: 18 }}>Role workspace sync</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{message}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
            <span>{roles.length} browser workspace{roles.length === 1 ? '' : 's'}</span>
            <span>Mode: {mode}</span>
            <span>No data is deleted during sync</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={check} disabled={state === 'checking' || state === 'syncing'}>
            {state === 'checking' ? 'Checking…' : 'Check storage'}
          </button>
          <button type="button" className="btn secondary" onClick={sync} disabled={!roles.length || state === 'syncing' || state === 'checking'}>
            {state === 'syncing' ? 'Syncing…' : 'Sync role workspaces'}
          </button>
        </div>
      </div>
      <div style={{ marginTop: 11, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        Sync is idempotent and owner-scoped. It does not send outreach, merge identities, verify contact data, change candidate dispositions, or remove local workspaces.
      </div>
    </section>
  )
}
