import { LoginForm } from '@/components/LoginForm'
import { getSession } from '@/lib/supabase/session'
import { safeRelativePath } from '@/lib/safe-redirect'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in to SourcingOS',
  description: 'Sign in to the SourcingOS private beta.',
  robots: { index: false, follow: false },
}

interface Props {
  // Next.js 15+: searchParams is a Promise and must be awaited.
  searchParams: Promise<{ from?: string; error?: string; beta?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams

  // Already authenticated? Redirect to the app
  const session = await getSession()
  if (session.authenticated) {
    const destination = safeRelativePath(sp.from)
    redirect(destination)
  }

  // Sanitise the from param before displaying it in UI or passing to LoginForm
  const from = safeRelativePath(sp.from, '') || undefined

  return (
    <main className="wrap" style={{ maxWidth: '480px', paddingTop: '80px' }}>
      <div className="eyebrow">Private beta</div>
      <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: '8px' }}>
        Sign in to SourcingOS
      </h1>
      <p className="lead" style={{ fontSize: '16px', marginBottom: '28px' }}>
        Sign in with the email and password attached to your approved beta account.
        A sign-in link remains available as a backup.
      </p>

      {from && (
        <div className="preview-banner" style={{ marginBottom: '20px' }}>
          <span className="pb-icon">◈</span>
          <span>Sign in to access <strong>{from}</strong></span>
        </div>
      )}

      <LoginForm from={from} error={sp.error} />

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
