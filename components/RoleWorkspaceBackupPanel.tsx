'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ROLE_WORKSPACE_CHANGED_EVENT,
  readRoleWorkspaces,
  writeRoleWorkspaces,
} from '@/lib/role-workspace-storage'
import {
  createRoleWorkspaceBackup,
  planRoleWorkspaceImport,
  type RoleImportPlan,
} from '@/lib/role-workspace-backup'
import type { RoleWorkspace } from '@/lib/role-workspace'

export function RoleWorkspaceBackupPanel() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [importText, setImportText] = useState('')
  const [plan, setPlan] = useState<RoleImportPlan | null>(null)
  const [message, setMessage] = useState('Export a versioned backup before relying on browser-local role data.')
  const fileRef = useRef<HTMLInputElement | null>(null)

  function refresh() {
    setRoles(readRoleWorkspaces())
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

  function exportBackup() {
    const backup = createRoleWorkspaceBackup(roles)
    const text = JSON.stringify(backup, null, 2)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `sourcingos-role-workspaces-${date}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setMessage(`Exported ${backup.roleCount} role workspace${backup.roleCount === 1 ? '' : 's'} with ${backup.candidateCount} role candidate record${backup.candidateCount === 1 ? '' : 's'}.`)
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Backup file is larger than the 10 MB browser import limit.')
      return
    }
    const text = await file.text()
    setImportText(text)
    setPlan(null)
    setMessage(`Loaded ${file.name}. Review the dry-run plan before applying.`)
  }

  function previewImport() {
    const next = planRoleWorkspaceImport(roles, importText)
    setPlan(next)
    setMessage(next.valid ? 'Dry run complete. No local data has changed.' : 'Backup validation failed. No local data has changed.')
  }

  function applyImport() {
    if (!plan?.valid) return
    writeRoleWorkspaces(plan.result)
    setRoles(plan.result)
    setMessage(`Restore applied: ${plan.newRoles} new, ${plan.replacedRoles} replaced with newer copies, ${plan.unchangedRoles} unchanged.`)
    setPlan(null)
    setImportText('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <section className="card" style={{ marginBottom: 18, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240, flex: '1 1 480px' }}>
          <div className="kicker">Data safety and portability</div>
          <h2 style={{ margin: '5px 0 7px', fontSize: 18 }}>Backup and restore role workspaces</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{message}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 9, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
            <span>{roles.length} local role{roles.length === 1 ? '' : 's'}</span>
            <span>{roles.reduce((sum, role) => sum + role.candidates.length, 0)} role candidate record{roles.reduce((sum, role) => sum + role.candidates.length, 0) === 1 ? '' : 's'}</span>
            <span>Versioned JSON with integrity checksum</span>
          </div>
        </div>
        <button type="button" className="btn secondary" onClick={exportBackup} disabled={!roles.length}>
          Export backup
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={event => chooseFile(event.target.files?.[0]).catch(() => setMessage('Backup file could not be read.'))}
            style={{ flex: '1 1 300px' }}
          />
          <button type="button" className="btn ghost" onClick={previewImport} disabled={!importText.trim()}>
            Dry-run restore
          </button>
        </div>

        {plan && (
          <div style={{ marginTop: 12, padding: 12, border: `1px solid ${plan.valid ? 'rgba(93,242,163,.35)' : 'rgba(246,201,107,.45)'}`, borderRadius: 9, background: 'rgba(255,255,255,.02)' }}>
            <div style={{ fontWeight: 650 }}>{plan.valid ? 'Restore plan ready' : 'Restore blocked'}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 7, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)' }}>
              <span>Incoming: {plan.incomingCount}</span>
              <span>New: {plan.newRoles}</span>
              <span>Replace older local copy: {plan.replacedRoles}</span>
              <span>Keep unchanged/local: {plan.unchangedRoles}</span>
              <span>Incoming candidates: {plan.candidateCount}</span>
            </div>
            {plan.errors.length > 0 && <ul style={{ margin: '9px 0 0', paddingLeft: 18 }}>{plan.errors.map(error => <li key={error} style={{ color: 'var(--amber)', fontSize: 12 }}>{error}</li>)}</ul>}
            {plan.warnings.length > 0 && <ul style={{ margin: '9px 0 0', paddingLeft: 18 }}>{plan.warnings.map(warning => <li key={warning} className="muted" style={{ fontSize: 12 }}>{warning}</li>)}</ul>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost" onClick={() => { setPlan(null); setImportText(''); if (fileRef.current) fileRef.current.value = '' }}>Cancel</button>
              <button type="button" className="btn secondary" onClick={applyImport} disabled={!plan.valid}>Apply restore</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 11, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        Restore is additive and duplicate-aware. It never removes a local role. Matching role ids are replaced only when the backup copy is newer. Always review files containing candidate information before storing or sharing them.
      </div>
    </section>
  )
}
