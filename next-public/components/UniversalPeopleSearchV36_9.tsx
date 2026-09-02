'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ROLE_CANDIDATE_SAVED_EVENT } from '@/lib/role-candidate-link'
import type { SourceResult } from '@/lib/source-types'
import {
  buildUniversalPeopleProviderRequestV36_9,
  classifyUniversalPeopleSearchV36_9,
  exactLinkedInAnchorV36_9,
  universalPeopleIntentLabelV36_9,
} from '@/lib/universal-people-search-v36-9'

type ProviderProfileUrl = {
  kind: 'linkedin' | 'github' | 'stackoverflow' | 'personal' | 'other'
  url: string
}

type ProviderObservation = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills: string[]
  profileUrls: ProviderProfileUrl[]
  contactAvailability: { email: boolean | 'unknown'; phone: boolean | 'unknown' }
  providerRetrievalScore?: number
  providerScoreScale?: string
  providerExplanation?: string
  refreshedAt?: string
  observedAt: string
}

type ReviewObservation = {
  observation: ProviderObservation
  observationSignature: string
  sourceResult: SourceResult
}

type ProviderTelemetry = {
  provider: string
  status: 'completed' | 'failed' | 'unavailable' | 'skipped'
  discovered: number
  latencyMs: number
  estimatedCredits?: number
  message?: string
}

type SearchResponse = {
  ok?: boolean
  error?: string
  observations?: ProviderObservation[]
  reviewObservations?: ReviewObservation[]
  telemetry?: ProviderTelemetry[]
  providerMix?: Record<string, number>
  retainedProviderMix?: Record<string, number>
  discoveredBeforeCap?: number
  returnedAfterCap?: number
  contributingProviders?: number
  warnings?: string[]
}

type ProviderStatus = {
  provider: string
  label: string
  state: 'configured' | 'missing_key' | 'planned' | 'disabled'
  executable: boolean
  message: string
}

type StatusResponse = {
  ok?: boolean
  providers?: ProviderStatus[]
  executableSearchProviders?: string[]
}

type SaveResponse = {
  ok?: boolean
  error?: string
  reused?: boolean
  candidateId?: string
  candidateUrl?: string
  note?: string
}

type ContactSignal = {
  type: string
  value: string
  sourceProvider: string
  confidence: 'low' | 'medium' | 'high'
  permissionStatus: string
  deliverability?: string
}

type ContactResponse = {
  ok?: boolean
  error?: string
  message?: string
  signals?: ContactSignal[]
  orchestration?: { stopReason?: string; attempts?: Array<{ provider: string; status: string; resultCount: number }> }
  warning?: string
}

