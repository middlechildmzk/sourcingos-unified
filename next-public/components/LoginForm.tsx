'use client'
import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import Link from 'next/link'

interface LoginFormProps {
  from?: string
  error?: string
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
    if (!email.trim() || status === 'sending') return

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

    // Build the callback URL so Supabase knows where to redirect after the link click
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const callbackUrl = new URL('/auth/callback', siteUrl)
    if (from) callbackUrl.searchParams.set('next', from)

    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: false, // invite-only: don't auto-create accounts
      },
    })

    if (error) {
      setStatus('error')
      setMessage(
        error.message === 'Signups not allowed for this instance'
          ? 'Your email is not on the beta access list. Request access below.'
          : error.message
      )
      return
    }

    setStatus('sent')
    setMessage('')
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
          Work email
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
        No password required. We send a one-click sign-in link to your email.
        <br />
        Don&rsquo;t have beta access?{' '}
        <Link href="/waitlist" style={{ color: 'var(--accent)' }}>
          Request access →
        </Link>
      </p>
    </div>
  )
}
