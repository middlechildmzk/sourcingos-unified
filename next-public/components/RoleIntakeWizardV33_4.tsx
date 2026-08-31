'use client'

import { useMemo, useState } from 'react'
import { buildSearchLanes, createRoleWorkspace, type RoleIntake, type RoleWorkspace, type SearchLane } from '@/lib/role-workspace'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import { initializeApprovedRoleBrief } from '@/lib/role-brief-artifact-v33-4'
import { roleBriefInterpretations } from '@/lib/role-workbench-v33-4'
import { enrichRoleIntakeWithOnet, type OnetRoleIntelligence } from '@/lib/onet-role-intelligence'

type Props = { initialText?: string; onCancel: () => void; onCreate: (workspace: RoleWorkspace) => void }

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, 30)
}
function parseList(value: string) { return unique(value.split(/[,\n]/)) }
function list(value: string[]) { return value.join(', ') }

export function RoleIntakeWizardV33_4({ initialText = '', onCancel, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [rawText, setRawText] = useState(initialText)
  const [draft, setDraft] = useState<RoleWorkspace | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [onet, setOnet] = useState<OnetRoleIntelligence | undefined>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const approvedCount = draft?.searchLanes.filter(lane => lane.status === 'approved').length || 0
  const interpretations = useMemo(() => draft ? roleBriefInterpretations(draft.intake) : [], [draft])

  async function begin() {
    const text = rawText.trim()
    if (text.length < 20) {
      setError('Describe who you need in at least 20 characters, or paste the job description.')
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
    setDraft(current => current ? {
      ...current,
      searchLanes: current.searchLanes.map(lane => lane.id === id ? { ...lane, status } : lane),
      updatedAt: new Date().toISOString(),
    } : current)
  }

  function continueToPlan() {
    if (!draft) return
    if (!draft.intake.title || draft.intake.title === 'Untitled role') {
      setError('Confirm the target role title before approving the Role Brief.')
      return
    }
    if (!draft.intake.mustHaves.length) {
      setError('Confirm at least one recruiter-approved must-have before approving the Role Brief.')
      return
    }
    setError('')
    setStep(3)
  }

  function finish() {
    if (!draft) return
    if (!approvedCount) {
      setError('Approve at least one sourcing hypothesis before creating the workspace.')
      return
    }
    const now = new Date().toISOString()
    const initialized = initializeApprovedRoleBrief(draft, now)
    onCreate({
      ...initialized,
      status: 'calibrating',
      updatedAt: now,
      activity: [{
        id: crypto.randomUUID(),
        type: 'lane_approved',
        message: `Approved Role Brief v1 and ${approvedCount} sourcing hypoth${approvedCount === 1 ? 'esis' : 'eses'}. No external search ran during setup.`,
        createdAt: now,
      }, ...initialized.activity],
    })
  }

  return <section className="role-wizard role-wizard-v33-4" aria-label="Create recruiter-approved Role Brief">
    <header className="role-wizard-header">
      <div>
        <span className="kicker">SourcingOS Role Brief</span>
        <h2>{step === 1 ? 'Who are you looking for?' : step === 2 ? 'Is this what you mean?' : 'How should SourcingOS search?'}</h2>
        <p>{step === 1
          ? 'Describe the person in plain English or paste the JD. Nothing searches until you approve the structured brief and at least one search angle.'
          : step === 2
            ? 'Review the criteria and the interpretations SourcingOS would carry into search. Unknowns stay unknown; sensitive requirements stay verification-gated.'
            : 'Approve the search angles worth spending effort on. The underlying queries remain inspectable, but they do not become candidate evidence.'}</p>
      </div>
      <button className="role-wizard-close" onClick={onCancel} aria-label="Close role setup">×</button>
    </header>

    <div className="role-wizard-steps">
      <div className={step === 1 ? 'active' : 'complete'}><span>{step > 1 ? '✓' : '1'}</span><b>Describe</b></div>
      <div className={step === 2 ? 'active' : step > 2 ? 'complete' : ''}><span>{step > 2 ? '✓' : '2'}</span><b>Approve brief</b></div>
      <div className={step === 3 ? 'active' : ''}><span>3</span><b>Approve search</b></div>
    </div>
    {error && <div className="role-wizard-alert" role="alert">{error}</div>}

    {step === 1 && <div className="role-wizard-body role-wizard-start-v33-4">
      <label className="role-wizard-source">
        Who do you need?
        <textarea
          className="textarea big"
          value={rawText}
          onChange={event => setRawText(event.target.value)}
          placeholder="Find me senior RHEL administrators within commuting distance of Annapolis Junction, with recent hands-on Linux ownership. Secret or higher is required and must be verified before consequential use…"
          autoFocus
        />
        <span>{rawText.trim().length.toLocaleString()} characters · one sentence, intake notes, or a full JD</span>
      </label>
      <div className="role-wizard-trust-strip">
        <span>✓ Recruiter approves the brief</span><span>✓ Search criteria ≠ candidate facts</span><span>✓ No auto-outreach</span>
      </div>
      <div className="role-wizard-footer">
        <div><b>No search spend yet</b><span>This step only structures the request.</span></div>
        <div className="button-row"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn" disabled={working} onClick={() => void begin()}>{working ? 'Understanding role…' : 'Build Role Brief →'}</button></div>
      </div>
    </div>}

    {step === 2 && draft && <div className="role-wizard-body">
      <div className="role-wizard-calibration-grid">
        <div className="role-wizard-form">
          {questions.length > 0 && <div className="cta"><b>Questions to review</b>{questions.map(question => <p className="muted" key={question}>• {question}</p>)}</div>}
          <div className="grid two">
            <label>Role title<input className="input" value={draft.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label>
            <label>Location<input className="input" value={draft.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label>
            <label>Work mode<select value={draft.intake.workMode} onChange={event => updateIntake('workMode', event.target.value as RoleIntake['workMode'])}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label>
            <label>Clearance / credential context<input className="input" value={draft.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label>
          </div>
          <label>Must-haves<textarea className="textarea" value={list(draft.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} /></label>
          <label>Preferred<textarea className="textarea" value={list(draft.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label>
          <label>Disqualifiers <small>shown as recruiter-defined conflicts, never auto-rejections</small><textarea className="textarea" value={list(draft.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label>
          <label>Target companies<textarea className="textarea" value={list(draft.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} /></label>
          <label>Adjacent backgrounds<textarea className="textarea" value={list(draft.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} /></label>
          <label>Hiring-manager context<textarea className="textarea" value={draft.intake.hiringManagerNotes} onChange={event => updateIntake('hiringManagerNotes', event.target.value)} /></label>
        </div>

        <aside className="role-wizard-preview role-interpretation-preview-v33-4">
          <span className="kicker">How SourcingOS interpreted your request</span>
          <h3>{draft.intake.title}</h3>
          <p>{[draft.intake.location, draft.intake.workMode].filter(Boolean).join(' · ')}</p>
          <div className="role-interpretation-list-v33-4">{interpretations.map(note => <div key={note.id} className={note.verificationGated ? 'verification' : ''}><b>{note.label}</b><span>{note.statement}</span></div>)}</div>
          {onet?.matchedOccupation && <div className="role-context-note-v33-4"><b>O*NET context</b><span>{onet.matchedOccupation.title} and related occupational intelligence may expand search angles; it cannot add hidden must-haves.</span></div>}
          <details className="advanced-disclosure"><summary>Original source text</summary><pre>{draft.intake.rawDescription}</pre></details>
        </aside>
      </div>
      <div className="role-wizard-footer"><button className="btn ghost" onClick={() => setStep(1)}>← Back</button><div><b>Brief approval boundary</b><span>No candidate research has run.</span></div><button className="btn" onClick={continueToPlan}>Looks right — review search plan →</button></div>
    </div>}

    {step === 3 && draft && <div className="role-wizard-body">
      <div className="role-wizard-strategy-summary"><div><small>Approved search angles</small><b>{approvedCount}</b></div><div><small>Total proposed</small><b>{draft.searchLanes.length}</b></div><div><small>Role Brief</small><b>v1</b></div></div>
      <div className="role-wizard-lanes">{draft.searchLanes.map(lane => <article className={`role-wizard-lane ${lane.status}`} key={lane.id}>
        <div className="role-wizard-lane-icon">{lane.label.slice(0, 1)}</div>
        <div><div className="role-wizard-lane-title"><h3>{lane.label}</h3><span className={`status-pill ${lane.status === 'approved' ? 'success' : 'warning'}`}>{lane.status}</span></div><p>{lane.purpose}</p><details className="advanced-disclosure"><summary>Why / query details</summary><code>{lane.query}</code></details></div>
        <div className="role-wizard-lane-actions"><button className={lane.status === 'approved' ? 'btn' : 'btn secondary'} onClick={() => updateLane(lane.id, 'approved')}>Approve</button><button className="btn ghost" onClick={() => updateLane(lane.id, 'paused')}>Pause</button></div>
      </article>)}</div>
      <div className="role-wizard-footer"><button className="btn ghost" onClick={() => setStep(2)}>← Edit brief</button><div><b>{approvedCount} approved</b><span>Search still begins only when you explicitly run the sourcing agent.</span></div><button className="btn" onClick={finish}>Create approved role →</button></div>
    </div>}
  </section>
}
