'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  buildEnrichmentRequest,
  enrichmentInputHint,
  getActiveProviderStatus,
  type EnrichmentSource,
} from '@/lib/contact-enrichment'

// ─────────────────────────────────────────────────────────────────────────────
// FindContactButton — future-ready, gated contact enrichment affordance.
//
// FOUNDATION ONLY (Sprint 2.7 prep). No live provider call. The provider stub
// returns providerConfigured: false, so this always shows the not-configured
// message. Sprint 2.8 will POST to /api/contact-enrichment/find.
//
// Gating order:
//   1. Logged out          → "Sign in to find contact info."
//   2. Insufficient inputs → "Add name/company/domain/profile URL…"
//   3. Provider not set     → "Contact enrichment provider not configured yet."
// ─────────────────────────────────────────────────────────────────────────────

interface FindContactButtonProps {
  source: EnrichmentSource
  /** When false, clicking prompts sign-in. Defaults true (page is auth-gated today). */
  isAuthenticated?: boolean
  compact?: boolean
}

export function FindContactButton({ source, isAuthenticated = true, compact }: FindContactButtonProps) {
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'warn' | 'auth' } | null>(null)

  function handleClick() {
    // 1. Auth gate
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

    // 3. Provider status (stub → not configured)
    const status = getActiveProviderStatus()
    if (!status.providerConfigured) {
      setMessage({ text: status.message, tone: 'info' })
      return
    }

    // (Sprint 2.8) — POST to /api/contact-enrichment/find would go here.
    setMessage({ text: 'Contact enrichment will be available in a future release.', tone: 'info' })
  }

  return (
    <div className="find-contact">
      <button
        type="button"
        className="btn ghost find-contact-btn"
        onClick={handleClick}
        style={compact ? { fontSize: '11px', padding: '4px 10px' } : { fontSize: '12px', padding: '5px 12px' }}
        title="Find contact info (enrichment provider not connected yet)"
      >
        ✉ Find contact
      </button>

      {message && (
        <div className={`find-contact-msg find-contact-${message.tone}`}>
          {message.tone === 'auth' ? (
            <span>
              {message.text} <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in →</Link>
            </span>
          ) : (
            <span>{message.text}</span>
          )}
        </div>
      )}
    </div>
  )
}
