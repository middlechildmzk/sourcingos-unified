'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { EvidenceClass, EvidenceLedgerSnapshot } from '@/lib/evidence-ledger'

type ApiResponse = EvidenceLedgerSnapshot & {
  ok: boolean
  persistence_mode: 'preview' | 'supabase'
  error?: string
  _note?: string
}

const evidenceLabels: Record<EvidenceClass, string> = {
  verified_fact: 'Verified fact',
  supported_inference: 'Supported inference',
  weak_signal: 'Weak signal',
  unknown: 'Unknown',
  stale: 'Stale',
  conflicting: 'Conflicting',
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'Unknown date'
}

export function EvidenceLedgerClient() {
  const [ledger, setLedger] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState<'all' | EvidenceClass>('all')
  const [reviewOnly, setReviewOnly] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadLedger() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/candidate-db/evidence-ledger', {
          signal: controller.signal,
          cache: 'no-store',
        })
        const json = await response.json() as ApiResponse
        if (!response.ok || !json.ok) throw new Error(json.error || 'Evidence Ledger could not be loaded.')
        setLedger(json)
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : 'Evidence Ledger could not be loaded.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadLedger().catch(() => undefined)
    return () => controller.abort()
  }, [])

  const filteredCandidates = useMemo(() => {
    if (!ledger) return []
    const normalizedQuery = query.trim().toLowerCase()

    return ledger.candidates
      .map(candidate => ({
        ...candidate,
        claims: candidate.claims.filter(claim => {
          if (classFilter !== 'all' && claim.evidenceClass !== classFilter) return false
          if (reviewOnly && claim.reviewerStatus !== 'requires_review' && claim.reviewerStatus !== 'unreviewed') return false
          if (!normalizedQuery) return true
          return [candidate.canonicalName, candidate.headline, candidate.location, claim.fieldName, claim.claimedValue, claim.source]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery)
        }),
      }))
      .filter(candidate => candidate.claims.length > 0 || (!normalizedQuery && classFilter === 'all' && !reviewOnly))
  }, [classFilter, ledger, query, reviewOnly])

  if (loading) {
    return <div className="card" role="status">Loading the Candidate Intelligence Spine…</div>
  }

  if (error) {
    return (
      <div className="card" role="alert">
        <span className="kicker">Evidence Ledger unavailable</span>
        <h2>The read-only ledger could not be loaded.</h2>
        <p className="muted">{error}</p>
        <Link href="/app/candidate-database" className="btn">Return to Candidate Database</Link>
      </div>
    )
  }

  if (!ledger) return null

  const visibleClaimCount = filteredCandidates.reduce((sum, candidate) => sum + candidate.claims.length, 0)

  return (
    <div className="interactive-tool">
      <div className="cta">
        <b>{ledger.persistence_mode === 'supabase' ? 'Durable evidence mode:' : 'Preview evidence mode:'}</b>{' '}
        Facts, inferences, weak signals, stale records, and conflicts remain separate. This workspace is read-only and performs no merges, outreach, or candidate disposition actions.
      </div>

      <div className="grid">
        <div className="card"><span className="kicker">Claims</span><div className="big-number">{ledger.summary.total}</div></div>
        <div className="card"><span className="kicker">Needs review</span><div className="big-number">{ledger.summary.requiresReview}</div></div>
        <div className="card"><span className="kicker">Conflicting</span><div className="big-number">{ledger.summary.conflicting}</div></div>
        <div className="card"><span className="kicker">Stale</span><div className="big-number">{ledger.summary.stale}</div></div>
        <div className="card"><span className="kicker">Blocked use</span><div className="big-number">{ledger.summary.blocked}</div></div>
      </div>

      <section className="card" aria-labelledby="ledger-filters-heading">
        <span className="kicker">Research controls</span>
        <h2 id="ledger-filters-heading">Filter the evidence, not the person.</h2>
        <div className="grid two">
          <label>
            Search candidate, field, source, or value
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Example: location, GitHub, clearance, email"
            />
          </label>
          <label>
            Evidence class
            <select value={classFilter} onChange={event => setClassFilter(event.target.value as 'all' | EvidenceClass)}>
              <option value="all">All evidence classes</option>
              {Object.entries(evidenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <input type="checkbox" checked={reviewOnly} onChange={event => setReviewOnly(event.target.checked)} />
          Show only unreviewed or review-required claims
        </label>
        <p className="muted" aria-live="polite">Showing {visibleClaimCount} claim(s) across {filteredCandidates.length} candidate record(s).</p>
      </section>

      {filteredCandidates.length === 0 ? (
        <div className="card">
          <span className="kicker">No matching evidence</span>
          <h2>Nothing matches the current filters.</h2>
          <p className="muted">Clear the filters or import and validate candidate evidence in the Candidate Database.</p>
        </div>
      ) : (
        <div className="results">
          {filteredCandidates.map(candidate => (
            <article className="result-card" key={candidate.candidateId}>
              <div className="result-head">
                <span>{candidate.claims.length} visible claim(s)</span>
                <span>{candidate.summary.conflicting} conflict(s) · {candidate.summary.stale} stale</span>
              </div>
              <h2>{candidate.canonicalName}</h2>
              <p className="muted">{[candidate.headline, candidate.location].filter(Boolean).join(' · ') || 'Candidate details pending review'}</p>

              <div className="results">
                {candidate.claims.map(claim => (
                  <div className="card" key={claim.id}>
                    <div className="result-head">
                      <span>{evidenceLabels[claim.evidenceClass]}</span>
                      <span>{claim.confidenceScore}/100 · {claim.freshness}</span>
                    </div>
                    <h3>{claim.fieldName}</h3>
                    <p style={{ overflowWrap: 'anywhere' }}>{claim.claimedValue}</p>
                    <div className="chips">
                      <span className="tag">Source: {claim.source}</span>
                      <span className="tag">Use: {claim.permittedUse.replaceAll('_', ' ')}</span>
                      <span className="tag">Review: {claim.reviewerStatus.replaceAll('_', ' ')}</span>
                    </div>
                    <p className="muted">Retrieved {formatDate(claim.retrievedAt)} · freshness window {claim.freshnessWindowDays} days</p>
                    {claim.notes.map(note => <p className="muted" key={note}>{note}</p>)}
                    {claim.sourceUrl ? <a href={claim.sourceUrl} target="_blank" rel="noreferrer">Open source evidence ↗</a> : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="card">
        <span className="kicker">Permanent evidence rules</span>
        <h2>What SourcingOS will not collapse into a score.</h2>
        <ul>{ledger.principles.map(principle => <li key={principle}>{principle}</li>)}</ul>
      </section>
    </div>
  )
}
