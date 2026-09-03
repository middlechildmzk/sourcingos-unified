'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { SourceResult } from '@/lib/source-types'
import {
  buildUniversalExactIdentityRequestV36_9,
  buildUniversalPeopleProviderRequestV36_9,
  classifyUniversalPeopleSearchV36_9,
  universalPeopleIntentLabelV36_9,
} from '@/lib/universal-people-search-v36-9'

type ProfileUrl = { kind: 'linkedin' | 'github' | 'stackoverflow' | 'personal' | 'other'; url: string }

type Observation = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills: string[]
  profileUrls: ProfileUrl[]
  contactAvailability: { email: boolean | 'unknown'; phone: boolean | 'unknown' }
  providerRetrievalScore?: number
  providerScoreScale?: string
  providerExplanation?: string
  observedAt: string
}

type ReviewObservation = {
  observation: Observation
  observationSignature: string
  sourceResult: SourceResult
}

type ProviderTelemetry = {
  provider: string
  status: 'completed' | 'failed' | 'unavailable' | 'skipped'
  discovered: number
  latencyMs: number
  message?: string
}

type SearchResponse = {
  ok?: boolean
  error?: string
  observations?: Observation[]
  reviewObservations?: ReviewObservation[]
  telemetry?: ProviderTelemetry[]
  discoveredBeforeCap?: number
  returnedAfterCap?: number
  contributingProviders?: number
  warnings?: string[]
}

type StatusResponse = {
  ok?: boolean
  executableSearchProviders?: string[]
  observationSigningConfigured?: boolean
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
  person?: {
    providerPersonId?: string
    displayName: string
    currentTitle?: string
    currentEmployer?: string
    location?: string
    skills: string[]
    profileUrls: ProfileUrl[]
  }
  orchestration?: {
    stopReason?: string
    satisfiedGoals?: string[]
    missingGoals?: string[]
    attempts?: Array<{ provider: string; status: string; resultCount: number; latencyMs?: number }>
  }
}

type SaveResponse = {
  ok?: boolean
  error?: string
  reused?: boolean
  candidateId?: string
  candidateUrl?: string
}

