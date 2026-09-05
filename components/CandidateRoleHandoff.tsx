'use client'

import { useEffect, useState } from 'react'
import { AddToRoleButton } from '@/components/AddToRoleButton'

type State = 'loading' | 'ready' | 'missing' | 'error'

export function CandidateRoleHandoff({ candidateId }: { candidateId: string }) {
  const [state, setState] = useState<State>('loading')
  const [candidate, setCandidate] = useState<any>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/candidate-db/360/${candidateId}`, { headers: { accept: 'application/json' } })
      .then(async response => ({ response, json: await response.json() }))
      .then(({ response, json }) => {
        if (!active) return
        if (!response.ok || !json.ok || !json.dossier?.candidate) {
          setState(response.status === 404 ? 'missing' : 'error')
          return
        }
        setCandidate(json.dossier.candidate)
        setState('ready')
      })
      .catch(() => active && setState('error'))
    return () => { active = false }
  }, [candidateId])

  if (state === 'loading') {
    return <div className="card" style={{ marginBottom: 18, padding: 14, fontSize: 13, color: 'var(--muted)' }}>Loading role handoff…</div>
  }

  if (state !== 'ready' || !candidate) return null

  return (
    <div className="card" style={{ marginBottom: 18, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <div className="kicker">Role-specific workflow</div>
        <div style={{ fontWeight: 650, marginTop: 3 }}>Add this dossier to an active role</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
          Adds an unreviewed role candidate. It does not confirm fit, identity, contact permission, clearance, or availability.
        </div>
      </div>
      <AddToRoleButton candidate={{
        candidateId,
        name: candidate.canonicalName || 'Unconfirmed identity',
        headline: candidate.headline,
        company: candidate.currentCompany,
        location: candidate.location,
        source: 'candidate_360',
        contactStatus: Array.isArray(candidate.contactSignalIds) && candidate.contactSignalIds.length ? 'signals_found' : 'unknown',
        evidenceStatus: Array.isArray(candidate.evidenceItemIds) && candidate.evidenceItemIds.length ? 'reviewed' : 'unreviewed',
        tags: Array.isArray(candidate.skills) ? candidate.skills : [],
      }} />
    </div>
  )
}
