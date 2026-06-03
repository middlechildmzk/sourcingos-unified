'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  buildEnrichmentRequest,
  enrichmentInputHint,
  type ContactSignal,
  type EnrichmentSource,
} from '@/lib/contact-enrichment'

// ─────────────────────────────────────────────────────────────────────────────
// FindContactButton — user-triggered contact enrichment.
//
// Calls POST /api/contact-enrichment/find (server-side PDL). The browser never
// sees the API key or raw provider payload. Every signal is shown as unverified.
//
// Response handling:
//   401 auth_required        → "Sign in to find contact info."
//   503 provider_not_configured → "Contact enrichment provider not configured yet."
//   200 + signals            → render signals (unverified, permission unknown)
//   200 + empty              → "No contact signal found yet."
// ─────────────────────────────────────────────────────────────────────────────

interface FindContactButtonProps {
  source: EnrichmentSource
  /** When false, prompts sign-in without calling the API. */
  isAuthenticated?: boolean
  compact?: boolean
}

type Phase = 'idle' | 'loading' | 'done' | 'error'

const SIGNAL_LABEL: Record<string, string> = {
  email: 'Email', phone: 'Phone', profile_url: 'Profile',
  social_url: 'Social', company_domain: 'Company domain', unknown: 'Signal',
}

export function FindContactButton({ source, isAuthenticated = true, compact }: FindContactButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'warn' | 'auth' } | null>(null)
  const [signals, setSignals] = useState<ContactSignal[]>([])

  async function handleClick() {
    // 1. Auth gate (client-side fast path — server also enforces)
    if (!isAuthenticated) {
      setMessage({ text: 'Sign in to find contact info and build your Candidate Graph.', tone: 'auth' })
      return
    }

    // 2. Input sufficiency
    const request = buildEnrichmentRequest(source)
    const hint = enrichmentInputHint(request)
    if (hint) {
      setMessage({ text: hint, tone: 'warn' })
      return
    }

    // 3. Call live API
    setPhase('loading'); setMessage(null); setSignals([])
    try {
      const res = await fetch('/api/contact-enrichment/find', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (res.status === 401) {
        setPhase('idle')
        setMessage({ text: 'Sign in to find contact info.', tone: 'auth' })
        return
      }
      if (res.status === 503) {
        setPhase('idle')
        setMessage({ text: 'Contact enrichment provider not configured yet.', tone: 'info' })
        return
      }

      const json = await res.json()
      if (json.ok) {
        setSignals(json.signals || [])
        setPhase('done')
        if (!json.signals || json.signals.length === 0) {
          setMessage({ text: json.message || 'No contact signal found yet.', tone: 'info' })
        }
      } else {
        setPhase('error')
        setMessage({ text: json.error || 'Enrichment failed.', tone: 'warn' })
      }
    } catch {
      setPhase('error')
      setMessage({ text: 'Could not reach the enrichment service.', tone: 'warn' })
    }
  }

  return (
    <div className="find-contact">
      <button
        type="button"
        className="btn ghost find-contact-btn"
        onClick={handleClick}
        disabled={phase === 'loading'}
        style={compact ? { fontSize: '11px', padding: '4px 10px' } : { fontSize: '12px', padding: '5px 12px' }}
        title="Find contact info via configured provider"
      >
        {phase === 'loading' ? '⟳ Finding…' : '✉ Find contact'}
      </button>

      {/* Returned signals */}
      {phase === 'done' && signals.length > 0 && (
        <div className="enrich-results">
          <div className="enrich-warning">
            ⚠ Contact signals are unverified and do not imply permission to contact.
          </div>
          {signals.map((s, i) => (
            <div key={i} className="enrich-signal">
              <div className="enrich-signal-head">
                <span className="enrich-signal-type">{SIGNAL_LABEL[s.type] || s.type}</span>
                <span className="enrich-signal-value">{s.value}</span>
              </div>
              <div className="enrich-signal-meta">
                <span className="enrich-badge enrich-badge-unverified">Unverified</span>
                <span className="enrich-badge">Permission unknown</span>
                <span className="enrich-badge">People Data Labs</span>
                {s.discoveredAt && (
                  <span className="enrich-badge-date">
                    {new Date(s.discoveredAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status / gating messages */}
      {message && (
        <div className={`find-contact-msg find-contact-${message.tone}`}>
          {message.tone === 'auth' ? (
            <span>{message.text} <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in →</Link></span>
          ) : (
            <span>{message.text}</span>
          )}
        </div>
      )}
    </div>
  )
}
