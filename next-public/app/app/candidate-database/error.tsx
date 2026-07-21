'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function CandidateDatabaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CandidateDatabase] route error', error)
  }, [error])

  return (
    <main className="wrap" style={{ maxWidth: 560, paddingTop: 64 }}>
      <div className="eyebrow">Candidates</div>
      <h1 style={{ margin: '0 0 8px' }}>We could not load this view</h1>
      <p className="muted" style={{ fontSize: 15, marginBottom: 20 }}>
        Retry the page. If the problem continues, return to Candidates or Roles and try again later.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={reset}>Retry</button>
        <Link className="btn secondary" href="/app/candidate-database">Back to Candidates</Link>
        <Link className="btn ghost" href="/app/roles">Back to Roles</Link>
      </div>
      {error.digest && (
        <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
          Error reference: {error.digest}
        </p>
      )}
    </main>
  )
}
