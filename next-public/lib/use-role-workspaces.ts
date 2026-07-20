'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoleWorkspace } from '@/lib/role-workspace'
import {
  ROLE_WORKSPACE_CHANGED_EVENT,
  hydrateRoleWorkspaces,
  readRoleWorkspaces,
  writeRoleWorkspaces,
} from '@/lib/role-workspace-storage'

type StorageMode = 'checking' | 'preview' | 'supabase' | 'error'

export function useRoleWorkspaces() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [mode, setMode] = useState<StorageMode>('checking')
  const [message, setMessage] = useState('Loading role workspaces…')
  const syncTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const refreshLocal = useCallback(() => {
    setRoles(readRoleWorkspaces())
  }, [])

  const syncWorkspace = useCallback(async (workspace: RoleWorkspace) => {
    try {
      const response = await fetch('/api/roles/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Role sync failed.')
      setMode(json.mode === 'supabase' && json.persisted ? 'supabase' : 'preview')
      setMessage(json.persisted ? 'Saved to your account.' : json.note || 'Saved in this browser.')
    } catch (error) {
      setMode('error')
      setMessage(error instanceof Error ? error.message : 'Role sync failed. Browser changes were preserved.')
    }
  }, [])

  const scheduleSync = useCallback((workspace: RoleWorkspace, delay = 800) => {
    const current = syncTimers.current.get(workspace.id)
    if (current) clearTimeout(current)
    const timer = setTimeout(() => {
      syncTimers.current.delete(workspace.id)
      void syncWorkspace(workspace)
    }, delay)
    syncTimers.current.set(workspace.id, timer)
  }, [syncWorkspace])

  useEffect(() => {
    refreshLocal()
    const listener = () => refreshLocal()
    window.addEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
    window.addEventListener('storage', listener)

    void (async () => {
      try {
        const response = await fetch('/api/roles/sync', { headers: { accept: 'application/json' }, cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.ok) throw new Error(json.error || 'Could not restore role workspaces.')
        if (json.mode === 'supabase') {
          const merged = hydrateRoleWorkspaces(Array.isArray(json.workspaces) ? json.workspaces : [])
          setRoles(merged)
          setMode('supabase')
          setMessage('Connected and restored from your account.')
        } else {
          setMode('preview')
          setMessage(json.note || 'Browser-local preview workspace.')
        }
      } catch (error) {
        setMode('error')
        setMessage(error instanceof Error ? error.message : 'Could not restore account workspaces. Browser data is still available.')
      }
    })()

    return () => {
      window.removeEventListener(ROLE_WORKSPACE_CHANGED_EVENT, listener)
      window.removeEventListener('storage', listener)
      for (const timer of syncTimers.current.values()) clearTimeout(timer)
      syncTimers.current.clear()
    }
  }, [refreshLocal])

  const commit = useCallback((next: RoleWorkspace[], syncIds: string[] = []) => {
    writeRoleWorkspaces(next)
    setRoles(next)
    for (const id of syncIds) {
      const workspace = next.find(role => role.id === id)
      if (workspace) scheduleSync(workspace)
    }
  }, [scheduleSync])

  const addRole = useCallback((workspace: RoleWorkspace) => {
    const next = [workspace, ...readRoleWorkspaces().filter(role => role.id !== workspace.id)]
    commit(next, [workspace.id])
  }, [commit])

  const updateRole = useCallback((roleId: string, updater: (workspace: RoleWorkspace) => RoleWorkspace) => {
    const current = readRoleWorkspaces()
    const next = current.map(role => role.id === roleId ? updater(role) : role)
    commit(next, [roleId])
    return next.find(role => role.id === roleId)
  }, [commit])

  const removeRole = useCallback((roleId: string) => {
    const next = readRoleWorkspaces().filter(role => role.id !== roleId)
    commit(next)
  }, [commit])

  return { roles, mode, message, addRole, updateRole, removeRole, syncWorkspace, refreshLocal }
}
