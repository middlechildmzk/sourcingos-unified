'use client'

import { useEffect, useState } from 'react'
import type { Candidate360ResolvedProfileV35, ResolvedCandidateFieldV35, ResolvedContactV35 } from '@/lib/candidate-field-resolution-v35'

function words(value: string) { return value.replaceAll('_', ' ') }

function stateClass(state: string) {
  if (state === 'resolved') return 'success'
  if (state === 'needs_review' || state === 'resolved_with_conflict') return 'warning'
  return ''
}

function FieldCard({ label, field }: { label: string; field: ResolvedCandidateFieldV35 }) {
  return <div className="cta" style={{ margin: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="kicker">{label}</span>
      <span className={`status-pill ${stateClass(field.state)}`}>{words(field.state)}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 750, marginTop: 7 }}>{field.value || 'Unknown'}</div>
    <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
      {field.winningSource ? `Selected from ${words(field.winningSource)}` : 'No winning source'} · {field.sourceCount} supporting source{field.sourceCount === 1 ? '' : 's'}
    </div>
    {!!field.rationale.length && <div className="muted" style={{ fontSize: 10, lineHeight: 1.45, marginTop: 7 }}>{field.rationale.slice(0, 2).join(' ')}</div>}
    {!!field.alternatives.length && <details className="advanced-disclosure" style={{ marginTop: 8 }}><summary>{field.alternatives.length} competing observation{field.alternatives.length === 1 ? '' : 's'}</summary><div className="product-list" style={{ marginTop: 8 }}>{field.alternatives.slice(0, 5).map(item => <div className="product-row" key={item.observationId}><div className="product-row-main"><div className="product-row-title">{item.value}</div><div className="product-row-meta">{words(item.source)} · {item.reasonNotSelected}</div></div></div>)}</div></details>}
  </div>
}

function EmailCard({ email }: { email: ResolvedContactV35 }) {
  return <div className="cta" style={{ margin: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="kicker">Primary work email signal</span>
      <span className={`status-pill ${stateClass(email.state)}`}>{words(email.state)}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 750, marginTop: 7 }}>{email.value}</div>
    <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{words(email.source)} · {email.sourceCount} source{email.sourceCount === 1 ? '' : 's'} · {email.verified ? 'provider-marked verified' : 'unverified'} · permission {words(email.permissionStatus)}</div>
    <div className="muted" style={{ fontSize: 10, lineHeight: 1.45, marginTop: 7 }}>{email.rationale.slice(0, 2).join(' ')}</div>
  </div>
}

export function CandidateFieldResolutionV36_10({ candidateId }: { candidateId: string }) {
  const [profile, setProfile] = useState<Candidate360ResolvedProfileV35 | null>(null)
  const [status, setStatus] = useState('Loading resolved profile…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/candidate-db/360/${encodeURIComponent(candidateId)}`, { headers: { accept: 'application/json' } })
        const json = await response.json()
        if (!response.ok || !json?.ok) throw new Error(json?.error || 'Could not resolve Candidate 360 fields.')
        if (!cancelled) {
          setProfile(json?.dossier?.resolvedProfile || null)
          setStatus(json?.dossier?.resolvedProfile ? '' : 'No resolved profile is available yet.')
        }
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : 'Could not resolve Candidate 360 fields.')
      }
    })()
    return () => { cancelled = true }
  }, [candidateId])

  if (!profile) return <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Canonical profile resolution</span><h2>Resolved Candidate 360</h2></div></div><p className="muted">{status}</p></section>

  const fields = [
    ['Name', profile.name],
    ['Current title', profile.currentTitle],
    ['Current company', profile.currentCompany],
    ['Location', profile.location],
    ['Headline', profile.headline],
  ] as const

  return <section className="product-panel">
    <div className="product-panel-head">
      <div><span className="kicker">Canonical profile resolution</span><h2>Resolved Candidate 360</h2></div>
      <span>{profile.conflictCount} conflict{profile.conflictCount === 1 ? '' : 's'} · {profile.reviewCount} field{profile.reviewCount === 1 ? '' : 's'} need review</span>
    </div>
    <div className="cta" style={{ marginBottom: 14 }}><b>Source-aware, not source-destructive.</b> SourcingOS resolves the best display value from attached observations while preserving every competing source value underneath it. This presentation layer never authorizes an identity merge or outreach.</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
      {fields.map(([label, field]) => <FieldCard key={label} label={label} field={field} />)}
      {profile.primaryWorkEmail && <EmailCard email={profile.primaryWorkEmail} />}
    </div>
  </section>
}
