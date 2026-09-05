'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

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
  version: 'v36.15'
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
  readOnly: true
  model: { configured: boolean; used: boolean; provider?: string; model?: string }
  assumptions: string[]
  warnings: string[]
}
type WebPlan = {
  version: 'v36.16'
  action: 'search_web'
  assistantSummary: string
  webRequest: { action: 'search_web'; query: string }
  toolPlan: ToolPlan[]
  readOnly: true
  model: { configured: boolean; used: false; provider?: string; model?: string }
  assumptions: string[]
  warnings: string[]
}
type AgentPlan = PeoplePlan | WebPlan

type ProfileUrl = { kind: string; url: string }
type Observation = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills?: string[]
  profileUrls?: ProfileUrl[]
  contactAvailability?: { email: boolean | 'unknown'; phone: boolean | 'unknown' }
  observedAt?: string
}
type Telemetry = { provider: string; status: string; discovered: number; latencyMs: number; message?: string }
type SearchResult = {
  observations: Observation[]
  telemetry: Telemetry[]
  discoveredBeforeCap: number
  returnedAfterCap: number
  contributingProviders: number
  warnings: string[]
}
type WebResearchResult = {
  provider: string
  transport?: string
  tool?: string
  text: string
  observedAt?: string
  freshness?: string
  trust?: { externalContentIsUntrusted?: boolean; becomesCandidateFact?: boolean }
}
type ContactSignal = {
  type: 'email' | 'phone'
  value: string
  channelKind?: string
  sourceProvider?: string
  confidence?: string
  deliverability?: string
}
type ContactOutcome = {
  person: Observation
  ok: boolean
  message: string
  signals: ContactSignal[]
  missingGoals: string[]
  error?: string
}
type ContactBatch = {
  requested: number
  outcomes: ContactOutcome[]
}
type Turn = {
  id: string
  user: string
  plan?: AgentPlan
  search?: SearchResult
  web?: WebResearchResult
  contact?: ContactBatch
  error?: string
}

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function channel(value: boolean | 'unknown' | undefined) {
  if (value === true) return 'available'
  if (value === false) return 'not returned'
  return 'unknown'
}

function criterionGroups(plan: AgentPlan) {
  if (!('criteria' in plan)) return []
  const groups: Array<{ label: string; values: string[]; kind?: 'must' | 'preference' }> = []
  if (plan.criteria.titles.length) groups.push({ label: 'Role / titles', values: plan.criteria.titles })
  if (plan.criteria.skills.length) groups.push({ label: 'Skills', values: plan.criteria.skills })
  if (plan.criteria.locations.length) groups.push({ label: 'Location', values: plan.criteria.locations })
  if (plan.criteria.companies.length) groups.push({ label: 'Company', values: plan.criteria.companies })
  const must = plan.criteria.requirements.filter(item => item.mustHave).map(item => item.text)
  const preferences = plan.criteria.requirements.filter(item => !item.mustHave && /^Preference:/i.test(item.text)).map(item => item.text.replace(/^Preference:\s*/i, ''))
  if (must.length) groups.push({ label: 'Must haves', values: must, kind: 'must' })
  if (preferences.length) groups.push({ label: 'Prioritize', values: preferences, kind: 'preference' })
  return groups
}

function PlanCard({ plan }: { plan: AgentPlan }) {
  const groups = plan.action === 'search_people' ? criterionGroups(plan) : []
  const executionLabel = plan.action === 'search_people'
    ? 'auto-run people search'
    : plan.action === 'search_web'
      ? 'auto-run live web'
      : 'approval gated'
  return <div className="agent-chat-plan">
    <div className="agent-chat-plan-head">
      <div>
        <span className="kicker">SourcingOS interpretation</span>
        <div className="agent-chat-answer">{plan.assistantSummary}</div>
      </div>
      <div className="chips">
        <span className="status-pill success">{executionLabel}</span>
        <span className="status-pill">{plan.model.used ? `${label(plan.model.provider || 'AI')} · ${plan.model.model || 'model'}` : 'deterministic planner'}</span>
      </div>
    </div>
    {!!groups.length && <div className="agent-chat-criteria">
      {groups.map(group => <div key={group.label} className="agent-chat-criterion">
        <small>{group.label}</small>
        <div className="chips">{group.values.slice(0, 12).map(value => <span className={group.kind === 'must' ? 'status-pill success' : 'tag'} key={value}>{value}</span>)}</div>
      </div>)}
    </div>}
    <div className="agent-tool-trace">
      {plan.toolPlan.map((tool, index) => <div className="product-row" key={`${tool.tool}-${index}`}>
        <div className="product-row-main">
          <div className="product-row-title">{tool.executableNow ? '→' : '⏸'} {tool.tool}</div>
          <div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{tool.rationale}</div>
        </div>
        <div className="chips">
          <span className="status-pill">{tool.costClass}</span>
          <span className="status-pill">{tool.freshnessClass}</span>
          {tool.approvalRequired && <span className="status-pill">approval required</span>}
        </div>
      </div>)}
    </div>
    {!!plan.warnings.length && <details className="advanced-disclosure" style={{ marginTop: 10 }}><summary>Planner notes ({plan.warnings.length})</summary><div className="product-list" style={{ marginTop: 8 }}>{plan.warnings.map((warning, index) => <div className="product-row" key={`${warning}-${index}`}><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{warning}</div></div>)}</div></details>}
  </div>
}

