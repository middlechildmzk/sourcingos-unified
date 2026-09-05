'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import type { RoleCandidateIntelligenceV35 } from '@/lib/entity-intelligence/role-candidate-intelligence-v35'

type CandidateExplanation = {
  candidateId: string
  canonicalName: string
  headline: string
  state: 'conflicting' | 'needs_verification' | 'insufficient_evidence' | 'evidence_ready' | 'no_requirements'
  claimCount: number
  matchExplanation: RoleCandidateIntelligenceV35
}

type ResponseShape = {
  ok?: boolean
  error?: string
  candidates?: CandidateExplanation[]
}

function stateLabel(state: CandidateExplanation['state']): string {
  if (state === 'evidence_ready') return 'Evidence ready'
  if (state === 'needs_verification') return 'Needs verification'
  if (state === 'insufficient_evidence') return 'Missing evidence'
  if (state === 'conflicting') return 'Conflicting evidence'
  return 'No explicit requirements'
}

function geographyLabel(state: RoleCandidateIntelligenceV35['geography']['state']): string {
  if (state === 'outside_approved_search_area') return 'Outside approved search area'
  if (state === 'not_constrained') return 'Not constrained'
  if (state === 'compatible') return 'Location compatible'
  return 'Location unknown'
}

export function RoleCandidateIntelligenceV35({ roleId }: { roleId: string }) {
  const { roles, mode } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const [response, setResponse] = useState<ResponseShape>({ candidates: [] })
  const [loading, setLoading] = useState(false)

  const candidateKey = useMemo(
    () => role?.candidates.map(candidate => `${candidate.candidateId || ''}:${candidate.updatedAt}`).sort().join('|') || '',
    [role?.candidates],
  )
  const intelligenceKey = useMemo(() => JSON.stringify(role?.searchIntelligence || null), [role?.searchIntelligence])
  const intakeKey = useMemo(() => role ? JSON.stringify({
    mustHaves: role.intake.mustHaves,
    niceToHaves: role.intake.niceToHaves,
    disqualifiers: role.intake.disqualifiers,
    clearance: role.intake.clearance,
    location: role.intake.location,
    rawDescription: role.intake.rawDescription,
  }) : '', [role])

  useEffect(() => {
    if (!role || mode === 'checking') return
    const canonical = role.candidates.filter(candidate => candidate.candidateId).slice(0, 12)
    if (!canonical.length) {
      setResponse({ candidates: [] })
      return
    }
    const controller = new AbortController()
    setLoading(true)
    void (async () => {
      try {
        const request = await fetch('/api/role-candidate-assessment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            intake: role.intake,
            searchIntelligence: role.searchIntelligence,
            candidates: canonical.map(candidate => ({
              candidateId: candidate.candidateId,
              name: candidate.name,
              headline: candidate.headline,
              company: candidate.company,
              location: candidate.location,
              fitReasons: candidate.fitReasons,
              concerns: candidate.concerns,
              tags: candidate.tags,
              contactStatus: candidate.contactStatus,
              evidenceStatus: candidate.evidenceStatus,
            })),
          }),
        })
        const json = await request.json() as ResponseShape
        if (!request.ok || !json.ok) throw new Error(json.error || 'Candidate explanation failed.')
        setResponse(json)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setResponse({ ok: false, error: error instanceof Error ? error.message : 'Candidate explanation failed.', candidates: [] })
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [role?.id, candidateKey, intakeKey, intelligenceKey, mode])

  if (!role || mode === 'checking' || (!role.candidates.length && !loading)) return null
  const candidates = response.candidates || []

  return (
    <section className="role-candidate-intel-v35" aria-label="Candidate match explanations">
      <div className="role-candidate-intel-v35__header">
        <div>
          <div className="eyebrow">V35 role ↔ candidate intelligence</div>
          <h2>Why these people surfaced</h2>
          <p>Separates discovery signals from qualification evidence. No opaque fit score, no auto-rejection, and no search term becomes a candidate fact.</p>
        </div>
        <span className="role-candidate-intel-v35__version">v35.3</span>
      </div>

      {loading && !candidates.length && <div className="role-candidate-intel-v35__status">Building evidence explanations…</div>}
      {response.error && <div className="role-candidate-intel-v35__warning">{response.error}</div>}

      <div className="role-candidate-intel-v35__grid">
        {candidates.map(candidate => {
          const packet = candidate.matchExplanation
          const observedDiscovery = packet.discoverySignals.filter(signal => signal.observed)
          return (
            <article className="role-candidate-intel-v35__card" key={candidate.candidateId}>
              <div className="role-candidate-intel-v35__card-head">
                <div>
                  <Link href={`/app/candidate/${encodeURIComponent(candidate.candidateId)}`}>{candidate.canonicalName}</Link>
                  <span>{candidate.headline || 'Candidate Graph profile'}</span>
                </div>
                <span className={`role-candidate-intel-v35__state role-candidate-intel-v35__state--${candidate.state}`}>{stateLabel(candidate.state)}</span>
              </div>

              <div className="role-candidate-intel-v35__facts">
                <span><b>{packet.requirements.supported.length}</b><small>supported</small></span>
                <span><b>{packet.requirements.needsVerification.length}</b><small>verify</small></span>
                <span><b>{packet.requirements.missingEvidence.length}</b><small>unknown</small></span>
                <span><b>{candidate.claimCount}</b><small>evidence claims</small></span>
              </div>

              {packet.requirements.supported.length > 0 && (
                <div className="role-candidate-intel-v35__row">
                  <strong>Supported</strong>
                  <p>{packet.requirements.supported.join(' · ')}</p>
                </div>
              )}
              {packet.requirements.needsVerification.length > 0 && (
                <div className="role-candidate-intel-v35__row role-candidate-intel-v35__row--verify">
                  <strong>Needs verification</strong>
                  <p>{packet.requirements.needsVerification.join(' · ')}</p>
                </div>
              )}
              {packet.requirements.missingEvidence.length > 0 && (
                <div className="role-candidate-intel-v35__row role-candidate-intel-v35__row--unknown">
                  <strong>Missing evidence</strong>
                  <p>{packet.requirements.missingEvidence.join(' · ')}</p>
                </div>
              )}
              {packet.requirements.contradicted.length > 0 && (
                <div className="role-candidate-intel-v35__row role-candidate-intel-v35__row--conflict">
                  <strong>Conflicting evidence</strong>
                  <p>{packet.requirements.contradicted.join(' · ')}</p>
                </div>
              )}

              {observedDiscovery.length > 0 && (
                <div className="role-candidate-intel-v35__row role-candidate-intel-v35__row--discovery">
                  <strong>Why discovered — search-only</strong>
                  <p>{observedDiscovery.map(signal => signal.label).join(' · ')}</p>
                  <small>These signals can explain retrieval but do not satisfy a must-have unless independently supported above.</small>
                </div>
              )}

              <div className="role-candidate-intel-v35__geo">
                <span>{geographyLabel(packet.geography.state)}</span>
                <p>{packet.geography.explanation}</p>
              </div>

              <details>
                <summary>Full explanation</summary>
                <ul>{packet.explanation.map(item => <li key={item}>{item}</li>)}</ul>
              </details>
            </article>
          )
        })}
      </div>

      {!!role.candidates.length && candidates.length === 0 && !loading && !response.error && (
        <div className="role-candidate-intel-v35__status">Candidate explanations will appear after canonical Candidate Graph records are available.</div>
      )}
      <div className="role-candidate-intel-v35__trust">Discovery ≠ qualification · missing ≠ negative · clearance/credentials stay verification-gated · recruiter decides fit.</div>
    </section>
  )
}
