'use client'

import { useMemo, useState } from 'react'
import { buildSearchLanes, createRoleWorkspace, type RoleIntake, type RoleWorkspace } from '@/lib/role-workspace'
import { initializeApprovedRoleBrief } from '@/lib/role-brief-artifact-v33-4'
import { roleBriefInterpretations } from '@/lib/role-workbench-v33-4'
import { enrichRoleIntakeWithOnet, type OnetRoleIntelligence } from '@/lib/onet-role-intelligence'

type Props = { initialText?: string; onCancel: () => void; onCreate: (workspace: RoleWorkspace) => void }
type ParseResponse = { ok?: boolean; error?: string; result?: { intake: RoleIntake; questions: string[]; aiGenerated: boolean; summary: string } }

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, 30)
}
function parseList(value: string) { return unique(value.split(/[,\n]/)) }
function list(value: string[]) { return value.join(', ') }

export function RoleIntakeWizardV33_4({ initialText = '', onCancel, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [rawText, setRawText] = useState(initialText)
  const [draft, setDraft] = useState<RoleWorkspace | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [aiGenerated, setAiGenerated] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [onet, setOnet] = useState<OnetRoleIntelligence | undefined>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const interpretations = useMemo(() => draft ? roleBriefInterpretations(draft.intake) : [], [draft])

  async function begin() {
    const text = rawText.trim()
    if (text.length < 10) {
      setError('Tell me who you need in one or two sentences, or paste the job description.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/role-intelligence/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await response.json() as ParseResponse
      if (!response.ok || !json.ok || !json.result) throw new Error(json.error || 'Could not understand the role request.')

      let workspace = createRoleWorkspace(text)
      workspace = { ...workspace, intake: json.result.intake, searchLanes: buildSearchLanes(json.result.intake) }
      setQuestions(json.result.questions || [])
      setSummary(json.result.summary || '')
      setAiGenerated(Boolean(json.result.aiGenerated))

      try {
        const onetResponse = await fetch(`/api/role-intelligence/onet?title=${encodeURIComponent(workspace.intake.title)}`)
        const onetJson = await onetResponse.json() as { intelligence?: OnetRoleIntelligence }
        if (onetJson.intelligence) {
          setOnet(onetJson.intelligence)
          const intake = enrichRoleIntakeWithOnet(workspace.intake, onetJson.intelligence)
          workspace = { ...workspace, intake, searchLanes: buildSearchLanes(intake) }
        }
      } catch {
        setOnet(undefined)
      }

      setDraft(workspace)
      setStep(2)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not understand the role request.')
    } finally {
      setWorking(false)
    }
  }

  function updateIntake<K extends keyof RoleIntake>(field: K, value: RoleIntake[K]) {
    setDraft(current => {
      if (!current) return current
      const intake = { ...current.intake, [field]: value } as RoleIntake
      return { ...current, intake, searchLanes: buildSearchLanes(intake), updatedAt: new Date().toISOString() }
    })
  }

  function startSourcing() {
    if (!draft) return
    if (!draft.intake.title || draft.intake.title === 'Untitled role') {
      setError('I still need a clear role title before I can start sourcing.')
      setShowDetails(true)
      return
    }
    if (!draft.intake.mustHaves.length) {
      setError('I still need at least one non-negotiable capability before I can start sourcing.')
      setShowDetails(true)
      return
    }

    const now = new Date().toISOString()
    const approvedSearchLanes = draft.searchLanes.map(lane => ({ ...lane, status: 'approved' as const }))
    const initialized = initializeApprovedRoleBrief({ ...draft, searchLanes: approvedSearchLanes }, now)
    onCreate({
      ...initialized,
      status: 'active',
      updatedAt: now,
      activity: [{
        id: crypto.randomUUID(),
        type: 'lane_approved',
        message: `Recruiter confirmed Role Brief v1 and authorized the initial ${approvedSearchLanes.length}-angle sourcing pass from the compact confirmation screen.`,
        createdAt: now,
      }, ...initialized.activity],
    })
  }

  return <section className="role-wizard role-wizard-v33-4 role-wizard-agent-first-v33-4" aria-label="Create sourcing search">
    <header className="role-wizard-header">
      <div>
        <span className="kicker">SourcingOS Agent</span>
        <h2>{step === 1 ? 'Who are you looking for?' : 'Here’s what I’m going to look for.'}</h2>
        <p>{step === 1
          ? 'Describe the person naturally. One or two sentences is enough; a full JD works too.'
          : 'You do not need to fill out a form. Confirm the search or edit details only if something looks wrong.'}</p>
      </div>
      <button className="role-wizard-close" onClick={onCancel} aria-label="Close role setup">×</button>
    </header>

    {error && <div className="role-wizard-alert" role="alert">{error}</div>}

    {step === 1 && <div className="role-wizard-body role-wizard-start-v33-4">
      <div className="role-agent-prompt-v33-4">
        <textarea
          className="textarea big"
          value={rawText}
          onChange={event => setRawText(event.target.value)}
          placeholder="Find me senior RHEL administrators near Annapolis Junction with recent hands-on Linux ownership. Secret or higher is required; 7+ years is preferred."
          aria-label="Who are you looking for?"
          autoFocus
        />
        <div className="role-agent-prompt-meta-v33-4">
          <span>Try a sentence, intake notes, or paste the JD.</span>
          <span>{rawText.trim().length.toLocaleString()} characters</span>
        </div>
      </div>
      <div className="role-wizard-trust-strip">
        <span>AI parses the brief</span><span>You confirm once</span><span>Then the agent starts</span>
      </div>
      <div className="role-wizard-footer role-wizard-footer-simple-v33-4">
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={working} onClick={() => void begin()}>{working ? 'Understanding what you need…' : 'Continue →'}</button>
      </div>
    </div>}

    {step === 2 && draft && <div className="role-wizard-body role-agent-confirm-v33-4">
      <section className="role-agent-understood-v33-4">
        <div className="role-agent-understood-head-v33-4">
          <div>
            <span className="kicker">{aiGenerated ? 'AI-parsed Role Brief' : 'Parsed Role Brief'}</span>
            <h3>{draft.intake.title}</h3>
            <p>{summary || [draft.intake.location, draft.intake.workMode].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="btn ghost" onClick={() => setShowDetails(current => !current)}>{showDetails ? 'Hide details' : 'Edit details'}</button>
        </div>

        <div className="role-agent-brief-grid-v33-4">
          <div><small>Must have</small><div className="chips">{draft.intake.mustHaves.length ? draft.intake.mustHaves.map(item => <span className="chip" key={item}>{item}</span>) : <span className="muted">None confirmed</span>}</div></div>
          {draft.intake.niceToHaves.length > 0 && <div><small>Preferred</small><div className="chips">{draft.intake.niceToHaves.slice(0, 8).map(item => <span className="chip" key={item}>{item}</span>)}</div></div>}
          <div><small>Location / work</small><p>{[draft.intake.location !== 'Not specified' ? draft.intake.location : '', draft.intake.workMode !== 'unknown' ? draft.intake.workMode : ''].filter(Boolean).join(' · ') || 'Open / not specified'}</p></div>
          {draft.intake.clearance !== 'Not specified' && <div><small>Verification-gated</small><p>{draft.intake.clearance} · discovery context only until verified</p></div>}
          {draft.intake.disqualifiers.length > 0 && <div><small>Avoid / flag for review</small><p>{draft.intake.disqualifiers.join(' · ')}</p></div>}
        </div>

        <div className="role-agent-plan-line-v33-4">
          <b>I’ll start with {draft.searchLanes.length} search angles</b>
          <span>{draft.searchLanes.slice(0, 4).map(lane => lane.label).join(' · ')}{draft.searchLanes.length > 4 ? ` · +${draft.searchLanes.length - 4} more` : ''}</span>
        </div>

        {questions.length > 0 && <div className="role-agent-followup-note-v33-4">
          <b>I noticed {questions.length === 1 ? 'one possible ambiguity' : 'a couple possible ambiguities'}.</b>
          <span>I can start from what you gave me and use the first talent pool to calibrate instead of blocking you with a questionnaire.</span>
          <details><summary>See what I may ask later</summary>{questions.map(question => <p key={question}>• {question}</p>)}</details>
        </div>}

        <div className="role-interpretation-list-v33-4 role-agent-trust-summary-v33-4">{interpretations.filter(note => note.verificationGated || note.id === 'source-truth').map(note => <div key={note.id} className={note.verificationGated ? 'verification' : ''}><b>{note.label}</b><span>{note.statement}</span></div>)}</div>
        {onet?.matchedOccupation && <div className="role-context-note-v33-4"><b>Search expansion</b><span>O*NET recognized {onet.matchedOccupation.title}; related titles may broaden discovery but do not become hidden requirements.</span></div>}
      </section>

      {showDetails && <details className="role-agent-details-v33-4" open>
        <summary>Advanced Role Brief fields</summary>
        <div className="role-wizard-form">
          <div className="grid two">
            <label>Role title<input className="input" value={draft.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label>
            <label>Location<input className="input" value={draft.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label>
            <label>Work mode<select value={draft.intake.workMode} onChange={event => updateIntake('workMode', event.target.value as RoleIntake['workMode'])}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label>
            <label>Clearance / credential context<input className="input" value={draft.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label>
          </div>
          <label>Must-haves<textarea className="textarea" value={list(draft.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} /></label>
          <label>Preferred<textarea className="textarea" value={list(draft.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label>
          <label>Disqualifiers<textarea className="textarea" value={list(draft.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label>
          <label>Target companies<textarea className="textarea" value={list(draft.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} /></label>
          <label>Adjacent backgrounds<textarea className="textarea" value={list(draft.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} /></label>
        </div>
      </details>}

      <div className="role-wizard-footer role-agent-launch-v33-4">
        <button className="btn ghost" onClick={() => setStep(1)}>← Change request</button>
        <div><b>Looks right?</b><span>Starting authorizes this initial search pass. Candidate facts still require candidate evidence.</span></div>
        <button className="btn" onClick={startSourcing}>Start sourcing →</button>
      </div>
    </div>}
  </section>
}
