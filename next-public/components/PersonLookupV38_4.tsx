'use client'

import Link from 'next/link'
import { FormEvent, useMemo, useState } from 'react'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import styles from './PersonLookupV38_4.module.css'

type GraphCandidate = {
  id: string
  canonicalName: string
  headline?: string
  currentTitle?: string
  currentCompany?: string
  location?: string
  skills?: string[]
  absorbedIdentityCount?: number
}

type ProfileUrl = { kind: string; url: string }
type LiveObservation = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills?: string[]
  profileUrls?: ProfileUrl[]
  contactAvailability?: { email?: boolean | 'unknown'; phone?: boolean | 'unknown' }
  identityCluster?: { sourceCount: number; providers: string[]; persistentMergePerformed: false }
}
type SignedObservation = { observation: LiveObservation; observationSignature: string }
type ContactSignal = { type: string; channelKind?: string; value: string; sourceProvider?: string; deliverability?: string; permissionStatus?: string }
type LookupStatus = 'graph' | 'live' | 'contacts' | 'saving' | ''

function externalProfiles(person: LiveObservation) {
  return (person.profileUrls || []).filter(item => /^https?:\/\//i.test(item.url)).slice(0, 6)
}

function identityPayload(person: LiveObservation) {
  const linkedinUrl = person.profileUrls?.find(item => item.kind === 'linkedin')?.url
  const githubUrl = person.profileUrls?.find(item => item.kind === 'github')?.url
  return {
    providerName: person.provider,
    providerPersonId: person.providerPersonId,
    fullName: person.displayName,
    title: person.currentTitle || person.headline,
    currentCompany: person.currentEmployer,
    location: person.location,
    profileUrl: linkedinUrl || githubUrl || person.profileUrls?.[0]?.url,
    linkedinUrl,
    githubUrl,
    sourceContext: 'person_lookup_v38_4',
  }
}

export function PersonLookupV38_4({ initialQuery = '', roleId }: { initialQuery?: string; roleId?: string }) {
  const { roles, updateRole } = useRoleWorkspaces()
  const role = roleId ? roles.find(item => item.id === roleId) : undefined
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<LookupStatus>('')
  const [graphCandidates, setGraphCandidates] = useState<GraphCandidate[]>([])
  const [live, setLive] = useState<LiveObservation[]>([])
  const [signed, setSigned] = useState<SignedObservation[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [contactSignals, setContactSignals] = useState<Record<string, ContactSignal[]>>({})
  const [contactConfirm, setContactConfirm] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Record<string, string>>({})

  const exactPrompt = useMemo(() => query.trim(), [query])

  async function searchGraph(event?: FormEvent) {
    event?.preventDefault()
    const value = query.trim()
    if (!value || status) return
    setError(''); setSearched(true); setStatus('graph'); setLive([]); setSigned([])
    try {
      const response = await fetch(`/api/candidate-db/list?q=${encodeURIComponent(value)}&limit=20`, { cache: 'no-store', headers: { accept: 'application/json' } })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || 'Candidate Graph lookup failed.')
      setGraphCandidates(Array.isArray(json.candidates) ? json.candidates.filter((item: GraphCandidate & { entityKind?: string }) => !item.entityKind || item.entityKind === 'person') : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Candidate Graph lookup failed.')
    } finally { setStatus('') }
  }

  async function searchLive() {
    const value = query.trim()
    if (!value || status) return
    setError(''); setStatus('live')
    try {
      const planResponse = await fetch('/api/agent-runtime/plan', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ message: `Find this specific person, not a broad candidate population: ${value}. Use the name, employer, email, or professional profile URL as identity lookup context.` }),
      })
      const planJson = await planResponse.json().catch(() => ({}))
      if (!planResponse.ok || !planJson.ok || !planJson.plan) throw new Error(planJson.error || 'SourcingOS could not interpret this person lookup.')
      const plan = planJson.plan as { action?: string; providerRequest?: Record<string, unknown> }
      if (plan.action !== 'search_people' || !plan.providerRequest) throw new Error('This lookup did not resolve to a people-search plan. Add a name, company, email, or professional profile URL.')
      const response = await fetch('/api/candidate-data/search', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ...plan.providerRequest, query: value, limit: 12 }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || 'Live person lookup failed.')
      setLive(Array.isArray(json.observations) ? json.observations : [])
      setSigned(Array.isArray(json.reviewObservations) ? json.reviewObservations : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Live person lookup failed.')
    } finally { setStatus('') }
  }

  function signedFor(person: LiveObservation) {
    return signed.find(item => item.observation.provider === person.provider && item.observation.providerPersonId === person.providerPersonId)
  }

  function attachToRole(candidateId: string, person: { name: string; headline?: string; company?: string; location?: string; source?: string }) {
    if (!roleId) return
    updateRole(roleId, workspace => {
      const now = new Date().toISOString()
      const existing = workspace.candidates.find(item => item.candidateId === candidateId)
      const nextCandidate = {
        id: existing?.id || `candidate:${candidateId}`,
        candidateId,
        name: person.name,
        headline: person.headline || '',
        company: person.company || '',
        location: person.location || '',
        source: person.source || 'candidate_graph',
        stage: existing?.stage || 'needs_review' as const,
        fitDecision: existing?.fitDecision || 'unreviewed' as const,
        fitReasons: existing?.fitReasons || [],
        concerns: existing?.concerns || [],
        tags: existing?.tags || [],
        contactStatus: existing?.contactStatus || 'unknown' as const,
        evidenceStatus: existing?.evidenceStatus || 'unreviewed' as const,
        addedAt: existing?.addedAt || now,
        updatedAt: now,
      }
      return { ...workspace, candidates: existing ? workspace.candidates.map(item => item.id === existing.id ? nextCandidate : item) : [nextCandidate, ...workspace.candidates], updatedAt: now }
    })
  }

  async function saveLive(person: LiveObservation) {
    const key = `${person.provider}:${person.providerPersonId}`
    if (savedIds[key] || status) return savedIds[key]
    const verified = signedFor(person)
    if (!verified) { setError('This live observation is reviewable but was not server-signed for durable saving.'); return undefined }
    setStatus('saving'); setError('')
    try {
      const response = await fetch('/api/candidate-data/save', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ observation: verified.observation, observationSignature: verified.observationSignature }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Candidate save failed.')
      const candidateId = String(json.candidateId)
      setSavedIds(current => ({ ...current, [key]: candidateId }))
      attachToRole(candidateId, { name: person.displayName, headline: person.currentTitle || person.headline, company: person.currentEmployer, location: person.location, source: person.provider })
      return candidateId
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Candidate save failed.')
      return undefined
    } finally { setStatus('') }
  }

  async function findStoredContacts(candidate: GraphCandidate) {
    if (status) return
    const key = `graph:${candidate.id}`
    if (contactConfirm !== key) { setContactConfirm(key); return }
    setStatus('contacts'); setError('')
    try {
      const response = await fetch('/api/contact-enrichment/find', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ purpose: 'contact_bundle', candidateId: candidate.id, fullName: candidate.canonicalName, title: candidate.currentTitle || candidate.headline, currentCompany: candidate.currentCompany, location: candidate.location, sourceContext: 'person_lookup_graph_v38_4' }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || 'Contact lookup failed.')
      setContactSignals(current => ({ ...current, [key]: Array.isArray(json.signals) ? json.signals : [] }))
      setContactConfirm(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Contact lookup failed.') } finally { setStatus('') }
  }

  async function findLiveContacts(person: LiveObservation) {
    if (status) return
    const key = `${person.provider}:${person.providerPersonId}`
    if (contactConfirm !== key) { setContactConfirm(key); return }
    setStatus('contacts'); setError('')
    try {
      const response = await fetch('/api/contact-enrichment/find', {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ purpose: 'contact_bundle', ...identityPayload(person) }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || 'Contact lookup failed.')
      setContactSignals(current => ({ ...current, [key]: Array.isArray(json.signals) ? json.signals : [] }))
      setContactConfirm(null)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Contact lookup failed.') } finally { setStatus('') }
  }

  return <div className={styles.workspace}>
    <section className={styles.hero}>
      <span className={styles.kicker}>Known-person lookup</span>
      <h1>Find one person, resolve the profile, then act.</h1>
      <p>Start with SourcingOS’s Candidate Graph. If the person is not already there, search live connected sources. Contact enrichment remains an explicit recruiter-approved action.</p>
      {role && <div className={styles.role}>Saving a person will also attach them to <strong>{role.intake.title}</strong>.</div>}
      <form onSubmit={searchGraph} className={styles.searchForm}>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name · company · email · LinkedIn/GitHub/profile URL" autoFocus />
        <button type="submit" disabled={!exactPrompt || Boolean(status)}>{status === 'graph' ? 'Searching…' : 'Search Candidate Graph'}</button>
      </form>
      <div className={styles.liveRow}><span>Need broader coverage or a fresh identity?</span><button type="button" onClick={searchLive} disabled={!exactPrompt || Boolean(status)}>{status === 'live' ? 'Searching live sources…' : 'Search live sources'}</button></div>
      {error && <div className={styles.error}>{error}</div>}
    </section>

    {searched && <section className={styles.results}>
      <div className={styles.sectionHead}><div><span>Candidate Graph</span><strong>{graphCandidates.length} match{graphCandidates.length === 1 ? '' : 'es'}</strong></div>{graphCandidates.length === 0 && <small>No stored person matched this lookup yet.</small>}</div>
      <div className={styles.cards}>{graphCandidates.map(candidate => {
        const key = `graph:${candidate.id}`
        const signals = contactSignals[key] || []
        return <article key={candidate.id} className={styles.card}>
          <div className={styles.cardTop}><div><h2>{candidate.canonicalName}</h2><p>{[candidate.currentTitle || candidate.headline, candidate.currentCompany, candidate.location].filter(Boolean).join(' · ') || 'Professional details not yet complete'}</p></div>{candidate.absorbedIdentityCount ? <span className={styles.fused}>{candidate.absorbedIdentityCount + 1} identities</span> : null}</div>
          {candidate.skills?.length ? <div className={styles.skills}>{candidate.skills.slice(0, 8).map(skill => <span key={skill}>{skill}</span>)}</div> : null}
          <div className={styles.actions}><Link href={`/app/candidate/${encodeURIComponent(candidate.id)}`}>Open Candidate 360</Link>{roleId && <button type="button" onClick={() => attachToRole(candidate.id, { name: candidate.canonicalName, headline: candidate.currentTitle || candidate.headline, company: candidate.currentCompany, location: candidate.location })}>Add to role</button>}<button type="button" onClick={() => void findStoredContacts(candidate)} disabled={Boolean(status)}>{contactConfirm === key ? 'Confirm contact lookup' : 'Find contact info'}</button></div>
          {signals.length > 0 && <div className={styles.contacts}>{signals.map((signal, index) => <div key={`${signal.type}:${signal.value}:${index}`}><strong>{signal.channelKind || signal.type}</strong><span>{signal.value}</span><small>{[signal.sourceProvider, signal.deliverability, signal.permissionStatus].filter(Boolean).join(' · ')}</small></div>)}</div>}
        </article>
      })}</div>
    </section>}

    {live.length > 0 && <section className={styles.results}>
      <div className={styles.sectionHead}><div><span>Live source results</span><strong>{live.length} unified review result{live.length === 1 ? '' : 's'}</strong></div><small>Search-level grouping does not silently merge durable identities.</small></div>
      <div className={styles.cards}>{live.map(person => {
        const key = `${person.provider}:${person.providerPersonId}`
        const saved = savedIds[key]
        const signals = contactSignals[key] || []
        return <article key={key} className={styles.card}>
          <div className={styles.cardTop}><div><h2>{person.displayName}</h2><p>{[person.currentTitle || person.headline, person.currentEmployer, person.location].filter(Boolean).join(' · ') || 'Professional details not returned'}</p></div>{person.identityCluster?.sourceCount && person.identityCluster.sourceCount > 1 ? <span className={styles.fused}>{person.identityCluster.sourceCount} sources</span> : <span className={styles.provider}>{person.provider.replaceAll('_', ' ')}</span>}</div>
          {person.skills?.length ? <div className={styles.skills}>{person.skills.slice(0, 10).map(skill => <span key={skill}>{skill}</span>)}</div> : null}
          {externalProfiles(person).length > 0 && <div className={styles.profiles}>{externalProfiles(person).map(item => <a key={`${item.kind}:${item.url}`} href={item.url} target="_blank" rel="noreferrer">{item.kind}</a>)}</div>}
          <div className={styles.actions}>{saved ? <Link href={`/app/candidate/${encodeURIComponent(saved)}`}>Open saved profile</Link> : <button type="button" onClick={() => void saveLive(person)} disabled={Boolean(status)}>Save to Candidate Graph{roleId ? ' + role' : ''}</button>}<button type="button" onClick={() => void findLiveContacts(person)} disabled={Boolean(status)}>{contactConfirm === key ? 'Confirm contact lookup' : 'Find contact info'}</button></div>
          {signals.length > 0 && <div className={styles.contacts}>{signals.map((signal, index) => <div key={`${signal.type}:${signal.value}:${index}`}><strong>{signal.channelKind || signal.type}</strong><span>{signal.value}</span><small>{[signal.sourceProvider, signal.deliverability, signal.permissionStatus].filter(Boolean).join(' · ')}</small></div>)}</div>}
        </article>
      })}</div>
    </section>}
  </div>
}
