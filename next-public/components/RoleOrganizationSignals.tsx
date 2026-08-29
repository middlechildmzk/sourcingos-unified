'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildDomainPackProfile } from '@/lib/domain-packs-v31'
import {
  memoryDisposition,
  updateSignalMemory,
  type OrganizationSignal,
  type OrganizationSignalMemoryItem,
} from '@/lib/organization-signals-v31'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type SignalResponse = {
  ok?: boolean
  error?: string
  query?: string
  signals?: OrganizationSignal[]
  sourceStatus?: { usaspending?: { status: 'completed' | 'failed'; discovered: number } }
  trust?: { message?: string; organizationOnly?: string }
}

function storageKey(roleId: string) {
  return `sourcingos.v31.organization-signal-memory.${roleId}`
}

function readMemory(roleId: string): OrganizationSignalMemoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(roleId)) || '[]')
    return Array.isArray(parsed) ? parsed.slice(-500) : []
  } catch {
    return []
  }
}

function amount(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${Math.round(value).toLocaleString()}`
}

function dateLabel(value: string | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function RoleOrganizationSignals({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const profile = useMemo(() => role ? buildDomainPackProfile(role.intake) : null, [role])
  const [signals, setSignals] = useState<OrganizationSignal[]>([])
  const [memory, setMemory] = useState<OrganizationSignalMemoryItem[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => setMemory(readMemory(roleId)), [roleId])

  if (!role || !profile || mode === 'checking' || !profile.activeIds.has('federal')) return null
  const activeRole = role

  function saveMemory(next: OrganizationSignalMemoryItem[]) {
    setMemory(next)
    try { localStorage.setItem(storageKey(roleId), JSON.stringify(next)) } catch { /* best effort */ }
  }

  function setDisposition(signal: OrganizationSignal, disposition: 'targeted' | 'dismissed') {
    saveMemory(updateSignalMemory(memory, signal, disposition))
  }

  function targetOrganization(signal: OrganizationSignal) {
    updateRole(roleId, current => {
      const existing = current.intake.targetCompanies.some(company => company.trim().toLowerCase() === signal.organization.trim().toLowerCase())
      if (existing) return current
      const now = new Date().toISOString()
      return {
        ...current,
        intake: {
          ...current.intake,
          targetCompanies: [...current.intake.targetCompanies, signal.organization].slice(0, 100),
        },
        activity: [
          ...current.activity,
          {
            id: crypto.randomUUID(),
            type: 'note_added' as const,
            message: `Added ${signal.organization} to target organizations from a recruiter-reviewed public market signal.`,
            createdAt: now,
          },
        ].slice(-500),
        updatedAt: now,
      }
    })
    setDisposition(signal, 'targeted')
    setStatus(`${signal.organization} was added to this role's target organizations. The contract signal itself was not attached to any candidate.`)
  }

  async function runSignals() {
    if (working) return
    setWorking(true)
    setStatus('Scanning public federal contract awards for organization-level signals…')
    try {
      const response = await fetch('/api/organization-signals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: activeRole.intake.title,
          mustHaves: activeRole.intake.mustHaves,
          limit: 18,
        }),
      })
      const json = await response.json() as SignalResponse
      if (!response.ok || !json.ok) throw new Error(json.error || 'Organization signal search failed.')
      setSignals(json.signals || [])
      setQuery(json.query || '')
      setStatus(json.trust?.message || `Found ${(json.signals || []).length} public organization signals.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Organization signal search failed.')
    } finally {
      setWorking(false)
    }
  }

  const visible = signals.filter(signal => memoryDisposition(memory, signal) !== 'dismissed')

  return <section className="product-panel" aria-label="Organization opportunity signals">
    <div className="product-panel-head">
      <div><span className="kicker">Market signals · federal pack</span><h2>Find organizations worth sourcing now.</h2></div>
      <span>Organizations, never candidates</span>
    </div>
    <p className="muted">SourcingOS can use public contract activity to suggest organizations worth investigating. A contract award never means an employee is available, interested, qualified, or verified.</p>

    <div className="cta">
      <div><b>USAspending contract intelligence</b><span>Read-only scan of public contract awards using role-safe capability terms. Recruiter notes and candidate data are never sent.</span></div>
      <button className="btn" disabled={working} onClick={() => void runSignals()}>{working ? 'Scanning…' : 'Scan contract signals'}</button>
    </div>

    {query && <div className="agentic-query-box"><span>Public signal query</span><code>{query}</code></div>}
    {status && <div className="cta" role="status">{status}</div>}

    {!!visible.length && <div className="product-list">{visible.map(signal => {
      const disposition = memoryDisposition(memory, signal)
      return <article className="product-row" key={signal.id}>
        <div className="product-row-main">
          <div className="product-row-title">{signal.organization}</div>
          <div className="product-row-meta">{[signal.headline, amount(signal.amount), dateLabel(signal.eventDate)].filter(Boolean).join(' · ')}</div>
          <p className="normal-wrap">{signal.whyNow}</p>
          {signal.description && <details className="advanced-disclosure"><summary>Public award description</summary><p className="normal-wrap">{signal.description}</p></details>}
          <div className="agentic-source-status-row">
            <span className="status-pill">USAspending</span>
            {typeof signal.freshnessDays === 'number' && <span className="status-pill">{signal.freshnessDays}d old</span>}
            {disposition === 'targeted' && <span className="status-pill success">targeted</span>}
            <a className="status-pill" href={signal.sourceUrl} target="_blank" rel="noreferrer noopener">Evidence ↗</a>
          </div>
        </div>
        <div className="product-row-actions">
          <button className="btn secondary" disabled={disposition === 'targeted'} onClick={() => targetOrganization(signal)}>{disposition === 'targeted' ? 'Added to targets' : 'Add organization'}</button>
          <button className="btn ghost" onClick={() => setDisposition(signal, 'dismissed')}>Dismiss</button>
        </div>
      </article>
    })}</div>}
  </section>
}