function displayProvider(value: string): string {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function contactAvailabilityLabel(value: boolean | 'unknown'): string {
  if (value === true) return 'available'
  if (value === false) return 'not returned'
  return 'unknown'
}

export function UniversalPeopleSearchV36_9({ roleId }: { roleId?: string }) {
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [skills, setSkills] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([])
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [savingKey, setSavingKey] = useState('')
  const [saved, setSaved] = useState<Record<string, { candidateId: string; candidateUrl: string; reused: boolean }>>({})
  const [contactWorkingKey, setContactWorkingKey] = useState('')
  const [contacts, setContacts] = useState<Record<string, ContactResponse>>({})

  const intent = useMemo(() => classifyUniversalPeopleSearchV36_9(query), [query])
  const reviewObservations = response?.reviewObservations || []
  const configuredCount = providerStatuses.filter(item => item.executable).length
  const availableCount = providerStatuses.filter(item => item.state !== 'disabled').length

  const linkedinOverlap = useMemo(() => {
    const counts = new Map<string, number>()
    for (const review of reviewObservations) {
      const anchor = exactLinkedInAnchorV36_9(review.observation.profileUrls)
      if (anchor) counts.set(anchor, (counts.get(anchor) || 0) + 1)
    }
    return counts
  }, [reviewObservations])

  useEffect(() => {
    let active = true
    void fetch('/api/candidate-data/status', { cache: 'no-store' })
      .then(async res => res.json() as Promise<StatusResponse>)
      .then(json => { if (active && json.ok) setProviderStatuses(json.providers || []) })
      .catch(() => { /* search itself reports provider availability */ })
    return () => { active = false }
  }, [])

  async function runSearch() {
    const trimmed = query.trim()
    if (!trimmed && !title.trim() && !company.trim() && !location.trim() && !skills.trim()) {
      setStatus('Enter a name, role, company, location, skill, email, phone, or professional profile URL.')
      return
    }
    if (working) return

    setWorking(true)
    setResponse(null)
    setStatus(`Searching ${configuredCount || 'configured'} professional-data provider${configuredCount === 1 ? '' : 's'}…`)
    try {
      const request = buildUniversalPeopleProviderRequestV36_9({ query: trimmed, title, company, location, skills, limit: 30 })
      const res = await fetch('/api/candidate-data/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      })
      const json = await res.json() as SearchResponse
      if (!res.ok || !json.ok) throw new Error(json.error || 'People search failed.')
      setResponse(json)
      const retained = json.returnedAfterCap ?? json.reviewObservations?.length ?? 0
      const discovered = json.discoveredBeforeCap ?? retained
      setStatus(retained
        ? `Found ${retained} reviewable provider observation${retained === 1 ? '' : 's'} from ${discovered} discoveries.`
        : 'The configured providers returned no reviewable people for this search. Add stronger identity or professional filters and try again.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'People search failed.')
    } finally {
      setWorking(false)
    }
  }

  async function saveReview(review: ReviewObservation) {
    const key = `${review.observation.provider}:${review.observation.providerPersonId}`
    if (savingKey) return
    setSavingKey(key)
    try {
      const res = await fetch('/api/candidate-data/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          observation: review.observation,
          observationSignature: review.observationSignature,
        }),
      })
      const json = await res.json() as SaveResponse
      if (!res.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Candidate save failed.')
      const candidateUrl = json.candidateUrl || `/app/candidate/${json.candidateId}`
      setSaved(current => ({ ...current, [key]: { candidateId: json.candidateId!, candidateUrl, reused: Boolean(json.reused) } }))

      if (roleId) {
        window.dispatchEvent(new CustomEvent(ROLE_CANDIDATE_SAVED_EVENT, {
          detail: { candidateId: json.candidateId, result: review.sourceResult },
        }))
      }
      setStatus(`${json.reused ? 'Reused existing Candidate 360.' : 'Saved to Candidate Graph.'}${roleId ? ' Added to the active role review queue through the canonical candidate link.' : ''} ${json.note || ''}`.trim())
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Candidate save failed.')
    } finally {
      setSavingKey('')
    }
  }

  async function findWorkContact(review: ReviewObservation) {
    const observation = review.observation
    const key = `${observation.provider}:${observation.providerPersonId}`
    if (contactWorkingKey) return
    setContactWorkingKey(key)
    try {
      const linkedinUrl = observation.profileUrls.find(item => item.kind === 'linkedin')?.url
      const profileUrl = linkedinUrl || observation.profileUrls[0]?.url
      const candidateId = saved[key]?.candidateId
      const res = await fetch('/api/contact-enrichment/find', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          purpose: 'work_email_finder',
          candidateId,
          providerName: observation.provider,
          providerPersonId: observation.providerPersonId,
          fullName: observation.displayName,
          currentCompany: observation.currentEmployer,
          location: observation.location,
          title: observation.currentTitle || observation.headline,
          profileUrl,
          linkedinUrl,
          sourceContext: 'universal_people_search_v36_9',
        }),
      })
      const json = await res.json() as ContactResponse
      if (!res.ok || !json.ok) throw new Error(json.error || 'Contact lookup failed.')
      setContacts(current => ({ ...current, [key]: json }))
    } catch (error) {
      setContacts(current => ({ ...current, [key]: { ok: false, error: error instanceof Error ? error.message : 'Contact lookup failed.' } }))
    } finally {
      setContactWorkingKey('')
    }
  }

  return <section className="product-panel" aria-label="Universal people search" style={{ marginBottom: 18 }}>
    <div className="product-panel-head" style={{ alignItems: 'flex-start' }}>
      <div>
        <span className="kicker">Universal People Search · V36.9</span>
        <h2 style={{ marginBottom: 6 }}>Search people first. Let SourcingOS choose the data sources.</h2>
        <p className="muted" style={{ maxWidth: 780, margin: 0 }}>
          Name, title, company, location, skills, email, phone, LinkedIn/GitHub URL, or free text. SourcingOS fans the request across configured professional-data providers, keeps provider scores separate from qualification, and lets you explicitly save or enrich the person.
        </p>
      </div>
      <div style={{ minWidth: 190, textAlign: 'right' }}>
        <span className="status-pill success">{configuredCount} executable</span>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{availableCount || providerStatuses.length} provider lanes known</div>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 18 }}>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void runSearch() }}
          placeholder="Try: Jane Doe · RHEL administrator Annapolis Junction · jane@example.com · linkedin.com/in/..."
          aria-label="People search query"
          style={{ width: '100%', minHeight: 48, paddingRight: 150 }}
        />
        {!!query.trim() && <span className="status-pill active" style={{ position: 'absolute', right: 9, top: 9 }}>{universalPeopleIntentLabelV36_9(intent)}</span>}
      </div>
      <button className="btn" disabled={working} onClick={() => void runSearch()}>{working ? 'Searching…' : 'Search all sources'}</button>
    </div>

    <div className="button-row" style={{ marginTop: 10 }}>
      <button className="btn ghost" onClick={() => setShowFilters(value => !value)}>{showFilters ? 'Hide filters' : 'Add filters'}</button>
      <span className="muted" style={{ fontSize: 12 }}>More anchors narrow the same search; they do not create a separate workflow.</span>
    </div>

    {showFilters && <div className="grid two" style={{ marginTop: 14 }}>
      <label><span className="kicker">Title</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Linux Administrator" style={{ width: '100%', marginTop: 5 }} /></label>
      <label><span className="kicker">Company</span><input value={company} onChange={event => setCompany(event.target.value)} placeholder="Current or target employer" style={{ width: '100%', marginTop: 5 }} /></label>
      <label><span className="kicker">Location</span><input value={location} onChange={event => setLocation(event.target.value)} placeholder="Annapolis Junction, MD" style={{ width: '100%', marginTop: 5 }} /></label>
      <label><span className="kicker">Skills / keywords</span><input value={skills} onChange={event => setSkills(event.target.value)} placeholder="RHEL, Linux, Ansible" style={{ width: '100%', marginTop: 5 }} /></label>
    </div>}

    {!!providerStatuses.length && <div className="chips" style={{ marginTop: 14 }}>
      {providerStatuses.filter(item => item.capabilities ? true : true).map(item => <span className={`tag ${item.executable ? '' : 'muted'}`} key={item.provider} title={item.message}>{item.label} · {item.executable ? 'ready' : item.state.replace('_', ' ')}</span>)}
    </div>}

    {status && <div className="cta" role="status" style={{ marginTop: 14, marginBottom: 0 }}>{status}</div>}

    {response && <div style={{ marginTop: 18 }}>
      <div className="agentic-run-metrics" style={{ marginBottom: 14 }}>
        <span><b>{response.discoveredBeforeCap || 0}</b><small>raw discoveries</small></span>
        <span><b>{response.returnedAfterCap || reviewObservations.length}</b><small>retained</small></span>
        <span><b>{response.contributingProviders || 0}</b><small>providers contributed</small></span>
      </div>

      {!!response.telemetry?.length && <div className="agentic-source-status-row" style={{ marginBottom: 14 }}>
        {response.telemetry.map(item => <span key={item.provider} className={`status-pill ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'warning' : ''}`}>{displayProvider(item.provider)} · {item.status} · {item.discovered} · {item.latencyMs}ms</span>)}
      </div>}

      {!!reviewObservations.length && <div className="agentic-results">
        <div className="agentic-results-head">
          <div><span className="kicker">Professional-data discoveries</span><h3>{reviewObservations.length} observations for recruiter review</h3></div>
          <span className="status-pill">retrieval ≠ qualification</span>
        </div>
        <div className="agentic-result-grid">{reviewObservations.map(review => {
          const observation = review.observation
          const key = `${observation.provider}:${observation.providerPersonId}`
          const savedResult = saved[key]
          const contactResult = contacts[key]
          const linkedin = observation.profileUrls.find(item => item.kind === 'linkedin')
          const anchor = exactLinkedInAnchorV36_9(observation.profileUrls)
          const overlapCount = anchor ? linkedinOverlap.get(anchor) || 1 : 1
          return <article className="agentic-result-card" key={key}>
            <div className="agentic-result-top">
              <span className="status-pill">{displayProvider(observation.provider)}</span>
              <span>{overlapCount > 1 ? `${overlapCount} providers share this LinkedIn anchor` : 'provider observation'}</span>
            </div>
            <h4>{observation.displayName}</h4>
            <p>{[observation.currentTitle || observation.headline, observation.currentEmployer, observation.location].filter(Boolean).join(' · ') || 'Professional profile observation'}</p>

            {!!observation.skills.length && <div className="chips" style={{ margin: '10px 0' }}>{observation.skills.slice(0, 7).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>}

            <div className="agentic-result-evidence">
              <b>Why this record is here</b>
              <span>{observation.providerExplanation || 'Returned by the provider for the recruiter-entered people-search criteria. Provider retrieval metadata is not a SourcingOS qualification decision.'}</span>
            </div>

            <div className="agentic-result-foot">
              <span>Email {contactAvailabilityLabel(observation.contactAvailability.email)}</span>
              <span>Phone {contactAvailabilityLabel(observation.contactAvailability.phone)}</span>
              {observation.providerRetrievalScore !== undefined && <span>Provider retrieval {observation.providerRetrievalScore}{observation.providerScoreScale ? ` / ${observation.providerScoreScale}` : ''}</span>}
            </div>

            {!!observation.profileUrls.length && <div className="button-row" style={{ marginTop: 10 }}>
              {observation.profileUrls.slice(0, 4).map(profile => <a className="btn ghost" key={`${profile.kind}:${profile.url}`} href={profile.url} target="_blank" rel="noreferrer noopener">{profile.kind} ↗</a>)}
            </div>}

            <div className="button-row" style={{ marginTop: 12 }}>
              {savedResult
                ? <Link className="btn secondary" href={savedResult.candidateUrl}>{savedResult.reused ? 'Open existing Candidate 360' : 'Open Candidate 360'}</Link>
                : <button className="btn secondary" disabled={Boolean(savingKey)} onClick={() => void saveReview(review)}>{savingKey === key ? 'Saving…' : roleId ? 'Save + add to role' : 'Save Candidate 360'}</button>}
              <button className="btn ghost" disabled={Boolean(contactWorkingKey)} onClick={() => void findWorkContact(review)}>{contactWorkingKey === key ? 'Resolving contact…' : 'Find work contact'}</button>
              {linkedin && <a className="btn ghost" href={linkedin.url} target="_blank" rel="noreferrer noopener">LinkedIn ↗</a>}
            </div>

            {contactResult && <div className="cta" style={{ marginTop: 10, marginBottom: 0 }}>
              {contactResult.ok ? <>
                <strong>{contactResult.message || 'Contact lookup complete.'}</strong>
                {!!contactResult.signals?.length && <div style={{ marginTop: 7 }}>{contactResult.signals.slice(0, 8).map(signal => <div key={`${signal.type}:${signal.value}`} style={{ fontSize: 13, marginTop: 3 }}><b>{signal.type}</b> · {signal.value} · {signal.sourceProvider} · {signal.confidence} confidence</div>)}</div>}
                <small className="muted">Contact ownership, deliverability, and permission remain separate. No outreach is sent automatically.</small>
              </> : <span>{contactResult.error || 'Contact lookup failed.'}</span>}
            </div>}
          </article>
        })}</div>
      </div>}

      {!!response.warnings?.length && <div className="agentic-warning-list" style={{ marginTop: 14 }}>{response.warnings.slice(0, 8).map(warning => <span key={warning}>⚠ {warning}</span>)}</div>}
    </div>}

    <div className="agentic-results-note" style={{ marginTop: 16 }}>
      Universal People Search runs licensed professional-data retrieval without treating a provider row as a resolved person or a provider score as fit. Exact cross-provider identity still requires deterministic anchors/recruiter review. Contact lookup is explicit and separate from search.
    </div>
  </section>
}
