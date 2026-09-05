'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { NetworkRow } from '@/app/api/network/list/route'

// Network Vault organizes imported relationship context. It never treats a row as
// a verified candidate, outreach permission, or confirmed identity by itself.

type LoadState = 'idle' | 'loading' | 'ok' | 'error' | 'auth'
type PageState = { limit: number; offset: number; hasMore: boolean; total: number }
type SignalTone = 'muted' | 'amber' | 'cyan'

const PAGE_SIZE = 50
const EMPTY_PAGE: PageState = { limit: PAGE_SIZE, offset: 0, hasMore: false, total: 0 }

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: '12px',
}

function SignalChip({ label, tone = 'muted' }: { label: string; tone?: SignalTone }) {
  const color = tone === 'amber' ? 'var(--amber)' : tone === 'cyan' ? 'var(--cyan)' : 'var(--muted)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', lineHeight: 1, padding: '4px 8px', borderRadius: '999px', border: `1px solid ${color}`, color, opacity: 0.92, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function lifecycle(row: NetworkRow): { label: string; tone: SignalTone; detail: string } {
  if (row.candidateId) return { label: 'In Candidate Graph', tone: 'cyan', detail: 'Linked to a recruiter-reviewed candidate record.' }
  const status = row.status.trim().toLowerCase()
  if (status === 'confirmed') return { label: 'Identity confirmed', tone: 'cyan', detail: 'The source-profile identity was recruiter-confirmed.' }
  if (status === 'rejected') return { label: 'Kept separate', tone: 'muted', detail: 'A proposed identity match was rejected.' }
  return { label: 'Relationship only', tone: 'amber', detail: 'Imported relationship context that still requires candidate review.' }
}

function pageState(value: unknown, totalValue: unknown): PageState {
  const page = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const number = (input: unknown, fallback: number) => {
    const parsed = typeof input === 'number' ? input : Number(input)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
  }
  return {
    limit: Math.max(1, Math.min(100, number(page.limit, PAGE_SIZE))),
    offset: number(page.offset, 0),
    hasMore: page.hasMore === true,
    total: number(totalValue, 0),
  }
}

export function NetworkVaultClient() {
  const [state, setState] = useState<LoadState>('idle')
  const [rows, setRows] = useState<NetworkRow[]>([])
  const [page, setPage] = useState<PageState>(EMPTY_PAGE)
  const [mode, setMode] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState('')

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [hasEmail, setHasEmail] = useState(false)
  const [hasLinkedin, setHasLinkedin] = useState(false)
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<NetworkRow | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 280)
    return () => clearTimeout(timer)
  }, [q])

  const load = useCallback(async (search: string, offset = 0) => {
    setState('loading')
    setErrorMsg('')
    setSelected(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(Math.max(0, offset)) })
      if (search) params.set('q', search)
      const res = await fetch(`/api/network/list?${params.toString()}`, { headers: { accept: 'application/json' } })
      if (res.status === 401) { setState('auth'); return }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Could not load your network.')
        setState('error')
        return
      }
      const nextRows = Array.isArray(data.rows) ? data.rows : []
      setRows(nextRows)
      setPage(pageState(data.page, data.total))
      setMode(data.persistence_mode || '')
      setState('ok')
    } catch {
      setErrorMsg('Could not reach the network service.')
      setState('error')
    }
  }, [])

  useEffect(() => { void load(debouncedQ, 0) }, [debouncedQ, load])

  // These quick refinements apply to the loaded page. The primary search is
  // server-side and spans the complete imported network.
  const visible = useMemo(() => {
    const companyQuery = company.trim().toLowerCase()
    const titleQuery = title.trim().toLowerCase()
    return rows.filter(row => {
      if (hasEmail && !row.email) return false
      if (hasLinkedin && !row.linkedinUrl) return false
      if (companyQuery && !row.company.toLowerCase().includes(companyQuery)) return false
      if (titleQuery && !row.title.toLowerCase().includes(titleQuery)) return false
      return true
    })
  }, [rows, hasEmail, hasLinkedin, company, title])

  const withEmail = useMemo(() => rows.filter(row => row.email).length, [rows])
  const withLinkedin = useMemo(() => rows.filter(row => row.linkedinUrl).length, [rows])
  const start = page.total && rows.length ? page.offset + 1 : 0
  const end = page.offset + rows.length

  return (
    <>
      <div className="preview-banner" style={{ marginBottom: '18px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Relationship context only.</strong> These are your imported connections. An entry does not
          mean the person is looking, qualified, cleared, contactable, or approved for outreach. Contact
          signals are unverified. Review before any action.
        </span>
      </div>

      <div style={{ ...card, padding: '16px', marginBottom: '16px' }}>
        <input
          value={q}
          onChange={event => setQ(event.target.value)}
          placeholder="Search your full network by name, title, or company"
          aria-label="Search your network"
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', fontSize: '15px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '9px', color: 'var(--text)', outline: 'none' }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
          <button type="button" onClick={() => setHasEmail(value => !value)} className="btn ghost" style={{ fontSize: '12px', padding: '6px 12px', borderColor: hasEmail ? 'var(--accent)' : undefined, color: hasEmail ? 'var(--accent)' : undefined }}>
            {hasEmail ? '✓ ' : ''}Has email on page
          </button>
          <button type="button" onClick={() => setHasLinkedin(value => !value)} className="btn ghost" style={{ fontSize: '12px', padding: '6px 12px', borderColor: hasLinkedin ? 'var(--accent)' : undefined, color: hasLinkedin ? 'var(--accent)' : undefined }}>
            {hasLinkedin ? '✓ ' : ''}Has LinkedIn URL on page
          </button>
          <input value={company} onChange={event => setCompany(event.target.value)} placeholder="Company on this page" aria-label="Filter loaded page by company" style={{ flex: '1 1 160px', minWidth: '140px', padding: '7px 11px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }} />
          <input value={title} onChange={event => setTitle(event.target.value)} placeholder="Title on this page" aria-label="Filter loaded page by title" style={{ flex: '1 1 160px', minWidth: '140px', padding: '7px 11px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }} />
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          <span>Source: LinkedIn connections import</span>
          <span>{withEmail} with email on this page</span>
          <span>{withLinkedin} with LinkedIn URL on this page</span>
          {mode === 'preview' && <span style={{ color: 'var(--amber)' }}>Preview mode, not durable</span>}
        </div>
      </div>

      {state === 'ok' && (
        <div style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 2px 10px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>
            Showing {visible.length} visible on this page
            {visible.length !== rows.length && ` of ${rows.length} loaded`}
          </span>
          <span>{start.toLocaleString()}–{end.toLocaleString()} of {page.total.toLocaleString()} matching connections</span>
        </div>
      )}

      {state === 'loading' && <div style={{ ...card, padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading your network…</div>}

      {state === 'auth' && (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '14px' }}>Sign in to view your private network.</p>
          <Link className="btn" href="/login">Sign in →</Link>
        </div>
      )}

      {state === 'error' && (
        <div style={{ ...card, padding: '32px', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '14px' }}>{errorMsg}</p>
          <button className="btn ghost" onClick={() => void load(debouncedQ, page.offset)}>Try again</button>
        </div>
      )}

      {state === 'ok' && rows.length === 0 && (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '8px' }}>{debouncedQ ? 'No matches' : 'Your network is empty'}</h3>
          <p className="muted" style={{ marginBottom: '16px', fontSize: '14px' }}>
            {debouncedQ ? 'No imported connections match that search.' : 'Import your LinkedIn connections export to seed your private network.'}
          </p>
          {!debouncedQ && <Link className="btn" href="/app/network/import">Import LinkedIn connections →</Link>}
        </div>
      )}

      {state === 'ok' && rows.length > 0 && visible.length === 0 && (
        <div style={{ ...card, padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No connections match the quick filters on this page.</div>
      )}

      {state === 'ok' && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(row => {
            const status = lifecycle(row)
            return <button key={row.id} type="button" onClick={() => setSelected(row)} style={{ ...card, textAlign: 'left', padding: '13px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', color: 'var(--text)' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[row.title, row.company].filter(Boolean).join(' · ') || 'No title or company on this row'}</span>
              </span>
              <span style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {row.email && <SignalChip label="✉ email signal" />}
                {row.linkedinUrl && <SignalChip label="LinkedIn" tone="cyan" />}
                <SignalChip label={status.label} tone={status.tone} />
              </span>
            </button>
          })}
        </div>
      )}

      {state === 'ok' && page.total > page.limit && (
        <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="btn secondary" disabled={page.offset === 0} onClick={() => void load(debouncedQ, Math.max(0, page.offset - page.limit))}>Previous page</button>
          <span className="muted" style={{ fontSize: 12 }}>Page {Math.floor(page.offset / page.limit) + 1}</span>
          <button className="btn secondary" disabled={!page.hasMore} onClick={() => void load(debouncedQ, page.offset + page.limit)}>Next page</button>
        </div>
      )}

      {selected && <NetworkDrawer row={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', padding: '5px 0' }}>
      <span style={{ color: 'var(--muted)', minWidth: '110px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{children || <span style={{ color: 'var(--muted)' }}>Not recorded</span>}</span>
    </div>
  )
}

function NetworkDrawer({ row, onClose }: { row: NetworkRow; onClose: () => void }) {
  const status = lifecycle(row)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,16,.6)', zIndex: 60 }} />
      <aside role="dialog" aria-modal="true" aria-label={`Details for ${row.name}`} style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 'min(440px, 92vw)', background: 'var(--panel)', borderLeft: '1px solid var(--line)', zIndex: 61, overflowY: 'auto', padding: '22px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '19px', fontWeight: 700 }}>{row.name}</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '2px' }}>{[row.title, row.company].filter(Boolean).join(' · ') || 'No title or company on this row'}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn ghost" style={{ padding: '4px 10px', fontSize: '13px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '14px 0 8px' }}>
          <SignalChip label="Relationship context" tone="amber" />
          <SignalChip label={status.label} tone={status.tone} />
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5 }}>{status.detail}</p>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '6px' }}>Source profile</div>
          <DetailRow label="Source">LinkedIn connections import</DetailRow>
          <DetailRow label="LinkedIn URL">{row.linkedinUrl ? <a href={row.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>Open profile ↗</a> : ''}</DetailRow>
          <DetailRow label="Location">{row.location}</DetailRow>
          <DetailRow label="Connected on">{row.connectedOn}</DetailRow>
          <DetailRow label="Imported">{row.importedAt}</DetailRow>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '6px' }}>Contact signals <span style={{ color: 'var(--amber)', textTransform: 'none', letterSpacing: 0 }}>· unverified</span></div>
          {row.email || row.linkedinUrl ? (
            <>
              {row.email && <DetailRow label="Email">{row.email}</DetailRow>}
              {row.linkedinUrl && <DetailRow label="Profile URL">{row.linkedinUrl}</DetailRow>}
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>Not verified and not an outreach permission. Confirm through your own process before any contact.</p>
            </>
          ) : <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No contact signal on this row.</p>}
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '6px' }}>Evidence</div>
          <div style={{ ...card, padding: '12px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.55 }}>
            <strong style={{ fontWeight: 600 }}>LinkedIn connection export row.</strong>{' '}
            {row.name}{row.title ? `, ${row.title}` : ''}{row.company ? ` at ${row.company}` : ''}. Connection import is relationship context only and does not imply job interest or outreach permission.
          </div>
          {row.importLabel && <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>Batch: {row.importLabel}</p>}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
          No outreach from this view. Review the identity and evidence before adding this person to a role or using a contact signal.
        </div>
      </aside>
    </>
  )
}
