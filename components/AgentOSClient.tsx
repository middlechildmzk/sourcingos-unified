'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Workflow = { id: string; workflow_type: string; status: string; current_step: string; input: { title?: string }; role_id?: string | null; created_at: string }
type Approval = { id: string; approval_type: string; title: string; summary: string; payload: Record<string, unknown>; created_at: string }
type Memory = { id: string; signal_type: string; key: string; value: string; confidence: number; supporting_events: number }
type Edge = { id: string; from_type: string; from_id: string; edge_type: string; to_type: string; to_id: string; label: string; confidence: number }
type Brief = { id: string; brief_date: string; title: string; summary: string; metrics: Record<string, number>; actions: string[]; risks: string[] }
type Role = { id: string; title: string; status: string; location: string; work_mode: string; updated_at: string }
type Inbox = { id: string; priority: number; reason: string; status: string; role_id?: string | null; candidates?: { id: string; canonical_name: string; headline?: string; current_company?: string; location?: string; skills?: string[]; merge_status?: string } | Array<{ id: string; canonical_name: string; headline?: string; current_company?: string; location?: string; skills?: string[]; merge_status?: string }> }
type Step = { id: string; workflow_id: string; step_key: string; agent_key: string; status: string; attempt: number; updated_at: string }
type Payload = { ok: boolean; mode: string; workflows: Workflow[]; approvals: Approval[]; memory: Memory[]; edges: Edge[]; briefs: Brief[]; roles: Role[]; inbox: Inbox[]; steps: Step[] }

function candidateFrom(item: Inbox) { return Array.isArray(item.candidates) ? item.candidates[0] : item.candidates }
function words(value: string) { return value.replaceAll('_', ' ') }

