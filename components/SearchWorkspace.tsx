'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { CandidateRow, type CandidateRowPerson } from '@/components/CandidateRow'

type Requirement = { text: string; mustHave: boolean }
type ProviderRequest = {
  query: string
  requirements?: Requirement[]
  names?: string[]
  titles?: string[]
  skills?: string[]
  companies?: string[]
  locations?: string[]
  limit: number
  highFreshness: boolean
}
type ToolPlan = {
  tool: string
  rationale: string
  costClass: string
  freshnessClass: string
  approvalRequired: boolean
  executableNow: boolean
  targetCount?: number
}
type PeoplePlan = {
  action: 'search_people' | 'approval_required'
  assistantSummary: string
  providerRequest: ProviderRequest
  criteria: {
    titles: string[]
    skills: string[]
    companies: string[]
    locations: string[]
    requirements: Requirement[]
    limit: number
  }
  toolPlan: ToolPlan[]
  assumptions: string[]
  warnings: string[]
  model: { configured: boolean; used: boolean; provider?: string; model?: string }
}
type WebPlan = {
  action: 'search_web'
  assistantSummary: string
  webRequest: { action: 'search_web'; query: string }
  toolPlan: ToolPlan[]
  assumptions: string[]
  warnings: string[]
  model: { configured: boolean; used: boolean; provider?: string; model?: string }
}
type AgentPlan = PeoplePlan | WebPlan

type Observation = CandidateRowPerson & {
  observedAt?: string
  sourceUrl?: string
}
type Telemetry = {
  provider: string
  status: string
  discovered: number
  latencyMs: number
  message?: string
}
type SearchResult = {
  observations: Observation[]
  telemetry: Telemetry[]
  discoveredBeforeCap: number
  returnedAfterCap: number
  contributingProviders: number
  warnings: string[]
}
type ProviderStatus = {
  id: string
  label: string
  configured: boolean
  executableNow: boolean
  capabilities: string[]
  transports: string[]
  costClass: string
  freshness: string
}
type SearchHistory = {
  id: string
  query: string
  summary: string
  resultCount?: number
}
type WebResearch = {
  provider: string
  transport?: string
  tool?: string
  text: string
  observedAt?: string
  freshness?: string
}

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function meaningfulPhrases(text: string) {
  return text
    .replace(/^Preference:\s*/i, '')
    .split(/\s+(?:or|and\/or)\s+|\/|\||,/i)
    .map(value => value.trim().toLowerCase())
    .filter(value => value.length >= 3 && !/^\d+\+?\s*(?:years?|yrs?)/i.test(value))
}

function requirementObserved(person: Observation, requirement: string) {
  const haystack = [person.currentTitle, person.headline, person.currentEmployer, person.location, ...(person.skills || [])]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase()
  return meaningfulPhrases(requirement).some(phrase => haystack.includes(phrase))
}

function whySurfaced(person: Observation, plan?: PeoplePlan) {
  const querySkills = new Set((plan?.criteria.skills || []).map(value => value.toLowerCase()))
  const matched = (person.skills || []).filter(skill => querySkills.has(skill.toLowerCase())).slice(0, 3)
  if (matched.length) return `Observed ${matched.join(', ')} in ${label(person.provider)} evidence.`
  if (plan?.criteria.titles.some(title => (person.currentTitle || person.headline || '').toLowerCase().includes(title.toLowerCase()))) {
    return `Observed title aligns with ${plan.criteria.titles[0]}.`
  }
  return `Retrieved by ${label(person.provider)} for this search; review evidence before judging fit.`
}

function evidenceCount(person: Observation, plan?: PeoplePlan) {
  if (!plan) return 0
  const requirements = [
    ...plan.criteria.requirements.filter(item => item.mustHave).map(item => item.text),
    ...plan.criteria.skills,
  ]
  return Array.from(new Set(requirements)).filter(requirement => requirementObserved(person, requirement)).length
}

function contactLabel(value: boolean | 'unknown' | undefined) {
  if (value === true) return 'Available'
  if (value === false) return 'Not returned'
  return 'Unknown'
}

function statusClass(status: string) {
  const lower = status.toLowerCase()
  if (['completed', 'success', 'ready'].includes(lower)) return 'is-complete'
  if (['failed', 'error'].includes(lower)) return 'is-failed'
  if (['unavailable', 'disabled', 'skipped'].includes(lower)) return 'is-skipped'
  return 'is-pending'
}

