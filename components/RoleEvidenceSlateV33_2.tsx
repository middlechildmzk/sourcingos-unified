'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RoleWorkspace } from '@/lib/role-workspace'

type EvidenceState = 'supported' | 'contradicted' | 'unknown' | 'needs_verification'
type SlateState = 'conflicting' | 'needs_verification' | 'insufficient_evidence' | 'evidence_ready' | 'no_requirements'

type Requirement = {
  requirementId: string
  requirementText: string
  tier: 'must_have' | 'preferred' | 'disqualifier'
  kind: 'general' | 'credential' | 'clearance'
  state: EvidenceState
  rationale: string
  evidence: Array<{ id: string; source: string; sourceType: string; sourceUrl?: string; evidenceClass: string; detail: string; spanText?: string; freshness: string }>
  contradictions: Array<{ id: string; source: string; detail: string; sourceUrl?: string }>
  recruiterContext: string[]
}

type CandidateAssessment = {
  candidateId: string
  canonicalName: string
  headline: string
  state: SlateState
  tally: { supported: number; contradicted: number; needsVerification: number; unknown: number; total: number }
  mustHaveTally: { supported: number; contradicted: number; needsVerification: number; unknown: number; total: number }
  claimCount: number
  requirements: Requirement[]
}

type ResponseBody = {
  ok?: boolean
  error?: string
  mode?: 'supabase' | 'preview'
  candidates?: CandidateAssessment[]
  trust?: { decision?: string; unknown?: string; sensitive?: string }
}

function stateLabel(state: SlateState): string {
  if (state === 'evidence_ready') return 'evidence ready'
  if (state === 'needs_verification') return 'needs verification'
  if (state === 'insufficient_evidence') return 'insufficient evidence'
  if (state === 'conflicting') return 'conflicting evidence'
  return 'no explicit requirements'
}

function requirementLabel(state: EvidenceState): string {
  if (state === 'needs_verification') return 'needs verification'
  return state
}

function stateClass(state: SlateState | EvidenceState): string {
  if (state === 'supported' || state === 'evidence_ready') return 'success'
  if (state === 'contradicted' || state === 'conflicting') return 'warning'
  if (state === 'needs_verification') return 'active'
  return ''
}

export function RoleEvidenceSlateV33_2({ role }: { role: RoleWorkspace }) {
  const candidateKey = useMemo(() => role.candidates.map(candidate => candidate.candidateId).filter(Boolean).sort().join('|'), [role.candidates])
  const intakeKey = useMemo(() => JSON.stringify({
    mustHaves: role.intake.mustHaves,
    niceToHaves: role.intake.niceToHaves,
    disqualifiers: role.intake.disqualifiers,
    clearance: role.intake.clearance,
  }), [role.intake.mustHaves, role.intake.niceToHaves, role.intake.disqualifiers, role.intake.clearance])
  const [data, setData] = useState<ResponseBody>({ candidates: [] })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const canonical = role.candidates.filter(candidate => candidate.candidateId)
    if (!canonical.length) {
      setData({ candidates: [] })
      return
    }

    const controller = new AbortController()
    setLoading(true)
    void (async () => {
      try {
        const response = await fetch('/api/role-candidate-assessment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            intake: role.intake,
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
        const json = await response.json() as ResponseBody
        if (!response.ok || !json.ok) throw new Error(json.error || 'Evidence review slate could not be built.')
        setData(json)
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') setData({ ok: false, error: error instanceof Error ? error.message : 'Evidence review slate could not be built.', candidates: [] })
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [role.id, candidateKey, intakeKey])

  const assessments = data.candidates || []
  if (!role.candidates.some(candidate => candidate.candidateId)) return null

  return <section className="product-panel" style={{ marginTop: 18 }} aria-label="Evidence review slate">
    <div className="product-panel-head">
      <div><span className="kicker">Pre-shortlist evidence review</span><h2>What the Candidate Graph can actually support.</h2></div>
      <span className={`status-pill ${data.mode === 'supabase' ? 'success' : ''}`}>{loading ? 'refreshing' : data.mode || 'review'}</span>
    </div>
    <p className="muted" style={{ marginTop: -4 }}>This is not a fit score or hiring recommendation. It maps each role requirement to source-linked evidence, contradictions, verification needs, or unknowns before a recruiter chooses who to shortlist.</p>

    {data.error && <div className="cta" role="status">{data.error}</div>}
    {!data.error && !loading && !assessments.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No canonical candidates to assess yet</div><div className="product-row-meta">Save a supported discovery to Candidate Graph first.</div></div></div>}

    {!!assessments.length && <div className="product-list">{assessments.map(candidate => {
      const must = candidate.mustHaveTally
      return <details className="advanced-disclosure" key={candidate.candidateId}>
        <summary>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{candidate.canonicalName}</b>
            <span className={`status-pill ${stateClass(candidate.state)}`}>{stateLabel(candidate.state)}</span>
            <small>{must.supported}/{must.total} must-haves supported · {must.needsVerification} verify · {must.unknown} unknown{must.contradicted ? ` · ${must.contradicted} contradicted` : ''}</small>
          </span>
        </summary>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {candidate.headline && <div className="muted">{candidate.headline} · {candidate.claimCount} Candidate Graph claim{candidate.claimCount === 1 ? '' : 's'}</div>}
          {candidate.requirements.map(requirement => <div className="product-row" key={requirement.requirementId}>
            <div className="product-row-main">
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="product-row-title">{requirement.requirementText}</span>
                <span className={`status-pill ${stateClass(requirement.state)}`}>{requirementLabel(requirement.state)}</span>
                <span className="status-pill">{requirement.tier.replace('_', ' ')}</span>
              </div>
              <div className="product-row-meta">{requirement.rationale}</div>
              {!!requirement.evidence.length && <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>{requirement.evidence.slice(0, 3).map(evidence => <div key={evidence.id} className="agentic-result-evidence"><b>{evidence.source} · {evidence.evidenceClass.replace('_', ' ')}</b><span>{evidence.spanText || evidence.detail}</span>{evidence.sourceUrl && <a href={evidence.sourceUrl} target="_blank" rel="noreferrer noopener">Source ↗</a>}</div>)}</div>}
              {!!requirement.recruiterContext.length && <div className="muted" style={{ marginTop: 7 }}>Recruiter context only: {requirement.recruiterContext.slice(0, 2).join(' · ')}</div>}
              {!!requirement.contradictions.length && <div className="cta" style={{ marginTop: 8, marginBottom: 0 }}>{requirement.contradictions.slice(0, 2).map(item => item.detail).join(' · ')}</div>}
            </div>
          </div>)}
        </div>
      </details>
    })}</div>}

    <div className="agentic-results-note" style={{ marginTop: 12 }}>{data.trust?.unknown || 'Missing evidence remains unknown.'} {data.trust?.sensitive || 'Verification-gated requirements stay verification-gated.'}</div>
  </section>
}
