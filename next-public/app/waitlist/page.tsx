import { WaitlistForm } from '@/components/WaitlistForm'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Request Beta Access | SourcingOS',
  description: 'Request private access to the SourcingOS Candidate Search beta.',
}

interface Props {
  searchParams: { beta?: string; from?: string }
}

export default function WaitlistPage({ searchParams }: Props) {
  const isBetaRequired = searchParams.beta === 'required'
  const from = searchParams.from?.startsWith('/') ? searchParams.from : undefined

  return (
    <main className="wrap" style={{ maxWidth: '560px' }}>
      {isBetaRequired ? (
        <>
          {/* ── Beta access required state ──────────────────────── */}
          <div className="preview-banner" style={{ marginBottom: '24px' }}>
            <span className="pb-icon">◈</span>
            <span>
              <strong>Beta access required.</strong>{' '}
              {from && <>The page <strong>{from}</strong> is part of the private SourcingOS beta. </>}
              Sign in if you already have access, or request access below.
            </span>
          </div>

          <div className="eyebrow">Private beta</div>
          <h1>SourcingOS is in private beta.</h1>
          <p className="lead">
            Candidate Search, Candidate Graph, and Candidate 360 are in private beta for senior sourcers
            and recruiting teams. Free tools (BooleanOS, X-Ray, JD Strategy) are open to everyone.
          </p>

          {/* Already have access? */}
          <div className="card" style={{ marginBottom: '28px' }}>
            <span className="kicker">Already have beta access?</span>
            <h3>Sign in with your beta email</h3>
            <p className="muted" style={{ fontSize: '14px', marginBottom: '14px' }}>
              Use the email address you were invited with. We will send a one-click magic link — no password required.
            </p>
            <Link
              className="btn"
              href={from ? `/login?from=${encodeURIComponent(from)}` : '/login'}
            >
              Sign in →
            </Link>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0 24px', color: 'var(--muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            or
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          <span className="kicker">No access yet?</span>
          <h2 style={{ fontSize: '22px', margin: '8px 0 14px' }}>Request beta access</h2>
          <p className="muted" style={{ fontSize: '14px', marginBottom: '20px' }}>
            We open cohorts to senior sourcers and TA teams working hard-to-fill technical, cleared,
            healthcare, and AI roles. We will reach out when your cohort opens.
          </p>
        </>
      ) : (
        <>
          {/* ── Standard waitlist state ─────────────────────────── */}
          <span className="kicker">Private beta</span>
          <h1>Join the SourcingOS beta.</h1>
          <p className="lead">
            Get access to the Candidate Search workbench, Candidate Graph, and Candidate 360.
            Free tools (BooleanOS, X-Ray) are open now — no account required.
          </p>
          <div style={{ marginBottom: '8px' }}>
            <Link href="/login" style={{ fontSize: '14px', color: 'var(--accent)' }}>
              Already have access? Sign in →
            </Link>
          </div>
        </>
      )}

      <WaitlistForm />

      <div className="cta" style={{ marginTop: '24px' }}>
        <strong>Beta promise:</strong> Human-approved sourcing intelligence. No auto-send.
        No auto-merge. No clearance verification claims from public breadcrumbs.
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <Link href="/tools/boolean-generator" className="btn secondary" style={{ fontSize: '13px' }}>
          Try BooleanOS free →
        </Link>
        <Link href="/tools/xray-search" className="btn ghost" style={{ fontSize: '13px' }}>
          Try X-Ray Launcher →
        </Link>
      </div>
    </main>
  )
}
