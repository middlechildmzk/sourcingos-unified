'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Review = {
  id: string
  candidateId?: string
  sourceProfileIds: string[]
  score: number
  reasons: string[]
  conflicts: Array<string | { explanation?: string; severity?: string; type?: string }>
  decision: string
  createdAt?: string
}

type Profile = {
  id: string
  candidateId?: string
  source: string
  sourceProfileId: string
  displayName: string
  headline?: string
  organization?: string
  location?: string
  profileUrl?: string
  status?: string
  lastSeenAt?: string
}

type Candidate = {
  id: string
  canonicalName: string
  headline?: string
  currentCompany?: string
  location?: string
  mergeStatus?: string
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function list(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function normalizeReview(row: any): Review {
  return {
    id: text(row?.id),
    candidateId: text(row?.candidateId || row?.candidate_id) || undefined,
    sourceProfileIds: list(row?.sourceProfileIds || row?.source_profile_ids).map(String),
    score: Number(row?.score ?? row?.match_score ?? 0) || 0,
    reasons: list(row?.reasons || row?.match_reasons).map(String),
    conflicts: list(row?.conflicts),
    decision: text(row?.decision, 'pending'),
    createdAt: text(row?.createdAt || row?.created_at) || undefined,
  }
}

function conflictText(value: Review['conflicts'][number]) {
  if (typeof value === 'string') return value
  return text(value?.explanation || value?.type, 'Conflicting identity evidence requires review.')
}

function sourceLabel(source: string) {
  return source.replaceAll('_', ' ').replace(/\b\w/g, match => match.toUpperCase())
}

export function IdentityReviewInboxV36_10() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [status, setStatus] = useState('Loading identity reviews…')
  const [working, setWorking] = useState('')
  const [mode, setMode] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/candidate-db/match-review', { headers: { accept: 'application/json' } })
      const json = await response.json()
      if (!response.ok || !json?.ok) throw new Error(text(json?.error, 'Could not load identity reviews.'))
      setReviews(list(json.reviews).map(normalizeReview))
      setProfiles(list(json.profiles) as Profile[])
      setCandidates(list(json.candidates) as Candidate[])
      setMode(text(json.mode))
      const pending = list(json.reviews).filter((review: any) => text(review?.decision, 'pending') === 'pending').length
      setStatus(pending ? `${pending} identity review${pending === 1 ? '' : 's'} waiting for a recruiter decision.` : 'No pending identity reviews.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load identity reviews.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const pending = useMemo(() => reviews.filter(review => review.decision === 'pending'), [reviews])
  const decided = useMemo(() => reviews.filter(review => review.decision !== 'pending').slice(0, 20), [reviews])
  const profileMap = useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles])
  const candidateMap = useMemo(() => new Map(candidates.map(candidate => [candidate.id, candidate])), [candidates])

  async function decide(review: Review, decision: 'confirmed' | 'rejected') {
    setWorking(review.id)
    setStatus(decision === 'confirmed' ? 'Confirming these observations belong to the same person…' : 'Keeping these observations separate…')
    try {
      const response = await fetch('/api/candidate-db/confirm-merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, decision }),
      })
      const json = await response.json()
      if (!response.ok || !json?.ok) throw new Error(text(json?.error, 'Identity decision failed.'))
      setStatus(decision === 'confirmed'
        ? 'Identity confirmed. Only the explicitly reviewed source profiles and their provenance were attached to the canonical person.'
        : 'Decision saved. The source profiles remain separate people.')
      await load()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Identity decision failed.')
    } finally {
      setWorking('')
    }
  }

  return <div className="interactive-tool" style={{ display: 'grid', gap: 14 }}>
    <div className="product-summary-grid">
      <div className="product-stat"><small>Pending identity reviews</small><b>{pending.length}</b><span>Human decision required</span></div>
      <div className="product-stat"><small>Source observations in view</small><b>{profiles.length}</b><span>Never flattened or erased</span></div>
      <div className="product-stat"><small>Canonical people referenced</small><b>{candidates.length}</b><span>One person, many sources</span></div>
      <div className="product-stat"><small>Storage</small><b>{mode || '—'}</b><span>{mode === 'supabase' ? 'Owner-scoped durable graph' : 'Preview data may reset'}</span></div>
    </div>

    <section className="product-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Identity resolution inbox</span><h2>Possible same person</h2></div>
        <span>{status}</span>
      </div>
      <div className="cta" style={{ marginBottom: 14 }}>
        <b>Identity confidence is not merge permission.</b> Exact source IDs are reused automatically. Cross-source observations are attached to one Candidate 360 only after an explicit recruiter confirmation.
      </div>

      <div className="product-list">
        {pending.map(review => {
          const target = review.candidateId ? candidateMap.get(review.candidateId) : undefined
          const reviewProfiles = review.sourceProfileIds.map(id => profileMap.get(id)).filter(Boolean) as Profile[]
          return <div className="product-row" key={review.id} style={{ alignItems: 'stretch', display: 'grid', gap: 12 }}>
            <div className="product-row-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="product-row-title">{target?.canonicalName || reviewProfiles[0]?.displayName || 'Potential identity match'}</div>
                  <div className="product-row-meta">Identity review score {review.score}/100 · ranking for human review, not an automatic merge threshold</div>
                </div>
                {target?.id && <Link className="btn ghost" href={`/app/candidate/${encodeURIComponent(target.id)}`}>Open Candidate 360</Link>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginTop: 12 }}>
                {reviewProfiles.map(profile => <div className="cta" key={profile.id} style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <b>{profile.displayName || 'Source identity'}</b>
                    <span className="status-pill">{sourceLabel(profile.source || 'source')}</span>
                    <span className={`status-pill ${profile.status === 'confirmed' ? 'success' : ''}`}>{profile.status || 'pending'}</span>
                  </div>
                  <div className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{[profile.headline, profile.organization, profile.location].filter(Boolean).join(' · ') || 'No additional normalized profile fields.'}</div>
                  {profile.profileUrl && <a href={profile.profileUrl} target="_blank" rel="noreferrer noopener" style={{ display: 'inline-block', marginTop: 8 }}>Open source profile ↗</a>}
                </div>)}
              </div>

              {!!review.reasons.length && <div style={{ marginTop: 12 }}><span className="kicker">Why SourcingOS proposed this review</span><div className="chips" style={{ marginTop: 7 }}>{review.reasons.slice(0, 8).map(reason => <span className="tag" key={reason}>{reason}</span>)}</div></div>}
              {!!review.conflicts.length && <div className="cta" style={{ marginTop: 12, marginBottom: 0 }}><b>Conflicts remain visible</b>{review.conflicts.slice(0, 5).map((conflict, index) => <div className="muted" style={{ marginTop: 5 }} key={index}>{conflictText(conflict)}</div>)}</div>}
            </div>
            <div className="product-row-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn secondary" disabled={working === review.id} onClick={() => void decide(review, 'rejected')}>Keep separate</button>
              <button className="btn" disabled={working === review.id} onClick={() => void decide(review, 'confirmed')}>Confirm same person</button>
            </div>
          </div>
        })}
        {!pending.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Identity inbox is clear</div><div className="product-row-meta">New deterministic cross-source anchors will create recruiter-review proposals as candidates are saved.</div></div></div>}
      </div>
    </section>

    {!!decided.length && <details className="advanced-disclosure product-panel"><summary>Recent identity decisions ({decided.length})</summary><div className="product-list" style={{ marginTop: 12 }}>{decided.map(review => <div className="product-row" key={review.id}><div className="product-row-main"><div className="product-row-title">{review.decision === 'confirmed' ? 'Confirmed same person' : 'Kept separate'}</div><div className="product-row-meta">Review score {review.score}/100 · {(review.reasons || []).slice(0, 2).join(' · ') || 'Identity review'}</div></div><span className={`status-pill ${review.decision === 'confirmed' ? 'success' : ''}`}>{review.decision}</span></div>)}</div></details>}
  </div>
}