export function AgentOSClient() {
  const [data, setData] = useState<Payload>({ ok: true, mode: 'preview', workflows: [], approvals: [], memory: [], edges: [], briefs: [], roles: [], inbox: [], steps: [] })
  const [status, setStatus] = useState('Loading your recruiting desk…')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [title, setTitle] = useState('Senior DevSecOps Engineer')
  const [intake, setIntake] = useState('Own secure cloud platform engineering for regulated workloads. Must demonstrate AWS, Kubernetes, Terraform, Linux, security automation, and production architecture experience.')
  const [skills, setSkills] = useState('AWS, Kubernetes, Terraform, Linux, DevSecOps, security automation')
  const [locations, setLocations] = useState('United States')
  const [companies, setCompanies] = useState('AWS, Microsoft, Booz Allen, Leidos, Northrop Grumman')

  async function load() {
    const res = await fetch('/api/agent-os', { headers: { accept: 'application/json' } })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || 'Could not load your recruiting desk.')
    setData(json)
    setSelectedRoleId(current => current || json.roles?.[0]?.id || '')
    setStatus(json.mode === 'preview' ? 'Preview mode. Sign in to run durable workflows.' : 'Everything is up to date.')
  }
  useEffect(() => { load().catch(error => setStatus(error instanceof Error ? error.message : 'Could not load your recruiting desk.')) }, [])

  async function action(payload: Record<string, unknown>, label: string) {
    setStatus(label)
    const res = await fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok || !json.ok) { setStatus(json.error || 'Action failed.'); return }
    setStatus('Done.')
    await load()
  }

  const activeWorkflows = data.workflows.filter(item => ['queued','running','waiting_approval'].includes(item.status))
  const brief = data.briefs[0]
  const stats = useMemo(() => ({
    roles: data.roles.filter(role => ['calibrating','active'].includes(role.status)).length,
    candidates: data.inbox.filter(item => ['unreviewed','reviewing'].includes(item.status)).length,
    approvals: data.approvals.length,
    active: activeWorkflows.length,
  }), [data, activeWorkflows.length])

  const attentionCount = stats.candidates + stats.approvals

  return <div className="interactive-tool">
    <div className="product-page-head">
      <div><span className="kicker">Recruiter command center</span><h1>Today</h1><p>Your agent handles the operational work. This page keeps only the decisions and candidate reviews that need you.</p></div>
      <div className="product-page-actions"><button className="btn secondary" onClick={() => action({ action: 'daily_brief' }, 'Refreshing your daily brief…')}>Refresh brief</button><Link className="btn" href="/app/roles">Open roles</Link></div>
    </div>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Needs attention</small><b>{attentionCount}</b><span>Approvals and candidates</span></div>
      <div className="product-stat"><small>Active roles</small><b>{stats.roles}</b><span>Calibrating or sourcing</span></div>
      <div className="product-stat"><small>Agent workflows</small><b>{stats.active}</b><span>Running or queued</span></div>
      <div className="product-stat"><small>Memory signals</small><b>{data.memory.length}</b><span>Approved recruiter patterns</span></div>
    </div>

    <div className="product-layout">
      <div style={{ display: 'grid', gap: 14 }}>
        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Your queue</span><h2>Needs your attention</h2></div><span>{attentionCount} item{attentionCount === 1 ? '' : 's'}</span></div>
          <div className="product-list">
            {data.approvals.map(approval => <div className="product-row" key={approval.id}>
              <div className="product-row-main"><div className="product-row-title">{approval.title}</div><div className="product-row-meta">Agent checkpoint · {words(approval.approval_type)} · {approval.summary}</div><details className="advanced-disclosure"><summary>Review proposed changes</summary><pre>{JSON.stringify(approval.payload, null, 2)}</pre></details></div>
              <div className="product-row-actions"><button className="btn secondary" onClick={() => action({ action: 'approval', approvalId: approval.id, decision: 'rejected', note: 'Recruiter requested revision.' }, 'Sending this back for revision…')}>Revise</button><button className="btn" onClick={() => action({ action: 'approval', approvalId: approval.id, decision: 'approved' }, 'Approving checkpoint…')}>Approve</button></div>
            </div>)}

            {data.inbox.slice(0, 20).map(item => {
              const candidate = candidateFrom(item)
              if (!candidate) return null
              return <div className="product-row" key={item.id}>
                <div className="product-row-main"><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div className="product-row-title">{candidate.canonical_name}</div><span className="status-pill active">priority {item.priority}</span></div><div className="product-row-meta">{[candidate.headline, candidate.current_company, candidate.location].filter(Boolean).join(' · ') || item.reason}</div><div className="chips">{(candidate.skills || []).slice(0, 5).map(skill => <span className="tag" key={skill}>{skill}</span>)}</div></div>
                <div className="product-row-actions"><Link className="btn ghost" href={`/app/candidate/${candidate.id}`}>Review</Link><button className="btn secondary" onClick={() => action({ action: 'inbox_action', inboxId: item.id, inboxAction: 'enrich' }, `Enriching ${candidate.canonical_name}…`)}>Enrich</button><button className="btn" disabled={!selectedRoleId} onClick={() => action({ action: 'inbox_to_role', inboxId: item.id, roleId: selectedRoleId }, `Adding ${candidate.canonical_name} to role…`)}>Add to role</button></div>
              </div>
            })}
            {!attentionCount && <div className="product-row"><div className="product-row-main"><div className="product-row-title">You are caught up</div><div className="product-row-meta">No approvals or prioritized candidates currently need your attention.</div></div><span className="status-pill success">clear</span></div>}
          </div>
          {!!data.roles.length && <div style={{ marginTop: 14 }}><label>Candidate destination<select value={selectedRoleId} onChange={event => setSelectedRoleId(event.target.value)}><option value="">Choose a role</option>{data.roles.map(role => <option value={role.id} key={role.id}>{role.title}</option>)}</select></label></div>}
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><div><span className="kicker">Req load</span><h2>Roles ready for the agent</h2></div><Link href="/app/roles">Manage roles →</Link></div>
          <div className="product-list">{data.roles.slice(0, 12).map(role => {
            const workflow = activeWorkflows.find(item => item.role_id === role.id)
            return <div className="product-row" key={role.id}><div className="product-row-main"><div className="product-row-title">{role.title}</div><div className="product-row-meta">{[role.location, words(role.work_mode), words(role.status)].filter(Boolean).join(' · ')}</div></div><div className="product-row-actions">{workflow ? <span className={`status-pill ${workflow.status === 'waiting_approval' ? 'warning' : 'active'}`}>{words(workflow.current_step)}</span> : <button className="btn secondary" onClick={() => action({ action: 'create_from_role', roleId: role.id }, `Launching agent for ${role.title}…`)}>Launch agent</button>}</div></div>
          })}{!data.roles.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">Create your first role</div><div className="product-row-meta">A calibrated role becomes the home for strategy, sourcing, candidate review, and agent learning.</div></div><Link className="btn" href="/app/roles">Create role</Link></div>}</div>
        </section>

        <details className="advanced-disclosure product-panel">
          <summary>Launch an agent from a new intake instead</summary>
          <div style={{ marginTop: 14 }}><label>Role title<input className="input" value={title} onChange={event => setTitle(event.target.value)} /></label><label>JD or calibrated intake<textarea className="textarea big" value={intake} onChange={event => setIntake(event.target.value)} /></label><div className="grid two"><label>Skills<input className="input" value={skills} onChange={event => setSkills(event.target.value)} /></label><label>Locations<input className="input" value={locations} onChange={event => setLocations(event.target.value)} /></label></div><label>Target companies<input className="input" value={companies} onChange={event => setCompanies(event.target.value)} /></label><button className="btn" onClick={() => action({ action: 'create_role_launch', input: { title, intake, skills: skills.split(',').map(value => value.trim()).filter(Boolean), locations: locations.split(',').map(value => value.trim()).filter(Boolean), targetCompanies: companies.split(',').map(value => value.trim()).filter(Boolean) } }, 'Creating autonomous role workflow…')}>Launch recruiter agent</button></div>
        </details>
      </div>

      <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
        <section className="product-panel">
          <div className="product-panel-head"><h2>Daily brief</h2><span>{brief?.brief_date || 'Today'}</span></div>
          {brief ? <><h3 style={{ fontSize: 17, marginBottom: 8 }}>{brief.title}</h3><p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>{brief.summary}</p>{brief.actions?.length ? <div className="product-list">{brief.actions.map((item, index) => <div className="product-row" key={`${item}-${index}`}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item}</div></div></div>)}</div> : null}{brief.risks?.length ? <div className="cta" style={{ marginTop: 12 }}>{brief.risks.join(' ')}</div> : null}</> : <><p className="muted">Generate a concise summary of overnight sourcing, pending decisions, and risks.</p><button className="btn secondary" onClick={() => action({ action: 'daily_brief' }, 'Creating your daily brief…')}>Generate brief</button></>}
        </section>

        <section className="product-panel">
          <div className="product-panel-head"><h2>Agent activity</h2><span>{activeWorkflows.length} active</span></div>
          <div className="product-list">{activeWorkflows.slice(0, 10).map(workflow => {
            const workflowSteps = data.steps.filter(step => step.workflow_id === workflow.id)
            const completed = workflowSteps.filter(step => step.status === 'completed').length
            return <div className="product-row" key={workflow.id}><div className="product-row-main"><div className="product-row-title">{workflow.input?.title || 'Recruiting workflow'}</div><div className="product-row-meta">{completed}/{workflowSteps.length || 6} checkpoints · now {words(workflow.current_step)}</div></div><div className="product-row-actions"><span className={`status-pill ${workflow.status === 'waiting_approval' ? 'warning' : 'active'}`}>{words(workflow.status)}</span>{workflow.status !== 'waiting_approval' && <button className="btn ghost" onClick={() => action({ action: 'advance', workflowId: workflow.id }, `Advancing ${workflow.input?.title || 'workflow'}…`)}>Run</button>}</div></div>
          })}{!activeWorkflows.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No active workflows</div><div className="product-row-meta">Launch an agent from one of your roles.</div></div></div>}</div>
        </section>

        <details className="advanced-disclosure product-panel">
          <summary>System intelligence and controls</summary>
          <div style={{ marginTop: 14 }}><div className="product-panel-head"><h2>Recruiter memory</h2><span>{data.memory.length}</span></div><div className="product-list">{data.memory.slice(0, 12).map(memory => <div className="product-row" key={memory.id}><div className="product-row-main"><div className="product-row-title">{memory.value}</div><div className="product-row-meta">{words(memory.signal_type)} · {memory.supporting_events} decisions</div></div><span className="status-pill success">{memory.confidence}%</span></div>)}</div><div className="product-panel-head" style={{ marginTop: 20 }}><h2>Graph evidence</h2><span>{data.edges.length}</span></div><div className="product-list">{data.edges.slice(0, 12).map(edge => <div className="product-row" key={edge.id}><div className="product-row-main"><div className="product-row-title">{edge.label || `${edge.from_type} → ${edge.to_type}`}</div><div className="product-row-meta">{words(edge.edge_type)}</div></div><span className="status-pill">{edge.confidence}%</span></div>)}</div></div>
        </details>
      </aside>
    </div>
    <p className="muted" style={{ marginTop: 16, fontSize: 11 }}>{status}</p>
  </div>
}