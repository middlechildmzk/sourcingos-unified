'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { CandidateRow, type CandidateRowPerson } from '@/components/CandidateRow'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type Requirement = { text: string; mustHave: boolean }
type ProviderRequest = { query: string; requirements?: Requirement[]; names?: string[]; titles?: string[]; skills?: string[]; companies?: string[]; locations?: string[]; limit: number; highFreshness: boolean }
type ToolPlan = { tool: string; rationale: string; costClass: string; freshnessClass: string; approvalRequired: boolean; executableNow: boolean; targetCount?: number }
type PeoplePlan = { action: 'search_people' | 'approval_required'; assistantSummary: string; providerRequest: ProviderRequest; criteria: { titles: string[]; skills: string[]; companies: string[]; locations: string[]; requirements: Requirement[]; limit: number }; toolPlan: ToolPlan[]; assumptions: string[]; warnings: string[]; model: { configured: boolean; used: boolean; provider?: string; model?: string } }
type WebPlan = { action: 'search_web'; assistantSummary: string; webRequest: { action: 'search_web'; query: string }; toolPlan: ToolPlan[]; assumptions: string[]; warnings: string[]; model: { configured: boolean; used: boolean; provider?: string; model?: string } }
type AgentPlan = PeoplePlan | WebPlan
type Observation = CandidateRowPerson & { observedAt?: string; sourceUrl?: string }
type Telemetry = { provider: string; status: string; discovered: number; latencyMs: number; message?: string }
type SearchResult = { observations: Observation[]; telemetry: Telemetry[]; discoveredBeforeCap: number; returnedAfterCap: number; contributingProviders: number; warnings: string[] }
type ProviderStatus = { id: string; label: string; configured: boolean; executableNow: boolean; capabilities: string[]; transports: string[]; costClass: string; freshness: string }
type WebResearch = { provider: string; transport?: string; tool?: string; text: string; observedAt?: string; freshness?: string }
type ContactSignal = { type: string; channelKind?: string; value: string; sourceProvider?: string; deliverability?: string; permissionStatus?: string }
type ContactOutcome = { person: Observation; signals: ContactSignal[]; message: string; error?: string }
type Turn = { id: string; query: string; summary: string; plan: AgentPlan; count?: number }

