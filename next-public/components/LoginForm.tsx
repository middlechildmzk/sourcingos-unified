'use client'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import Link from 'next/link'

interface LoginFormProps {
  from?: string
  error?: string
}

function readableLoginError(message: string) {
  if (message === 'Signups not allowed for this instance') {
    return 'Your email is not on the beta access list. Request access below.'
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach Supabase Auth. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then verify Supabase Auth URL Configuration for getsourcingos.com.'
  }
  return message
}

export function resolveLoginCallbackOrigin(currentOrigin: string, currentHostname: string, configuredSiteUrl?: string) {
  const isVercelPreview = /(?:^|\.)vercel\.app$/i.test(currentHostname)
  return isVercelPreview ? currentOrigin : configuredSiteUrl || currentOrigin
}

export function LoginForm({ from, error: initialError }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState(initialError ?? '')

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || status === 'sending') return

    if (!trimmedEmail.includes('@')) {
      setStatus('error')
      setMessage('Use the email address that was invited to the beta. Usernames like dllarson1991 will not work here.')
      return
    }

    if (!configured) {
      setStatus('error')
      setMessage('Supabase is not configured. Running in preview mode — auth is not active.')
      return
    }

    const sb = createBrowserSupabaseClient()
    if (!sb) {
      setStatus('error')
      setMessage('Auth client unavailable. Check Supabase environment variables.')
      return
    }

    setStatus('sending')
    setMessage('')

    // Preview deployments must return to the same preview hostname. Using the
    // production site URL here sends testers back to an older production build.
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
      setMessage(readableLoginError(err instanceof Error ? err.message : 'Failed to fetch'))
    }
  }

  if (status === 'sent') {
    return (
      <div className="interactive-tool">
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉</div>
          <h3 style={{ margin: '0 0 8px' }}>Check your inbox</h3>
          <p className="muted" style={{ fontSize: '15px', margin: '0 0 10px' }}>
            We sent a sign-in link to <strong>{email}</strong>.
            Click it to sign in — it expires in 1 hour.
          </p>
          <p className="muted" style={{ fontSize: '13px', margin: '0 0 16px' }}>
            Use only the <strong>newest email link</strong> — each request generates a new link
            and invalidates older ones.
          </p>
          <p className="muted" style={{ fontSize: '13px' }}>
            No email? Check your spam folder, or{' '}
            <button
              onClick={() => { setStatus('idle'); setMessage('') }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' }}
            >
              request a new link
            </button>.
          </p>
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

      {message && status !== 'idle' && (
        <div className="preview-banner" style={{ marginBottom: '20px', borderColor: status === 'error' ? 'rgba(255,100,100,.35)' : undefined }}>
          <span className="pb-icon">{status === 'error' ? '✕' : '◈'}</span>
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
          disabled={status === 'sending'}
          style={{ marginBottom: '14px' }}
        />
        <button
          className="btn"
          type="submit"
          disabled={!email.trim() || status === 'sending'}
          style={{ width: '100%', opacity: status === 'sending' ? 0.6 : 1 }}
        >
          {status === 'sending' ? 'Sending link…' : 'Send magic link →'}
        </button>
      </form>

      <p className="muted" style={{ fontSize: '13px', marginTop: '18px', textAlign: 'center', lineHeight: '1.6' }}>
        No password required. We send a one-click sign-in link to your invited beta email.
        <br />
        Don&rsquo;t have beta access?{' '}
        <Link href="/waitlist" style={{ color: 'var(--accent)' }}>
          Request access →
        </Link>
      </p>
    </div>
  )
}
