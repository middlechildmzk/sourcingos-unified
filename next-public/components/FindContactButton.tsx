'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  buildEnrichmentRequest,
  enrichmentInputHint,
  type EnrichmentSource,
} from '@/lib/contact-enrichment'

type ContactSignal = {
  type: string
  channelKind?: string
  value: string
  sourceProvider: string
  confidence: 'low' | 'medium' | 'high'
  permissionStatus: string
  ownershipConfidence?: string
  deliverability?: string
  discoveredAt?: string
}

type ContactAttempt = {
  provider: string
  purpose: string
  configured?: boolean
  resultCount: number
  latencyMs?: number
  estimatedCredits?: number
  warnings?: string[]
}

interface FindContactButtonProps {
  source: EnrichmentSource
  isAuthenticated?: boolean
  compact?: boolean
}

type Phase = 'idle' | 'loading' | 'done' | 'error'

const CHANNEL_LABEL: Record<string, string> = {
  work_email: 'Work email',
  personal_email: 'Personal email',
  other_email: 'Email',
  mobile_phone: 'Mobile phone',
  work_phone: 'Work phone',
  home_phone: 'Home phone',
  other_phone: 'Phone',
  professional_profile: 'Professional profile',
  social_profile: 'Social profile',
  company_domain: 'Company domain',
  unknown: 'Contact signal',
}

function providerLabel(value: string) {
  return String(value || 'provider').split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function signalLabel(signal: ContactSignal) {
  if (signal.channelKind && CHANNEL_LABEL[signal.channelKind]) return CHANNEL_LABEL[signal.channelKind]
  if (signal.type === 'email') return 'Email'
  if (signal.type === 'phone') return 'Phone'
  if (signal.type === 'profile_url' || signal.type === 'social_url') return 'Profile'
  return 'Signal'
}

export function FindContactButton({ source, isAuthenticated = true, compact }: FindContactButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'warn' | 'auth' } | null>(null)
  const [signals, setSignals] = useState<ContactSignal[]>([])
  const [attempts, setAttempts] = useState<ContactAttempt[]>([])
  const [missingGoals, setMissingGoals] = useState<string[]>([])
  const [cacheSignals, setCacheSignals] = useState(0)

  async function handleClick() {
    if (!isAuthenticated) {
      setMessage({ text: 'Sign in to find contact info and build your Candidate Graph.', tone: 'auth' })
      return
    }

    const request = buildEnrichmentRequest(source)
    const hint = enrichmentInputHint(request)
    if (hint) {
      setMessage({ text: hint, tone: 'warn' })
      return
    }

    setPhase('loading')
    setMessage(null)
    setSignals([])
    setAttempts([])
    setMissingGoals([])
    try {
      const res = await fetch('/api/contact-enrichment/find', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...request,
          purpose: 'contact_bundle',
          goals: ['work_email', 'personal_email', 'phone'],
        }),
      })

      if (res.status === 401) {
        setPhase('idle')
        setMessage({ text: 'Sign in to find contact info.', tone: 'auth' })
        return
      }
      if (res.status === 503) {
        const json = await res.json().catch(() => ({}))
        setPhase('idle')
        setMessage({ text: json.error || 'No eligible contact provider is configured for this person.', tone: 'info' })
        return
      }

      const json = await res.json()
      if (!res.ok || !json.ok) {
        setPhase('error')
        setMessage({ text: json.error || 'Contact resolution failed.', tone: 'warn' })
        return
      }

      setSignals(json.signals || [])
      setAttempts(json.orchestration?.attempts || [])
      setMissingGoals(json.orchestration?.missingGoals || [])
      setCacheSignals(json.orchestration?.cacheSignalsConsidered || 0)
      setPhase('done')

      if (!json.signals?.length) {
        setMessage({
          text: json.orchestration?.attempts?.length
            ? `No requested contact channels returned after ${json.orchestration.attempts.length} eligible provider attempt${json.orchestration.attempts.length === 1 ? '' : 's'}.`
            : json.message || 'No contact signal found.',
          tone: 'info',
        })
      }
    } catch {
      setPhase('error')
      setMessage({ text: 'Could not reach the contact-resolution service.', tone: 'warn' })
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
        title="Search configured professional contact providers for missing requested channels"
      >
        {phase === 'loading' ? '⟳ Resolving contact…' : 'Find contact info'}
      </button>

      {phase === 'done' && signals.length > 0 && (
        <div className="enrich-results">
          <div className="enrich-warning">
            Contact ownership, technical validity, and permission to contact are separate. No outreach is sent automatically.
          </div>
          {signals.map((signal, index) => (
            <div key={`${signal.sourceProvider}:${signal.type}:${signal.value}:${index}`} className="enrich-signal">
              <div className="enrich-signal-head">
                <span className="enrich-signal-type">{signalLabel(signal)}</span>
                <span className="enrich-signal-value">{signal.value}</span>
              </div>
              <div className="enrich-signal-meta">
                <span className="enrich-badge">{providerLabel(signal.sourceProvider)}</span>
                <span className="enrich-badge">{signal.confidence} confidence</span>
                {signal.ownershipConfidence && <span className="enrich-badge">ownership {signal.ownershipConfidence}</span>}
                {signal.deliverability && <span className="enrich-badge">deliverability {signal.deliverability}</span>}
                <span className="enrich-badge">permission {signal.permissionStatus || 'unknown'}</span>
                {signal.discoveredAt && <span className="enrich-badge-date">{new Date(signal.discoveredAt).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}

          <details className="advanced-disclosure" style={{ marginTop: 10 }}>
            <summary>Contact resolution details · {attempts.length} provider attempt{attempts.length === 1 ? '' : 's'}</summary>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {cacheSignals > 0 && <small>Candidate Graph cache checked first: {cacheSignals} stored signal{cacheSignals === 1 ? '' : 's'}.</small>}
              {attempts.map((attempt, index) => <small key={`${attempt.provider}:${attempt.purpose}:${index}`}>
                {providerLabel(attempt.provider)} · {attempt.purpose.replaceAll('_', ' ')} · {attempt.resultCount} returned{attempt.latencyMs !== undefined ? ` · ${attempt.latencyMs}ms` : ''}{attempt.estimatedCredits !== undefined ? ` · est. ${attempt.estimatedCredits} credit${attempt.estimatedCredits === 1 ? '' : 's'}` : ''}
              </small>)}
              {!!missingGoals.length && <small><b>Still missing:</b> {missingGoals.map(goal => CHANNEL_LABEL[goal] || goal.replaceAll('_', ' ')).join(', ')}.</small>}
            </div>
          </details>
        </div>
      )}

      {message && (
        <div className={`find-contact-msg find-contact-${message.tone}`}>
          {message.tone === 'auth'
            ? <span>{message.text} <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in →</Link></span>
            : <span>{message.text}</span>}
        </div>
      )}
    </div>
  )
}
