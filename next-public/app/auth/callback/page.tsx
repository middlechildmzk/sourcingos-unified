// ─────────────────────────────────────────────────────────────────────────────
// app/auth/callback/page.tsx — Callback landing page for magic-link auth.
//
// This page REPLACES the previous route.ts (server-side handler).
// The actual code exchange runs client-side in AuthCallbackClient so the
// PKCE verifier stored by the browser client is accessible.
//
// Supabase dashboard required: add /auth/callback to Redirect URLs.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense } from 'react'
import { AuthCallbackClient } from '@/components/AuthCallbackClient'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Signing in… | SourcingOS',
  robots: { index: false, follow: false },
}

export default function AuthCallbackPage() {
  return (
    // Suspense is required because AuthCallbackClient uses useSearchParams()
    <Suspense
      fallback={
        <main
          className="wrap"
          style={{ maxWidth: '480px', paddingTop: '96px', textAlign: 'center' }}
        >
          <p className="muted" style={{ fontSize: '15px' }}>Signing in…</p>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  )
}
