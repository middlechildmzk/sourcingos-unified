'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

export function RoleDeleteControl({ roleId }: { roleId: string }) {
  const router = useRouter()
  const { roles, mode, removeRole } = useRoleWorkspaces()
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const role = roles.find(item => item.id === roleId)
  const storageReady = mode === 'supabase' || mode === 'preview'

  if (!role) return null

  async function deleteRole() {
    if (!storageReady) {
      setStatus('Wait for account storage to reconnect before deleting this role.')
      return
    }

    const confirmed = window.confirm(
      `Delete ${role.intake.title}? This removes the role workspace and its role-specific candidates, search lanes, and activity. This cannot be undone.`
    )
    if (!confirmed) return

    setWorking(true)
    setStatus('')
    const deleted = await removeRole(roleId)
    setWorking(false)
    if (!deleted) {
      setStatus('The role was not deleted. Refresh the workspace and try again.')
      return
    }

    router.push('/app/roles')
    router.refresh()
  }

  return (
    <details className="advanced-disclosure product-panel" style={{ marginTop: 18 }}>
      <summary>Role administration</summary>
      <div style={{ marginTop: 14 }}>
        <span className="kicker">Danger zone</span>
        <h2>Delete this role workspace</h2>
        <p className="muted">
          {mode === 'supabase'
            ? 'Deletion is owner-scoped and requires the exact saved server version.'
            : mode === 'preview'
              ? 'This removes the role from this browser-only preview.'
              : 'Deletion is unavailable until account storage reconnects.'}
        </p>
        {status && <div className="cta" role="status">{status}</div>}
        <button className="btn ghost" disabled={working || !storageReady} onClick={() => void deleteRole()}>
          {working ? 'Deleting role…' : 'Delete role'}
        </button>
      </div>
    </details>
  )
}
