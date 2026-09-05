// ─────────────────────────────────────────────────────────────────────────────
// components/AuthCallbackClient.tsx — Client-side PKCE code exchange.
//
// WHY CLIENT-SIDE:
//   @supabase/ssr's createBrowserClient() stores the PKCE code verifier in a
//   browser cookie. When the user clicks the magic link and lands here, the
//   verifier must be read from that same browser context. A server-side route
//   handler cannot reliably complete this browser-owned exchange.
//
// FLOW:
//   1. Read ?code and ?next from the URL
//   2. Call supabase.auth.exchangeCodeForSession(code) in the browser
//   3. Navigate to ?next, or Today by default, with a full page request
//   4. On failure, return to login with a bounded error message
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
      const next = searchParams.get('next') ?? '/app/today'
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (errorParam) {
        const msg = errorDescription ?? errorParam
        setPhase('error')
        setMessage(msg)
        window.location.href = `/login?error=${encodeURIComponent(msg)}`
        return
      }

      if (!code) {
        const msg = 'Missing auth code. Please request a new sign-in link.'
        setPhase('error')
        setMessage(msg)
        window.location.href = `/login?error=${encodeURIComponent(msg)}`
        return
      }

      const sb = createBrowserSupabaseClient()
      if (!sb) {
        setPhase('redirecting')
        window.location.href = safeRelativePath(next)
        return
      }

      const { error } = await sb.auth.exchangeCodeForSession(code)

      if (error) {
        const msg = error.message
        setPhase('error')
        setMessage(msg)
        window.location.href = `/login?error=${encodeURIComponent(msg)}`
        return
      }

      setPhase('redirecting')
      setMessage('Signed in. Redirecting…')
      window.location.href = safeRelativePath(next)
    }

    void exchange()
  }, [searchParams])

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
