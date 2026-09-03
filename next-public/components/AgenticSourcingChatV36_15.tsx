'use client'

import { FormEvent, useMemo, useState } from 'react'

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
}
type AgentPlan = {
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

type Observation = {
  provider: string
  providerPersonId: string
  displayName: string
  headline?: string
  currentTitle?: string
  currentEmployer?: string
  location?: string
  skills?: string[]
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
type Turn = {
  id: string
  user: string
  plan?: AgentPlan
  search?: SearchResult
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
  const groups: Array<{ label: string; values: string[]; kind?: 'must' }> = []
  if (plan.criteria.titles.length) groups.push({ label: 'Role / titles', values: plan.criteria.titles })
  if (plan.criteria.skills.length) groups.push({ label: 'Skills', values: plan.criteria.skills })
  if (plan.criteria.locations.length) groups.push({ label: 'Location', values: plan.criteria.locations })
  if (plan.criteria.companies.length) groups.push({ label: 'Company', values: plan.criteria.companies })
  const must = plan.criteria.requirements.filter(item => item.mustHave).map(item => item.text)
  if (must.length) groups.push({ label: 'Requirements', values: must, kind: 'must' })
  return groups
}

function PlanCard({ plan }: { plan: AgentPlan }) {
  const groups = criterionGroups(plan)
  return <div className="agent-chat-plan">
    <div className="agent-chat-plan-head">
      <div>
        <span className="kicker">SourcingOS interpretation</span>
        <div className="agent-chat-answer">{plan.assistantSummary}</div>
      </div>
      <div className="chips">
        <span className="status-pill success">read only</span>
        <span className="status-pill">{plan.model.used ? `${label(plan.model.provider || 'AI')} · ${plan.model.model || 'model'}` : 'deterministic parser'}</span>
      </div>
    </div>
    <div className="agent-chat-criteria">
      {groups.map(group => <div key={group.label} className="agent-chat-criterion">
        <small>{group.label}</small>
        <div className="chips">{group.values.slice(0, 12).map(value => <span className={group.kind === 'must' ? 'status-pill success' : 'tag'} key={value}>{value}</span>)}</div>
      </div>)}
      {!groups.length && <div className="muted">No structured criteria were confidently extracted yet.</div>}
    </div>
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
  const retained = result.observations || []
  return <div className="agent-chat-search-result">
    <div className="agent-chat-result-summary">
      <div><span className="kicker">Tool result</span><h3 style={{ margin: '4px 0 0' }}>{retained.length} people returned</h3></div>
      <div className="chips">
        <span className="status-pill">{result.discoveredBeforeCap || retained.length} discovered</span>
        <span className="status-pill success">{result.returnedAfterCap || retained.length} retained</span>
        <span className="status-pill">{result.contributingProviders || 0} sources contributed</span>
      </div>
    </div>

    <div className="agent-chat-telemetry">
      {(result.telemetry || []).map(item => <span className={`status-pill ${item.status === 'completed' ? 'success' : ''}`} key={item.provider}>{label(item.provider)} · {item.status} · {item.discovered}</span>)}
    </div>

    <div className="agent-chat-candidates">
      {retained.map((person, index) => <div className="agent-chat-candidate" key={`${person.provider}:${person.providerPersonId}`}>
        <div className="agent-chat-candidate-rank">{index + 1}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="agent-chat-candidate-head">
            <strong>{person.displayName}</strong>
            <span className="status-pill">{label(person.provider)}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{[person.currentTitle || person.headline, person.currentEmployer, person.location].filter(Boolean).join(' · ') || 'Professional observation'}</div>
          {!!person.skills?.length && <div className="chips" style={{ marginTop: 7 }}>{person.skills.slice(0, 6).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>}
          <div className="agent-chat-contact-state"><span>Email {channel(person.contactAvailability?.email)}</span><span>Phone {channel(person.contactAvailability?.phone)}</span></div>
        </div>
      </div>)}
      {!retained.length && <div className="product-empty-state"><h3>No people returned</h3><p className="muted">Refine the criteria in the conversation. Provider failures and zero-result searches remain distinct in the trace below.</p></div>}
    </div>

    {!!result.warnings?.length && <details className="advanced-disclosure" style={{ marginTop: 10 }}><summary>Search diagnostics ({result.warnings.length})</summary><div className="product-list" style={{ marginTop: 8 }}>{result.warnings.map((warning, index) => <div className="product-row" key={`${warning}-${index}`}><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{warning}</div></div>)}</div></details>}
  </div>
}

export function AgenticSourcingChatV36_15() {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [previousPlan, setPreviousPlan] = useState<AgentPlan | undefined>()
  const [working, setWorking] = useState<'planning' | 'searching' | ''>('')

  const placeholder = useMemo(() => previousPlan
    ? 'Refine it: prioritize production Kubernetes and move closer to Minneapolis…'
    : 'Find 25 backend engineers in Minneapolis with AWS + Kubernetes…', [previousPlan])

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
      setPreviousPlan(plan)
      setTurns(current => current.map(turn => turn.id === id ? { ...turn, plan } : turn))

      if (plan.action !== 'search_people') {
        setWorking('')
        return
      }

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

  return <section className="product-panel agent-chat-shell">
    <style>{`
      .agent-chat-shell{overflow:hidden;background:linear-gradient(145deg,color-mix(in srgb,var(--panel) 96%,var(--accent) 4%),var(--panel))}
      .agent-chat-head{display:flex;justify-content:space-between;gap:16px;align-items:start;flex-wrap:wrap;margin-bottom:16px}
      .agent-chat-head h2{font-size:24px;margin:4px 0 5px}.agent-chat-head p{max-width:780px;margin:0}
      .agent-chat-thread{display:grid;gap:14px;max-height:760px;overflow:auto;padding-right:4px}
      .agent-chat-turn{display:grid;gap:10px}.agent-chat-user{justify-self:end;max-width:min(760px,90%);padding:11px 14px;border-radius:16px 16px 4px 16px;background:color-mix(in srgb,var(--accent) 20%,var(--panel));border:1px solid color-mix(in srgb,var(--accent) 35%,var(--border));font-weight:650}
      .agent-chat-plan,.agent-chat-search-result{padding:14px;border:1px solid var(--border);border-radius:16px;background:color-mix(in srgb,var(--panel) 94%,#fff 1%)}
      .agent-chat-plan-head,.agent-chat-result-summary{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap}.agent-chat-answer{font-size:14px;font-weight:700;line-height:1.55;margin-top:5px;max-width:820px}
      .agent-chat-criteria{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:13px}.agent-chat-criterion{padding:9px 10px;border:1px solid var(--border);border-radius:11px}.agent-chat-criterion small{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:9px;color:var(--muted);margin-bottom:6px}
      .agent-tool-trace{display:grid;gap:7px;margin-top:12px}.agent-chat-telemetry{display:flex;flex-wrap:wrap;gap:5px;margin:12px 0}.agent-chat-candidates{display:grid;gap:7px}.agent-chat-candidate{display:flex;gap:10px;padding:11px;border:1px solid var(--border);border-radius:12px}.agent-chat-candidate-rank{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 13%,transparent);font-size:10px;font-weight:850}.agent-chat-candidate-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.agent-chat-contact-state{display:flex;gap:14px;margin-top:8px;color:var(--muted);font-size:10px}.agent-chat-compose{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;margin-top:16px;padding-top:15px;border-top:1px solid var(--border)}.agent-chat-compose textarea{resize:vertical;min-height:48px;max-height:140px;width:100%}.agent-chat-empty{padding:18px;border:1px dashed var(--border);border-radius:14px;margin-bottom:4px}.agent-chat-examples{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.agent-chat-error{padding:10px 12px;border:1px solid color-mix(in srgb,#ef4444 38%,var(--border));border-radius:11px;color:var(--muted)}
      @media(max-width:720px){.agent-chat-compose{grid-template-columns:1fr}.agent-chat-thread{max-height:none}}
    `}</style>

    <div className="agent-chat-head">
      <div><span className="kicker">V36.15 · Conversational sourcing</span><h2>Chat with SourcingOS.</h2><p className="muted">Describe who you need or refine the last search in plain language. SourcingOS translates the conversation into explicit criteria and runs the existing evidence-aware People Search underneath it.</p></div>
      <div className="chips"><span className="status-pill success">read-only auto execution</span>{previousPlan && <button className="btn ghost" type="button" onClick={() => { setTurns([]); setPreviousPlan(undefined); setInput('') }} disabled={!!working}>New search</button>}</div>
    </div>

    <div className="agent-chat-thread" aria-live="polite">
      {!turns.length && <div className="agent-chat-empty">
        <strong>The conversation is the control surface.</strong>
        <p className="muted" style={{ margin: '5px 0 0', lineHeight: 1.55 }}>This first release may automatically search people only. Saving, contact enrichment, outreach, ATS writes, and identity merges remain explicit recruiter-controlled actions.</p>
        <div className="agent-chat-examples">
          {['Find 25 backend engineers in Minneapolis with AWS + Kubernetes', 'Find a RHEL admin near Annapolis Junction, MD with Secret clearance or higher', 'Find senior technical sourcers in the DC area'].map(example => <button type="button" className="btn ghost" key={example} onClick={() => setInput(example)}>{example}</button>)}
        </div>
      </div>}
      {turns.map(turn => <div className="agent-chat-turn" key={turn.id}>
        <div className="agent-chat-user">{turn.user}</div>
        {turn.plan && <PlanCard plan={turn.plan} />}
        {turn.search && <SearchResults result={turn.search} />}
        {turn.error && <div className="agent-chat-error">{turn.error}</div>}
      </div>)}
      {!!working && <div className="cta" style={{ marginBottom: 0 }}><b>{working === 'planning' ? 'Interpreting recruiter intent…' : 'Running read-only professional sources…'}</b><div className="muted" style={{ marginTop: 3, fontSize: 11 }}>{working === 'planning' ? 'Building explicit Role/Search Brain criteria and tool plan.' : 'Provider telemetry and results will appear in this turn when the search finishes.'}</div></div>}
    </div>

    <form className="agent-chat-compose" onSubmit={submit}>
      <textarea className="input" value={input} onChange={event => setInput(event.target.value)} placeholder={placeholder} disabled={!!working} aria-label="Chat with SourcingOS" />
      <button className="btn" type="submit" disabled={!!working || input.trim().length < 2}>{working ? 'Working…' : previousPlan ? 'Refine search' : 'Search'}</button>
    </form>
  </section>
}
