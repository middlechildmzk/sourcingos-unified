'use client'

import { useEffect, useState } from 'react'
import { RoleCandidateEvidenceMatrix } from '@/components/RoleCandidateEvidenceMatrix'
import type { EvidenceClaim } from '@/lib/evidence-ledger'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

export function RoleCandidateEvidenceAnalysisClient({ roleId, candidateId }: { roleId: string; candidateId: string }) {
  const { roles, mode } = useRoleWorkspaces()
  const [claims, setClaims] = useState<EvidenceClaim[] | null>(null)
  const [status, setStatus] = useState('')
  const role = roles.find(item => item.id === roleId)
  const candidate = role?.candidates.find(item => item.candidateId === candidateId || item.id === candidateId)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch(`/api/candidate-db/evidence-ledger?candidateId=${encodeURIComponent(candidateId)}`, { headers: { accept: 'application/json' } })
        const json = await response.json()
        if (!response.ok || !json.ok) throw new Error(json.error || 'Candidate Evidence Ledger unavailable.')
        if (!cancelled) setClaims(Array.isArray(json.claims) ? json.claims as EvidenceClaim[] : [])
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : 'Candidate Evidence Ledger unavailable.')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [candidateId])

  if (mode === 'checking' || (!claims && !status)) {
    return <section className="product-panel"><p className="muted">Loading role evidence analysis…</p></section>
  }
  if (!role || !candidate) return null
  if (!claims) {
    return <section className="product-panel"><span className="kicker">Role evidence analysis</span><h2>Evidence matrix unavailable</h2><p className="muted">{status}</p></section>
  }

  return <RoleCandidateEvidenceMatrix role={role} candidate={candidate} claims={claims} />
}
