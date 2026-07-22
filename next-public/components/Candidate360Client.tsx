'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AddToRoleButton } from '@/components/AddToRoleButton'
import { FindContactButton } from '@/components/FindContactButton'

type Dossier = any

function FreshnessChip({ label, days }: { label: string; days: number }) {
  const cls = days <= 7 ? 'fresh-fresh' : days <= 30 ? 'fresh-recent' : days <= 90 ? 'fresh-stale' : 'fresh-unknown'
  return <span className={`freshness-chip ${cls}`}>● {label} · {days}d</span>
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const cls = confidence === 'high' ? 'conf-high' : confidence === 'medium' ? 'conf-medium' : 'conf-low'
  return <span className={cls}>{confidence}</span>
}

function words(value: string) { return value.replaceAll('_', ' ') }

export function Candidate360Client({ candidateId }: { candidateId: string }) {
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidate-db/360/${candidateId}`, { headers: { accept: 'application/json' } })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Candidate not found.')
      setDossier(json.dossier)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load candidate dossier.')
    }
  }, [candidateId])

  useEffect(() => { void load() }, [load])

  async function runAction(label: string, request: () => Promise<Response>) {
    setWorking(label)
    setStatus(label)
    try {
      const res = await request()
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Action failed.')
      setStatus(json.note || 'Done.')
      await load()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Action failed.')
    } finally {
      setWorking('')
    }
  }

  if (!dossier) return <div className="product-panel"><p className="muted">{status || 'Loading Candidate 360…'}</p></div>

  const c = dossier.candidate
  const evidence = Array.isArray(dossier.evidence) ? dossier.evidence : []
  const profiles = Array.isArray(dossier.sourceProfiles) ? dossier.sourceProfiles : []
  const contacts = Array.isArray(dossier.contacts) ? dossier.contacts : []
  const availability = Array.isArray(dossier.openToWorkSignals) ? dossier.openToWorkSignals : []
  const reviews = Array.isArray(dossier.matchReviews) ? dossier.matchReviews : []

  return <div style={{ display: 'grid', gap: 14 }}>
    <section className="product-panel">
      <div className="product-page-head" style={{ marginBottom: 16 }}>
        <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="kicker">Candidate 360</span><span className={`status-pill ${c.mergeStatus === 'source_verified' || c.mergeStatus === 'confirmed' ? 'success' : ''}`}>{words(c.mergeStatus || 'pending')}</span></div><h1 style={{ marginTop: 4 }}>{c.canonicalName || 'Unconfirmed identity'}</h1><p>{[c.headline, c.currentCompany, c.location].filter(Boolean).join(' · ') || 'Candidate intelligence record'}</p></div>
        <div className="product-page-actions"><Link className="btn ghost" href="/app/candidate-database">All candidates</Link><AddToRoleButton candidate={{ candidateId, name: c.canonicalName || 'Unconfirmed identity', headline: c.headline, company: c.currentCompany, location: c.location, source: 'candidate_360', contactStatus: contacts.length ? 'signals_found' : 'unknown', evidenceStatus: evidence.length ? 'reviewed' : 'unreviewed', tags: Array.isArray(c.skills) ? c.skills : [] }} /></div>
      </div>
      {c.summary && <p className="muted" style={{ maxWidth: 900, lineHeight: 1.65, fontSize: 13 }}>{c.summary}</p>}
      <div className="chips" style={{ marginTop: 12 }}>{(c.skills || []).slice(0, 12).map((skill: string) => <span className="tag" key={skill}>{skill}</span>)}</div>
      <div className="button-row" style={{ marginTop: 16 }}><button className="btn secondary" disabled={!!working} onClick={() => void runAction('Checking source freshness…', () => fetch('/api/candidate-db/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ candidateId }) }))}>Check freshness</button><button className="btn secondary" disabled={!!working} onClick={() => void runAction('Queueing deeper enrichment…', () => fetch('/api/candidate-acquisition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'queue_enrichment', candidateIds: [candidateId] }) }))}>Enrich</button><button className="btn secondary" disabled={!!working} onClick={() => void runAction('Extracting graph relationships…', () => fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'extract_graph', candidateId }) }))}>Build graph</button></div>
      {status && <div className="cta" style={{ marginTop: 14, marginBottom: 0 }}>{status}</div>}
    </section>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Evidence</small><b>{evidence.length}</b><span>Score {dossier.scores?.evidenceScore ?? 0}/100</span></div>
      <div className="product-stat"><small>Source profiles</small><b>{profiles.length}</b><span>Kept separate until confirmed</span></div>
      <div className="product-stat"><small>Contact signal</small><b>{dossier.scores?.bestContactScore ?? 0}</b><span>Unverified by default</span></div>
      <div className="product-stat"><small>Freshness</small><b>{dossier.freshness?.days ?? 0}d</b><span><FreshnessChip label={dossier.freshness?.label || 'unknown'} days={dossier.freshness?.days ?? 999} /></span></div>
    </div>

    <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Evidence-first review</span><h2>Professional evidence</h2></div><span>{evidence.length} items</span></div>
          <div className="product-list">{evidence.slice(0, 25).map((item: any) => <div className="product-row" key={item.id}><div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><div className="product-row-title">{item.label}</div><ConfidenceBadge confidence={item.confidence || 'medium'} /><span className="status-pill">{item.source}</span></div><div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{item.detail}</div></div>{item.url ? <a className="btn ghost" href={item.url} target="_blank" rel="noreferrer noopener">Source</a> : null}</div>)}{!evidence.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No evidence collected yet</div><div className="product-row-meta">Queue enrichment or attach a source profile before evaluating this record.</div></div></div>}</div>
          {evidence.length > 25 && <details className="advanced-disclosure"><summary>Show {evidence.length - 25} additional evidence items</summary><div className="product-list" style={{ marginTop: 12 }}>{evidence.slice(25).map((item: any) => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.label}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item.detail}</div></div></div>)}</div></details>}
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Identity provenance</span><h2>Source profiles</h2></div><span>{profiles.length} profiles</span></div>
          <div className="product-list">{profiles.map((profile: any) => <div className="product-row" key={profile.id}><div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><div className="product-row-title">{profile.displayName || c.canonicalName}</div><span className="status-pill">{profile.source}</span><span className={`status-pill ${profile.status === 'confirmed' ? 'success' : ''}`}>{profile.status || 'pending'}</span></div><div className="product-row-meta">{[profile.headline, profile.organization, profile.location].filter(Boolean).join(' · ') || 'Public source profile'}</div><div className="chips">{(profile.matchReasons || []).slice(0, 4).map((reason: string) => <span className="tag" key={reason}>{reason}</span>)}</div></div>{profile.profileUrl ? <a className="btn ghost" href={profile.profileUrl} target="_blank" rel="noreferrer noopener">Open</a> : null}</div>)}{!profiles.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No source profiles</div><div className="product-row-meta">This candidate needs provenance before identity or fit decisions.</div></div></div>}</div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel"><div className="product-panel-head"><h2>Verify next</h2><span>Before outreach or presentation</span></div><div className="product-list">{(dossier.verifyNext || []).map((item: string, index: number) => <div className="product-row" key={`${item}-${index}`}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{item}</div></div></div>)}</div></section>

        <details className="advanced-disclosure product-panel">
          <summary>Contact research ({contacts.length})</summary>
          <div className="cta" style={{ marginTop: 12 }}><b>Research only.</b> A contact signal is not verification or permission to contact.</div><div className="product-list">{contacts.map((contact: any) => <div className="product-row" key={contact.id}><div className="product-row-main"><div className="product-row-title">{contact.type}: {contact.value}</div><div className="product-row-meta">{contact.source} · permission {contact.permissionStatus || 'unknown'} · signal {contact.score}/100</div></div><ConfidenceBadge confidence={contact.confidence || 'medium'} /></div>)}</div><div style={{ marginTop: 14 }}><FindContactButton isAuthenticated={true} source={{ candidateId, displayName: c.canonicalName, headline: c.headline, organization: c.currentCompany, location: c.location, source: 'github' }} /></div>
        </details>

        <details className="advanced-disclosure product-panel">
          <summary>Availability signals ({availability.length})</summary>
          <p className="muted" style={{ fontSize: 11 }}>Availability language is a reviewable signal, not a verified job-seeking claim.</p><div className="product-list">{availability.map((signal: any) => <div className="product-row" key={signal.id}><div className="product-row-main"><div className="product-row-title">{signal.label}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{signal.detail}</div></div><span className="status-pill">{signal.score}/100</span></div>)}</div>
        </details>

        {!!reviews.length && <details className="advanced-disclosure product-panel"><summary>Identity decisions ({reviews.length})</summary><div className="product-list">{reviews.map((review: any) => <div className="product-row" key={review.id}><div className="product-row-main"><div className="product-row-title">{words(review.decision || 'pending')} · {review.score}/100</div><div className="product-row-meta">{(review.reasons || []).join(' · ') || 'Identity review'}</div></div></div>)}</div></details>}
      </aside>
    </div>
  </div>
}
