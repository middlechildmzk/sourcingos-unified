'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SourceResult } from '@/lib/source-types'
import {
  buildUniversalExactIdentityRequestV36_9,
  buildUniversalPeopleProviderRequestV36_9,
  classifyUniversalPeopleSearchV36_9,
  universalPeopleIntentLabelV36_9,
  type UniversalPeopleProviderRequestV36_9,
} from '@/lib/universal-people-search-v36-9'
import {
  bestPhoneChannelV36_13,
  contactSupportLabelV36_13,
  evidenceCoverageForObservationV36_13,
  orderObservationsByEvidenceV36_13,
  summarizeContactSignalsV36_13,
  type ContactReviewChannelV36_13,
  type ContactSignalForReviewV36_13,
} from '@/lib/people-review-v36-13'

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

type ContactResponse = {
  ok?: boolean
  error?: string
  message?: string
  signals?: ContactSignalForReviewV36_13[]
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
    attempts?: Array<{ provider: string; status?: string; resultCount: number; latencyMs?: number }>
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

function observationKey(observation: Observation): string {
  return `${observation.provider}:${observation.providerPersonId}`
}

function csvCell(value: unknown): string {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  return `"${text.replace(/"/g, '""')}"`
}

function escapeRegexp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedText({ value, terms }: { value?: string; terms: string[] }): ReactNode {
  const text = String(value || '')
  const usable = Array.from(new Set(terms.map(term => term.trim()).filter(term => term.length >= 2)))
    .sort((a, b) => b.length - a.length)
    .slice(0, 18)
  if (!text || !usable.length) return text
  const pattern = new RegExp(`(${usable.map(escapeRegexp).join('|')})`, 'gi')
  return text.split(pattern).map((part, index) => {
    const matched = usable.some(term => term.toLowerCase() === part.toLowerCase())
    return matched
      ? <mark key={`${part}-${index}`} style={{ background: 'color-mix(in srgb, var(--accent) 28%, transparent)', color: 'inherit', borderRadius: 4, padding: '0 2px' }}>{part}</mark>
      : part
  })
}

function ContactChannelRow({ label, channel }: { label: string; channel: ContactReviewChannelV36_13 }) {
  const signal = channel.primary
  return <div className="product-row" style={{ alignItems: 'flex-start' }}>
    <div className="product-row-main">
      <div className="product-row-title">{label}</div>
      {signal ? <>
        <div style={{ fontSize: 14, fontWeight: 750, marginTop: 4, wordBreak: 'break-word' }}>{signal.value}</div>
        <div className="product-row-meta" style={{ whiteSpace: 'normal', marginTop: 4 }}>
          {contactSupportLabelV36_13(signal)} · {providerLabel(signal.sourceProvider)}
          {signal.deliverability ? ` · ${signal.deliverability.replaceAll('_', ' ')}` : ''}
          {signal.ownershipConfidence ? ` · ownership ${signal.ownershipConfidence}` : ''}
        </div>
      </> : <div className="product-row-meta">Not found</div>}
    </div>
    {signal && channel.alternatives.length > 0 && <span className="status-pill">+{channel.alternatives.length}</span>}
  </div>
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
  const [activeSearchRequest, setActiveSearchRequest] = useState<UniversalPeopleProviderRequestV36_9>()
  const [status, setStatus] = useState('')
  const [sourceCount, setSourceCount] = useState(0)
  const [signingReady, setSigningReady] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [bulkWorking, setBulkWorking] = useState(false)
  const [saved, setSaved] = useState<Record<string, { candidateId: string; candidateUrl: string }>>({})
  const [contactKey, setContactKey] = useState('')
  const [contacts, setContacts] = useState<Record<string, ContactResponse>>({})
  const [exactContact, setExactContact] = useState<ContactResponse | null>(null)
  const [activeKey, setActiveKey] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const intent = useMemo(() => classifyUniversalPeopleSearchV36_9(query), [query])
  const observations = response?.observations || []
  const orderedObservations = useMemo(
    () => orderObservationsByEvidenceV36_13(observations, activeSearchRequest),
    [observations, activeSearchRequest],
  )
  const reviewByKey = useMemo(() => {
    const map = new Map<string, ReviewObservation>()
    for (const review of response?.reviewObservations || []) map.set(observationKey(review.observation), review)
    return map
  }, [response])
  const activeIndex = Math.max(0, orderedObservations.findIndex(item => observationKey(item) === activeKey))
  const activeObservation = orderedObservations[activeIndex]
  const resolvedActiveKey = activeObservation ? observationKey(activeObservation) : ''
  const activeContact = resolvedActiveKey ? contacts[resolvedActiveKey] : undefined
  const activeContactSummary = useMemo(
    () => summarizeContactSignalsV36_13(activeContact?.signals || []),
    [activeContact],
  )
  const activePhoneChannel = useMemo(() => bestPhoneChannelV36_13(activeContactSummary), [activeContactSummary])
  const activeCoverage = useMemo(
    () => activeObservation ? evidenceCoverageForObservationV36_13(activeObservation, activeSearchRequest) : undefined,
    [activeObservation, activeSearchRequest],
  )
  const highlightTerms = useMemo(() => {
    if (!activeCoverage) return []
    return activeCoverage.criteria
      .filter(item => item.status === 'observed')
      .map(item => item.label.replace(/^Current or relevant (?:title|employer):\s*/i, ''))
      .filter(label => !/^\d+\+? years/i.test(label))
  }, [activeCoverage])
  const allSelected = Boolean(orderedObservations.length) && orderedObservations.every(item => selectedKeys.has(observationKey(item)))
  const selectedObservations = orderedObservations.filter(item => selectedKeys.has(observationKey(item)))

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
    setContacts({})
    setSelectedKeys(new Set())
    setActiveKey('')
    setStatus('Searching…')

    try {
      const providerRequest = buildUniversalPeopleProviderRequestV36_9({ query: trimmed, company, title, location, skills, limit: 30 })
      const exactRequest = buildUniversalExactIdentityRequestV36_9(trimmed)

      const providerPromise = fetch('/api/candidate-data/search', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(providerRequest),
      }).then(async res => ({ res, json: await res.json() as SearchResponse }))

      const exactPromise = exactRequest
        ? fetch('/api/contact-enrichment/find', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(exactRequest),
        }).then(async res => ({ res, json: await res.json() as ContactResponse }))
        : Promise.resolve(undefined)

      const [providerOutcome, exactOutcome] = await Promise.allSettled([providerPromise, exactPromise])
      let found = 0
      let providerError = ''

      if (providerOutcome.status === 'fulfilled') {
        if (providerOutcome.value.res.ok && providerOutcome.value.json.ok) {
          const json = providerOutcome.value.json
          setResponse(json)
          setActiveSearchRequest(providerRequest)
          const raw = json.observations || []
          const ordered = orderObservationsByEvidenceV36_13(raw, providerRequest)
          if (ordered[0]) setActiveKey(observationKey(ordered[0]))
          found = raw.length || json.returnedAfterCap || 0
        } else providerError = providerOutcome.value.json.error || 'Search failed.'
      } else providerError = providerOutcome.reason instanceof Error ? providerOutcome.reason.message : 'Search failed.'

      if (exactOutcome.status === 'fulfilled' && exactOutcome.value?.res.ok && exactOutcome.value.json.ok) setExactContact(exactOutcome.value.json)
      if (!found && providerError) throw new Error(providerError)
      setStatus(found ? `${found} result${found === 1 ? '' : 's'}` : exactOutcome.status === 'fulfilled' && exactOutcome.value?.json.ok ? 'Exact identity result returned.' : 'No matching people returned.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'People search failed.')
    } finally {
      setWorking(false)
    }
  }

  async function persistObservation(observation: Observation): Promise<{ key: string; candidateId: string; candidateUrl: string }> {
    const key = observationKey(observation)
    const review = reviewByKey.get(key)
    if (!review) throw new Error('This result is visible but does not have a signed saveable observation in this runtime.')
    const res = await fetch('/api/candidate-data/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ observation: review.observation, observationSignature: review.observationSignature }),
    })
    const json = await res.json() as SaveResponse
    if (!res.ok || !json.ok || !json.candidateId) throw new Error(json.error || 'Candidate save failed.')
    return { key, candidateId: json.candidateId, candidateUrl: json.candidateUrl || `/app/candidate/${json.candidateId}` }
  }

  async function saveObservation(observation: Observation) {
    const key = observationKey(observation)
    if (savingKey || bulkWorking) return
    setSavingKey(key)
    try {
      const result = await persistObservation(observation)
      setSaved(current => ({ ...current, [result.key]: { candidateId: result.candidateId, candidateUrl: result.candidateUrl } }))
      setStatus(`${observation.displayName} saved to SourcingOS.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Candidate save failed.')
    } finally {
      setSavingKey('')
    }
  }

  async function saveSelected() {
    if (!selectedObservations.length || bulkWorking) return
    setBulkWorking(true)
    const additions: Record<string, { candidateId: string; candidateUrl: string }> = {}
    let savedCount = 0
    let skippedCount = 0
    try {
      for (const observation of selectedObservations) {
        const key = observationKey(observation)
        if (saved[key]) { skippedCount += 1; continue }
        if (!reviewByKey.has(key)) { skippedCount += 1; continue }
        try {
          const result = await persistObservation(observation)
          additions[result.key] = { candidateId: result.candidateId, candidateUrl: result.candidateUrl }
          savedCount += 1
        } catch { skippedCount += 1 }
      }
      if (Object.keys(additions).length) setSaved(current => ({ ...current, ...additions }))
      setStatus(`${savedCount} selected candidate${savedCount === 1 ? '' : 's'} saved${skippedCount ? ` · ${skippedCount} already saved or unavailable` : ''}.`)
    } finally {
      setBulkWorking(false)
    }
  }

  async function findContact(observation: Observation) {
    const key = observationKey(observation)
    if (contactKey) return
    setContactKey(key)
    try {
      const linkedinUrl = observation.profileUrls.find(item => item.kind === 'linkedin')?.url
      const profileUrl = linkedinUrl || observation.profileUrls[0]?.url
      const res = await fetch('/api/contact-enrichment/find', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          purpose: 'contact_bundle', candidateId: saved[key]?.candidateId, providerName: observation.provider,
          providerPersonId: observation.providerPersonId, fullName: observation.displayName,
          currentCompany: observation.currentEmployer, location: observation.location,
          title: observation.currentTitle || observation.headline, profileUrl, linkedinUrl,
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

  function toggleSelected(key: string) {
    setSelectedKeys(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedKeys(allSelected ? new Set() : new Set(orderedObservations.map(observationKey)))
  }

  function exportSelectedCsv() {
    if (!selectedObservations.length) return
    const headers = ['Name', 'Title', 'Company', 'Location', 'Skills', 'Provider', 'Evidence observed', 'Evidence total', 'Required evidence observed', 'Required evidence total', 'Work email', 'Personal email', 'Phone', 'LinkedIn', 'Saved candidate URL']
    const rows = selectedObservations.map(observation => {
      const key = observationKey(observation)
      const coverage = evidenceCoverageForObservationV36_13(observation, activeSearchRequest)
      const summary = summarizeContactSignalsV36_13(contacts[key]?.signals || [])
      const phone = bestPhoneChannelV36_13(summary).primary?.value || ''
      const linkedin = summary.linkedin.primary?.value || observation.profileUrls.find(item => item.kind === 'linkedin')?.url || ''
      return [
        observation.displayName,
        observation.currentTitle || observation.headline || '',
        observation.currentEmployer || '',
        observation.location || '',
        observation.skills.join('; '),
        providerLabel(observation.provider),
        coverage.observedCount,
        coverage.totalCount,
        coverage.mustHaveObserved,
        coverage.mustHaveTotal,
        summary.workEmail.primary?.value || '',
        summary.personalEmail.primary?.value || '',
        phone,
        linkedin,
        saved[key]?.candidateUrl || '',
      ]
    })
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sourcingos-people-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  function showPrevious() {
    if (!orderedObservations.length) return
    const nextIndex = activeIndex <= 0 ? orderedObservations.length - 1 : activeIndex - 1
    setActiveKey(observationKey(orderedObservations[nextIndex]))
  }

  function showNext() {
    if (!orderedObservations.length) return
    const nextIndex = activeIndex >= orderedObservations.length - 1 ? 0 : activeIndex + 1
    setActiveKey(observationKey(orderedObservations[nextIndex]))
  }

  const otherPossibleContacts = useMemo(() => {
    const summary = activeContactSummary
    const values: ContactSignalForReviewV36_13[] = [
      ...summary.workEmail.alternatives,
      ...summary.personalEmail.alternatives,
      ...summary.mobilePhone.alternatives,
      ...(activePhoneChannel === summary.mobilePhone ? [summary.otherPhone.primary, ...summary.otherPhone.alternatives] : summary.otherPhone.alternatives),
      summary.otherEmail.primary,
      ...summary.otherEmail.alternatives,
      ...summary.linkedin.alternatives,
      summary.github.primary,
      ...summary.github.alternatives,
      summary.otherProfiles.primary,
      ...summary.otherProfiles.alternatives,
    ].filter(Boolean) as ContactSignalForReviewV36_13[]
    return Array.from(new Map(values.map(item => [`${item.type}:${item.value}:${item.sourceProvider}`, item])).values())
  }, [activeContactSummary, activePhoneChannel])

  return <>
    <style>{`
      .people-review-layout{display:grid;grid-template-columns:minmax(310px,.72fr) minmax(460px,1.28fr);gap:14px;align-items:start}
      .people-review-list{padding:0;overflow:hidden}
      .people-review-scroll{max-height:72vh;overflow:auto}
      .people-review-row{padding:14px 14px 13px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s ease,border-color .15s ease}
      .people-review-row:hover{background:color-mix(in srgb,var(--accent) 5%,transparent)}
      .people-review-row.active{background:color-mix(in srgb,var(--accent) 10%,transparent);box-shadow:inset 3px 0 0 var(--accent)}
      .people-review-detail{position:sticky;top:86px;max-height:calc(100vh - 105px);overflow:auto}
      .people-review-bulk{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      @media(max-width:1050px){.people-review-layout{grid-template-columns:1fr}.people-review-detail{position:static;max-height:none}.people-review-scroll{max-height:none}}
    `}</style>

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
            style={{ width: '100%', minHeight: 54, paddingRight: query.trim() ? 170 : 16 }}
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
        <label><span className="kicker">Company</span><input value={company} onChange={event => setCompany(event.target.value)} placeholder="Acme Corp" style={{ width: '100%', marginTop: 5 }} /></label>
        <label><span className="kicker">Title</span><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Senior Systems Engineer" style={{ width: '100%', marginTop: 5 }} /></label>
        <label><span className="kicker">Location</span><input value={location} onChange={event => setLocation(event.target.value)} placeholder="Arlington, VA" style={{ width: '100%', marginTop: 5 }} /></label>
        <label><span className="kicker">Skills</span><input value={skills} onChange={event => setSkills(event.target.value)} placeholder="RHEL, Ansible, Linux" style={{ width: '100%', marginTop: 5 }} /></label>
      </div>}

      {status && <div role="status" style={{ marginTop: 12, fontSize: 14 }}>{status}</div>}
    </section>

    {exactContact?.person && !orderedObservations.length && <section className="product-panel" style={{ marginTop: 14 }}>
      <span className="kicker">Exact identity result</span>
      <h3 style={{ margin: '5px 0' }}>{exactContact.person.displayName}</h3>
      <p className="muted" style={{ margin: 0 }}>{[exactContact.person.currentTitle, exactContact.person.currentEmployer, exactContact.person.location].filter(Boolean).join(' · ')}</p>
    </section>}

    {!!orderedObservations.length && <section style={{ marginTop: 16 }}>
      <div className="agentic-results-head" style={{ marginBottom: 10, gap: 12, alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0 }}>People</h2>
          <span className="muted" style={{ fontSize: 13 }}>{orderedObservations.length} returned · ordered for review by visible search evidence, not a fit score</span>
        </div>
        <div className="people-review-bulk">
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> Select all
          </label>
          <span className="status-pill">{selectedKeys.size} selected</span>
          <button className="btn secondary" disabled={!selectedObservations.length || bulkWorking || !signingReady} onClick={() => void saveSelected()}>{bulkWorking ? 'Saving…' : 'Save selected'}</button>
          <button className="btn ghost" disabled={!selectedObservations.length} onClick={exportSelectedCsv}>Export CSV</button>
        </div>
      </div>

      <div className="people-review-layout">
        <section className="product-panel people-review-list" aria-label="People search results">
          <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span className="kicker">Review queue</span>
            <span className="muted" style={{ fontSize: 11 }}>Click a person to inspect</span>
          </div>
          <div className="people-review-scroll">
            {orderedObservations.map((observation, index) => {
              const key = observationKey(observation)
              const coverage = evidenceCoverageForObservationV36_13(observation, activeSearchRequest)
              const observed = coverage.criteria.filter(item => item.status === 'observed')
              const selected = selectedKeys.has(key)
              const isActive = key === resolvedActiveKey
              return <div
                className={`people-review-row${isActive ? ' active' : ''}`}
                key={key}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => setActiveKey(key)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveKey(key) } }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start' }}>
                  <input type="checkbox" checked={selected} aria-label={`Select ${observation.displayName}`} onClick={event => event.stopPropagation()} onChange={() => toggleSelected(key)} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14 }}>{observation.displayName}</strong>
                      {saved[key] && <span className="status-pill success">saved</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, lineHeight: 1.45, marginTop: 3 }}>{[observation.currentTitle || observation.headline, observation.currentEmployer].filter(Boolean).join(' · ') || 'Professional profile'}</div>
                    {observation.location && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{observation.location}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="status-pill">{providerLabel(observation.provider)}</span>
                    <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>#{index + 1}</div>
                  </div>
                </div>
                {!!coverage.totalCount && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
                  <span className="status-pill success">{coverage.observedCount}/{coverage.totalCount} evidenced</span>
                  {observed.slice(0, 3).map(item => <span className="tag" key={item.id}>{item.label.replace(/^Current or relevant (?:title|employer):\s*/i, '')}</span>)}
                  {observed.length > 3 && <span className="muted" style={{ fontSize: 11 }}>+{observed.length - 3}</span>}
                </div>}
                <div className="agentic-result-foot" style={{ marginTop: 9 }}>
                  <span>Email {channelLabel(observation.contactAvailability.email)}</span>
                  <span>Phone {channelLabel(observation.contactAvailability.phone)}</span>
                </div>
              </div>
            })}
          </div>
        </section>

        {activeObservation && activeCoverage && <aside className="product-panel people-review-detail" aria-label="Candidate review panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span className="kicker">Candidate preview</span>
              <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{activeIndex + 1} of {orderedObservations.length}</div>
            </div>
            <div className="button-row" style={{ margin: 0 }}>
              <button className="btn ghost" onClick={showPrevious} aria-label="Previous candidate">← Previous</button>
              <button className="btn ghost" onClick={showNext} aria-label="Next candidate">Next →</button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 26 }}>{activeObservation.displayName}</h2>
              <p style={{ margin: '7px 0 0', lineHeight: 1.55 }}><HighlightedText value={activeObservation.currentTitle || activeObservation.headline || 'Professional profile'} terms={highlightTerms} /></p>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                <HighlightedText value={[activeObservation.currentEmployer, activeObservation.location].filter(Boolean).join(' · ')} terms={highlightTerms} />
              </p>
            </div>
            <span className="status-pill">{providerLabel(activeObservation.provider)}</span>
          </div>

          <section style={{ marginTop: 18 }}>
            <div className="product-panel-head" style={{ marginBottom: 9 }}>
              <div><span className="kicker">Executed search</span><h3 style={{ margin: '3px 0 0' }}>Requirement evidence</h3></div>
              <span>{activeCoverage.observedCount}/{activeCoverage.totalCount} visible</span>
            </div>
            <p className="muted" style={{ fontSize: 11, lineHeight: 1.5, marginTop: 0 }}>Observed means the returned provider fields visibly support the criterion. Not evidenced is unknown here — not a rejection, contradiction, or fit score.</p>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {activeCoverage.criteria.map(item => <span
                key={item.id}
                className={`status-pill ${item.status === 'observed' ? 'success' : ''}`}
                title={item.evidence || 'This search result does not carry enough normalized evidence for this criterion.'}
              >{item.mustHave ? 'Required · ' : ''}{item.label.replace(/^Current or relevant (?:title|employer):\s*/i, '')} · {item.status === 'observed' ? 'observed' : 'not evidenced'}</span>)}
            </div>
          </section>

          <section style={{ marginTop: 20 }}>
            <div className="product-panel-head"><div><span className="kicker">Profile preview</span><h3 style={{ margin: '3px 0 0' }}>Professional profile</h3></div></div>
            <div className="product-list">
              <div className="product-row"><div className="product-row-main"><div className="product-row-title">Current / recent role</div><div className="product-row-meta" style={{ whiteSpace: 'normal' }}><HighlightedText value={activeObservation.currentTitle || activeObservation.headline || 'Not returned'} terms={highlightTerms} /></div></div></div>
              <div className="product-row"><div className="product-row-main"><div className="product-row-title">Employer</div><div className="product-row-meta"><HighlightedText value={activeObservation.currentEmployer || 'Not returned'} terms={highlightTerms} /></div></div></div>
              <div className="product-row"><div className="product-row-main"><div className="product-row-title">Location</div><div className="product-row-meta"><HighlightedText value={activeObservation.location || 'Not returned'} terms={highlightTerms} /></div></div></div>
            </div>
            {!!activeObservation.skills.length && <div style={{ marginTop: 12 }}>
              <span className="kicker">Skills / keywords returned</span>
              <div className="chips" style={{ marginTop: 7 }}>{activeObservation.skills.slice(0, 24).map(skill => {
                const highlighted = activeCoverage.criteria.some(item => item.kind === 'skill' && item.status === 'observed' && item.label.toLowerCase() === skill.toLowerCase())
                return <span className={`tag${highlighted ? ' active' : ''}`} style={highlighted ? { outline: '1px solid var(--accent)' } : undefined} key={skill}>{skill}</span>
              })}</div>
            </div>}
            {!!activeObservation.profileUrls.length && <div className="button-row" style={{ marginTop: 13 }}>
              {activeObservation.profileUrls.slice(0, 6).map(profile => <a className="btn ghost" key={`${profile.kind}:${profile.url}`} href={profile.url} target="_blank" rel="noreferrer noopener">{profile.kind} ↗</a>)}
            </div>}
          </section>

          <section style={{ marginTop: 20 }}>
            <div className="product-panel-head">
              <div><span className="kicker">Contact intelligence</span><h3 style={{ margin: '3px 0 0' }}>Primary contact paths</h3></div>
              {activeContact?.signals?.length ? <span>{activeContact.signals.length} raw signals</span> : null}
            </div>
            {!activeContact && <div className="cta" style={{ marginBottom: 0 }}><strong>No contact lookup run yet.</strong><p className="muted" style={{ margin: '5px 0 10px', fontSize: 12 }}>Run the waterfall once; SourcingOS will surface one best-supported work email, personal email, phone, and professional profile while keeping the rest collapsed.</p><button className="btn" disabled={Boolean(contactKey)} onClick={() => void findContact(activeObservation)}>{contactKey === resolvedActiveKey ? 'Finding contact…' : 'Find contact info'}</button></div>}
            {activeContact && !activeContact.ok && <div className="cta">{activeContact.error || 'Contact lookup failed.'}</div>}
            {activeContact?.ok && <>
              <div className="product-list">
                <ContactChannelRow label="Work email" channel={activeContactSummary.workEmail} />
                <ContactChannelRow label="Personal email" channel={activeContactSummary.personalEmail} />
                <ContactChannelRow label={activeContactSummary.mobilePhone.primary ? 'Mobile phone' : 'Phone'} channel={activePhoneChannel} />
                <ContactChannelRow label="LinkedIn" channel={activeContactSummary.linkedin} />
                {activeContactSummary.github.primary && <ContactChannelRow label="GitHub" channel={activeContactSummary.github} />}
              </div>
              {!!activeContact.orchestration?.missingGoals?.length && <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>Still missing from requested contact bundle: {activeContact.orchestration.missingGoals.join(', ')}.</p>}
              {!!otherPossibleContacts.length && <details className="advanced-disclosure" style={{ marginTop: 12 }}>
                <summary>Other possible contact/profile signals ({otherPossibleContacts.length})</summary>
                <div className="product-list" style={{ marginTop: 10 }}>{otherPossibleContacts.map(signal => <div className="product-row" key={`${signal.type}:${signal.value}:${signal.sourceProvider}`}><div className="product-row-main"><div className="product-row-title">{signal.channelKind?.replaceAll('_', ' ') || signal.type}</div><div style={{ fontSize: 12, marginTop: 2, wordBreak: 'break-word' }}>{signal.value}</div><div className="product-row-meta">{providerLabel(signal.sourceProvider)} · {contactSupportLabelV36_13(signal)}</div></div></div>)}</div>
              </details>}
              {!!activeContactSummary.rejected.length && <details className="advanced-disclosure" style={{ marginTop: 8 }}><summary>Rejected / disconnected provider signals ({activeContactSummary.rejected.length})</summary><p className="muted" style={{ fontSize: 11 }}>These are retained only for provenance and are not presented as usable contact paths.</p></details>}
            </>}
          </section>

          <div className="button-row" style={{ marginTop: 20 }}>
            {saved[resolvedActiveKey]
              ? <Link className="btn" href={saved[resolvedActiveKey].candidateUrl}>Open Candidate 360</Link>
              : <button className="btn" disabled={!reviewByKey.has(resolvedActiveKey) || Boolean(savingKey) || bulkWorking} onClick={() => void saveObservation(activeObservation)}>{savingKey === resolvedActiveKey ? 'Saving…' : 'Save to SourcingOS'}</button>}
            {activeContact && <button className="btn secondary" disabled={Boolean(contactKey)} onClick={() => void findContact(activeObservation)}>{contactKey === resolvedActiveKey ? 'Refreshing contact…' : 'Refresh contact'}</button>}
          </div>

          {activeObservation.providerExplanation && <details className="advanced-disclosure" style={{ marginTop: 14 }}><summary>Why did this provider return this person?</summary><p className="muted" style={{ fontSize: 12, lineHeight: 1.55 }}>{activeObservation.providerExplanation}</p></details>}
        </aside>}
      </div>
    </section>}

    {response && !orderedObservations.length && !working && <section className="product-panel" style={{ marginTop: 14 }}><strong>No people returned.</strong><p className="muted" style={{ marginBottom: 0 }}>Try adding a company, location, title, or another identity anchor.</p></section>}

    {response && <details className="product-panel" style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Search diagnostics</summary>
      <div className="agentic-run-metrics" style={{ marginTop: 12 }}>
        <span><b>{response.discoveredBeforeCap || 0}</b><small>discovered</small></span>
        <span><b>{response.returnedAfterCap ?? orderedObservations.length}</b><small>returned</small></span>
        <span><b>{response.contributingProviders || 0}</b><small>sources contributed</small></span>
      </div>
      {!!response.telemetry?.length && <div className="agentic-source-status-row" style={{ marginTop: 12 }}>{response.telemetry.map(item => <span key={item.provider} className={`status-pill ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'warning' : ''}`}>{providerLabel(item.provider)} · {item.status} · {item.discovered}</span>)}</div>}
      {!!response.warnings?.length && <div className="agentic-warning-list" style={{ marginTop: 12 }}>{response.warnings.map(warning => <span key={warning}>⚠ {warning}</span>)}</div>}
      {!signingReady && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Results remain visible, but saving requires internal observation signing in this runtime.</p>}
    </details>}
  </>
}
