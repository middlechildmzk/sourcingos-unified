import { getSession } from '@/lib/supabase/session'
import { LogoutButton } from '@/components/LogoutButton'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  return (
    <>
      {/* ── In-app session bar ──────────────────────────────────── */}
      <div className="app-session-bar">
        <div className="app-session-inner">
          <div className="app-session-links">
            <Link href="/app/candidate-search" className="app-session-link">
              Candidate Search
            </Link>
            <Link href="/app/candidate-database" className="app-session-link">
              Candidate Database
            </Link>
            <Link href="/app/evidence-ledger" className="app-session-link">
              Evidence Ledger
            </Link>
            <Link href="/app/network" className="app-session-link">
              Network
            </Link>
            <Link href="/sources" className="app-session-link">
              Source Search
            </Link>
          </div>

          <div className="app-session-user">
            {session.mode === 'preview' && (
              <span className="status-preview" style={{ marginRight: '10px' }}>
                Preview mode
              </span>
            )}
            {session.authenticated && session.user && (
              <>
                {session.user.role === 'admin' && (
                  <Link href="/jobs/admin" className="status-live" style={{ marginRight: '8px', textDecoration: 'none' }}>
                    Admin
                  </Link>
                )}
                <span
                  title={session.user.email}
                  style={{
                    fontSize: '12px',
                    color: 'var(--muted)',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                    marginRight: '10px',
                  }}
                >
                  {session.user.email}
                </span>
                <LogoutButton compact />
              </>
            )}
            {!session.authenticated && session.mode === 'supabase' && (
              <Link href="/login" className="btn" style={{ fontSize: '12px', padding: '6px 14px' }}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Compliance reminder (only once, in the shell) ────────── */}
      {session.mode === 'preview' && (
        <div style={{ background: 'rgba(246,201,107,.04)', borderBottom: '1px solid rgba(246,201,107,.18)', padding: '10px 7vw', fontSize: '12px', color: '#c8a84b', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>◈</span>
          <span>
            <strong>Preview mode:</strong> Auth and persistence are inactive. Data resets on cold start.
            Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable durability.
          </span>
        </div>
      )}

      {children}
    </>
  )
}
