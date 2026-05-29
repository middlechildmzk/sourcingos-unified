import { LoginForm } from '@/components/LoginForm'
import { getSession } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in to SourcingOS',
  description: 'Sign in to the SourcingOS private beta.',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: { from?: string; error?: string; beta?: string }
}

export default async function LoginPage({ searchParams }: Props) {
  // Already authenticated? Redirect to the app
  const session = await getSession()
  if (session.authenticated) {
    const destination = searchParams.from?.startsWith('/') ? searchParams.from : '/app/candidate-search'
    redirect(destination)
  }

  const from = searchParams.from?.startsWith('/') ? searchParams.from : undefined

  return (
    <main className="wrap" style={{ maxWidth: '480px', paddingTop: '80px' }}>
      <div className="eyebrow">Private beta</div>
      <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '8px' }}>
        Sign in to SourcingOS
      </h1>
      <p className="lead" style={{ fontSize: '16px', marginBottom: '28px' }}>
        Enter your beta-access email and we&rsquo;ll send a sign-in link.
        No password required.
      </p>

      {from && (
        <div className="preview-banner" style={{ marginBottom: '20px' }}>
          <span className="pb-icon">◈</span>
          <span>Sign in to access <strong>{from}</strong></span>
        </div>
      )}

      <LoginForm from={from} error={searchParams.error} />

      <div className="cta" style={{ marginTop: '28px', fontSize: '14px' }}>
        <strong>Beta access:</strong> SourcingOS is invite-only. If you do not
        have access yet, <Link href="/waitlist?beta=required" style={{ color: 'var(--accent)' }}>request access</Link> and
        we will reach out when your cohort opens.
      </div>

      <p style={{ textAlign: 'center', marginTop: '24px' }}>
        <Link href="/" className="muted" style={{ fontSize: '13px', textDecoration: 'underline' }}>
          ← Back to SourcingOS.io
        </Link>
      </p>
    </main>
  )
}
