'use client'

import { useMemo, useState } from 'react'
import { buildSearchLanes, createRoleWorkspace, type RoleIntake, type RoleWorkspace, type SearchLane } from '@/lib/role-workspace'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import { enrichRoleIntakeWithOnet, type OnetRoleIntelligence } from '@/lib/onet-role-intelligence'

type Props = { initialText?: string; onCancel: () => void; onCreate: (workspace: RoleWorkspace) => void }

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, 30)
}
function parseList(value: string) { return unique(value.split(/[,\n]/)) }
function list(value: string[]) { return value.join(', ') }

export function RoleIntakeWizardV33({ initialText = '', onCancel, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rawText, setRawText] = useState(initialText)
  const [draft, setDraft] = useState<RoleWorkspace | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [onet, setOnet] = useState<OnetRoleIntelligence | undefined>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const approvedCount = draft?.searchLanes.filter(lane => lane.status === 'approved').length || 0
  const readiness = useMemo(() => {
    if (!draft) return 0
    let score = 20
    if (draft.intake.title && draft.intake.title !== 'Untitled role') score += 20
    if (draft.intake.location !== 'Not specified') score += 10
    if (draft.intake.mustHaves.length) score += 25
    if (approvedCount) score += 20
    if (draft.intake.adjacentBackgrounds.length) score += 5
    return Math.min(score, 100)
  }, [approvedCount, draft])

  async function begin() {
    const text = rawText.trim()
    if (text.length < 20) {
      setError('Describe the role in at least 20 characters or paste the job description.')
      return
    }
    setWorking(true)
    setError('')
    const interpretation = interpretRoleBrief(text)
    let workspace = createRoleWorkspace(text)
    setQuestions(interpretation.questions)

    try {
      const response = await fetch(`/api/role-intelligence/onet?title=${encodeURIComponent(workspace.intake.title)}`)
      const json = await response.json() as { intelligence?: OnetRoleIntelligence }
      if (json.intelligence) {
        setOnet(json.intelligence)
        const intake = enrichRoleIntakeWithOnet(workspace.intake, json.intelligence)
        workspace = { ...workspace, intake, searchLanes: buildSearchLanes(intake) }
      }
    } catch {
      setOnet(undefined)
    } finally {
      setDraft(workspace)
      setStep(2)
      setWorking(false)
    }
  }

  function updateIntake<K extends keyof RoleIntake>(field: K, value: RoleIntake[K]) {
    setDraft(current => {
      if (!current) return current
      const intake = { ...current.intake, [field]: value } as RoleIntake
      const previous = new Map(current.searchLanes.map(lane => [lane.id, lane.status]))
      const searchLanes = buildSearchLanes(intake).map(lane => ({ ...lane, status: previous.get(lane.id) || lane.status }))
      return { ...current, intake, searchLanes, updatedAt: new Date().toISOString() }
    })
  }

  function updateLane(id: string, status: SearchLane['status']) {
    setDraft(current => current ? { ...current, searchLanes: current.searchLanes.map(lane => lane.id === id ? { ...lane, status } : lane), updatedAt: new Date().toISOString() } : current)
  }

  function finish() {
    if (!draft) return
    if (!draft.intake.title || draft.intake.title === 'Untitled role') {
      setError('Confirm the target role title before creating the workspace.')
      setStep(2)
      return
    }
    if (!draft.intake.mustHaves.length) {
      setError('Confirm at least one recruiter-approved must-have before creating the workspace.')
      setStep(2)
      return
    }
    if (!approvedCount) {
      setError('Approve at least one canonical sourcing hypothesis before creating the workspace.')
      return
    }
    const now = new Date().toISOString()
    onCreate({
      ...draft,
      status: 'calibrating',
      updatedAt: now,
      activity: [{ id: crypto.randomUUID(), type: 'lane_approved', message: `Role brief confirmed with ${approvedCount} approved canonical search hypoth${approvedCount === 1 ? 'esis' : 'eses'}.`, createdAt: now }, ...draft.activity],
    })
  }

  return <section className="role-wizard" aria-label="Create role from natural-language sourcing brief">
    <header className="role-wizard-header"><div><span className="kicker">Role Brain · V33</span><h2>{step === 1 ? 'Tell SourcingOS who you need.' : step === 2 ? 'Confirm what the brief means.' : 'Approve the sourcing hypotheses.'}</h2><p>{step === 1 ? 'Use a sentence, hiring-manager notes, or a full JD. SourcingOS structures the same role brain before any research runs.' : step === 2 ? 'Only recruiter-confirmed requirements become role criteria. Occupational intelligence adds search adjacencies, not hidden must-haves.' : 'These are the same canonical hypothesis IDs used by guided queries, executable sources, paste-back, and calibration.'}</p></div><button className="role-wizard-close" onClick={onCancel} aria-label="Close role setup">×</button></header>

    <div className="role-wizard-steps"><div className={step === 1 ? 'active' : 'complete'}><span>{step > 1 ? '✓' : '1'}</span><b>Brief</b></div><div className={step === 2 ? 'active' : step > 2 ? 'complete' : ''}><span>{step > 2 ? '✓' : '2'}</span><b>Interpret</b></div><div className={step === 3 ? 'active' : ''}><span>3</span><b>Plan</b></div></div>
    {error && <div className="role-wizard-alert" role="alert">{error}</div>}

    {step === 1 && <div className="role-wizard-body">
      <label className="role-wizard-source">Natural-language sourcing brief or job description<textarea className="textarea big" value={rawText} onChange={event => setRawText(event.target.value)} placeholder="Find me a senior platform engineer in Minneapolis with recent hands-on Kubernetes ownership and strong infrastructure depth…" /><span>{rawText.trim().length.toLocaleString()} characters · 20 minimum</span></label>
      <div className="cta"><b>Examples that work</b><p className="muted">“I need an oncology nurse practitioner in Phoenix.” · “Find cleared DevSecOps talent around Northern Virginia with Kubernetes and cloud security evidence.” · Or paste the full JD.</p></div>
      <div className="role-wizard-footer"><div><b>Recruiter control stays on</b><span>No search runs, candidate decisions, or outreach happen during setup.</span></div><div className="button-row"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn" disabled={working} onClick={() => void begin()}>{working ? 'Interpreting…' : 'Interpret role →'}</button></div></div>
    </div>}

    {step === 2 && draft && <div className="role-wizard-body">
      <div className="role-wizard-score"><div><span>Search readiness</span><b>{readiness}%</b></div><div className="role-wizard-score-track"><span style={{ width: `${readiness}%` }} /></div><small>Readiness measures workflow completeness, not a person or hiring outcome.</small></div>
      {questions.length > 0 && <div className="cta"><b>Confirm before search</b>{questions.map(question => <p className="muted" key={question}>• {question}</p>)}</div>}
      {onet?.matchedOccupation && <div className="cta"><b>O*NET 31.0 role context</b><p className="muted">Matched occupation: {onet.matchedOccupation.title}. Related occupations and technologies can expand search hypotheses; they do not rewrite your must-haves.</p></div>}
      <div className="role-wizard-calibration-grid"><div className="role-wizard-form">
        <div className="grid two"><label>Role title<input className="input" value={draft.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label><label>Location<input className="input" value={draft.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label><label>Work mode<select value={draft.intake.workMode} onChange={event => updateIntake('workMode', event.target.value as RoleIntake['workMode'])}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label><label>Clearance / credential context<input className="input" value={draft.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label></div>
        <label>Must-haves<textarea className="textarea" value={list(draft.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} /></label><label>Preferred<textarea className="textarea" value={list(draft.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label><label>Disqualifiers<textarea className="textarea" value={list(draft.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label><label>Target companies<textarea className="textarea" value={list(draft.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} /></label><label>Adjacent backgrounds<textarea className="textarea" value={list(draft.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} /></label><label>Hiring-manager notes<textarea className="textarea" value={draft.intake.hiringManagerNotes} onChange={event => updateIntake('hiringManagerNotes', event.target.value)} /></label>
      </div><aside className="role-wizard-preview"><span className="kicker">Structured Role Brain</span><h3>{draft.intake.title}</h3><p>{[draft.intake.location, draft.intake.workMode, draft.intake.clearance !== 'Not specified' ? draft.intake.clearance : ''].filter(Boolean).join(' · ')}</p><small>Recruiter-approved must-haves</small><div className="chips">{draft.intake.mustHaves.map(item => <span className="tag" key={item}>{item}</span>)}</div><small>Search adjacencies</small><div className="chips">{draft.intake.adjacentBackgrounds.slice(0, 10).map(item => <span className="tag" key={item}>{item}</span>)}</div><details className="advanced-disclosure"><summary>Original source text</summary><pre>{draft.intake.rawDescription}</pre></details></aside></div>
      <div className="role-wizard-footer"><button className="btn ghost" onClick={() => setStep(1)}>← Back</button><button className="btn secondary" onClick={() => setStep(3)}>Review canonical Search Plan →</button></div>
    </div>}

    {step === 3 && draft && <div className="role-wizard-body">
      <div className="role-wizard-strategy-summary"><div><small>Approved hypotheses</small><b>{approvedCount}</b></div><div><small>Total hypotheses</small><b>{draft.searchLanes.length}</b></div><div><small>Role status</small><b>Calibrating</b></div></div>
      <div className="role-wizard-lanes">{draft.searchLanes.map(lane => <article className={`role-wizard-lane ${lane.status}`} key={lane.id}><div className="role-wizard-lane-icon">{lane.label.slice(0, 1)}</div><div><div className="role-wizard-lane-title"><h3>{lane.label}</h3><span className={`status-pill ${lane.status === 'approved' ? 'success' : 'warning'}`}>{lane.status}</span></div><p>{lane.purpose}</p><details className="advanced-disclosure"><summary>Review strategy query</summary><code>{lane.query}</code></details></div><div className="role-wizard-lane-actions"><button className={lane.status === 'approved' ? 'btn' : 'btn secondary'} onClick={() => updateLane(lane.id, 'approved')}>Approve</button><button className="btn ghost" onClick={() => updateLane(lane.id, 'paused')}>Pause</button></div></article>)}</div>
      <div className="role-wizard-footer"><button className="btn ghost" onClick={() => setStep(2)}>← Back</button><div><b>{approvedCount} approved</b><span>You can revise the same plan later through recruiter-approved calibration.</span></div><button className="btn" onClick={finish}>Create role workspace →</button></div>
    </div>}
  </section>
}
