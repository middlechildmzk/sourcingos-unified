'use client'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import Link from 'next/link'

interface LoginFormProps {
  from?: string
  error?: string
}

type LoginMode = 'password' | 'magic'
type LoginStatus = 'idle' | 'working' | 'sent' | 'error'

function readableLoginError(message: string) {
  if (message === 'Signups not allowed for this instance') {
    return 'Your email is not on the beta access list. Request access below.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Email or password is incorrect.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'This beta email has not been confirmed yet.'
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach SourcingOS Auth. Please try again.'
  }
  return message
}

export function resolveLoginCallbackOrigin(currentOrigin: string, currentHostname: string, configuredSiteUrl?: string) {
  const isVercelPreview = /(?:^|\.)vercel\.app$/i.test(currentHostname)
  return isVercelPreview ? currentOrigin : configuredSiteUrl || currentOrigin
}

export function LoginForm({ from, error: initialError }: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<LoginStatus>(initialError ? 'error' : 'idle')
  const [message, setMessage] = useState(initialError ?? '')

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  function validateEmail() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail.includes('@')) {
      setStatus('error')
      setMessage('Use the email address that was invited to the beta.')
      return null
    }
    return trimmedEmail
  }

  function getClient() {
    if (!configured) {
      setStatus('error')
      setMessage('Supabase is not configured. Running in preview mode — auth is not active.')
      return null
    }
    const sb = createBrowserSupabaseClient()
    if (!sb) {
      setStatus('error')
      setMessage('Auth client unavailable. Please try again.')
      return null
    }
    return sb
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'working') return
    const trimmedEmail = validateEmail()
    if (!trimmedEmail || !password) return
    const sb = getClient()
    if (!sb) return

    setStatus('working')
    setMessage('')

    try {
      const { error } = await sb.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        setStatus('error')
        setMessage(readableLoginError(error.message))
        return
      }

      window.location.assign(from || '/app/roles')
    } catch (err) {
      setStatus('error')
      setMessage(readableLoginError(err instanceof Error ? err.message : 'Failed to sign in'))
    }
  }

  async function handleMagicSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'working') return
    const trimmedEmail = validateEmail()
    if (!trimmedEmail) return
    const sb = getClient()
    if (!sb) return

    setStatus('working')
    setMessage('')

    const callbackOrigin = resolveLoginCallbackOrigin(
      window.location.origin,
      window.location.hostname,
      process.env.NEXT_PUBLIC_SITE_URL
    )
    const callbackUrl = new URL('/auth/callback', callbackOrigin)
    if (from) callbackUrl.searchParams.set('next', from)

    try {
      const { error } = await sb.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: callbackUrl.toString(),
          shouldCreateUser: false,
        },
      })

      if (error) {
        setStatus('error')
        setMessage(readableLoginError(error.message))
        return
      }

      setStatus('sent')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setMessage(readableLoginError(err instanceof Error ? err.message : 'Failed to send sign-in link'))
    }
  }

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode)
    setStatus('idle')
    setMessage('')
  }

  if (mode === 'magic' && status === 'sent') {
    return (
      <div className="interactive-tool">
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉</div>
          <h3 style={{ margin: '0 0 8px' }}>Check your inbox</h3>
          <p className="muted" style={{ fontSize: '15px', margin: '0 0 10px' }}>
            We sent a backup sign-in link to <strong>{email}</strong>.
          </p>
          <button
            type="button"
            onClick={() => switchMode('password')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}
          >
            Use password instead
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="interactive-tool">
      {!configured && (
        <div className="preview-banner" style={{ marginBottom: '20px' }}>
          <span className="pb-icon">◈</span>
          <span>
            <strong>Preview mode:</strong> Supabase is not configured. Auth is inactive.{' '}
            <Link href="/app/candidate-search" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>
              Enter app in preview mode →
            </Link>
          </span>
        </div>
      )}

      {message && status === 'error' && (
        <div className="preview-banner" style={{ marginBottom: '20px', borderColor: 'rgba(255,100,100,.35)' }}>
          <span className="pb-icon">✕</span>
          <span>{message}</span>
        </div>
      )}

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Beta email
          </label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={status === 'working'}
            style={{ marginBottom: '14px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your SourcingOS password"
            autoComplete="current-password"
            disabled={status === 'working'}
            style={{ marginBottom: '14px' }}
          />

          <button
            className="btn"
            type="submit"
            disabled={!email.trim() || !password || status === 'working'}
            style={{ width: '100%', opacity: status === 'working' ? 0.6 : 1 }}
          >
            {status === 'working' ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMagicSubmit}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Beta email
          </label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            disabled={status === 'working'}
            style={{ marginBottom: '14px' }}
          />
          <button
            className="btn"
            type="submit"
            disabled={!email.trim() || status === 'working'}
            style={{ width: '100%', opacity: status === 'working' ? 0.6 : 1 }}
          >
            {status === 'working' ? 'Sending link…' : 'Email a sign-in link →'}
          </button>
        </form>
      )}

      <p className="muted" style={{ fontSize: '13px', marginTop: '18px', textAlign: 'center', lineHeight: '1.6' }}>
        {mode === 'password' ? (
          <>
            Prefer passwordless?{' '}
            <button
              type="button"
              onClick={() => switchMode('magic')}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}
            >
              Use a sign-in link instead
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => switchMode('password')}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}
          >
            Use password instead
          </button>
        )}
        <br />
        Don&rsquo;t have beta access?{' '}
        <Link href="/waitlist" style={{ color: 'var(--accent)' }}>
          Request access →
        </Link>
      </p>
    </div>
  )
}