function SearchResults({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false)
  const retained = result.observations || []
  const visible = expanded ? retained : retained.slice(0, 8)
  return <div className="agent-chat-search-result">
    <div className="agent-chat-result-summary">
      <div><span className="kicker">Search result</span><h3 style={{ margin: '4px 0 0' }}>{retained.length} people returned</h3></div>
      <div className="chips">
        <span className="status-pill">{result.discoveredBeforeCap || retained.length} discovered</span>
        <span className="status-pill success">{result.returnedAfterCap || retained.length} retained</span>
        <span className="status-pill">{result.contributingProviders || 0} sources</span>
      </div>
    </div>

    <div className="agent-chat-candidates">
      {visible.map((person, index) => <div className="agent-chat-candidate" key={`${person.provider}:${person.providerPersonId}`}>
        <div className="agent-chat-candidate-rank">{index + 1}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="agent-chat-candidate-head">
            <strong>{person.displayName}</strong>
            <span className="status-pill">{label(person.provider)}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{[person.currentTitle || person.headline, person.currentEmployer, person.location].filter(Boolean).join(' · ') || 'Professional observation'}</div>
          {!!person.skills?.length && <div className="chips" style={{ marginTop: 7 }}>{person.skills.slice(0, 6).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>}
          <div className="agent-chat-contact-state"><span>Email {channel(person.contactAvailability?.email)}</span><span>Phone {channel(person.contactAvailability?.phone)}</span>
            {(person.profileUrls || []).slice(0, 2).map(profile => <a key={`${profile.kind}:${profile.url}`} href={profile.url} target="_blank" rel="noreferrer">{label(profile.kind)}</a>)}
          </div>
        </div>
      </div>)}
      {!retained.length && <div className="product-empty-state"><h3>No people returned</h3><p className="muted">Refine the criteria in the conversation. Provider failures and zero-result searches remain distinct in diagnostics.</p></div>}
    </div>

    {retained.length > 8 && <button type="button" className="btn ghost agent-chat-show-more" onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse results' : `Show all ${retained.length} people`}</button>}

    <details className="advanced-disclosure agent-chat-diagnostics">
      <summary>Search diagnostics · {(result.telemetry || []).filter(item => item.discovered > 0).length} contributing source{(result.telemetry || []).filter(item => item.discovered > 0).length === 1 ? '' : 's'}</summary>
      <div className="agent-chat-telemetry">{(result.telemetry || []).map(item => <span className={`status-pill ${item.status === 'completed' ? 'success' : ''}`} key={item.provider}>{label(item.provider)} · {item.status} · {item.discovered}</span>)}</div>
      {!!result.warnings?.length && <div className="product-list" style={{ marginTop: 8 }}>{result.warnings.map((warning, index) => <div className="product-row" key={`${warning}-${index}`}><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{warning}</div></div>)}</div>}
    </details>
  </div>
}

function WebResearch({ result }: { result: WebResearchResult }) {
  const preview = result.text.slice(0, 6000)
  const remainder = result.text.slice(6000)
  return <div className="agent-chat-web-result">
    <div className="agent-chat-result-summary">
      <div><span className="kicker">Live web research</span><h3 style={{ margin: '4px 0 0' }}>Fresh external source material</h3></div>
      <div className="chips">
        <span className="status-pill success">{label(result.provider || 'web')}</span>
        {result.transport && <span className="status-pill">{result.transport.toUpperCase()}</span>}
        <span className="status-pill">{result.freshness || 'live'}</span>
        <span className="status-pill">untrusted evidence input</span>
      </div>
    </div>
    <div className="agent-chat-web-copy">{preview || 'The live-web tool returned no readable text.'}</div>
    {!!remainder && <details className="advanced-disclosure" style={{ marginTop: 10 }}><summary>Show remaining web result</summary><div className="agent-chat-web-copy" style={{ marginTop: 8 }}>{remainder}</div></details>}
    <div className="muted" style={{ marginTop: 10, fontSize: 10, lineHeight: 1.5 }}>Live web material is not automatically a candidate fact, verified identity, qualification, or contact permission. Person-linked evidence must be reviewed through SourcingOS evidence/provenance rules.</div>
  </div>
}

function ContactApproval({ plan, contact, disabled, onApprove }: { plan: PeoplePlan; contact?: ContactBatch; disabled: boolean; onApprove: () => void }) {
  const tool = plan.toolPlan[0]
  if (!tool || tool.tool !== 'find_contacts') {
    return <div className="agent-approval-card"><strong>Approval checkpoint</strong><p className="muted">This action is recognized but is not executable in this release yet. SourcingOS will not fake the write.</p></div>
  }
  const count = tool.targetCount || 1
  const successful = contact?.outcomes.filter(item => item.ok) || []
  const signalCount = successful.reduce((sum, item) => sum + item.signals.length, 0)
  return <div className="agent-approval-card">
    <div className="agent-approval-head">
      <div><span className="kicker">Recruiter approval</span><h3>Find contact info for the top {count}</h3></div>
      <div className="chips"><span className="status-pill">paid read</span><span className="status-pill success">no workflow write</span></div>
    </div>
    {!contact && <>
      <p className="muted">This will run the SourcingOS goal-specific contact waterfall against the top {count} ranked candidate{count === 1 ? '' : 's'}. Cached signals are checked first; providers stop per channel when a usable goal is satisfied. Nothing is sent and no ATS stage is changed.</p>
      <div className="agent-approval-actions"><button className="btn" type="button" onClick={onApprove} disabled={disabled}>{disabled ? 'Running enrichment…' : `Approve & enrich top ${count}`}</button><span className="muted">Work email · personal email · phone pursued independently</span></div>
    </>}
    {contact && <div className="agent-contact-results">
      <div className="agent-contact-summary"><strong>{contact.outcomes.length} processed · {signalCount} contact signal{signalCount === 1 ? '' : 's'} returned</strong><span className="muted">Provider observations; not permission to contact.</span></div>
      {contact.outcomes.map((outcome, index) => <div className="agent-contact-person" key={`${outcome.person.provider}:${outcome.person.providerPersonId}`}>
        <div className="agent-chat-candidate-rank">{index + 1}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="agent-chat-candidate-head"><strong>{outcome.person.displayName}</strong><span className={`status-pill ${outcome.signals.length ? 'success' : ''}`}>{outcome.signals.length ? `${outcome.signals.length} found` : 'no signal'}</span></div>
          {!!outcome.signals.length && <div className="agent-contact-signals">{outcome.signals.map(signal => <div className="agent-contact-signal" key={`${signal.type}:${signal.value}:${signal.sourceProvider || ''}`}><b>{signal.type === 'email' ? 'Email' : 'Phone'}</b><span>{signal.value}</span><small>{[signal.channelKind, signal.sourceProvider ? label(signal.sourceProvider) : '', signal.deliverability].filter(Boolean).join(' · ')}</small></div>)}</div>}
          {!outcome.signals.length && <div className="muted" style={{ marginTop: 4 }}>{outcome.error || outcome.message}{outcome.missingGoals.length ? ` · Missing: ${outcome.missingGoals.map(label).join(', ')}` : ''}</div>}
        </div>
      </div>)}
    </div>}
  </div>
}

export function AgenticSourcingChatV36_15() {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [previousPlan, setPreviousPlan] = useState<PeoplePlan | undefined>()
  const [working, setWorking] = useState<'planning' | 'searching' | 'web' | 'enriching' | ''>('')
  const threadRef = useRef<HTMLDivElement>(null)

  const placeholder = useMemo(() => previousPlan
    ? 'Refine the search, research the web, compare candidates, or ask for contact info…'
    : 'Describe who you need…', [previousPlan])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const node = threadRef.current
      if (node) node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [turns, working])

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const message = input.trim()
    if (!message || working) return
    setInput('')
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setTurns(current => [...current, { id, user: message }])
    setWorking('planning')

    try {
      const planRes = await fetch('/api/agent-runtime/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ message, ...(previousPlan ? { previousPlan } : {}) }),
      })
      const planJson = await planRes.json()
      if (!planRes.ok || !planJson.ok || !planJson.plan) throw new Error(planJson.error || 'SourcingOS could not plan this turn.')
      const plan = planJson.plan as AgentPlan
      if (plan.action === 'search_people') setPreviousPlan(plan)
      setTurns(current => current.map(turn => turn.id === id ? { ...turn, plan } : turn))

      if (plan.action === 'search_web') {
        setWorking('web')
        const webRes = await fetch('/api/agentic-sourcing/web', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(plan.webRequest),
        })
        const webJson = await webRes.json().catch(() => ({}))
        if (!webRes.ok || !webJson.ok || !webJson.result) throw new Error(webJson.error || 'Live web research failed.')
        const web = webJson.result as WebResearchResult
        setTurns(current => current.map(turn => turn.id === id ? { ...turn, plan, web } : turn))
        return
      }

      if (plan.action !== 'search_people') return

      setWorking('searching')
      const searchRes = await fetch('/api/candidate-data/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(plan.providerRequest),
      })
      const searchJson = await searchRes.json()
      if (!searchRes.ok || !searchJson.ok) throw new Error(searchJson.error || 'People search failed.')
      const search: SearchResult = {
        observations: Array.isArray(searchJson.observations) ? searchJson.observations : [],
        telemetry: Array.isArray(searchJson.telemetry) ? searchJson.telemetry : [],
        discoveredBeforeCap: Number(searchJson.discoveredBeforeCap || 0),
        returnedAfterCap: Number(searchJson.returnedAfterCap || 0),
        contributingProviders: Number(searchJson.contributingProviders || 0),
        warnings: Array.isArray(searchJson.warnings) ? searchJson.warnings : [],
      }
      setTurns(current => current.map(turn => turn.id === id ? { ...turn, plan, search } : turn))
    } catch (error) {
      setTurns(current => current.map(turn => turn.id === id ? { ...turn, error: error instanceof Error ? error.message : 'Agent turn failed.' } : turn))
    } finally {
      setWorking('')
    }
  }

  async function approveContacts(turnId: string) {
    if (working) return
    const targetIndex = turns.findIndex(turn => turn.id === turnId)
    const targetTurn = targetIndex >= 0 ? turns[targetIndex] : undefined
    const tool = targetTurn?.plan?.toolPlan.find(item => item.tool === 'find_contacts')
    const priorSearch = targetIndex > 0 ? [...turns.slice(0, targetIndex)].reverse().find(turn => turn.search?.observations?.length) : undefined
    const count = Math.max(1, Math.min(25, tool?.targetCount || 1))
    const people = priorSearch?.search?.observations.slice(0, count) || []
    if (!targetTurn || !people.length) {
      setTurns(current => current.map(turn => turn.id === turnId ? { ...turn, error: 'There is no prior ranked search slate available for this contact action.' } : turn))
      return
    }

    setWorking('enriching')
    const outcomes: ContactOutcome[] = []
    try {
      for (const person of people) {
        const linkedinUrl = (person.profileUrls || []).find(item => item.kind === 'linkedin')?.url
        const profileUrl = linkedinUrl || person.profileUrls?.[0]?.url
        try {
          const response = await fetch('/api/contact-enrichment/find', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              purpose: 'contact_bundle',
              providerName: person.provider,
              providerPersonId: person.providerPersonId,
              fullName: person.displayName,
              title: person.currentTitle || person.headline,
              currentCompany: person.currentEmployer,
              location: person.location,
              profileUrl,
              linkedinUrl,
              sourceContext: 'agentic_sourcing_v36_16',
            }),
          })
          const json = await response.json().catch(() => ({}))
          outcomes.push({
            person,
            ok: Boolean(response.ok && json.ok),
            message: String(json.message || json.error || (response.ok ? 'Contact enrichment completed.' : 'Contact enrichment failed.')),
            signals: Array.isArray(json.signals) ? json.signals : [],
            missingGoals: Array.isArray(json.orchestration?.missingGoals) ? json.orchestration.missingGoals : [],
            ...(!response.ok || !json.ok ? { error: String(json.error || 'Contact enrichment failed.') } : {}),
          })
        } catch (error) {
          outcomes.push({ person, ok: false, message: 'Contact enrichment failed.', signals: [], missingGoals: ['work_email', 'personal_email', 'phone'], error: error instanceof Error ? error.message : 'Contact enrichment failed.' })
        }
        setTurns(current => current.map(turn => turn.id === turnId ? { ...turn, contact: { requested: count, outcomes: [...outcomes] } } : turn))
      }
    } finally {
      setWorking('')
    }
  }

  const workingLabel = working === 'planning'
    ? 'Interpreting recruiter intent…'
    : working === 'searching'
      ? 'Searching professional and X-ray sources…'
      : working === 'web'
        ? 'Researching the live web…'
        : 'Running approved contact enrichment…'
  const workingDetail = working === 'planning'
    ? 'Building explicit criteria and the next tool plan.'
    : working === 'searching'
      ? 'Structured providers, semantic sources, and bounded Serper X-rays can contribute observations before the global result cap.'
      : working === 'web'
        ? 'Live external material will attach to this turn as untrusted source evidence, not candidate truth.'
        : 'Work email, personal email, and phone are pursued independently through the goal-specific contact waterfall.'

  return <section className="product-panel agent-chat-shell">
    <style>{`
      .agent-chat-shell{overflow:hidden;background:linear-gradient(145deg,color-mix(in srgb,var(--panel) 96%,var(--accent) 4%),var(--panel));display:flex;flex-direction:column;height:calc(100vh - 175px);min-height:640px;max-height:900px;padding-bottom:0}
      .agent-chat-head{display:flex;justify-content:space-between;gap:16px;align-items:start;flex-wrap:wrap;margin-bottom:12px}.agent-chat-head h2{font-size:24px;margin:4px 0 4px}.agent-chat-head p{max-width:760px;margin:0}
      .agent-chat-thread{display:grid;align-content:start;gap:14px;flex:1;min-height:0;overflow:auto;padding:2px 5px 18px 0;scrollbar-gutter:stable}
      .agent-chat-turn{display:grid;gap:10px}.agent-chat-user{justify-self:end;max-width:min(760px,90%);padding:11px 14px;border-radius:16px 16px 4px 16px;background:color-mix(in srgb,var(--accent) 20%,var(--panel));border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border));font-weight:650}
      .agent-chat-plan,.agent-chat-search-result,.agent-chat-web-result{padding:14px;border:1px solid var(--border);border-radius:16px;background:color-mix(in srgb,var(--panel) 94%,#fff 1%)}
      .agent-chat-plan-head,.agent-chat-result-summary,.agent-approval-head{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap}.agent-chat-answer{font-size:14px;font-weight:700;line-height:1.55;margin-top:5px;max-width:820px}
      .agent-chat-criteria{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:13px}.agent-chat-criterion{padding:9px 10px;border:1px solid var(--border);border-radius:11px}.agent-chat-criterion small{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:9px;color:var(--muted);margin-bottom:6px}
      .agent-tool-trace{display:grid;gap:7px;margin-top:12px}.agent-chat-telemetry{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}.agent-chat-candidates{display:grid;gap:7px;margin-top:12px}.agent-chat-candidate,.agent-contact-person{display:flex;gap:10px;padding:11px;border:1px solid var(--border);border-radius:12px}.agent-chat-candidate-rank{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 13%,transparent);font-size:10px;font-weight:850;flex:0 0 auto}.agent-chat-candidate-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.agent-chat-contact-state{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:10px}.agent-chat-contact-state a{color:inherit;text-decoration:underline}.agent-chat-show-more{margin-top:10px}.agent-chat-diagnostics{margin-top:10px}
      .agent-chat-web-copy{margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:11px;background:color-mix(in srgb,var(--panel) 78%,transparent);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto}
      .agent-approval-card{padding:15px;border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border));border-radius:16px;background:color-mix(in srgb,var(--accent) 7%,var(--panel))}.agent-approval-head h3{margin:4px 0 0}.agent-approval-card p{line-height:1.55}.agent-approval-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}.agent-contact-results{display:grid;gap:8px;margin-top:12px}.agent-contact-summary{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border-radius:11px;background:color-mix(in srgb,var(--panel) 75%,transparent)}.agent-contact-signals{display:grid;gap:5px;margin-top:8px}.agent-contact-signal{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border:1px solid var(--border);border-radius:9px}.agent-contact-signal span{overflow-wrap:anywhere}.agent-contact-signal small{color:var(--muted)}
      .agent-chat-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin:0 -16px;padding:12px 16px 16px;border-top:1px solid var(--border);background:color-mix(in srgb,var(--panel) 97%,transparent);backdrop-filter:blur(12px);position:relative;z-index:5}.agent-chat-compose textarea{resize:none;min-height:52px;max-height:120px;width:100%}.agent-chat-empty{padding:18px;border:1px dashed var(--border);border-radius:14px;margin-bottom:4px}.agent-chat-examples{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.agent-chat-error{padding:10px 12px;border:1px solid color-mix(in srgb,#ef4444 38%,var(--border));border-radius:11px;color:var(--muted)}
      @media(max-width:900px){.agent-chat-shell{height:calc(100vh - 150px);min-height:560px}.agent-contact-signal{grid-template-columns:48px 1fr}.agent-contact-signal small{grid-column:2}}
      @media(max-width:720px){.agent-chat-shell{height:auto;max-height:none;min-height:0}.agent-chat-compose{grid-template-columns:1fr;margin-left:-12px;margin-right:-12px}.agent-chat-thread{max-height:70vh}.agent-chat-head p{display:none}}
    `}</style>

    <div className="agent-chat-head">
      <div><span className="kicker">V36.16 · Conversational sourcing</span><h2>Chat with SourcingOS.</h2><p className="muted">Search people, run bounded X-rays, research the live web, review evidence, then approve paid or consequential actions without leaving the conversation.</p></div>
      <div className="chips"><span className="status-pill success">read-only search auto-runs</span><span className="status-pill">paid reads need approval</span>{previousPlan && <button className="btn ghost" type="button" onClick={() => { setTurns([]); setPreviousPlan(undefined); setInput('') }} disabled={!!working}>New search</button>}</div>
    </div>

    <div className="agent-chat-thread" ref={threadRef} aria-live="polite">
      {!turns.length && <div className="agent-chat-empty">
        <strong>The conversation is the control surface.</strong>
        <p className="muted" style={{ margin: '5px 0 0', lineHeight: 1.55 }}>People search can fan out across structured providers plus bounded X-ray retrieval. Explicit live-web research can auto-run as a read. Contact enrichment is a paid read with an approval checkpoint. Saving, outreach, ATS writes, and identity merges remain recruiter-controlled.</p>
        <div className="agent-chat-examples">
          {['Find 25 backend engineers in Minneapolis, MN with AWS + Kubernetes', 'Find a RHEL admin near Annapolis Junction, MD with Secret clearance or higher', 'Search the web for recent RHEL hiring at GDIT'].map(example => <button type="button" className="btn ghost" key={example} onClick={() => setInput(example)}>{example}</button>)}
        </div>
      </div>}
      {turns.map(turn => <div className="agent-chat-turn" key={turn.id}>
        <div className="agent-chat-user">{turn.user}</div>
        {turn.plan && <PlanCard plan={turn.plan} />}
        {turn.search && <SearchResults result={turn.search} />}
        {turn.web && <WebResearch result={turn.web} />}
        {turn.plan?.action === 'approval_required' && <ContactApproval plan={turn.plan} contact={turn.contact} disabled={working === 'enriching'} onApprove={() => approveContacts(turn.id)} />}
        {turn.error && <div className="agent-chat-error">{turn.error}</div>}
      </div>)}
      {!!working && <div className="cta" style={{ marginBottom: 0 }}><b>{workingLabel}</b><div className="muted" style={{ marginTop: 3, fontSize: 11 }}>{workingDetail}</div></div>}
    </div>

    <form className="agent-chat-compose" onSubmit={submit}>
      <textarea className="input" value={input} onChange={event => setInput(event.target.value)} placeholder={placeholder} disabled={!!working} aria-label="Chat with SourcingOS" />
      <button className="btn" type="submit" disabled={!!working || input.trim().length < 2}>{working ? 'Working…' : 'Send'}</button>
    </form>
  </section>
}
