import { JobsReviewClient } from '@/components/JobsReviewClient'
import { getSession } from '@/lib/supabase/session'
import Link from 'next/link'

export const metadata = {
  title: 'Jobs Review Queue | SourcingOS',
  description: 'Admin review queue for SourcingOS Jobs employer submissions.',
  robots: { index: false, follow: false },
}

export default async function JobsAdminPage() {
  const session = await getSession()

  // ── Preview mode ──────────────────────────────────────────────────────────
  if (session.mode === 'preview') {
    return (
      <main className="wrap">
        <div className="preview-banner">
          <span className="pb-icon">◈</span>
          <span>
            <strong>Preview mode:</strong> Auth and persistence are not configured. The review queue below
            is in-memory only and resets between serverless invocations. Configure Supabase to enable
            durable, role-gated admin access.
          </span>
        </div>
        <div className="eyebrow">SourcingOS Jobs — Admin preview</div>
        <h1>Employer submission review queue</h1>
        <p className="lead">
          Review submitted recruiter, sourcer, TA, and recruiting operations roles before they appear
          publicly. Only approved roles use JobPosting schema.
        </p>
        <JobsReviewClient />
      </main>
    )
  }

  // ── Auth configured but not logged in ────────────────────────────────────
  if (!session.authenticated) {
    return (
      <main className="wrap" style={{ maxWidth: '480px', paddingTop: '60px' }}>
        <h1>Access required</h1>
        <p className="lead">Sign in to access the admin review queue.</p>
        <Link className="btn" href="/login?from=/jobs/admin">Sign in →</Link>
      </main>
    )
  }

  // ── Logged in but not admin ───────────────────────────────────────────────
  if (session.user.role !== 'admin') {
    return (
      <main className="wrap" style={{ maxWidth: '480px', paddingTop: '60px' }}>
        <div className="eyebrow">Access denied</div>
        <h1>Admin access required</h1>
        <p className="lead">
          Your account (<strong>{session.user.email}</strong>) does not have admin privileges.
          Contact the SourcingOS team if you need access.
        </p>
        <Link className="btn secondary" href="/app/candidate-search">← Candidate Search</Link>
      </main>
    )
  }

  // ── Admin — full access ───────────────────────────────────────────────────
  return (
    <main className="wrap">
      <div className="eyebrow">SourcingOS Jobs — Admin</div>
      <h1>Employer submission review queue</h1>
      <p className="lead">
        Reviewing as <strong>{session.user.email}</strong> (admin). Approve or reject submitted roles.
        Only approved roles use JobPosting schema and appear in public job listings.
      </p>
      <div className="cta" style={{ marginBottom: '24px' }}>
        <strong>Approval rule:</strong> Every approved job must have a real, live apply URL.
        No fake or placeholder links. Approved jobs write to the <code>approved_jobs</code> table only.
      </div>
      <JobsReviewClient />
    </main>
  )
}