function label(value: string) { return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ') }
function phrases(text: string) { return text.replace(/^Preference:\s*/i, '').split(/\s+(?:or|and\/or)\s+|\/|\||,/i).map(value => value.trim().toLowerCase()).filter(value => value.length >= 3 && !/^\d+\+?\s*(?:years?|yrs?)/i.test(value)) }
function observed(person: Observation, requirement: string) { const haystack = [person.currentTitle, person.headline, person.currentEmployer, person.location, ...(person.skills || [])].filter(Boolean).join(' | ').toLowerCase(); return phrases(requirement).some(phrase => haystack.includes(phrase)) }
function contactLabel(value: boolean | 'unknown' | undefined) { return value === true ? 'Available' : value === false ? 'Not returned' : 'Unknown' }
function statusClass(status: string) { const value = status.toLowerCase(); return ['completed', 'success', 'ready'].includes(value) ? 'is-complete' : ['failed', 'error'].includes(value) ? 'is-failed' : ['unavailable', 'disabled', 'skipped'].includes(value) ? 'is-skipped' : 'is-pending' }
function why(person: Observation, plan?: PeoplePlan) { const skills = new Set((plan?.criteria.skills || []).map(value => value.toLowerCase())); const matches = (person.skills || []).filter(skill => skills.has(skill.toLowerCase())).slice(0, 3); if (matches.length) return `Observed ${matches.join(', ')} in ${label(person.provider)} evidence.`; if (plan?.criteria.titles.some(title => (person.currentTitle || person.headline || '').toLowerCase().includes(title.toLowerCase()))) return `Observed title aligns with ${plan.criteria.titles[0]}.`; return `Retrieved by ${label(person.provider)} for this search; review evidence before judging fit.` }
function evidenceCount(person: Observation, plan?: PeoplePlan) { if (!plan) return 0; return Array.from(new Set([...plan.criteria.requirements.filter(item => item.mustHave).map(item => item.text), ...plan.criteria.skills])).filter(value => observed(person, value)).length }
function identityPayload(person: Observation) { const linkedinUrl = person.profileUrls?.find(item => item.kind === 'linkedin')?.url; return { providerName: person.provider, providerPersonId: person.providerPersonId, fullName: person.displayName, title: person.currentTitle || person.headline, currentCompany: person.currentEmployer, location: person.location, profileUrl: linkedinUrl || person.profileUrls?.[0]?.url, linkedinUrl, sourceContext: 'search_workspace_v37' } }
function rolePrompt(role: ReturnType<typeof useRoleWorkspaces>['roles'][number]) { return [role.intake.title, role.intake.location !== 'Not specified' ? `in or near ${role.intake.location}` : '', role.intake.clearance !== 'Not specified' ? `${role.intake.clearance} clearance` : '', role.intake.mustHaves.length ? `must have ${role.intake.mustHaves.join(', ')}` : '', role.intake.niceToHaves.length ? `prioritize ${role.intake.niceToHaves.join(', ')}` : ''].filter(Boolean).join(' · ') }

export function SearchWorkspaceV37({ initialQuery = '', roleId, source }: { initialQuery?: string; roleId?: string; source?: string }) {
  const { roles } = useRoleWorkspaces()
  const role = roleId ? roles.find(item => item.id === roleId) : undefined
  const [query, setQuery] = useState(initialQuery)
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [previousPlan, setPreviousPlan] = useState<PeoplePlan | undefined>()
  const [result, setResult] = useState<SearchResult | null>(null)
  const [web, setWeb] = useState<WebResearch | null>(null)
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [turns, setTurns] = useState<Turn[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [working, setWorking] = useState<'planning' | 'searching' | 'web' | 'contacts' | ''>('')
  const [error, setError] = useState('')
  const [contacts, setContacts] = useState<ContactOutcome[]>([])
  const prefilledRole = useRef(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const peoplePlan = plan?.action === 'search_people' || plan?.action === 'approval_required' ? plan as PeoplePlan : undefined
  const observations = result?.observations || []
  const selected = selectedIndex === null ? null : observations[selectedIndex] || null

  useEffect(() => {
    if (!initialQuery && role && !prefilledRole.current) { setQuery(rolePrompt(role)); prefilledRole.current = true }
  }, [initialQuery, role])

  useEffect(() => {
    let alive = true
    fetch('/api/agentic-sourcing/providers', { headers: { accept: 'application/json' }, cache: 'no-store' }).then(async response => {
      const json = await response.json().catch(() => ({}))
      if (alive && response.ok && json.ok && Array.isArray(json.providers)) setProviders(json.providers)
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!observations.length) return
      if (event.key.toLowerCase() === 'j') { event.preventDefault(); setSelectedIndex(current => Math.min(observations.length - 1, current === null ? 0 : current + 1)) }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setSelectedIndex(current => Math.max(0, current === null ? 0 : current - 1)) }
      if (event.key === 'Escape') setSelectedIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [observations.length])

  const sourceTelemetry = useMemo(() => {
    if (result?.telemetry?.length) return result.telemetry
    if (!working || working === 'contacts') return []
    const capability = working === 'web' ? 'search_web' : 'search_people'
    return providers.filter(provider => provider.configured && provider.executableNow && provider.capabilities.includes(capability)).slice(0, 12).map(provider => ({ provider: provider.id, status: 'eligible', discovered: 0, latencyMs: 0, message: 'Eligible source; awaiting execution telemetry.' }))
  }, [providers, result, working])

  async function run(event?: FormEvent) {
    event?.preventDefault()
    const message = query.trim()
    if (!message || working) return
    setError(''); setWeb(null); setContacts([]); setWorking('planning')
    try {
      const response = await fetch('/api/agent-runtime/plan', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ message, ...(previousPlan ? { previousPlan } : {}) }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok || !json.plan) throw new Error(json.error || 'SourcingOS could not interpret this search.')
      const next = json.plan as AgentPlan
      setPlan(next)
      setTurns(current => [{ id: `${Date.now()}`, query: message, summary: next.assistantSummary, plan: next }, ...current].slice(0, 8))
      if (next.action === 'search_web') {
        setWorking('web')
        const webResponse = await fetch('/api/agentic-sourcing/web', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(next.webRequest) })
        const webJson = await webResponse.json().catch(() => ({}))
        if (!webResponse.ok || !webJson.ok || !webJson.result) throw new Error(webJson.error || 'Live web research failed.')
        setWeb(webJson.result as WebResearch)
        return
      }
      if (next.action === 'approval_required') return
      setPreviousPlan(next)
      setWorking('searching'); setResult(null); setSelectedIndex(null)
      const searchResponse = await fetch('/api/candidate-data/search', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(next.providerRequest) })
      const searchJson = await searchResponse.json().catch(() => ({}))
      if (!searchResponse.ok || !searchJson.ok) throw new Error(searchJson.error || 'People search failed.')
      const nextResult: SearchResult = { observations: Array.isArray(searchJson.observations) ? searchJson.observations : [], telemetry: Array.isArray(searchJson.telemetry) ? searchJson.telemetry : [], discoveredBeforeCap: Number(searchJson.discoveredBeforeCap || 0), returnedAfterCap: Number(searchJson.returnedAfterCap || 0), contributingProviders: Number(searchJson.contributingProviders || 0), warnings: Array.isArray(searchJson.warnings) ? searchJson.warnings : [] }
      setResult(nextResult)
      setTurns(current => current.map((turn, index) => index === 0 ? { ...turn, count: nextResult.observations.length } : turn))
      if (nextResult.observations.length) setSelectedIndex(0)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Search failed.') } finally { setWorking('') }
  }

  async function approveContacts() {
    if (!peoplePlan || !result?.observations.length || working) return
    const count = Math.max(1, Math.min(10, peoplePlan.toolPlan.find(item => item.tool === 'find_contacts')?.targetCount || 1))
    setWorking('contacts'); setContacts([]); setError('')
    const outcomes: ContactOutcome[] = []
    try {
      for (const person of result.observations.slice(0, count)) {
        try {
          const response = await fetch('/api/contact-enrichment/find', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ purpose: 'contact_bundle', ...identityPayload(person) }) })
          const json = await response.json().catch(() => ({}))
          outcomes.push({ person, signals: Array.isArray(json.signals) ? json.signals : [], message: String(json.message || json.error || 'Contact lookup completed.'), ...(!response.ok || !json.ok ? { error: String(json.error || 'Contact lookup failed.') } : {}) })
        } catch (caught) { outcomes.push({ person, signals: [], message: 'Contact lookup failed.', error: caught instanceof Error ? caught.message : 'Contact lookup failed.' }) }
        setContacts([...outcomes])
      }
    } finally { setWorking('') }
  }

  const must = peoplePlan?.criteria.requirements.filter(item => item.mustHave) || []
  const preferences = peoplePlan?.criteria.requirements.filter(item => !item.mustHave) || []
  const contactTool = peoplePlan?.toolPlan.find(item => item.tool === 'find_contacts')

  return <div className="search-workspace">
    <section className="search-workspace-left">
      <header className="search-pane-head"><div><span className="search-kicker">Search Brain</span><h1>Who are you looking for?</h1></div><button type="button" className="search-icon-button" onClick={() => { setPlan(null); setPreviousPlan(undefined); setResult(null); setWeb(null); setSelectedIndex(null); setContacts([]); setQuery(role ? rolePrompt(role) : '') }} aria-label="New search">＋</button></header>
      {role && <div className="search-role-context"><span><b>{role.intake.title}</b><small>Role-linked search · nothing runs until you press Search.</small></span><Link href={`/app/roles/${encodeURIComponent(role.id)}`}>Back to role</Link></div>}
      {!role && source && source !== 'direct' && <div className="search-route-context">Consolidated from {label(source.replaceAll('-', '_'))}. One Search Brain now owns people discovery.</div>}
      <form className="search-composer" onSubmit={run}><textarea ref={composerRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a RHEL admin with 5+ years near Annapolis Junction, MD with Secret clearance or higher…" rows={4} disabled={Boolean(working)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void run() }} /><div className="search-composer-footer"><span>⌘↵ run search</span><button type="submit" disabled={!query.trim() || Boolean(working)}>{working && working !== 'contacts' ? 'Working…' : 'Search'}</button></div></form>

      {plan && <section className="search-brief"><div className="search-section-title"><span>Interpretation</span><small>{plan.model.used ? `${label(plan.model.provider || 'AI')} planner` : 'deterministic planner'}</small></div><p className="search-plan-summary">{plan.assistantSummary}</p>{peoplePlan && <div className="search-brief-groups">{!!peoplePlan.criteria.titles.length && <div><small>Role</small><div>{peoplePlan.criteria.titles.map(item => <span key={item}>{item}</span>)}</div></div>}{!!peoplePlan.criteria.locations.length && <div><small>Location</small><div>{peoplePlan.criteria.locations.map(item => <span key={item}>{item}</span>)}</div></div>}{!!must.length && <div><small>Must have</small><div>{must.map(item => <span className="is-must" key={item.text}>{item.text}</span>)}</div></div>}{!!preferences.length && <div><small>Prioritize</small><div>{preferences.map(item => <span key={item.text}>{item.text.replace(/^Preference:\s*/i, '')}</span>)}</div></div>}{!!peoplePlan.criteria.skills.length && <div><small>Discovery expansion</small><div>{peoplePlan.criteria.skills.slice(0, 10).map(item => <span key={item}>{item}</span>)}</div></div>}</div>}{!!plan.assumptions.length && <div className="search-assumptions"><b>Assumptions</b>{plan.assumptions.map(item => <span key={item}>{item}</span>)}</div>}</section>}

      <section className="search-history"><div className="search-section-title"><span>Conversation</span><small>{turns.length ? `${turns.length} turn${turns.length === 1 ? '' : 's'}` : 'session'}</small></div>{!turns.length ? <p className="search-empty-copy">Start with the hiring need. After the first search, type refinements naturally; the Search Brain keeps the prior criteria in context.</p> : turns.map(turn => <button type="button" key={turn.id} onClick={() => { setQuery(turn.query); requestAnimationFrame(() => composerRef.current?.focus()) }}><strong>{turn.query}</strong><span>{turn.summary}</span>{typeof turn.count === 'number' && <small>{turn.count} retained</small>}</button>)}</section>
    </section>

    <main className="search-workspace-center">
      <header className="search-results-head"><div><span className="search-kicker">Candidate slate</span><h2>{working === 'searching' ? 'Researching talent…' : result ? `${observations.length} retained candidates` : web ? 'Live web research' : plan?.action === 'approval_required' ? 'Approval required' : 'Your results will appear here'}</h2></div><div className="search-results-meta">{result && <><span>{result.discoveredBeforeCap || observations.length} discovered</span><span>{result.contributingProviders || 0} sources</span></>}{!!observations.length && <span>J/K review</span>}</div></header>

      <section className="provider-progress" aria-label="Source execution status"><div className="search-section-title"><span>Source execution</span><small>{working && working !== 'contacts' ? 'in progress' : sourceTelemetry.length ? 'latest search' : 'ready'}</small></div>{working && working !== 'contacts' && <div className="provider-progress-bar"><span /></div>}<div className="provider-progress-list">{sourceTelemetry.length ? sourceTelemetry.map(item => <div className={`provider-progress-item ${statusClass(item.status)}`} key={item.provider} title={item.message || ''}><i /><span>{label(item.provider)}</span><b>{item.status === 'eligible' ? 'eligible' : item.status}</b>{item.discovered > 0 && <small>{item.discovered}</small>}</div>) : <span className="search-empty-copy">Provider execution telemetry will appear here. Eligible is not the same as executed.</span>}</div></section>

      {working === 'searching' && <div className="candidate-skeleton-list">{Array.from({ length: 6 }).map((_, index) => <div className="candidate-skeleton" key={index}><i /><span /><span /><b /></div>)}</div>}
      {!working && !result && !web && plan?.action !== 'approval_required' && <div className="search-zero-state"><div className="search-zero-mark">⌕</div><h3>Search starts with intent, not filters.</h3><p>Describe the role in recruiter language. SourcingOS separates requirements from discovery expansion and keeps evidence uncertainty visible.</p><div><button type="button" onClick={() => setQuery('Find 25 backend engineers in Minneapolis, MN with AWS + Kubernetes')}>Backend engineers · Minneapolis</button><button type="button" onClick={() => setQuery('Find a RHEL admin near Annapolis Junction, MD with Secret clearance or higher')}>RHEL · Secret+ · Maryland</button></div></div>}
      {error && <div className="search-error">{error}</div>}

      {plan?.action === 'approval_required' && contactTool && <section className="search-approval-card"><div><span className="search-kicker">Recruiter approval</span><h3>Find contact info for the top {contactTool.targetCount || 1}</h3><p>Paid contact reads require explicit approval. SourcingOS will use the preceding ranked slate; no outreach or ATS write occurs.</p></div><button type="button" disabled={working === 'contacts' || !result?.observations.length} onClick={() => void approveContacts()}>{working === 'contacts' ? 'Enriching…' : 'Approve contact lookup'}</button></section>}
      {!!contacts.length && <div className="search-contact-results">{contacts.map((outcome, index) => <div key={`${outcome.person.provider}:${outcome.person.providerPersonId}`}><span>{index + 1}</span><div><strong>{outcome.person.displayName}</strong>{outcome.signals.length ? outcome.signals.map(signal => <p key={`${signal.type}:${signal.value}:${signal.sourceProvider || ''}`}><b>{label(signal.channelKind || signal.type)}</b> {signal.value} <small>{[signal.sourceProvider ? label(signal.sourceProvider) : '', signal.deliverability, signal.permissionStatus === 'do_not_contact' ? 'DNC' : ''].filter(Boolean).join(' · ')}</small></p>) : <p className="search-empty-copy">{outcome.error || outcome.message}</p>}</div></div>)}</div>}

      {result && <div className="candidate-slate">{observations.map((person, index) => <CandidateRow key={`${person.provider}:${person.providerPersonId}`} person={person} rank={index + 1} selected={selectedIndex === index} why={why(person, peoplePlan)} evidenceCount={evidenceCount(person, peoplePlan)} onSelect={() => setSelectedIndex(index)} />)}{!observations.length && <div className="search-zero-state compact"><h3>No candidates cleared this search.</h3><p>Refine the brief rather than treating missing evidence as rejection. Provider failures and zero-result sources remain visible above.</p></div>}</div>}
      {web && <div className="search-web-result"><div><span className="search-kicker">{label(web.provider)} · {web.transport || 'live'}</span><h3>Fresh external research</h3></div><pre>{web.text}</pre><p>External web material is untrusted evidence input. It is not automatically candidate truth, identity verification, qualification, or permission to contact.</p></div>}
    </main>

    <aside className={`search-workspace-right ${selected ? 'has-selection' : ''}`}>{!selected ? <div className="inspector-empty"><span className="search-kicker">Evidence inspector</span><div className="inspector-avatar">◎</div><h3>Select a candidate</h3><p>Open a row to inspect requirement evidence, uncertainty, provenance, and contact availability.</p></div> : <CandidateInspector person={selected} plan={peoplePlan} rank={(selectedIndex || 0) + 1} total={observations.length} onClose={() => setSelectedIndex(null)} onPrev={() => setSelectedIndex(current => Math.max(0, (current || 0) - 1))} onNext={() => setSelectedIndex(current => Math.min(observations.length - 1, (current || 0) + 1))} />}</aside>
  </div>
}

