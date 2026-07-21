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
type VersionMap = Record<string, number>

const ROLE_VERSION_STORAGE_KEY = 'sourcingos.v20.role-workspace-versions'

function validVersion(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function readRoleVersions(): VersionMap {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROLE_VERSION_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed)
      .map(([id, value]) => [id, validVersion(value)] as const)
      .filter((entry): entry is [string, number] => Boolean(entry[0] && entry[1])))
  } catch {
    return {}
  }
}

function writeRoleVersions(versions: VersionMap): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROLE_VERSION_STORAGE_KEY, JSON.stringify(versions))
}

function versionsFromResponse(value: unknown): VersionMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .map(([id, version]) => [id, validVersion(version)] as const)
    .filter((entry): entry is [string, number] => Boolean(entry[0] && entry[1])))
}

export function useRoleWorkspaces() {
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [mode, setMode] = useState<StorageMode>('checking')
  const [message, setMessage] = useState('Loading role workspaces…')
  const syncTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const versions = useRef<VersionMap>({})

  const refreshLocal = useCallback(() => {
    setRoles(readRoleWorkspaces())
  }, [])

  const syncWorkspace = useCallback(async (workspace: RoleWorkspace) => {
    try {
      const response = await fetch('/api/roles/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspace, expectedVersion: versions.current[workspace.id] }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Role sync failed.')

      if (json.mode === 'supabase' && json.persisted) {
        const version = validVersion(json.version)
        if (!version) throw new Error('Role saved without a valid server version. Refresh before editing again.')
        versions.current = { ...versions.current, [workspace.id]: version }
        writeRoleVersions(versions.current)
        setMode('supabase')
        setMessage(`Saved to your account at version ${version}.`)
      } else {
        setMode('preview')
        setMessage(json.note || 'Saved in this browser.')
      }
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
    versions.current = readRoleVersions()
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
          versions.current = versionsFromResponse(json.versions)
          writeRoleVersions(versions.current)
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
    const nextVersions = { ...versions.current }
    delete nextVersions[workspace.id]
    versions.current = nextVersions
    writeRoleVersions(nextVersions)
    const next = [workspace, ...readRoleWorkspaces().filter(role => role.id !== workspace.id)]
    commit(next, [workspace.id])
  }, [commit])

  const updateRole = useCallback((roleId: string, updater: (workspace: RoleWorkspace) => RoleWorkspace) => {
    const current = readRoleWorkspaces()
    const next = current.map(role => role.id === roleId ? updater(role) : role)
    commit(next, [roleId])
    return next.find(role => role.id === roleId)
  }, [commit])

  const removeRole = useCallback(async (roleId: string): Promise<boolean> => {
    const current = readRoleWorkspaces()
    if (!current.some(role => role.id === roleId)) return true

    if (mode === 'supabase') {
      const expectedVersion = versions.current[roleId]
      if (!expectedVersion) {
        setMode('error')
        setMessage('Refresh this role before deleting it from your account.')
        return false
      }
      try {
        const response = await fetch(`/api/roles/sync?roleId=${encodeURIComponent(roleId)}&expectedVersion=${expectedVersion}`, { method: 'DELETE' })
        const json = await response.json()
        if (!response.ok || !json.ok) throw new Error(json.error || 'Role deletion failed.')
      } catch (error) {
        setMode('error')
        setMessage(error instanceof Error ? error.message : 'Role deletion failed. The local workspace was preserved.')
        return false
      }
    }

    const nextVersions = { ...versions.current }
    delete nextVersions[roleId]
    versions.current = nextVersions
    writeRoleVersions(nextVersions)
    commit(current.filter(role => role.id !== roleId))
    setMessage(mode === 'supabase' ? 'Role deleted from your account.' : 'Role removed from this browser.')
    return true
  }, [commit, mode])

  return { roles, mode, message, addRole, updateRole, removeRole, syncWorkspace, refreshLocal }
}
