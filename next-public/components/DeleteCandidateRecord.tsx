'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { purgeCandidateFromLocalRoleWorkspaces } from '@/lib/candidate-local-purge'

export function DeleteCandidateRecord({ candidateId, roleId }: { candidateId: string; roleId?: string }) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')

  async function removeCandidate() {
    const confirmed = window.confirm(
      'Permanently delete this candidate and known linked source, evidence, role, acquisition, and graph records? This cannot be undone.'
    )
    if (!confirmed) return

    setWorking(true)
    setStatus('Deleting candidate data…')
    try {
      const response = await fetch(`/api/candidate-db/delete/${encodeURIComponent(candidateId)}`, {
        method: 'DELETE',
        headers: { accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload?.error || 'Candidate deletion failed.')

      purgeCandidateFromLocalRoleWorkspaces(candidateId)
      setStatus('Candidate deleted.')
      router.replace(roleId ? `/app/roles/${encodeURIComponent(roleId)}?tab=candidates` : '/app/candidate-database')
      router.refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Candidate deletion failed.')
      setWorking(false)
    }
  }

  return (
    <section className="product-panel" style={{ marginTop: 14 }}>
      <div className="product-panel-head">
        <div>
          <span className="kicker">Data controls</span>
          <h2>Delete candidate record</h2>
        </div>
      </div>
      <p className="muted">
        Permanently removes the canonical candidate and known linked evidence, source profiles, role state, acquisition records, graph edges, and candidate-derived calibration from SourcingOS. This action is irreversible.
      </p>
      <div className="button-row">
        <button className="btn ghost" type="button" disabled={working} onClick={() => void removeCandidate()}>
          {working ? 'Deleting…' : 'Permanently delete candidate'}
        </button>
      </div>
      {status ? <p role="status" className="muted" style={{ marginTop: 8 }}>{status}</p> : null}
    </section>
  )
}
