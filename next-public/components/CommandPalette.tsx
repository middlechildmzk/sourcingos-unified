'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLE_WORKSPACE_CHANGED_EVENT, readRoleWorkspaces } from '@/lib/role-workspace-storage'
import type { RoleWorkspace } from '@/lib/role-workspace'

type Candidate = {
  id: string
  canonicalName: string
  headline?: string
  currentCompany?: string
  location?: string
}

type Command = { label: string; detail: string; href: string; shortcut?: string }

const commands: Command[] = [
  { label: 'Open Today', detail: 'Approvals, candidate reviews, briefs, and agent work', href: '/app/agent-os', shortcut: 'G T' },
  { label: 'Create a role', detail: 'Open the role portfolio and start a calibrated intake', href: '/app/roles?new=1', shortcut: 'N R' },
  { label: 'Open AutoSource', detail: 'Review discovery campaigns and ambiguous identities', href: '/app/autosource', shortcut: 'G A' },
  { label: 'Search Candidate Graph', detail: 'Find known candidates and evidence', href: '/app/candidate-database', shortcut: 'G C' },
  { label: 'Open Evidence Ledger', detail: 'Review provenance, conflicts, and freshness', href: '/app/evidence-ledger' },
  { label: 'Open Network Vault', detail: 'Find relationship context and warm paths', href: '/app/network' },
  { label: 'Open Acquisition', detail: 'Review sources, enrichment, and graph growth', href: '/app/acquisition' },
]

export function CommandPalette({ triggerClassName = 'app-command-trigger' }: { triggerClassName?: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [roles, setRoles] = useState<RoleWorkspace[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(value => !value)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const refresh = () => setRoles(readRoleWorkspaces())
    refresh()
    window.addEventListener(ROLE_WORKSPACE_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(ROLE_WORKSPACE_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCandidates([])
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  useEffect(() => {
    const needle = query.trim()
    if (!open || needle.length < 2) {
      setCandidates([])
      setLoadingCandidates(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingCandidates(true)
      try {
        const response = await fetch(`/api/candidate-db/list?q=${encodeURIComponent(needle)}&limit=6&offset=0`, { signal: controller.signal, headers: { accept: 'application/json' } })
        const json = await response.json()
        if (!response.ok || !json.ok) throw new Error(json.error || 'Candidate search failed.')
        setCandidates(Array.isArray(json.candidates) ? json.candidates : [])
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setCandidates([])
      } finally {
        setLoadingCandidates(false)
      }
    }, 220)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [open, query])

  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return commands
    return commands.filter(command => `${command.label} ${command.detail}`.toLowerCase().includes(needle))
  }, [query])

  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return roles.slice(0, 6)
    return roles.filter(role => `${role.intake.title} ${role.intake.location} ${role.status}`.toLowerCase().includes(needle)).slice(0, 8)
  }, [query, roles])

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  return <>
    <button className={triggerClassName} onClick={() => setOpen(true)} aria-label="Open command palette"><span>Search or jump</span><kbd>⌘K</kbd></button>
    {open && <div className="command-palette-layer" role="dialog" aria-modal="true" aria-label="SourcingOS command palette">
      <button className="command-palette-backdrop" onClick={() => setOpen(false)} aria-label="Close command palette" />
      <section className="command-palette">
        <div className="command-palette-search"><span>⌕</span><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search roles, candidates, or actions…" aria-label="Search SourcingOS" /><kbd>Esc</kbd></div>
        <div className="command-palette-results">
          {!!filteredRoles.length && <div className="command-group"><div className="command-group-label">Roles</div>{filteredRoles.map(role => <button key={role.id} onClick={() => navigate(`/app/roles/${role.id}`)}><span><b>{role.intake.title}</b><small>{[role.intake.location, role.status, `${role.candidates.length} candidates`].filter(Boolean).join(' · ')}</small></span><em>Role</em></button>)}</div>}
          {(loadingCandidates || candidates.length > 0) && <div className="command-group"><div className="command-group-label">Candidates</div>{loadingCandidates && <div className="command-loading">Searching Candidate Graph…</div>}{candidates.map(candidate => <button key={candidate.id} onClick={() => navigate(`/app/candidate/${candidate.id}`)}><span><b>{candidate.canonicalName}</b><small>{[candidate.headline, candidate.currentCompany, candidate.location].filter(Boolean).join(' · ') || 'Candidate intelligence record'}</small></span><em>Candidate</em></button>)}</div>}
          {!!filteredCommands.length && <div className="command-group"><div className="command-group-label">Actions and destinations</div>{filteredCommands.map(command => <button key={command.href} onClick={() => navigate(command.href)}><span><b>{command.label}</b><small>{command.detail}</small></span>{command.shortcut ? <kbd>{command.shortcut}</kbd> : <em>Open</em>}</button>)}</div>}
          {query.trim().length >= 2 && !loadingCandidates && !candidates.length && !filteredRoles.length && !filteredCommands.length && <div className="command-empty"><b>No exact matches</b><span>Search the full Candidate Graph for “{query.trim()}”.</span><button className="btn" onClick={() => navigate(`/app/candidate-database?q=${encodeURIComponent(query.trim())}`)}>Search candidates</button></div>}
        </div>
      </section>
    </div>}
  </>
}
