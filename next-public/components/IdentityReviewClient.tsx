'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'auto_attached_deterministic' | 'superseded'

type ProposalSummary = {
  id: string
  status: ProposalStatus
  decisionClass: string
  score: number | null
  resolverVersion: string
  reviewRequired: boolean
  createdAt: string
  updatedAt: string
  incoming: {
    sourceProfileId: string
    currentCandidateId: string | null
    source: string
    stableSourceId: string
    displayName: string
    headline: string | null
    location: string | null
    organization: string | null
    profileUrl: string | null
  }
  proposedCandidate: {
    id: string
    canonicalName: string
    headline: string | null
    currentTitle: string | null
    currentCompany: string | null
    location: string | null
    mergeStatus: string
  }
  reasons: string[]
  conflictCount: number
  blockingConflictCount: number
}

type ProposalDetail = ProposalSummary & {
  deterministicRules: Array<{ ruleId: string; passed: boolean; evidence: unknown }>
  similarityComponents: Record<string, number | null>
  supportingEvidence: unknown[]
  conflicts: Array<{
    type: string
    severity: 'blocking' | 'material' | 'informational'
    explanation: string
    evidence: unknown
  }>
  incomingIdentifiers: Array<{
    type: string
    label: string
    displayValue: string | null
    confidence: number
    observedAt: string
    sensitive: boolean
  }>
  proposedCandidateSources: Array<{
    id: string
    source: string
    stableSourceId: string
    displayName: string
    headline: string | null
    location: string | null
    organization: string | null
    profileUrl: string | null
    status: string
    lastSeenAt: string | null
  }>
  candidateClaims: Array<{
    id: string
    fieldName: string
    value: unknown
    normalizedValue: string | null
    evidenceClass: string
    lifecycleStatus: string
    reviewerStatus: string
    source: string
    sourceType: string
    observedAt: string | null
    retrievedAt: string
    freshnessScore: number
    sourceReliability: number
    corroborationCount: number
  }>
  snapshotCount: number
}

type ListPayload = {
  ok?: boolean
  available?: boolean
  code?: string
  error?: string
  proposals?: ProposalSummary[]
  counts?: Record<ProposalStatus, number>
  page?: { limit: number; offset: number; hasMore: boolean; total: number }
  status?: ProposalStatus
}

const STATUSES: Array<{ value: ProposalStatus; label: string }> = [
  { value: 'pending', label: 'Pending review' },
  { value: 'auto_attached_deterministic', label: 'Deterministic' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'superseded', label: 'Superseded' },
]

function words(value: string) {
  return value.replaceAll('_', ' ')
}

function date(value: string | null | undefined) {
  if (!value) return 'Unknown date'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Unknown date' : parsed.toLocaleString()
}

