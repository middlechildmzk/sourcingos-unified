'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Dossier = any

function FreshnessChip({ label, days }: { label: string; days: number }) {
  const cls =
    days <= 7 ? 'fresh-fresh' :
    days <= 30 ? 'fresh-recent' :
    days <= 90 ? 'fresh-stale' :
    'fresh-unknown'
  return <span className={`freshness-chip ${cls}`}>⬤ {label} · {days}d</span>
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const cls =
    confidence === 'high' ? 'conf-high' :
    confidence === 'medium' ? 'conf-medium' :
    'conf-low'
  return <span className={cls}>{confidence}</span>
}

export function Candidate360Client({ candidateId }: { candidateId: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [status, setStatus] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      const res = await fetch(`/api/candidate-db/360/${candidateId}`)
      const json = await res.json()
      if (json.ok) {
        setDossier(json.dossier)
      } else {
        setStatus(json.error || 'Candidate not found')
      }
    } catch {
      setStatus('Failed to load candidate dossier')
    }
  }

  useEffect(() => { load() }, [candidateId])

  async function refresh() {
    setRefreshing(true)
    setStatus('Checking source freshness…')
    try {
      const res = await fetch('/api/candidate-db/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidateId }),
      })
      const json = await res.json()
      setStatus(json.ok ? json.note : json.error || 'Refresh failed')
      await load()
    } catch {
      setStatus('Refresh request failed')
    } finally {
      setRefreshing(false)
    }
  }

  if (!dossier) {
    return (
      <div className="interactive-tool">
        <div className="cta">{status || 'Loading Candidate 360…'}</div>
      </div>
    )
  }

  const c = dossier.candidate

  return (
    <div className="dossier">

      {/* ── Header: identity + scores ──────────────────────────── */}
      <div className="dossier-header">
        <div className="dossier-identity">
          <div>
            <h2 className="dossier-name">{c.canonicalName || 'Unconfirmed identity'}</h2>
            <p className="dossier-headline">
              {c.headline && <>{c.headline}</>}
              {c.location && <span style={{ color: 'var(--muted)' }}>{c.headline ? ' · ' : ''}{c.location}</span>}
            </p>
            <div className="dossier-meta">
              <FreshnessChip label={dossier.freshness.label} days={dossier.freshness.days} />
              {c.mergeStatus && (
                <span className="chip">{c.mergeStatus}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <button className="btn secondary" onClick={refresh} disabled={refreshing} style={{ fontSize: '13px', padding: '8px 14px' }}>
              {refreshing ? 'Checking…' : 'Check source freshness'}
            </button>
            <Link href="/app/candidate-database" className="btn ghost" style={{ fontSize: '13px', padding: '8px 14px' }}>
              ← All candidates
            </Link>
          </div>
        </div>

        {status && (
          <div className="preview-banner" style={{ marginBottom: '16px' }}>
            <span className="pb-icon">◈</span>
            <span>{status}</span>
          </div>
        )}

        {c.summary && <p style={{ margin: '0', color: 'var(--muted)', fontSize: '15px', lineHeight: '1.65' }}>{c.summary}</p>}

        <div className="dossier-scores" style={{ marginTop: '18px' }}>
          <div className="score-tile">
            <div className="st-val" style={{ color: 'var(--accent)' }}>{dossier.evidence?.length ?? 0}</div>
            <div className="st-label">Evidence items</div>
            <div className="st-note">Score {dossier.scores?.evidenceScore ?? 0}/100</div>
          </div>
          <div className="score-tile">
            <div className="st-val" style={{ color: 'var(--purple)' }}>{dossier.sourceProfiles?.length ?? 0}</div>
            <div className="st-label">Source profiles</div>
            <div className="st-note">Kept separate until confirmed</div>
          </div>
          <div className="score-tile">
            <div className="st-val" style={{ color: '#e6945a' }}>{dossier.scores?.bestContactScore ?? 0}</div>
            <div className="st-label">Contact signal</div>
            <div className="st-note">Unverified by default</div>
          </div>
          <div className="score-tile">
            <div className="st-val" style={{ color: 'var(--green)' }}>{dossier.scores?.openToWorkScore ?? 0}</div>
            <div className="st-label">Open-to-work signal</div>
            <div className="st-note">Signal, not a verified claim</div>
          </div>
        </div>
      </div>

      {/* ── Source profiles ────────────────────────────────────── */}
      <div className="dossier-section">
        <h2>
          Source profiles
          <span>{dossier.sourceProfiles?.length ?? 0} profiles · each kept separate until recruiter confirms</span>
        </h2>
        {dossier.sourceProfiles?.length ? (
          dossier.sourceProfiles.map((p: any) => (
            <div className="source-profile-row" key={p.id}>
              <div className="sp-head">
                <div>
                  <div className="sp-source">{p.source}</div>
                  <div className="sp-name">{p.displayName}</div>
                  <p className="sp-headline">
                    {p.headline}{p.organization ? ` · ${p.organization}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <span className="chip">{p.status || 'source profile'}</span>
                </div>
              </div>
              {p.matchReasons?.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Identity signals</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {p.matchReasons.map((r: string) => (
                      <span key={r} className="tag">{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {p.profileUrl && (
                <div style={{ marginTop: '10px' }}>
                  <a className="kicker" href={p.profileUrl} target="_blank" rel="noreferrer noopener">
                    Open source profile →
                  </a>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="muted" style={{ fontSize: '14px' }}>No source profiles attached yet.</p>
        )}
      </div>

      {/* ── Evidence matrix ────────────────────────────────────── */}
      <div className="dossier-section">
        <h2>
          Evidence matrix
          <span>{dossier.evidence?.length ?? 0} items — facts and signals observed from public sources</span>
        </h2>
        {dossier.evidence?.length ? (
          dossier.evidence.map((e: any) => (
            <div className="evidence-row" key={e.id}>
              <div className="evidence-meta">
                <span className="source-tag">{e.source}</span>
                <ConfidenceBadge confidence={e.confidence} />
              </div>
              <p className="evidence-label">{e.label}</p>
              <p className="evidence-detail">{e.detail}</p>
              {e.url && (
                <a className="kicker" href={e.url} target="_blank" rel="noreferrer noopener" style={{ marginTop: '8px', display: 'inline-block' }}>
                  Open evidence →
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="muted" style={{ fontSize: '14px' }}>No evidence items collected yet.</p>
        )}
      </div>

      {/* ── Contact signals ────────────────────────────────────── */}
      <div className="dossier-section">
        <h2>
          Contact signals
          <span>Unverified by default. Permission status unknown until confirmed.</span>
        </h2>
        <div className="preview-banner" style={{ marginBottom: '16px' }}>
          <span className="pb-icon">◈</span>
          <span>
            <strong>Research only.</strong> Contact signals are sourced from public data and are not
            verified. Do not treat as permission to contact. Do-not-contact suppresses contact score.
          </span>
        </div>
        {dossier.contacts?.length ? (
          dossier.contacts.map((ct: any) => (
            <div className="contact-row" key={ct.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                <span className="contact-unverified">⚠ Unverified</span>
                <span className="chip">{ct.score}/100 signal score</span>
              </div>
              <div className="contact-type">{ct.type}</div>
              <div className="contact-value">{ct.value}</div>
              <div className="contact-meta">
                Source: {ct.source} · Permission: {ct.permissionStatus || 'unknown'}
              </div>
            </div>
          ))
        ) : (
          <p className="muted" style={{ fontSize: '14px' }}>No contact signals collected yet.</p>
        )}
      </div>

      {/* ── Open-to-work signals ───────────────────────────────── */}
      <div className="dossier-section">
        <h2>
          Open-to-work signals
          <span>Signal strength, not a verified job-seeking claim</span>
        </h2>
        {dossier.openToWorkSignals?.length ? (
          dossier.openToWorkSignals.map((s: any) => (
            <div className="signal-row" key={s.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <ConfidenceBadge confidence={s.confidence} />
                <span className="chip">{s.score}/100 signal strength</span>
              </div>
              <p className="signal-label">{s.label}</p>
              <p className="signal-detail">{s.detail}</p>
              <p className="signal-caution">
                Requires recruiter review: {String(s.requiresReview)} ·
                Open-to-work is a signal, not a verified claim.
              </p>
            </div>
          ))
        ) : (
          <p className="muted" style={{ fontSize: '14px' }}>No open-to-work signals detected.</p>
        )}
      </div>

      {/* ── Verify next ────────────────────────────────────────── */}
      <div className="dossier-section">
        <h2>
          Verify next
          <span>Steps a recruiter should take before trusting this record</span>
        </h2>
        {dossier.verifyNext?.length ? (
          <ul className="verify-list">
            {dossier.verifyNext.map((v: string) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        ) : (
          <p className="muted" style={{ fontSize: '14px' }}>No verify-next steps generated yet.</p>
        )}
      </div>

      {/* ── Actions placeholder ────────────────────────────────── */}
      <div className="card">
        <span className="kicker">Next actions</span>
        <div className="grid two" style={{ marginTop: '12px' }}>
          <div>
            <strong style={{ fontSize: '14px' }}>Project fit</strong>
            <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>
              Project-specific fit scoring — available when project persistence is enabled.
            </p>
          </div>
          <div>
            <strong style={{ fontSize: '14px' }}>Outreach angle</strong>
            <p className="muted" style={{ fontSize: '13px', margin: '4px 0 0' }}>
              AI-generated HM pitch and outreach angle — available in AI Copilot layer (V20).
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
