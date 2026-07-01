'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { NetworkRow } from '@/app/api/network/list/route'

// ─────────────────────────────────────────────────────────────────────────────
// Network Vault V1 — browse / search / filter imported LinkedIn connections.
//
// Read-only. Every row is RELATIONSHIP CONTEXT, not a verified candidate. Contact
// signals are unverified. No outreach, no auto-merge — this view organizes the
// network and hands off to review elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ok' | 'error' | 'auth'

const card: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: '12px',
}

// Small, neutral "signal" chip — visually distinct from anything that reads as verified.
function SignalChip({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'amber' | 'cyan' }) {
  const color = tone === 'amber' ? 'var(--amber)' : tone === 'cyan' ? 'var(--cyan)' : 'var(--muted)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        lineHeight: 1,
        padding: '4px 8px',
        borderRadius: '999px',
        border: `1px solid ${color}`,
        color,
        opacity: 0.92,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export function NetworkVaultClient() {
  const [state, setState] = useState<LoadState>('idle')
  const [rows, setRows] = useState<NetworkRow[]>([])
  const [truncated, setTruncated] = useState(false)
  const [mode, setMode] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState('')

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [hasEmail, setHasEmail] = useState(false)
  const [hasLinkedin, setHasLinkedin] = useState(false)
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')

  const [selected, setSelected] = useState<NetworkRow | null>(null)

  // Debounce the server search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 280)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async (search: string) => {
    setState('loading')
    setErrorMsg('')
    try {
      const url = search ? `/api/network/list?q=${encodeURIComponent(search)}` : '/api/network/list'
      const res = await fetch(url, { headers: { accept: 'application/json' } })
      if (res.status === 401) { setState('auth'); return }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Could not load your network.')
        setState('error')
        return
      }
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setTruncated(!!data.truncated)
      setMode(data.persistence_mode || '')
      setState('ok')
    } catch {
      setErrorMsg('Could not reach the network service.')
      setState('error')
    }
  }, [])

  useEffect(() => { load(debouncedQ) }, [debouncedQ, load])

  // Client-side refinement over the (already server-searched) result set.
  const visible = useMemo(() => {
    const c = company.trim().toLowerCase()
    const t = title.trim().toLowerCase()
    return rows.filter(r => {
      if (hasEmail && !r.email) return false
      if (hasLinkedin && !r.linkedinUrl) return false
      if (c && !r.company.toLowerCase().includes(c)) return false
      if (t && !r.title.toLowerCase().includes(t)) return false
      return true
    })
  }, [rows, hasEmail, hasLinkedin, company, title])

  const withEmail = useMemo(() => rows.filter(r => r.email).length, [rows])
  const withLinkedin = useMemo(() => rows.filter(r => r.linkedinUrl).length, [rows])

  return (
    <>
      {/* Standing trust banner */}
      <div className="preview-banner" style={{ marginBottom: '18px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Relationship context only.</strong> These are your imported connections. An entry does not
          mean the person is looking, qualified, cleared, contactable, or approved for outreach. Contact
          signals are unverified. Review before any action.
        </span>
      </div>

      {/* Search + filters */}
      <div style={{ ...card, padding: '16px', marginBottom: '16px' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search your network by name, title, or company"
          aria-label="Search your network"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 14px',
            fontSize: '15px',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: '9px',
            color: 'var(--text)',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setHasEmail(v => !v)}
            className="btn ghost"
            style={{ fontSize: '12px', padding: '6px 12px', borderColor: hasEmail ? 'var(--accent)' : undefined, color: hasEmail ? 'var(--accent)' : undefined }}
          >
            {hasEmail ? '✓ ' : ''}Has email
          </button>
          <button
            type="button"
            onClick={() => setHasLinkedin(v => !v)}
            className="btn ghost"
            style={{ fontSize: '12px', padding: '6px 12px', borderColor: hasLinkedin ? 'var(--accent)' : undefined, color: hasLinkedin ? 'var(--accent)' : undefined }}
          >
            {hasLinkedin ? '✓ ' : ''}Has LinkedIn URL
          </button>
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="Company contains"
            aria-label="Filter by company"
            style={{ flex: '1 1 160px', minWidth: '140px', padding: '7px 11px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }}
          />
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title contains"
            aria-label="Filter by title"
            style={{ flex: '1 1 160px', minWidth: '140px', padding: '7px 11px', fontSize: '13px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
          <span>Source: LinkedIn connections import</span>
          <span>{withEmail} with email</span>
          <span>{withLinkedin} with LinkedIn URL</span>
          {mode === 'preview' && <span style={{ color: 'var(--amber)' }}>Preview mode — not durable</span>}
        </div>
      </div>

      {/* Result count */}
      {state === 'ok' && (
        <div style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 2px 10px' }}>
          Showing {visible.length} {visible.length === 1 ? 'connection' : 'connections'}
          {visible.length !== rows.length && ` of ${rows.length} loaded`}
          {truncated && (
            <span style={{ color: 'var(--amber)' }}> · first {rows.length} results — refine your search to narrow further</span>
          )}
        </div>
      )}

      {/* States */}
      {state === 'loading' && (
        <div style={{ ...card, padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading your network…</div>
      )}

      {state === 'auth' && (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '14px' }}>Sign in to view your private network.</p>
          <Link className="btn" href="/login">Sign in →</Link>
        </div>
      )}

      {state === 'error' && (
        <div style={{ ...card, padding: '32px', textAlign: 'center' }}>
          <p className="muted" style={{ marginBottom: '14px' }}>{errorMsg}</p>
          <button className="btn ghost" onClick={() => load(debouncedQ)}>Try again</button>
        </div>
      )}

      {state === 'ok' && rows.length === 0 && (
        <div style={{ ...card, padding: '40px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '8px' }}>{debouncedQ ? 'No matches' : 'Your network is empty'}</h3>
          <p className="muted" style={{ marginBottom: '16px', fontSize: '14px' }}>
            {debouncedQ
              ? 'No imported connections match that search.'
              : 'Import your LinkedIn connections export to seed your private network.'}
          </p>
          {!debouncedQ && <Link className="btn" href="/app/network/import">Import LinkedIn connections →</Link>}
        </div>
      )}

      {state === 'ok' && rows.length > 0 && visible.length === 0 && (
        <div style={{ ...card, padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
          No connections match the active filters.
        </div>
      )}

      {/* List */}
      {state === 'ok' && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {visible.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r)}
              style={{
                ...card,
                textAlign: 'left',
                padding: '13px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                alignItems: 'center',
                color: 'var(--text)',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </span>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[r.title, r.company].filter(Boolean).join(' · ') || 'No title or company on this row'}
                </span>
              </span>
              <span style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                {r.email && <SignalChip label="✉ email" />}
                {r.linkedinUrl && <SignalChip label="in" tone="cyan" />}
                <SignalChip label="Pending" tone="amber" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <NetworkDrawer row={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', padding: '5px 0' }}>
      <span style={{ color: 'var(--muted)', minWidth: '110px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{children || <span style={{ color: 'var(--muted)' }}>—</span>}</span>
    </div>
  )
}

function NetworkDrawer({ row, onClose }: { row: NetworkRow; onClose: () => void }) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,16,.6)', zIndex: 60 }}
      />
      <aside
        role="dialog"
        aria-label={`Details for ${row.name}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: 'min(440px, 92vw)',
          background: 'var(--panel)',
          borderLeft: '1px solid var(--line)',
          zIndex: 61,
          overflowY: 'auto',
          padding: '22px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '19px', fontWeight: 700 }}>{row.name}</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '2px' }}>
              {[row.title, row.company].filter(Boolean).join(' · ') || 'No title or company on this row'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn ghost" style={{ padding: '4px 10px', fontSize: '13px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '14px 0 18px' }}>
          <SignalChip label="Relationship context" tone="amber" />
          <SignalChip label="Pending review" tone="amber" />
        </div>

        {/* Source profile */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            Source profile
          </div>
          <DetailRow label="Source">LinkedIn connections import</DetailRow>
          <DetailRow label="LinkedIn URL">
            {row.linkedinUrl
              ? <a href={row.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }}>Open profile ↗</a>
              : ''}
          </DetailRow>
          <DetailRow label="Location">{row.location}</DetailRow>
          <DetailRow label="Connected on">{row.connectedOn}</DetailRow>
        </div>

        {/* Contact signals */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            Contact signals <span style={{ color: 'var(--amber)', textTransform: 'none', letterSpacing: 0 }}>· unverified</span>
          </div>
          {row.email || row.linkedinUrl ? (
            <>
              {row.email && <DetailRow label="Email">{row.email}</DetailRow>}
              {row.linkedinUrl && <DetailRow label="Profile URL">{row.linkedinUrl}</DetailRow>}
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px', lineHeight: 1.5 }}>
                Not verified and not an outreach permission. Confirm through your own process before any contact.
              </p>
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No contact signal on this row.</p>
          )}
        </div>

        {/* Evidence */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '6px' }}>
            Evidence
          </div>
          <div style={{ ...card, padding: '12px', fontSize: '13px', color: 'var(--text)', lineHeight: 1.55 }}>
            <strong style={{ fontWeight: 600 }}>LinkedIn connection export row.</strong>{' '}
            {row.name}{row.title ? ` — ${row.title}` : ''}{row.company ? ` at ${row.company}` : ''}. Connection
            import is relationship context only and does not imply job interest or outreach permission.
          </div>
          {row.importLabel && (
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>Batch: {row.importLabel}</p>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
          No outreach from this view. To work this person, review and confirm them as a candidate in your
          Candidate Database first.
        </div>
      </aside>
    </>
  )
}