function reviewRank(score: number | null) {
  if (score === null) return 'No rank'
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}/100`
}

function compactValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not observed'
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const rendered = JSON.stringify(value)
    return rendered.length > 120 ? `${rendered.slice(0, 117)}…` : rendered
  } catch {
    return 'Structured evidence'
  }
}

function personMeta(value: { headline?: string | null; currentTitle?: string | null; organization?: string | null; currentCompany?: string | null; location?: string | null }) {
  return [value.headline || value.currentTitle, value.organization || value.currentCompany, value.location].filter(Boolean).join(' · ') || 'No additional public profile fields observed'
}

export function IdentityReviewClient() {
  const [statusFilter, setStatusFilter] = useState<ProposalStatus>('pending')
  const [proposals, setProposals] = useState<ProposalSummary[]>([])
  const [counts, setCounts] = useState<Record<ProposalStatus, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    auto_attached_deterministic: 0,
    superseded: 0,
  })
  const [page, setPage] = useState({ limit: 25, offset: 0, hasMore: false, total: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProposalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [message, setMessage] = useState('Loading durable identity proposals…')

  const loadDetail = useCallback(async (proposalId: string) => {
    setSelectedId(proposalId)
    setDetail(null)
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/identity/proposals/${encodeURIComponent(proposalId)}`, {
        headers: { accept: 'application/json' },
      })
      const json = await response.json()
      if (!response.ok || !json?.ok || !json?.proposal) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'Could not load the identity comparison.')
      }
      setDetail(json.proposal as ProposalDetail)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load the identity comparison.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadList = useCallback(async (nextStatus: ProposalStatus, offset = 0) => {
    setLoading(true)
    setMessage('Loading durable identity proposals…')
    try {
      const params = new URLSearchParams({ status: nextStatus, limit: '25', offset: String(offset) })
      const response = await fetch(`/api/identity/proposals?${params.toString()}`, {
        headers: { accept: 'application/json' },
      })
      const json = await response.json() as ListPayload
      if (!response.ok || !json.ok) {
        if (json.available === false || json.code === 'identity_schema_unavailable') {
          setAvailable(false)
          setProposals([])
          setDetail(null)
          setSelectedId(null)
          setMessage(json.error || 'The durable identity-review schema is not applied in this environment.')
          return
        }
        throw new Error(json.error || 'Could not load identity proposals.')
      }

      const nextProposals = json.proposals || []
      setAvailable(true)
      setProposals(nextProposals)
      setCounts(json.counts || counts)
      setPage(json.page || { limit: 25, offset, hasMore: false, total: nextProposals.length })
      setMessage(nextProposals.length
        ? 'Review rank orders attention only. It is not a probability and never authorizes a merge.'
        : `No ${words(nextStatus)} identity proposals are available.`)

      const nextSelected = nextProposals.some(proposal => proposal.id === selectedId)
        ? selectedId
        : nextProposals[0]?.id || null
      setSelectedId(nextSelected)
      if (nextSelected) void loadDetail(nextSelected)
      else setDetail(null)
    } catch (error) {
      setAvailable(true)
      setMessage(error instanceof Error ? error.message : 'Could not load identity proposals.')
    } finally {
      setLoading(false)
    }
  }, [counts, loadDetail, selectedId])

  useEffect(() => {
    void loadList(statusFilter, 0)
    // The selected proposal is intentionally reset by the list loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const passedRules = useMemo(
    () => detail?.deterministicRules.filter(rule => rule.passed) || [],
    [detail],
  )
  const comparisonEntries = useMemo(
    () => Object.entries(detail?.similarityComponents || {}).filter(([, value]) => value !== null),
    [detail],
  )

  if (available === false) {
    return <div className="interactive-tool">
      <section className="product-panel">
        <div className="product-panel-head">
          <div><span className="kicker">Not activated</span><h2>Durable identity review is unavailable</h2></div>
          <span className="status-pill warning">read-only gate</span>
        </div>
        <p className="muted">{message}</p>
        <div className="cta" style={{ marginBottom: 0 }}>
          No proposal, candidate, source-profile, or database record was changed. The identity migrations require a separate reviewed production approval.
        </div>
        <div className="button-row" style={{ marginTop: 14 }}>
          <Link className="btn secondary" href="/app/candidate-database">Return to Candidates</Link>
        </div>
      </section>
    </div>
  }

  return <div className="interactive-tool">
    <div className="product-summary-grid">
      {STATUSES.slice(0, 4).map(item => <button
        type="button"
        key={item.value}
        className="product-stat"
        onClick={() => setStatusFilter(item.value)}
        aria-pressed={statusFilter === item.value}
        style={{ textAlign: 'left', cursor: 'pointer', borderColor: statusFilter === item.value ? 'var(--accent)' : undefined }}
      >
        <small>{item.label}</small>
        <b>{counts[item.value].toLocaleString()}</b>
        <span>{statusFilter === item.value ? 'Current queue' : 'Open queue'}</span>
      </button>)}
    </div>

    <div className="cta" style={{ marginBottom: 14 }}>
      <strong>Read-only review.</strong> Scores rank attention, not identity probability. This surface cannot attach profiles, merge candidates, or record decisions.
    </div>

    <div className="product-layout" style={{ gridTemplateColumns: 'minmax(300px,.8fr) minmax(0,1.2fr)' }}>
      <section className="product-panel" style={{ alignSelf: 'start' }}>
        <div className="product-panel-head">
          <div><span className="kicker">Proposal queue</span><h2>{STATUSES.find(item => item.value === statusFilter)?.label}</h2></div>
          <span>{page.total.toLocaleString()}</span>
        </div>
        <div className="product-list">
          {proposals.map(proposal => <button
            type="button"
            key={proposal.id}
            className="product-row"
            onClick={() => void loadDetail(proposal.id)}
            aria-pressed={selectedId === proposal.id}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: selectedId === proposal.id ? 'var(--accent)' : undefined }}
          >
            <div className="product-row-main">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="product-row-title">{proposal.incoming.displayName}</span>
                <span className="status-pill">{words(proposal.incoming.source)}</span>
                {!!proposal.blockingConflictCount && <span className="status-pill warning">blocking conflict</span>}
              </div>
              <div className="product-row-meta">Proposed: {proposal.proposedCandidate.canonicalName}</div>
              <div className="product-row-meta">Review rank {reviewRank(proposal.score)} · {proposal.reasons.slice(0, 2).join(' · ') || words(proposal.decisionClass)}</div>
            </div>
          </button>)}
          {!loading && !proposals.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No proposals in this queue</div><div className="product-row-meta">Nothing requires attention for this status.</div></div></div>}
          {loading && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Loading proposals…</div><div className="product-row-meta">Reading owner-scoped proposal records.</div></div></div>}
        </div>
        <div className="button-row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button className="btn secondary" disabled={loading || page.offset === 0} onClick={() => void loadList(statusFilter, Math.max(0, page.offset - page.limit))}>Previous</button>
          <button className="btn secondary" disabled={loading || !page.hasMore} onClick={() => void loadList(statusFilter, page.offset + page.limit)}>Next</button>
        </div>
      </section>

      <section className="product-panel" style={{ minWidth: 0 }}>
        <div className="product-panel-head">
          <div><span className="kicker">Identity comparison</span><h2>{detail?.incoming.displayName || 'Select a proposal'}</h2></div>
          {detail && <span className={`status-pill ${detail.blockingConflictCount ? 'warning' : ''}`}>{words(detail.decisionClass)}</span>}
        </div>

        {detailLoading && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Loading comparison…</div><div className="product-row-meta">Reading provenance and conflict evidence.</div></div></div>}

        {!detailLoading && detail && <div style={{ display: 'grid', gap: 14 }}>
          <div className="product-summary-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
            <div className="product-stat"><small>Review rank</small><b>{reviewRank(detail.score)}</b><span>Ranking signal, not probability</span></div>
            <div className="product-stat"><small>Conflicts</small><b>{detail.conflictCount}</b><span>{detail.blockingConflictCount} blocking</span></div>
            <div className="product-stat"><small>Snapshots</small><b>{detail.snapshotCount}</b><span>Raw payloads not exposed</span></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
            <div className="product-row">
              <div className="product-row-main">
                <span className="kicker">Incoming source profile</span>
                <div className="product-row-title">{detail.incoming.displayName}</div>
                <div className="product-row-meta">{personMeta(detail.incoming)}</div>
                <div className="chips"><span className="tag">{words(detail.incoming.source)}</span><span className="tag">separate record</span></div>
              </div>
              {detail.incoming.profileUrl && <a className="btn ghost" href={detail.incoming.profileUrl} target="_blank" rel="noreferrer">Source</a>}
            </div>
            <div className="product-row">
              <div className="product-row-main">
                <span className="kicker">Proposed canonical candidate</span>
                <div className="product-row-title">{detail.proposedCandidate.canonicalName}</div>
                <div className="product-row-meta">{personMeta(detail.proposedCandidate)}</div>
                <div className="chips"><span className="tag">{detail.proposedCandidateSources.length} source{detail.proposedCandidateSources.length === 1 ? '' : 's'}</span><span className="tag">{words(detail.proposedCandidate.mergeStatus)}</span></div>
              </div>
              <Link className="btn ghost" href={`/app/candidate/${detail.proposedCandidate.id}`}>Open 360</Link>
            </div>
          </div>

          <section>
            <div className="product-panel-head"><h3>Deterministic anchors</h3><span>{passedRules.length} passed</span></div>
            <div className="product-list">
              {detail.deterministicRules.map(rule => <div className="product-row" key={rule.ruleId}>
                <div className="product-row-main"><div className="product-row-title">{words(rule.ruleId)}</div><div className="product-row-meta">{rule.passed ? 'Observed rule passed' : 'Rule not satisfied'}</div></div>
                <span className={`status-pill ${rule.passed ? 'success' : ''}`}>{rule.passed ? 'passed' : 'not passed'}</span>
              </div>)}
            </div>
          </section>

          {!!comparisonEntries.length && <section>
            <div className="product-panel-head"><h3>Similarity components</h3><span>review ranking only</span></div>
            <div className="product-list">
              {comparisonEntries.map(([key, value]) => <div className="product-row" key={key}><div className="product-row-main"><div className="product-row-title">{words(key)}</div><div className="product-row-meta">One explainable component, never identity proof</div></div><b>{Math.round((value || 0) * 100)}/100</b></div>)}
            </div>
          </section>}

          <section>
            <div className="product-panel-head"><h3>Conflicts and negative evidence</h3><span>{detail.conflicts.length}</span></div>
            <div className="product-list">
              {detail.conflicts.map((conflict, index) => <div className="product-row" key={`${conflict.type}-${index}`}>
                <div className="product-row-main"><div className="product-row-title">{words(conflict.type)}</div><div className="product-row-meta">{conflict.explanation}</div></div>
                <span className={`status-pill ${conflict.severity === 'blocking' ? 'warning' : ''}`}>{conflict.severity}</span>
              </div>)}
              {!detail.conflicts.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No recorded conflicts</div><div className="product-row-meta">Absence of a conflict is not proof that the profiles are the same person.</div></div></div>}
            </div>
          </section>

          <details className="advanced-disclosure">
            <summary>Observed identifiers ({detail.incomingIdentifiers.length})</summary>
            <div className="product-list" style={{ marginTop: 10 }}>
              {detail.incomingIdentifiers.map((identifier, index) => <div className="product-row" key={`${identifier.type}-${index}`}><div className="product-row-main"><div className="product-row-title">{identifier.label}</div><div className="product-row-meta">{identifier.sensitive ? 'Sensitive value masked in browser' : identifier.displayValue || 'Observed without a display value'} · observed {date(identifier.observedAt)}</div></div><span className="status-pill">observed</span></div>)}
            </div>
          </details>

          <details className="advanced-disclosure">
            <summary>Proposed candidate source profiles ({detail.proposedCandidateSources.length})</summary>
            <div className="product-list" style={{ marginTop: 10 }}>
              {detail.proposedCandidateSources.map(source => <div className="product-row" key={source.id}><div className="product-row-main"><div className="product-row-title">{source.displayName}</div><div className="product-row-meta">{words(source.source)} · {personMeta(source)}</div></div>{source.profileUrl && <a className="btn ghost" href={source.profileUrl} target="_blank" rel="noreferrer">Source</a>}</div>)}
            </div>
          </details>

          <details className="advanced-disclosure">
            <summary>Field-level claims ({detail.candidateClaims.length})</summary>
            <div className="product-list" style={{ marginTop: 10 }}>
              {detail.candidateClaims.map(claim => <div className="product-row" key={claim.id}><div className="product-row-main"><div className="product-row-title">{words(claim.fieldName)}: {compactValue(claim.value)}</div><div className="product-row-meta">{words(claim.source)} · {words(claim.evidenceClass)} · {words(claim.lifecycleStatus)} · {claim.corroborationCount} corroboration</div></div><span className={`status-pill ${claim.reviewerStatus === 'requires_review' ? 'warning' : ''}`}>{words(claim.reviewerStatus)}</span></div>)}
              {!detail.candidateClaims.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No field claims recorded</div><div className="product-row-meta">The foundation does not invent canonical values from missing claims.</div></div></div>}
            </div>
          </details>

          <div className="cta" style={{ marginBottom: 0 }}>
            Decision controls are intentionally unavailable. A future approval must reassign the source profile, preserve the provisional candidate, record the proposal decision, and support reversal in one audited transaction.
          </div>
        </div>}

        {!detailLoading && !detail && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No proposal selected</div><div className="product-row-meta">Choose a proposal to inspect its source evidence and conflicts.</div></div></div>}
      </section>
    </div>
    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{message}</p>
  </div>
}
