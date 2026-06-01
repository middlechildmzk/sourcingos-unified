// ─────────────────────────────────────────────────────────────────────────────
// components/AuthCallbackClient.tsx — Client-side PKCE code exchange.
//
// WHY CLIENT-SIDE:
//   @supabase/ssr's createBrowserClient() stores the PKCE code verifier in a
//   browser cookie. When the user clicks the magic link and lands here, the
//   verifier must be read from that same browser context. A server-side route
//   handler (GET route.ts) cannot write response cookies in Next.js 14's
//   cookie() API, so exchangeCodeForSession() fails with:
//   "PKCE code verifier not found in storage."
//
//   Running the exchange in the browser guarantees the verifier is accessible.
//
// FLOW:
//   1. Read ?code and ?next from the URL (client-side, after render)
//   2. Call supabase.auth.exchangeCodeForSession(code) in the browser
//   3. On success → full page navigation to ?next (or /app/candidate-search)
//      (window.location.href forces a fresh request so middleware sees the new cookie)
//   4. On failure → full page navigation to /login?error=...
// ─────────────────────────────────────────────────────────────────────────────
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser'
import { safeRelativePath } from '@/lib/safe-redirect'

export function AuthCallbackClient() {
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<'loading' | 'redirecting' | 'error'>('loading')
  const [message, setMessage] = useState('Completing sign-in…')

  useEffect(() => {
    async function exchange() {
      const code = searchParams.get('code')
      const next = searchParams.get('next') ?? '/app/candidate-search'
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // ── Supabase surfaced an error in the redirect URL ─────────────────────
      if (errorParam) {
        const msg = errorDescription ?? errorParam
        setPhase('error')
        setMessage(msg)
        window.location.href = `/login?error=${encodeURIComponent(msg)}`
        return
      }

      // ── No code in URL ─────────────────────────────────────────────────────
      if (!code) {
        const msg = 'Missing auth code. Please request a new sign-in link.'
        setPhase('error')
        setMessage(msg)
        window.location.href = `/login?error=${encodeURIComponent(msg)}`
        return
      }

      // ── Supabase not configured (preview mode) ─────────────────────────────
      const sb = createBrowserSupabaseClient()
      if (!sb) {
        // No Supabase — skip exchange, go straight to app in preview mode
        setPhase('redirecting')
        window.location.href = safeRelativePath(next)
        return
      }

      // ── Exchange code for session in browser context ───────────────────────
      // The PKCE verifier is in the browser's cookie storage from when
      // signInWithOtp() was called. This MUST run client-side.
      const { error } = await sb.auth.exchangeCodeForSession(code)

      if (error) {
        const msg = error.message
        setPhase('error')
        setMessage(msg)
        window.location.href = `/login?error=${encodeURIComponent(msg)}`
        return
      }

      // ── Success: full navigation so middleware reads the new session cookie ─
      setPhase('redirecting')
      setMessage('Signed in. Redirecting…')
      window.location.href = safeRelativePath(next)
    }

    exchange()
  }, []) // intentionally empty — runs once on mount, URL is stable

  return (
    <main
      className="wrap"
      style={{ maxWidth: '480px', paddingTop: '96px', textAlign: 'center' }}
    >
      {phase === 'error' ? (
        <>
          <div style={{ fontSize: '28px', marginBottom: '14px' }}>✕</div>
          <h2 style={{ margin: '0 0 8px' }}>Sign-in failed</h2>
          <p className="muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
            {message}
          </p>
          <a className="btn" href="/login">Try again →</a>
        </>
      ) : (
        <>
          {/* Minimal animated spinner via CSS */}
          <div
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: '3px solid rgba(72,217,255,.2)',
              borderTopColor: 'var(--accent, #48d9ff)',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>
            {phase === 'redirecting' ? 'Signed in' : 'Signing in…'}
          </h2>
          <p className="muted" style={{ fontSize: '14px' }}>{message}</p>
        </>
      )}
    </main>
  )
}