function providerLabel(value: string): string {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function channelLabel(value: boolean | 'unknown'): string {
  if (value === true) return 'available'
  if (value === false) return 'not returned'
  return 'unknown'
}

export function PeopleSearchFlagshipV36_12() {
  const [query, setQuery] = useState('')
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [skills, setSkills] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [working, setWorking] = useState(false)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [status, setStatus] = useState('')
  const [sourceCount, setSourceCount] = useState(0)
  const [signingReady, setSigningReady] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [saved, setSaved] = useState<Record<string, { candidateId: string; candidateUrl: string }>>({})
  const [contactKey, setContactKey] = useState('')
  const [contacts, setContacts] = useState<Record<string, ContactResponse>>({})
  const [exactContact, setExactContact] = useState<ContactResponse | null>(null)

  const intent = useMemo(() => classifyUniversalPeopleSearchV36_9(query), [query])
  const observations = response?.observations || []
  const reviewByKey = useMemo(() => {
    const map = new Map<string, ReviewObservation>()
    for (const review of response?.reviewObservations || []) {
      map.set(`${review.observation.provider}:${review.observation.providerPersonId}`, review)
    }
    return map
  }, [response])

  useEffect(() => {
    let active = true
    void fetch('/api/candidate-data/status', { cache: 'no-store' })
      .then(async res => res.json() as Promise<StatusResponse>)
      .then(json => {
        if (!active || !json.ok) return
        setSourceCount(json.executableSearchProviders?.length || 0)
        setSigningReady(Boolean(json.observationSigningConfigured))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function runSearch() {
    const trimmed = query.trim()
    if (!trimmed && !company.trim() && !title.trim() && !location.trim() && !skills.trim()) {
      setStatus('Enter a name, email, phone, profile URL, or professional search.')
      return
    }
    if (working) return

    setWorking(true)
    setResponse(null)
    setExactContact(null)
    setStatus('Searching…')

    try {
      const providerRequest = buildUniversalPeopleProviderRequestV36_9({
        query: trimmed,
        company,
        title,
        location,
        skills,
        limit: 30,
      })
      const exactRequest = buildUniversalExactIdentityRequestV36_9(trimmed)

      const providerPromise = fetch('/api/candidate-data/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(providerRequest),
      }).then(async res => ({ res, json: await res.json() as SearchResponse }))

      const exactPromise = exactRequest
        ? fetch('/api/contact-enrichment/find', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(exactRequest),
        }).then(async res => ({ res, json: await res.json() as ContactResponse }))
        : Promise.resolve(undefined)

      const [providerOutcome, exactOutcome] = await Promise.allSettled([providerPromise, exactPromise])
      let found = 0
      let providerError = ''

      if (providerOutcome.status === 'fulfilled') {
        if (providerOutcome.value.res.ok && providerOutcome.value.json.ok) {
          setResponse(providerOutcome.value.json)
          found = providerOutcome.value.json.observations?.length || providerOutcome.value.json.returnedAfterCap || 0
        } else {
          providerError = providerOutcome.value.json.error || 'Search failed.'
        }
      } else {
        providerError = providerOutcome.reason instanceof Error ? providerOutcome.reason.message : 'Search failed.'
      }

      if (exactOutcome.status === 'fulfilled' && exactOutcome.value?.res.ok && exactOutcome.value.json.ok) {
        setExactContact(exactOutcome.value.json)
      }

      if (!found && !exactContact && providerError) throw new Error(providerError)
      setStatus(found ? `${found} result${found === 1 ? '' : 's'}` : 'No matching people returned.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'People search failed.')
    } finally {
      setWorking(false)
    }
  }

  async function saveObservation(observation: Observation) {
    const key = `${observation.provider}:${observation.providerPersonId}`
    const review = reviewByKey.get(key)
    if (!review || savingKey) return
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
      setSaved(current => ({
        ...current,
        [key]: {
          candidateId: json.candidateId!,
          candidateUrl: json.candidateUrl || `/app/candidate/${json.candidateId}`,
        },
      }))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Candidate save failed.')
    } finally {
      setSavingKey('')
    }
  }

  async function findContact(observation: Observation) {
    const key = `${observation.provider}:${observation.providerPersonId}`
    if (contactKey) return
    setContactKey(key)
    try {
      const linkedinUrl = observation.profileUrls.find(item => item.kind === 'linkedin')?.url
      const profileUrl = linkedinUrl || observation.profileUrls[0]?.url
      const res = await fetch('/api/contact-enrichment/find', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          purpose: 'contact_bundle',
          candidateId: saved[key]?.candidateId,
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
      setContactKey('')
    }
  }

  return <>
    <section className="product-panel" aria-label="People search">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        <div style={{ position: 'relative' }}>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void runSearch() }}
            placeholder="Search a name, email, phone, LinkedIn URL, or describe the person you need…"
            aria-label="People search"
            autoFocus
            style={{ width: '100%', minHeight: 54, paddingRight: query.trim() ? 150 : 16 }}
          />
          {!!query.trim() && <span className="status-pill active" style={{ position: 'absolute', right: 10, top: 11 }}>{universalPeopleIntentLabelV36_9(intent)}</span>}
        </div>
        <button className="btn" disabled={working} onClick={() => void runSearch()}>{working ? 'Searching…' : 'Search'}</button>
      </div>

      <div className="button-row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <button className="btn ghost" onClick={() => setShowFilters(value => !value)}>{showFilters ? 'Hide filters' : '+ Filters'}</button>
        <span className="muted" style={{ fontSize: 12 }}>{sourceCount ? `${sourceCount} connected sources` : 'Connected-source search'}</span>
      </div>

      {showFilters && <div className="grid two" style={{ marginTop: 14 }}>
        <label><span className="kicker">Company</span><input value={company} onChange={event => setCompany(event.target.value)} placeholder="Maximus" style={{ width: '100%', marginTop: 5 }} /></label>
        <label><span className="kicker">Title</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Senior Talent Sourcer" style={{ width: '100%', marginTop: 5 }} /></label>
        <label><span className="kicker">Location</span><input value={location} onChange={event => setLocation(event.target.value)} placeholder="Minneapolis, MN" style={{ width: '100%', marginTop: 5 }} /></label>
        <label><span className="kicker">Skills</span><input value={skills} onChange={event => setSkills(event.target.value)} placeholder="RHEL, Ansible, Linux" style={{ width: '100%', marginTop: 5 }} /></label>
      </div>}

      {status && <div role="status" style={{ marginTop: 12, fontSize: 14 }}>{status}</div>}
    </section>

    {exactContact?.person && <section className="product-panel" style={{ marginTop: 14 }}>
      <span className="kicker">Exact match</span>
      <h3 style={{ margin: '5px 0' }}>{exactContact.person.displayName}</h3>
      <p className="muted" style={{ margin: 0 }}>{[exactContact.person.currentTitle, exactContact.person.currentEmployer, exactContact.person.location].filter(Boolean).join(' · ')}</p>
      {!!exactContact.signals?.length && <div style={{ marginTop: 10 }}>{exactContact.signals.slice(0, 8).map(signal => <div key={`${signal.type}:${signal.value}`} style={{ fontSize: 13, marginTop: 4 }}><b>{signal.type}</b> · {signal.value} · {providerLabel(signal.sourceProvider)}</div>)}</div>}
    </section>}

    {!!observations.length && <section style={{ marginTop: 16 }}>
      <div className="agentic-results-head" style={{ marginBottom: 10 }}>
        <div><h2 style={{ margin: 0 }}>People</h2><span className="muted" style={{ fontSize: 13 }}>{observations.length} returned</span></div>
      </div>
      <div className="agentic-result-grid">{observations.map(observation => {
        const key = `${observation.provider}:${observation.providerPersonId}`
        const review = reviewByKey.get(key)
        const savedResult = saved[key]
        const contactResult = contacts[key]
        return <article className="agentic-result-card" key={key}>
          <div className="agentic-result-top">
            <span className="status-pill">{providerLabel(observation.provider)}</span>
          </div>
          <h4>{observation.displayName}</h4>
          <p>{[observation.currentTitle || observation.headline, observation.currentEmployer, observation.location].filter(Boolean).join(' · ') || 'Professional profile'}</p>

          {!!observation.skills.length && <div className="chips" style={{ margin: '10px 0' }}>{observation.skills.slice(0, 6).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>}

          <div className="agentic-result-foot">
            <span>Email {channelLabel(observation.contactAvailability.email)}</span>
            <span>Phone {channelLabel(observation.contactAvailability.phone)}</span>
          </div>

          {!!observation.profileUrls.length && <div className="button-row" style={{ marginTop: 10 }}>
            {observation.profileUrls.slice(0, 3).map(profile => <a className="btn ghost" key={`${profile.kind}:${profile.url}`} href={profile.url} target="_blank" rel="noreferrer noopener">{profile.kind} ↗</a>)}
          </div>}

          <div className="button-row" style={{ marginTop: 12 }}>
            {savedResult
              ? <Link className="btn secondary" href={savedResult.candidateUrl}>Open Candidate 360</Link>
              : <button
                className="btn secondary"
                disabled={!review || Boolean(savingKey)}
                title={!review ? 'This environment returned the person but cannot sign a saveable provider observation.' : undefined}
                onClick={() => void saveObservation(observation)}
              >{savingKey === key ? 'Saving…' : 'Save Candidate 360'}</button>}
            <button className="btn ghost" disabled={Boolean(contactKey)} onClick={() => void findContact(observation)}>{contactKey === key ? 'Finding contact…' : 'Find contact info'}</button>
          </div>

          {contactResult && <div className="cta" style={{ marginTop: 10, marginBottom: 0 }}>
            {contactResult.ok ? <>
              <strong>{contactResult.message || 'Contact lookup complete.'}</strong>
              {!!contactResult.signals?.length && <div style={{ marginTop: 6 }}>{contactResult.signals.map(signal => <div key={`${signal.type}:${signal.value}`} style={{ fontSize: 13, marginTop: 3 }}><b>{signal.type}</b> · {signal.value} · {providerLabel(signal.sourceProvider)}</div>)}</div>}
              {!!contactResult.orchestration?.missingGoals?.length && <small className="muted">Still missing: {contactResult.orchestration.missingGoals.join(', ')}</small>}
            </> : <span>{contactResult.error || 'Contact lookup failed.'}</span>}
          </div>}

          {observation.providerExplanation && <details style={{ marginTop: 10 }}><summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>Why this result?</summary><p className="muted" style={{ fontSize: 12 }}>{observation.providerExplanation}</p></details>}
        </article>
      })}</div>
    </section>}

    {response && !observations.length && !working && <section className="product-panel" style={{ marginTop: 14 }}><strong>No people returned.</strong><p className="muted" style={{ marginBottom: 0 }}>Try adding a company, location, title, or another identity anchor.</p></section>}

    {response && <details className="product-panel" style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Search diagnostics</summary>
      <div className="agentic-run-metrics" style={{ marginTop: 12 }}>
        <span><b>{response.discoveredBeforeCap || 0}</b><small>discovered</small></span>
        <span><b>{response.returnedAfterCap ?? observations.length}</b><small>returned</small></span>
        <span><b>{response.contributingProviders || 0}</b><small>sources contributed</small></span>
      </div>
      {!!response.telemetry?.length && <div className="agentic-source-status-row" style={{ marginTop: 12 }}>{response.telemetry.map(item => <span key={item.provider} className={`status-pill ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'warning' : ''}`}>{providerLabel(item.provider)} · {item.status} · {item.discovered}</span>)}</div>}
      {!!response.warnings?.length && <div className="agentic-warning-list" style={{ marginTop: 12 }}>{response.warnings.map(warning => <span key={warning}>⚠ {warning}</span>)}</div>}
      {!signingReady && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Results remain visible, but saving requires internal observation signing in this runtime.</p>}
    </details>}
  </>
}
