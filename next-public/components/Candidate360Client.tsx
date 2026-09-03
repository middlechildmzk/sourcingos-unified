'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddToRoleButton } from '@/components/AddToRoleButton'
import { FindContactButton } from '@/components/FindContactButton'
import { RoleSpecificCandidateReview } from '@/components/RoleSpecificCandidateReview'
import type { CandidateDossier } from '@/lib/candidate-dossier'
import type { CandidateProfileSourceV36_14, CandidateProfessionalProfileV36_14 } from '@/lib/candidate-professional-profile-v36-14'

function FreshnessChip({ label, days }: { label: string; days: number }) {
  const cls = days <= 7 ? 'fresh-fresh' : days <= 30 ? 'fresh-recent' : days <= 90 ? 'fresh-stale' : 'fresh-unknown'
  return <span className={`freshness-chip ${cls}`}>● {label} · {days}d</span>
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const cls = confidence === 'high' ? 'conf-high' : confidence === 'medium' ? 'conf-medium' : 'conf-low'
  return <span className={cls}>{confidence}</span>
}

function words(value: string) { return value.replaceAll('_', ' ') }

function providerLabel(value?: string) {
  return String(value || 'unknown').split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function initials(name?: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return `${parts[0]?.[0] || ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''}`.toUpperCase()
}

function dateRange(startDate?: string, endDate?: string, current?: boolean) {
  const start = startDate || ''
  const end = current ? 'Present' : endDate || ''
  if (start && end) return `${start} – ${end}`
  return start || end || ''
}

function SourcePills({ sources }: { sources: CandidateProfileSourceV36_14[] }) {
  if (!sources.length) return null
  return <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
    {sources.slice(0, 5).map((source, index) => <span className="status-pill" key={`${source.source}:${source.sourceProfileId || index}`}>{providerLabel(source.source)}</span>)}
    {sources.length > 5 && <span className="muted" style={{ fontSize: 10 }}>+{sources.length - 5} sources</span>}
  </div>
}

function emptyProfessionalProfile(): CandidateProfessionalProfileV36_14 {
  return {
    summaries: [], experience: [], education: [], certifications: [], projects: [],
    structuredSourceCount: 0, sourceCount: 0,
    trustBoundary: 'No structured provider profile has been returned for this candidate yet.',
  }
}

export function Candidate360Client({ candidateId, roleId }: { candidateId: string; roleId?: string }) {
  const [dossier, setDossier] = useState<CandidateDossier | null>(null)
  const [status, setStatus] = useState('')
  const [working, setWorking] = useState('')

  const load = useCallback(async () => {
    try {
      const dossierRes = await fetch(`/api/candidate-db/360/${candidateId}`, { headers: { accept: 'application/json' } })
      const dossierJson = await dossierRes.json()
      if (!dossierRes.ok || !dossierJson.ok) throw new Error(dossierJson.error || 'Candidate not found.')

      let professionalProfile: CandidateProfessionalProfileV36_14 | undefined
      try {
        const profileRes = await fetch(`/api/candidate-db/professional-profile/${candidateId}`, { headers: { accept: 'application/json' } })
        const profileJson = await profileRes.json()
        if (profileRes.ok && profileJson.ok && profileJson.profile) professionalProfile = profileJson.profile as CandidateProfessionalProfileV36_14
      } catch { /* Candidate dossier remains usable if optional structured projection is unavailable. */ }

      setDossier({ ...(dossierJson.dossier as CandidateDossier), ...(professionalProfile ? { professionalProfile } : {}) })
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
  const professional = dossier.professionalProfile || emptyProfessionalProfile()
  const roleHref = roleId ? `/app/roles/${encodeURIComponent(roleId)}?tab=candidates` : ''
  const profileSummary = professional.summaries[0]?.text
  const candidateSummary = c.summary && !/^provider observation from /i.test(c.summary) ? c.summary : undefined
  const summary = profileSummary || candidateSummary

  const primaryContacts = useMemo(() => {
    const sorted = [...contacts]
      .filter(contact => contact.permissionStatus !== 'do_not_contact' && contact.value)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
    const byKind = new Map<string, typeof sorted[number]>()
    for (const contact of sorted) {
      const kind = contact.contactKind || contact.type || 'other'
      if (!byKind.has(kind)) byKind.set(kind, contact)
    }
    return [...byKind.values()].slice(0, 6)
  }, [contacts])

  const totalProfileSections = professional.experience.length + professional.education.length + professional.certifications.length + professional.projects.length

  return <div style={{ display: 'grid', gap: 14 }}>
    <style>{`
      .candidate-profile-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:16px;align-items:start}
      .candidate-avatar{width:64px;height:64px;border-radius:18px;display:grid;place-items:center;font-size:20px;font-weight:850;background:color-mix(in srgb,var(--accent) 16%,transparent);border:1px solid color-mix(in srgb,var(--accent) 32%,var(--border))}
      .candidate-profile-section h2{margin:3px 0 0}
      .candidate-timeline{display:grid;gap:0;margin-top:10px}
      .candidate-timeline-row{display:grid;grid-template-columns:18px minmax(0,1fr);gap:10px;padding:0 0 18px}
      .candidate-timeline-line{position:relative}
      .candidate-timeline-line:before{content:'';position:absolute;top:7px;left:7px;width:6px;height:6px;border-radius:999px;background:var(--accent)}
      .candidate-timeline-line:after{content:'';position:absolute;top:17px;bottom:-12px;left:9.5px;width:1px;background:var(--border)}
      .candidate-timeline-row:last-child .candidate-timeline-line:after{display:none}
      .candidate-profile-side{display:grid;gap:14;align-content:start}
      @media(max-width:850px){.candidate-profile-hero{grid-template-columns:auto 1fr}.candidate-profile-hero .product-page-actions{grid-column:1/-1}.candidate-profile-side{order:2}}
    `}</style>

    <section className="product-panel">
      <div className="candidate-profile-hero">
        <div className="candidate-avatar" aria-hidden="true">{initials(c.canonicalName)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="kicker">Candidate 360</span>
            <span className={`status-pill ${c.mergeStatus === 'source_verified' || c.mergeStatus === 'confirmed' ? 'success' : ''}`}>{words(c.mergeStatus || 'pending')}</span>
            {professional.structuredSourceCount > 0 && <span className="status-pill success">structured profile</span>}
          </div>
          <h1 style={{ margin: '5px 0 0' }}>{c.canonicalName || 'Unconfirmed identity'}</h1>
          <p style={{ margin: '6px 0 0', lineHeight: 1.55 }}>{[c.currentTitle || c.headline, c.currentCompany].filter(Boolean).join(' · ') || 'Professional profile'}</p>
          {c.location && <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>{c.location}</p>}
          <div className="chips" style={{ marginTop: 11 }}>{(c.skills || []).slice(0, 10).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>
        </div>
        <div className="product-page-actions">
          {roleId && <Link className="btn" href={roleHref}>Back to role queue</Link>}
          <Link className="btn ghost" href="/app/candidate-database">All candidates</Link>
          {!roleId && <AddToRoleButton candidate={{ candidateId, name: c.canonicalName || 'Unconfirmed identity', headline: c.headline, company: c.currentCompany, location: c.location, source: 'candidate_360', contactStatus: contacts.length ? 'signals_found' : 'unknown', evidenceStatus: evidence.length ? 'reviewed' : 'unreviewed', tags: Array.isArray(c.skills) ? c.skills : [] }} />}
        </div>
      </div>
      {status && <div className="cta" style={{ marginTop: 14, marginBottom: 0 }}>{status}</div>}
    </section>

    {roleId && <RoleSpecificCandidateReview roleId={roleId} candidateId={candidateId} />}

    <div className="product-summary-grid">
      <div className="product-stat"><small>Experience entries</small><b>{professional.experience.length}</b><span>{professional.structuredSourceCount ? `${professional.structuredSourceCount} structured source${professional.structuredSourceCount === 1 ? '' : 's'}` : 'Enrich to build chronology'}</span></div>
      <div className="product-stat"><small>Source profiles</small><b>{profiles.length}</b><span>Provenance stays attached</span></div>
      <div className="product-stat"><small>Contact paths</small><b>{contacts.length}</b><span>Best paths surfaced below</span></div>
      <div className="product-stat"><small>Freshness</small><b>{dossier.freshness?.days ?? 0}d</b><span><FreshnessChip label={dossier.freshness?.label || 'unknown'} days={dossier.freshness?.days ?? 999} /></span></div>
    </div>

    <div className="product-layout">
      <main style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel candidate-profile-section">
          <div className="product-panel-head"><div><span className="kicker">Professional profile</span><h2>Summary</h2></div>{professional.summaries[0] && <SourcePills sources={professional.summaries[0].sources} />}</div>
          {summary
            ? <p style={{ lineHeight: 1.7, marginBottom: 0 }}>{summary}</p>
            : <div className="cta" style={{ marginBottom: 0 }}><strong>No structured summary returned yet.</strong><p className="muted" style={{ margin: '5px 0 0', fontSize: 12 }}>Current identity fields are available, but SourcingOS will not invent a biography from titles or provider retrieval text.</p></div>}
          {professional.summaries.length > 1 && <details className="advanced-disclosure" style={{ marginTop: 12 }}><summary>Other source-observed summaries ({professional.summaries.length - 1})</summary><div className="product-list" style={{ marginTop: 10 }}>{professional.summaries.slice(1).map((item, index) => <div className="product-row" key={`${item.text}-${index}`}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.55 }}>{item.text}</div><SourcePills sources={item.sources} /></div></div>)}</div></details>}
        </section>

        <section className="product-panel candidate-profile-section">
          <div className="product-panel-head"><div><span className="kicker">Career history</span><h2>Experience</h2></div><span>{professional.experience.length ? `${professional.experience.length} observed entr${professional.experience.length === 1 ? 'y' : 'ies'}` : 'Not returned'}</span></div>
          {professional.experience.length ? <div className="candidate-timeline">{professional.experience.map(item => <div className="candidate-timeline-row" key={item.id}>
            <div className="candidate-timeline-line" />
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div><strong style={{ fontSize: 15 }}>{item.title || 'Role not returned'}</strong>{item.company && <div style={{ marginTop: 2 }}>{item.company}</div>}</div>
                {dateRange(item.startDate, item.endDate, item.current) && <span className="muted" style={{ fontSize: 12 }}>{dateRange(item.startDate, item.endDate, item.current)}</span>}
              </div>
              {item.location && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{item.location}</div>}
              {item.description && <p className="muted" style={{ fontSize: 12, lineHeight: 1.6, margin: '7px 0 0' }}>{item.description}</p>}
              <SourcePills sources={item.sources} />
            </div>
          </div>)}</div> : <div className="cta" style={{ marginBottom: 0 }}><strong>Chronology not available from the saved source yet.</strong><p className="muted" style={{ margin: '5px 0 0', fontSize: 12 }}>Current role can still be shown above. Years of experience remain unknown until dated source history is returned.</p></div>}
        </section>

        <section className="product-panel candidate-profile-section">
          <div className="product-panel-head"><div><span className="kicker">Capabilities</span><h2>Skills & expertise</h2></div><span>{(c.skills || []).length} observed</span></div>
          {(c.skills || []).length
            ? <div className="chips">{(c.skills || []).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>
            : <p className="muted" style={{ marginBottom: 0 }}>No normalized skills returned by the attached source profiles yet.</p>}
        </section>

        {(professional.education.length > 0 || professional.certifications.length > 0) && <section className="product-panel candidate-profile-section">
          <div className="product-panel-head"><div><span className="kicker">Credentials</span><h2>Education & certifications</h2></div><span>{professional.education.length + professional.certifications.length} observed</span></div>
          {!!professional.education.length && <div className="product-list">{professional.education.map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.school || 'Institution not returned'}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{[item.degree, item.field].filter(Boolean).join(' · ') || 'Education observation'}{dateRange(item.startDate, item.endDate) ? ` · ${dateRange(item.startDate, item.endDate)}` : ''}</div>{item.description && <div className="product-row-meta" style={{ whiteSpace: 'normal', marginTop: 4 }}>{item.description}</div>}<SourcePills sources={item.sources} /></div></div>)}</div>}
          {!!professional.certifications.length && <div style={{ marginTop: professional.education.length ? 16 : 0 }}><span className="kicker">Certifications</span><div className="product-list" style={{ marginTop: 7 }}>{professional.certifications.map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.name}</div><div className="product-row-meta">{[item.issuer, item.issuedAt ? `Issued ${item.issuedAt}` : '', item.expiresAt ? `Expires ${item.expiresAt}` : ''].filter(Boolean).join(' · ')}</div><SourcePills sources={item.sources} /></div>{item.credentialUrl && <a className="btn ghost" href={item.credentialUrl} target="_blank" rel="noreferrer noopener">Credential</a>}</div>)}</div></div>}
        </section>}

        {!!professional.projects.length && <section className="product-panel candidate-profile-section">
          <div className="product-panel-head"><div><span className="kicker">Public / professional work</span><h2>Projects</h2></div><span>{professional.projects.length}</span></div>
          <div className="product-list">{professional.projects.map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.name}</div>{item.description && <div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{item.description}</div>}<div className="chips">{(item.technologies || []).map(technology => <span className="tag" key={technology}>{technology}</span>)}</div><SourcePills sources={item.sources} /></div>{item.url && <a className="btn ghost" href={item.url} target="_blank" rel="noreferrer noopener">Open</a>}</div>)}</div>
        </section>}

        <section className="product-panel candidate-profile-section">
          <div className="product-panel-head"><div><span className="kicker">Contact intelligence</span><h2>Best available contact paths</h2></div><span>{contacts.length} total signals</span></div>
          <div className="cta"><b>Research state.</b> Best available does not mean ownership, deliverability, permission, or currentness has been conclusively verified.</div>
          {primaryContacts.length ? <div className="product-list">{primaryContacts.map(contact => <div className="product-row" key={contact.id}><div className="product-row-main"><div className="product-row-title">{words(contact.contactKind || contact.type || 'contact')}</div><div style={{ fontSize: 14, fontWeight: 750, marginTop: 3, wordBreak: 'break-word' }}>{contact.value}</div><div className="product-row-meta">{providerLabel(contact.source)} · permission {contact.permissionStatus || 'unknown'} · support {contact.score ?? 0}/100</div></div><ConfidenceBadge confidence={contact.confidence || 'medium'} /></div>)}</div> : <p className="muted">No saved contact path yet.</p>}
          <div className="button-row" style={{ marginTop: 12 }}><FindContactButton isAuthenticated={true} source={{ candidateId, displayName: c.canonicalName, headline: c.headline, organization: c.currentCompany, location: c.location, source: 'github' }} /></div>
          {contacts.length > primaryContacts.length && <details className="advanced-disclosure" style={{ marginTop: 12 }}><summary>Other contact signals ({contacts.length - primaryContacts.length})</summary><div className="product-list" style={{ marginTop: 10 }}>{contacts.filter(contact => !primaryContacts.some(primary => primary.id === contact.id)).map(contact => <div className="product-row" key={contact.id}><div className="product-row-main"><div className="product-row-title">{contact.type || 'signal'}: {contact.value || 'value unavailable'}</div><div className="product-row-meta">{providerLabel(contact.source)} · permission {contact.permissionStatus || 'unknown'} · signal {contact.score ?? 0}/100</div></div></div>)}</div></details>}
        </section>

        <details className="advanced-disclosure product-panel">
          <summary>Evidence & source provenance ({evidence.length} evidence · {profiles.length} profiles)</summary>
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.55 }}>This is the audit layer behind the recruiter-facing profile. Provider observations remain reviewable evidence; they are not hidden or discarded when the profile view coalesces exact duplicate display entries.</p>
          <div className="product-panel-head" style={{ marginTop: 14 }}><div><span className="kicker">Source profiles</span><h3 style={{ margin: '3px 0 0' }}>{profiles.length} attached</h3></div></div>
          <div className="product-list">{profiles.map(profile => <div className="product-row" key={profile.id}><div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><div className="product-row-title">{profile.displayName || c.canonicalName || 'Unconfirmed identity'}</div>{profile.source && <span className="status-pill">{providerLabel(profile.source)}</span>}<span className={`status-pill ${profile.status === 'confirmed' ? 'success' : ''}`}>{profile.status || 'pending'}</span></div><div className="product-row-meta">{[profile.headline, profile.organization, profile.location].filter(Boolean).join(' · ') || 'Professional source profile'}</div><div className="chips">{(profile.matchReasons || []).slice(0, 4).map(reason => <span className="tag" key={reason}>{reason}</span>)}</div></div>{profile.profileUrl ? <a className="btn ghost" href={profile.profileUrl} target="_blank" rel="noreferrer noopener">Open</a> : null}</div>)}</div>
          <div className="product-panel-head" style={{ marginTop: 18 }}><div><span className="kicker">Raw evidence observations</span><h3 style={{ margin: '3px 0 0' }}>{evidence.length} retained</h3></div></div>
          <div className="product-list">{evidence.slice(0, 25).map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><div className="product-row-title">{item.label || 'Evidence item'}</div><ConfidenceBadge confidence={item.confidence || 'medium'} />{item.source && <span className="status-pill">{providerLabel(item.source)}</span>}</div><div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{item.detail || 'No additional detail returned.'}</div></div>{item.url ? <a className="btn ghost" href={item.url} target="_blank" rel="noreferrer noopener">Source</a> : null}</div>)}</div>
          {evidence.length > 25 && <details className="advanced-disclosure" style={{ marginTop: 10 }}><summary>Show {evidence.length - 25} more raw evidence observations</summary><div className="product-list" style={{ marginTop: 10 }}>{evidence.slice(25).map(item => <div className="product-row" key={item.id}><div className="product-row-main"><div className="product-row-title">{item.label || 'Evidence item'}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item.detail || 'No additional detail returned.'}</div></div></div>)}</div></details>}
        </details>
      </main>

      <aside className="candidate-profile-side">
        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Recruiter actions</span><h2>Next actions</h2></div></div>
          <div className="button-row" style={{ margin: 0 }}>
            <button className="btn secondary" disabled={!!working} onClick={() => void runAction('Checking source freshness…', () => fetch('/api/candidate-db/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ candidateId }) }))}>Check freshness</button>
            <button className="btn secondary" disabled={!!working} onClick={() => void runAction('Queueing deeper enrichment…', () => fetch('/api/candidate-acquisition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'queue_enrichment', candidateIds: [candidateId] }) }))}>Enrich</button>
            <button className="btn secondary" disabled={!!working} onClick={() => void runAction('Extracting graph relationships…', () => fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'extract_graph', candidateId }) }))}>Build graph</button>
          </div>
        </section>

        <section className="product-panel"><div className="product-panel-head"><div><span className="kicker">Trust checklist</span><h2>Verify next</h2></div><span>Before outreach / submit</span></div><div className="product-list">{(dossier.verifyNext || []).map((item, index) => <div className="product-row" key={`${item}-${index}`}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{item}</div></div></div>)}</div></section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Profile coverage</span><h2>What SourcingOS knows</h2></div></div>
          <div className="product-list">
            <div className="product-row"><div className="product-row-main"><div className="product-row-title">Structured sources</div><div className="product-row-meta">{professional.structuredSourceCount} of {profiles.length || professional.sourceCount || 0} attached profiles currently carry normalized chronology/profile sections.</div></div></div>
            <div className="product-row"><div className="product-row-main"><div className="product-row-title">Profile sections</div><div className="product-row-meta">{totalProfileSections} experience / education / certification / project observations available for recruiter review.</div></div></div>
            <div className="product-row"><div className="product-row-main"><div className="product-row-title">Evidence retained</div><div className="product-row-meta">{evidence.length} raw observations remain available under Evidence & source provenance.</div></div></div>
          </div>
          <p className="muted" style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 0 }}>{professional.trustBoundary}</p>
        </section>

        {!!availability.length && <details className="advanced-disclosure product-panel">
          <summary>Availability signals ({availability.length})</summary>
          <p className="muted" style={{ fontSize: 11 }}>Availability language is a reviewable signal, not a verified job-seeking claim.</p><div className="product-list">{availability.map(signal => <div className="product-row" key={signal.id}><div className="product-row-main"><div className="product-row-title">{signal.label || 'Availability signal'}</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{signal.detail || 'No additional detail returned.'}</div></div><span className="status-pill">{signal.score ?? 0}/100</span></div>)}</div>
        </details>}

        {!!reviews.length && <details className="advanced-disclosure product-panel"><summary>Identity decisions ({reviews.length})</summary><div className="product-list">{reviews.map(review => <div className="product-row" key={review.id}><div className="product-row-main"><div className="product-row-title">{words(review.decision || 'pending')} · {review.score ?? 0}/100</div><div className="product-row-meta">{(review.reasons || []).join(' · ') || 'Identity review'}</div></div></div>)}</div></details>}
      </aside>
    </div>
  </div>
}
