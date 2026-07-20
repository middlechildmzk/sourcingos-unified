'use client'

import { useEffect, useMemo, useState } from 'react'

type Workflow = { id: string; workflow_type: string; status: string; current_step: string; input: any; created_at: string }
type Approval = { id: string; approval_type: string; title: string; summary: string; payload: any; created_at: string }
type Memory = { id: string; signal_type: string; key: string; value: string; confidence: number; supporting_events: number }
type Edge = { id: string; from_type: string; from_id: string; edge_type: string; to_type: string; to_id: string; label: string; confidence: number }
type Brief = { id: string; brief_date: string; title: string; summary: string; metrics: any; actions: any[]; risks: any[] }
type Payload = { ok: boolean; mode: string; workflows: Workflow[]; approvals: Approval[]; memory: Memory[]; edges: Edge[]; briefs: Brief[] }

export function AgentOSClient() {
  const [data, setData] = useState<Payload>({ ok: true, mode: 'preview', workflows: [], approvals: [], memory: [], edges: [], briefs: [] })
  const [status, setStatus] = useState('Loading Agent OS…')
  const [title, setTitle] = useState('Senior DevSecOps Engineer')
  const [intake, setIntake] = useState('Own secure cloud platform engineering for regulated workloads. Must demonstrate AWS, Kubernetes, Terraform, Linux, security automation, and production architecture experience.')
  const [skills, setSkills] = useState('AWS, Kubernetes, Terraform, Linux, DevSecOps, security automation')
  const [locations, setLocations] = useState('United States')
  const [companies, setCompanies] = useState('AWS, Microsoft, Booz Allen, Leidos, Northrop Grumman')

  async function load() {
    const res = await fetch('/api/agent-os', { headers: { accept: 'application/json' } })
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json.error || 'Could not load Agent OS.')
    setData(json)
    setStatus(json.mode === 'preview' ? 'Preview mode. Sign in to run durable workflows.' : 'Agent OS connected.')
  }
  useEffect(() => { load().catch(error => setStatus(error instanceof Error ? error.message : 'Could not load Agent OS.')) }, [])

  async function action(payload: Record<string, unknown>, label: string) {
    setStatus(label)
    const res = await fetch('/api/agent-os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok || !json.ok) { setStatus(json.error || 'Action failed.'); return }
    setStatus('Done.')
    await load()
  }

  async function launch() {
    await action({ action: 'create_role_launch', input: { title, intake, skills: skills.split(',').map(v => v.trim()).filter(Boolean), locations: locations.split(',').map(v => v.trim()).filter(Boolean), targetCompanies: companies.split(',').map(v => v.trim()).filter(Boolean) } }, 'Creating autonomous role workflow…')
  }

  const stats = useMemo(() => ({
    active: data.workflows.filter(v => ['queued','running','waiting_approval'].includes(v.status)).length,
    approvals: data.approvals.length,
    memory: data.memory.length,
    edges: data.edges.length,
  }), [data])

  return <div className="interactive-tool">
    <div className="cta"><b>V23–V25 Agent OS:</b> durable multi-step recruiting workflows with checkpoints, recruiter approvals, inspectable memory, graph relationships, and resumable autonomous execution. The agent may research and organize; recruiters retain control of strategy, identity decisions, candidate disposition, and outreach.</div>

    <div className="grid" style={{ marginTop: 18 }}>
      <div className="card"><span className="kicker">Active workflows</span><div className="big-number">{stats.active}</div></div>
      <div className="card"><span className="kicker">Approval gates</span><div className="big-number">{stats.approvals}</div></div>
      <div className="card"><span className="kicker">Memory signals</span><div className="big-number">{stats.memory}</div></div>
      <div className="card"><span className="kicker">Graph edges</span><div className="big-number">{stats.edges}</div></div>
    </div>

    <section className="card" style={{ marginTop: 20 }}>
      <span className="kicker">V25 autonomous role launch</span><h2>Give the recruiting agent a role</h2>
      <label>Role title<input className="input" value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label>JD or calibrated intake<textarea className="textarea big" value={intake} onChange={e => setIntake(e.target.value)} /></label>
      <div className="grid two">
        <label>Skills<input className="input" value={skills} onChange={e => setSkills(e.target.value)} /></label>
        <label>Locations<input className="input" value={locations} onChange={e => setLocations(e.target.value)} /></label>
      </div>
      <label>Target companies<input className="input" value={companies} onChange={e => setCompanies(e.target.value)} /></label>
      <button className="btn" onClick={launch}>Launch recruiter agent</button>
    </section>

    <section style={{ marginTop: 24 }}><span className="kicker">Orchestration</span><h2>Workflow runs</h2><div className="results">
      {data.workflows.map(w => <div className="result-card" key={w.id}><div className="result-head"><span>{w.status}</span><span>{w.workflow_type.replaceAll('_',' ')}</span></div><h3>{w.input?.title || 'Recruiting workflow'}</h3><p className="muted">Current checkpoint: {w.current_step.replaceAll('_',' ')}</p><button className="btn secondary" disabled={w.status === 'waiting_approval' || w.status === 'completed'} onClick={() => action({ action: 'advance', workflowId: w.id }, `Advancing ${w.input?.title || 'workflow'}…`)}>Run next checkpoint</button></div>)}
      {!data.workflows.length ? <div className="card"><p className="muted">No agent workflows yet.</p></div> : null}
    </div></section>

    <section style={{ marginTop: 24 }}><span className="kicker">Human approval gates</span><h2>Decisions requiring recruiter control</h2><div className="results">
      {data.approvals.map(a => <div className="result-card" key={a.id}><div className="result-head"><span>{a.approval_type.replaceAll('_',' ')}</span><span>pending</span></div><h3>{a.title}</h3><p>{a.summary}</p><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--muted)' }}>{JSON.stringify(a.payload, null, 2)}</pre><div className="button-row"><button onClick={() => action({ action: 'approval', approvalId: a.id, decision: 'approved' }, 'Approving checkpoint…')}>Approve</button><button onClick={() => action({ action: 'approval', approvalId: a.id, decision: 'rejected', note: 'Recruiter requested revision.' }, 'Rejecting checkpoint…')}>Reject</button></div></div>)}
      {!data.approvals.length ? <div className="card"><p className="muted">No decisions are waiting for approval.</p></div> : null}
    </div></section>

    <div className="grid two" style={{ marginTop: 24 }}>
      <section><span className="kicker">V24 recruiter memory</span><h2>What the agent has learned</h2><div className="results">{data.memory.slice(0,30).map(m => <div className="result-card" key={m.id}><div className="result-head"><span>{m.signal_type}</span><span>{m.confidence}% confidence</span></div><h3>{m.key}</h3><p>{m.value}</p><p className="muted">Supported by {m.supporting_events} decision{m.supporting_events === 1 ? '' : 's'}.</p></div>)}{!data.memory.length ? <div className="card"><p className="muted">Memory starts only after repeated recruiter decisions.</p></div> : null}</div></section>
      <section><span className="kicker">V23 talent graph</span><h2>Relationship evidence</h2><div className="results">{data.edges.slice(0,30).map(e => <div className="result-card" key={e.id}><div className="result-head"><span>{e.edge_type.replaceAll('_',' ')}</span><span>{e.confidence}%</span></div><h3>{e.label || `${e.from_type} → ${e.to_type}`}</h3><p className="muted">{e.from_id} → {e.to_id}</p></div>)}{!data.edges.length ? <div className="card"><p className="muted">Graph edges will accumulate from reviewed employment, project, publication, patent, and professional relationship evidence.</p></div> : null}</div></section>
    </div>

    <section style={{ marginTop: 24 }}><span className="kicker">Daily recruiter brief</span><h2>What needs attention</h2><div className="results">{data.briefs.map(b => <div className="result-card" key={b.id}><div className="result-head"><span>{b.brief_date}</span><span>agent brief</span></div><h3>{b.title}</h3><p>{b.summary}</p></div>)}{!data.briefs.length ? <div className="card"><p className="muted">Daily briefs will summarize new candidates, approvals, stalled workflows, risks, and next actions.</p></div> : null}</div></section>
    <p className="muted" style={{ marginTop: 20 }}>{status}</p>
  </div>
}