function CandidateInspector({ person, plan, rank, total, onClose, onPrev, onNext }: { person: Observation; plan?: PeoplePlan; rank: number; total: number; onClose: () => void; onPrev: () => void; onNext: () => void }) {
  const requirements = Array.from(new Set([...(plan?.criteria.requirements.filter(item => item.mustHave).map(item => item.text) || []), ...(plan?.criteria.skills || [])])).slice(0, 12)
  const publicLinks = person.profileUrls || []
  return <div className="candidate-inspector"><header className="candidate-inspector-nav"><span>{rank} of {total}</span><div><button type="button" onClick={onPrev} disabled={rank <= 1}>↑</button><button type="button" onClick={onNext} disabled={rank >= total}>↓</button><button type="button" onClick={onClose}>×</button></div></header><section className="candidate-inspector-identity"><span className="candidate-inspector-source">{label(person.provider)} observation</span><h2>{person.displayName}</h2><p>{[person.currentTitle || person.headline, person.currentEmployer].filter(Boolean).join(' · ') || 'Professional profile'}</p><small>{person.location || 'Location not evidenced'}</small>{publicLinks[0] && <a href={publicLinks[0].url} target="_blank" rel="noreferrer">Open public profile ↗</a>}</section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Requirement evidence</span><small>observation-level</small></div>{requirements.length ? <div className="requirement-evidence-list">{requirements.map(requirement => { const supported = observed(person, requirement); return <div key={requirement} className={supported ? 'is-supported' : 'is-unknown'}><i>{supported ? '✓' : '?'}</i><span><b>{requirement}</b><small>{supported ? 'Supported by visible provider observation; not independently verified.' : 'Not evidenced in the current observation. Do not treat as a fail.'}</small></span></div> })}</div> : <p className="search-empty-copy">Run a people search to compare this candidate against explicit requirements.</p>}</section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Observed skills</span><small>{person.skills?.length || 0}</small></div>{person.skills?.length ? <div className="inspector-skill-list">{person.skills.slice(0, 18).map(skill => <span key={skill}>{skill}</span>)}</div> : <p className="search-empty-copy">No structured skills were returned by this observation.</p>}</section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Contact state</span><small>tri-state</small></div><div className="inspector-contact-grid"><div><small>Email</small><b>{contactLabel(person.contactAvailability?.email)}</b></div><div><small>Phone</small><b>{contactLabel(person.contactAvailability?.phone)}</b></div></div><p className="inspector-note">Availability is not ownership verification, deliverability, or permission to contact. Paid enrichment remains recruiter-approved.</p></section>
    <section className="candidate-inspector-section"><div className="search-section-title"><span>Provenance</span><small>{person.observedAt ? new Date(person.observedAt).toLocaleDateString() : 'current search'}</small></div><div className="inspector-provenance"><span>{label(person.provider)}</span>{publicLinks.slice(0, 4).map(item => <a key={`${item.kind}:${item.url}`} href={item.url} target="_blank" rel="noreferrer">{label(item.kind)} ↗</a>)}</div></section>
    <footer className="search-inspector-trust-footer">Search observations are read-only until you explicitly save, enrich, or add a canonical person through a supported workflow.</footer></div>
}