export function SearchWorkspace() {
  const [query, setQuery] = useState('')
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [web, setWeb] = useState<WebResearch | null>(null)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [history, setHistory] = useState<SearchHistory[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [working, setWorking] = useState<'planning' | 'searching' | 'web' | ''>('')
  const [error, setError] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const peoplePlan = plan?.action === 'search_people' || plan?.action === 'approval_required' ? plan as PeoplePlan : undefined
  const observations = result?.observations || []
  const selected = selectedIndex === null ? null : observations[selectedIndex] || null

  useEffect(() => {
    let alive = true
    fetch('/api/agentic-sourcing/providers', { headers: { accept: 'application/json' } })
      .then(async response => {
        const json = await response.json().catch(() => ({}))
        if (alive && response.ok && json.ok && Array.isArray(json.providers)) setProviders(json.providers)
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!observations.length) return
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setSelectedIndex(current => Math.min(observations.length - 1, current === null ? 0 : current + 1))
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSelectedIndex(current => Math.max(0, current === null ? 0 : current - 1))
      }
      if (event.key === 'Escape') setSelectedIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [observations.length])

  const sourceTelemetry = useMemo(() => {
    if (result?.telemetry?.length) return result.telemetry
    if (!working) return []
    return providers
      .filter(provider => provider.configured && provider.executableNow && provider.capabilities.includes('search_people'))
      .slice(0, 10)
      .map(provider => ({ provider: provider.id, status: 'eligible', discovered: 0, latencyMs: 0, message: 'Eligible source; awaiting execution telemetry.' }))
  }, [providers, result, working])

  async function runSearch(event?: FormEvent) {
    event?.preventDefault()
    const message = query.trim()
    if (!message || working) return
    setError('')
    setResult(null)
    setWeb(null)
    setSelectedIndex(null)
    setWorking('planning')

    try {
      const planResponse = await fetch('/api/agent-runtime/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ message }),
      })
      const planJson = await planResponse.json().catch(() => ({}))
      if (!planResponse.ok || !planJson.ok || !planJson.plan) throw new Error(planJson.error || 'SourcingOS could not interpret this search.')
      const nextPlan = planJson.plan as AgentPlan
      setPlan(nextPlan)
      setHistory(current => [{ id: `${Date.now()}`, query: message, summary: nextPlan.assistantSummary }, ...current].slice(0, 6))

      if (nextPlan.action === 'search_web') {
        setWorking('web')
        const webResponse = await fetch('/api/agentic-sourcing/web', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(nextPlan.webRequest),
        })
        const webJson = await webResponse.json().catch(() => ({}))
        if (!webResponse.ok || !webJson.ok || !webJson.result) throw new Error(webJson.error || 'Live web research failed.')
        setWeb(webJson.result as WebResearch)
        return
      }

      if (nextPlan.action !== 'search_people') return
      setWorking('searching')
      const searchResponse = await fetch('/api/candidate-data/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(nextPlan.providerRequest),
      })
      const searchJson = await searchResponse.json().catch(() => ({}))
      if (!searchResponse.ok || !searchJson.ok) throw new Error(searchJson.error || 'People search failed.')
      const nextResult: SearchResult = {
        observations: Array.isArray(searchJson.observations) ? searchJson.observations : [],
        telemetry: Array.isArray(searchJson.telemetry) ? searchJson.telemetry : [],
        discoveredBeforeCap: Number(searchJson.discoveredBeforeCap || 0),
        returnedAfterCap: Number(searchJson.returnedAfterCap || 0),
        contributingProviders: Number(searchJson.contributingProviders || 0),
        warnings: Array.isArray(searchJson.warnings) ? searchJson.warnings : [],
      }
      setResult(nextResult)
      setHistory(current => current.map((item, index) => index === 0 ? { ...item, resultCount: nextResult.observations.length } : item))
      if (nextResult.observations.length) setSelectedIndex(0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search failed.')
    } finally {
      setWorking('')
    }
  }

  function editLastSearch() {
    const last = history[0]
    if (!last) return
    setQuery(last.query)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  const mustHaves = peoplePlan?.criteria.requirements.filter(item => item.mustHave) || []
  const preferences = peoplePlan?.criteria.requirements.filter(item => !item.mustHave) || []

  return <div className="search-workspace">
    <section className="search-workspace-left">
      <header className="search-pane-head">
        <div><span className="search-kicker">Search Brain</span><h1>Who are you looking for?</h1></div>
        <button type="button" className="search-icon-button" onClick={() => { setPlan(null); setResult(null); setWeb(null); setSelectedIndex(null); setQuery('') }} aria-label="New search">＋</button>
      </header>

      <form className="search-composer" onSubmit={runSearch}>
        <textarea ref={composerRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a RHEL admin with 5+ years near Annapolis Junction, MD with Secret clearance or higher…" rows={4} disabled={Boolean(working)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void runSearch() }} />
        <div className="search-composer-footer"><span>⌘↵ run search</span><button type="submit" disabled={!query.trim() || Boolean(working)}>{working ? 'Working…' : 'Search'}</button></div>
      </form>

      {plan && <section className="search-brief">
        <div className="search-section-title"><span>Interpretation</span><button type="button" onClick={editLastSearch}>Edit query</button></div>
        <p className="search-plan-summary">{plan.assistantSummary}</p>
        {peoplePlan && <div className="search-brief-groups">
          {!!peoplePlan.criteria.titles.length && <div><small>Role</small><div>{peoplePlan.criteria.titles.map(item => <span key={item}>{item}</span>)}</div></div>}
          {!!peoplePlan.criteria.locations.length && <div><small>Location</small><div>{peoplePlan.criteria.locations.map(item => <span key={item}>{item}</span>)}</div></div>}
          {!!mustHaves.length && <div><small>Must have</small><div>{mustHaves.map(item => <span className="is-must" key={item.text}>{item.text}</span>)}</div></div>}
          {!!preferences.length && <div><small>Prioritize</small><div>{preferences.map(item => <span key={item.text}>{item.text.replace(/^Preference:\s*/i, '')}</span>)}</div></div>}
          {!!peoplePlan.criteria.skills.length && <div><small>Discovery expansion</small><div>{peoplePlan.criteria.skills.slice(0, 10).map(item => <span key={item}>{item}</span>)}</div></div>}
        </div>}
        {!!plan.assumptions.length && <div className="search-assumptions"><b>Assumptions</b>{plan.assumptions.map(item => <span key={item}>{item}</span>)}</div>}
      </section>}

      <section className="search-history">
        <div className="search-section-title"><span>Conversation</span><small>{history.length ? `${history.length} turn${history.length === 1 ? '' : 's'}` : 'session'}</small></div>
        {!history.length ? <p className="search-empty-copy">Start with the hiring need. SourcingOS will expose what it understood before you judge the slate.</p> : history.map(item => <button type="button" key={item.id} onClick={() => { setQuery(item.query); requestAnimationFrame(() => composerRef.current?.focus()) }}><strong>{item.query}</strong><span>{item.summary}</span>{typeof item.resultCount === 'number' && <small>{item.resultCount} retained</small>}</button>)}
      </section>
    </section>

    <main className="search-workspace-center">
      <header className="search-results-head">
        <div><span className="search-kicker">Candidate slate</span><h2>{working ? 'Researching talent…' : result ? `${observations.length} retained candidates` : web ? 'Live web research' : 'Your results will appear here'}</h2></div>
        <div className="search-results-meta">
          {result && <><span>{result.discoveredBeforeCap || observations.length} discovered</span><span>{result.contributingProviders || 0} sources</span></>}
          {!!observations.length && <span>J/K review</span>}
        </div>
      </header>

      <section className="provider-progress" aria-label="Source execution status">
        <div className="search-section-title"><span>Source execution</span><small>{working ? 'in progress' : sourceTelemetry.length ? 'latest search' : 'ready'}</small></div>
        {working && <div className="provider-progress-bar"><span /></div>}
        <div className="provider-progress-list">
          {sourceTelemetry.length ? sourceTelemetry.map(item => <div className={`provider-progress-item ${statusClass(item.status)}`} key={item.provider} title={item.message || ''}><i /><span>{label(item.provider)}</span><b>{item.status === 'eligible' ? 'eligible' : item.status}</b>{item.discovered > 0 && <small>{item.discovered}</small>}</div>) : <span className="search-empty-copy">Provider execution telemetry will appear here. Eligible is not the same as executed.</span>}
        </div>
      </section>

      {working === 'searching' && <div className="candidate-skeleton-list" aria-label="Loading candidates">{Array.from({ length: 6 }).map((_, index) => <div className="candidate-skeleton" key={index}><i /><span /><span /><b /></div>)}</div>}

      {!working && !result && !web && <div className="search-zero-state"><div className="search-zero-mark">⌕</div><h3>Search starts with intent, not filters.</h3><p>Describe the role in recruiter language. SourcingOS will separate requirements from discovery expansion, execute connected sources, and keep evidence uncertainty visible.</p><div><button type="button" onClick={() => setQuery('Find 25 backend engineers in Minneapolis, MN with AWS + Kubernetes')}>Backend engineers · Minneapolis</button><button type="button" onClick={() => setQuery('Find a RHEL admin near Annapolis Junction, MD with Secret clearance or higher')}>RHEL · Secret+ · Maryland</button></div></div>}

      {error && <div className="search-error">{error}</div>}

      {result && <div className="candidate-slate">{observations.map((person, index) => <CandidateRow key={`${person.provider}:${person.providerPersonId}`} person={person} rank={index + 1} selected={selectedIndex === index} why={whySurfaced(person, peoplePlan)} evidenceCount={evidenceCount(person, peoplePlan)} onSelect={() => setSelectedIndex(index)} />)}{!observations.length && <div className="search-zero-state compact"><h3>No candidates cleared this search.</h3><p>Refine the brief rather than treating missing evidence as rejection. Provider failures and zero-result sources remain visible above.</p></div>}</div>}

      {web && <div className="search-web-result"><div><span className="search-kicker">{label(web.provider)} · {web.transport || 'live'}</span><h3>Fresh external research</h3></div><pre>{web.text}</pre><p>External web material is untrusted evidence input. It is not automatically candidate truth, identity verification, qualification, or permission to contact.</p></div>}
    </main>

    <aside className={`search-workspace-right ${selected ? 'has-selection' : ''}`}>
      {!selected ? <div className="inspector-empty"><span className="search-kicker">Evidence inspector</span><div className="inspector-avatar">◎</div><h3>Select a candidate</h3><p>Open a row to inspect the observations that support the search, what is still unknown, source provenance, and contact availability.</p></div> : <CandidateInspector person={selected} plan={peoplePlan} rank={(selectedIndex || 0) + 1} total={observations.length} onClose={() => setSelectedIndex(null)} onPrev={() => setSelectedIndex(current => Math.max(0, (current || 0) - 1))} onNext={() => setSelectedIndex(current => Math.min(observations.length - 1, (current || 0) + 1))} />}
    </aside>
  </div>
}

function CandidateInspector({ person, plan, rank, total, onClose, onPrev, onNext }: { person: Observation; plan?: PeoplePlan; rank: number; total: number; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  const requirements = Array.from(new Set([
    ...(plan?.criteria.requirements.filter(item => item.mustHave).map(item => item.text) || []),
    ...(plan?.criteria.skills || []),
  ])).slice(0, 12)
  const linkedin = person.profileUrls?.find(item => item.kind === 'linkedin')?.url
  return <div className="candidate-inspector">
    <header className="candidate-inspector-nav"><span>{rank} of {total}</span><div><button type="button" onClick={onPrev} disabled={rank <= 1} aria-label="Previous candidate">↑</button><button type="button" onClick={onNext} disabled={rank >= total} aria-label="Next candidate">↓</button><button type="button" onClick={onClose} aria-label="Close candidate">×</button></div></header>
    <section className="candidate-inspector-identity"><span className="candidate-inspector-source">{label(person.provider)} observation</span><h2>{person.displayName}</h2><p>{[person.currentTitle || person.headline, person.currentEmployer].filter(Boolean).join(' · ') || 'Professional profile'}</p><small>{person.location || 'Location not evidenced'}</small>{linkedin && <a href={linkedin} target="_blank" rel="noreferrer">Open public profile ↗</a>}</section>

    <section className="candidate-inspector-section"><div className="search-section-title"><span>Requirement evidence</span><small>observation-level</small></div>{requirements.length ? <div className="requirement-evidence-list">{requirements.map(requirement => { const observed = requirementObserved(person, requirement); return <div key={requirement} className={observed ? 'is-supported' : 'is-unknown'}><i>{observed ? '✓' : '?'}</i><span><b>{requirement}</b><small>{observed ? 'Supported by visible provider observation; not independently verified.' : 'Not evidenced in the current observation. Do not treat as a fail.'}</small></span></div> })}</div> : <p className="search-empty-copy">Run a people search to compare this candidate against explicit requirements.</p>}</section>

    <section className="candidate-inspector-section"><div className="search-section-title"><span>Observed skills</span><small>{person.skills?.length || 0}</small></div>{person.skills?.length ? <div className="inspector-skill-list">{person.skills.slice(0, 18).map(skill => <span key={skill}>{skill}</span>)}</div> : <p className="search-empty-copy">No structured skills were returned by this observation.</p>}</section>

    <section className="candidate-inspector-section"><div className="search-section-title"><span>Contact state</span><small>tri-state</small></div><div className="inspector-contact-grid"><div><small>Work/personal email</small><b>{contactLabel(person.contactAvailability?.email)}</b></div><div><small>Phone</small><b>{contactLabel(person.contactAvailability?.phone)}</b></div></div><p className="inspector-note">Availability is not ownership verification, deliverability, or permission to contact. Paid enrichment remains recruiter-approved.</p></section>

    <section className="candidate-inspector-section"><div className="search-section-title"><span>Provenance</span><small>{person.observedAt ? new Date(person.observedAt).toLocaleDateString() : 'current search'}</small></div><div className="inspector-provenance"><span>{label(person.provider)}</span>{person.profileUrls?.slice(0, 4).map(item => <a key={`${item.kind}:${item.url}`} href={item.url} target="_blank" rel="noreferrer">{label(item.kind)} ↗</a>)}</div></section>

    <footer className="candidate-inspector-actions"><button type="button" className="secondary-action">Save</button><button type="button" className="primary-action">Open Candidate 360</button></footer>
  </div>
}
