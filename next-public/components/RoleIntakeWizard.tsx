'use client'

import { useMemo, useState } from 'react'
import {
  buildSearchLanes,
  createRoleWorkspace,
  type RoleIntake,
  type RoleWorkspace,
  type SearchLane,
} from '@/lib/role-workspace'

type RoleIntakeWizardProps = {
  initialText?: string
  onCancel: () => void
  onCreate: (workspace: RoleWorkspace) => void
}

type TemplateKey = 'auto' | 'technical' | 'cleared' | 'healthcare' | 'human-performance' | 'talent' | 'ai-research'

type RoleTemplate = {
  key: TemplateKey
  label: string
  description: string
  mustHaves: string[]
  adjacentBackgrounds: string[]
}

const templates: RoleTemplate[] = [
  {
    key: 'auto',
    label: 'Smart extraction',
    description: 'Start from the JD and keep every recommendation role-specific.',
    mustHaves: [],
    adjacentBackgrounds: [],
  },
  {
    key: 'technical',
    label: 'Technical & DevSecOps',
    description: 'Cloud, software, infrastructure, cybersecurity, and engineering leadership.',
    mustHaves: ['Technical depth', 'Production delivery'],
    adjacentBackgrounds: ['Platform engineering', 'Cloud security', 'Site reliability engineering'],
  },
  {
    key: 'cleared',
    label: 'Cleared & GovCon',
    description: 'Federal programs, mission delivery, capture, readiness, and cleared talent.',
    mustHaves: ['Federal contracting', 'Stakeholder management'],
    adjacentBackgrounds: ['Military readiness', 'Program operations', 'Mission support'],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    description: 'Clinical, provider, healthcare operations, research, and regulated delivery.',
    mustHaves: ['Healthcare domain experience', 'Regulated environment'],
    adjacentBackgrounds: ['Clinical operations', 'Military health', 'Population health'],
  },
  {
    key: 'human-performance',
    label: 'Human Performance',
    description: 'POTFF, H2F, Warrior Care, recovery, wellness, and force readiness.',
    mustHaves: ['Program leadership', 'Human performance or readiness'],
    adjacentBackgrounds: ['POTFF', 'H2F', 'Warrior Care', 'Recovery Care', 'Force and Family Readiness'],
  },
  {
    key: 'talent',
    label: 'Talent Acquisition',
    description: 'Sourcing, recruiting, recruiting operations, intelligence, and RPO leadership.',
    mustHaves: ['Talent acquisition', 'Stakeholder partnership'],
    adjacentBackgrounds: ['Talent intelligence', 'Recruiting operations', 'RPO', 'Workforce planning'],
  },
  {
    key: 'ai-research',
    label: 'AI & Research',
    description: 'Applied AI, machine learning, research engineering, data, and scientific talent.',
    mustHaves: ['Artificial Intelligence', 'Research or production evidence'],
    adjacentBackgrounds: ['Machine Learning', 'Data Engineering', 'Research Engineering'],
  },
]

const steps = [
  { number: 1, label: 'Intake' },
  { number: 2, label: 'Calibration' },
  { number: 3, label: 'Strategy' },
]

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, 30)
}

function parseList(value: string): string[] {
  return unique(value.split(/[,\n]/))
}

function listInput(value: string[]): string {
  return value.join(', ')
}

function enhanceWithTemplate(workspace: RoleWorkspace, templateKey: TemplateKey): RoleWorkspace {
  const template = templates.find(item => item.key === templateKey)
  if (!template || template.key === 'auto') return workspace

  const intake: RoleIntake = {
    ...workspace.intake,
    mustHaves: unique([...workspace.intake.mustHaves, ...template.mustHaves]),
    adjacentBackgrounds: unique([...workspace.intake.adjacentBackgrounds, ...template.adjacentBackgrounds]),
  }

  return {
    ...workspace,
    intake,
    searchLanes: buildSearchLanes(intake),
  }
}

export function RoleIntakeWizard({ initialText = '', onCancel, onCreate }: RoleIntakeWizardProps) {
  const [step, setStep] = useState(1)
  const [rawText, setRawText] = useState(initialText)
  const [templateKey, setTemplateKey] = useState<TemplateKey>('auto')
  const [draft, setDraft] = useState<RoleWorkspace | null>(null)
  const [error, setError] = useState('')

  const approvedCount = draft?.searchLanes.filter(lane => lane.status === 'approved').length || 0
  const proposedCount = draft?.searchLanes.filter(lane => lane.status === 'proposed').length || 0

  const readiness = useMemo(() => {
    if (!draft) return 0
    let score = 25
    if (draft.intake.title && draft.intake.title !== 'Untitled role') score += 20
    if (draft.intake.location !== 'Not specified') score += 10
    if (draft.intake.mustHaves.length >= 3) score += 20
    if (approvedCount >= 2) score += 20
    if (draft.intake.adjacentBackgrounds.length) score += 5
    return Math.min(score, 100)
  }, [approvedCount, draft])

  function beginCalibration() {
    if (rawText.trim().length < 80) {
      setError('Paste a complete job description or intake summary so SourcingOS can build a reliable search brief.')
      return
    }
    setError('')
    setDraft(enhanceWithTemplate(createRoleWorkspace(rawText.trim()), templateKey))
    setStep(2)
  }

  function updateIntake<K extends keyof RoleIntake>(field: K, value: RoleIntake[K]) {
    setDraft(current => {
      if (!current) return current
      const intake = { ...current.intake, [field]: value } as RoleIntake
      const statuses = new Map(current.searchLanes.map(lane => [lane.id, lane.status]))
      const searchLanes = buildSearchLanes(intake).map(lane => ({
        ...lane,
        status: statuses.get(lane.id) || lane.status,
      }))
      return { ...current, intake, searchLanes, updatedAt: new Date().toISOString() }
    })
  }

  function updateLane(laneId: string, status: SearchLane['status']) {
    setDraft(current => current ? {
      ...current,
      searchLanes: current.searchLanes.map(lane => lane.id === laneId ? { ...lane, status } : lane),
      updatedAt: new Date().toISOString(),
    } : current)
  }

  function finish() {
    if (!draft) return
    if (!draft.intake.title || draft.intake.title === 'Untitled role') {
      setError('Confirm a clear role title before creating the workspace.')
      setStep(2)
      return
    }
    if (!approvedCount) {
      setError('Approve at least one search lane before creating the workspace.')
      return
    }

    const now = new Date().toISOString()
    onCreate({
      ...draft,
      status: 'calibrating',
      updatedAt: now,
      activity: [
        {
          id: crypto.randomUUID(),
          type: 'lane_approved',
          message: `Guided intake completed with ${approvedCount} approved search lane${approvedCount === 1 ? '' : 's'}.`,
          createdAt: now,
        },
        ...draft.activity,
      ],
    })
  }

  return <section className="role-wizard" aria-label="Create a calibrated role">
    <header className="role-wizard-header">
      <div>
        <span className="kicker">Guided role setup</span>
        <h2>{step === 1 ? 'Start with the search, not a blank form' : step === 2 ? 'Confirm what success looks like' : 'Approve the search plan'}</h2>
        <p>{step === 1
          ? 'Paste what you have. SourcingOS will extract the intake and propose multiple sourcing lanes for recruiter approval.'
          : step === 2
            ? 'Review the role-specific requirements before any discovery workflow begins.'
            : 'Choose which lanes may run now. Proposed lanes remain paused until a recruiter approves them.'}</p>
      </div>
      <button className="role-wizard-close" onClick={onCancel} aria-label="Close guided role setup">×</button>
    </header>

    <div className="role-wizard-steps" aria-label={`Step ${step} of ${steps.length}`}>
      {steps.map(item => <div key={item.number} className={item.number === step ? 'active' : item.number < step ? 'complete' : ''}>
        <span>{item.number < step ? '✓' : item.number}</span>
        <b>{item.label}</b>
      </div>)}
    </div>

    {error && <div className="role-wizard-alert" role="alert">{error}</div>}

    {step === 1 && <div className="role-wizard-body">
      <div className="role-template-grid">
        {templates.map(template => <button
          type="button"
          key={template.key}
          className={`role-template-card ${templateKey === template.key ? 'selected' : ''}`}
          onClick={() => setTemplateKey(template.key)}
          aria-pressed={templateKey === template.key}
        >
          <span>{template.key === 'auto' ? '✦' : template.label.slice(0, 1)}</span>
          <b>{template.label}</b>
          <small>{template.description}</small>
        </button>)}
      </div>

      <label className="role-wizard-source">
        Job description or calibrated intake notes
        <textarea
          className="textarea big"
          value={rawText}
          onChange={event => setRawText(event.target.value)}
          placeholder="Paste the complete job description, hiring-manager notes, must-haves, location, compensation, clearance, and adjacent backgrounds…"
        />
        <span>{rawText.trim().length.toLocaleString()} characters · 80 minimum</span>
      </label>

      <div className="role-wizard-footer">
        <div><b>Recruiter control stays on</b><span>No campaign launches and no candidate is contacted during setup.</span></div>
        <div className="button-row"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn" onClick={beginCalibration}>Extract intake →</button></div>
      </div>
    </div>}

    {step === 2 && draft && <div className="role-wizard-body">
      <div className="role-wizard-score">
        <div><span>Search readiness</span><b>{readiness}%</b></div>
        <div className="role-wizard-score-track"><span style={{ width: `${readiness}%` }} /></div>
        <small>Readiness reflects intake completeness and recruiter-approved strategy, not candidate fit.</small>
      </div>

      <div className="role-wizard-calibration-grid">
        <div className="role-wizard-form">
          <div className="grid two">
            <label>Role title<input className="input" value={draft.intake.title} onChange={event => updateIntake('title', event.target.value)} /></label>
            <label>Location<input className="input" value={draft.intake.location} onChange={event => updateIntake('location', event.target.value)} /></label>
            <label>Work mode<select value={draft.intake.workMode} onChange={event => updateIntake('workMode', event.target.value as RoleIntake['workMode'])}><option value="unknown">Unknown</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option><option value="flexible">Flexible</option></select></label>
            <label>Compensation<input className="input" value={draft.intake.compensation} onChange={event => updateIntake('compensation', event.target.value)} /></label>
            <label>Clearance or credential<input className="input" value={draft.intake.clearance} onChange={event => updateIntake('clearance', event.target.value)} /></label>
            <label>Target companies<input className="input" value={listInput(draft.intake.targetCompanies)} onChange={event => updateIntake('targetCompanies', parseList(event.target.value))} placeholder="Company A, Company B" /></label>
          </div>
          <label>Must-haves<textarea className="textarea" value={listInput(draft.intake.mustHaves)} onChange={event => updateIntake('mustHaves', parseList(event.target.value))} placeholder="Required scope, skills, domain, clearance, leadership…" /></label>
          <label>Nice-to-haves<textarea className="textarea" value={listInput(draft.intake.niceToHaves)} onChange={event => updateIntake('niceToHaves', parseList(event.target.value))} /></label>
          <label>Disqualifiers<textarea className="textarea" value={listInput(draft.intake.disqualifiers)} onChange={event => updateIntake('disqualifiers', parseList(event.target.value))} /></label>
          <label>Adjacent backgrounds<textarea className="textarea" value={listInput(draft.intake.adjacentBackgrounds)} onChange={event => updateIntake('adjacentBackgrounds', parseList(event.target.value))} placeholder="Transferable programs, titles, industries, or mission areas…" /></label>
          <label>Hiring-manager notes<textarea className="textarea" value={draft.intake.hiringManagerNotes} onChange={event => updateIntake('hiringManagerNotes', event.target.value)} /></label>
        </div>

        <aside className="role-wizard-preview">
          <span className="kicker">Calibrated brief</span>
          <h3>{draft.intake.title}</h3>
          <p>{[draft.intake.location, draft.intake.workMode, draft.intake.clearance !== 'Not specified' ? draft.intake.clearance : ''].filter(Boolean).join(' · ')}</p>
          <div>
            <small>Must-have signals</small>
            <div className="chips">{draft.intake.mustHaves.slice(0, 8).map(item => <span className="tag" key={item}>{item}</span>)}{!draft.intake.mustHaves.length && <span className="muted">Add at least three signals.</span>}</div>
          </div>
          <div>
            <small>Adjacent universe</small>
            <div className="chips">{draft.intake.adjacentBackgrounds.slice(0, 8).map(item => <span className="tag" key={item}>{item}</span>)}{!draft.intake.adjacentBackgrounds.length && <span className="muted">Optional, but useful for hard-to-fill roles.</span>}</div>
          </div>
          <details className="advanced-disclosure"><summary>Original source text</summary><pre>{draft.intake.rawDescription}</pre></details>
        </aside>
      </div>

      <div className="role-wizard-footer">
        <button className="btn ghost" onClick={() => setStep(1)}>← Back</button>
        <div className="button-row"><button className="btn secondary" onClick={() => setStep(3)}>Review {draft.searchLanes.length} search lanes →</button></div>
      </div>
    </div>}

    {step === 3 && draft && <div className="role-wizard-body">
      <div className="role-wizard-strategy-summary">
        <div><small>Approved now</small><b>{approvedCount}</b></div>
        <div><small>Awaiting review</small><b>{proposedCount}</b></div>
        <div><small>Role status</small><b>Calibrating</b></div>
      </div>

      <div className="role-wizard-lanes">
        {draft.searchLanes.map(lane => <article className={`role-wizard-lane ${lane.status}`} key={lane.id}>
          <div className="role-wizard-lane-icon">{lane.source.slice(0, 1).toUpperCase()}</div>
          <div>
            <div className="role-wizard-lane-title"><h3>{lane.label}</h3><span className={`status-pill ${lane.status === 'approved' ? 'success' : lane.status === 'proposed' ? 'warning' : ''}`}>{lane.status}</span></div>
            <p>{lane.purpose}</p>
            <details className="advanced-disclosure"><summary>Review query intent</summary><code>{lane.query}</code></details>
          </div>
          <div className="role-wizard-lane-actions">
            <button className={lane.status === 'approved' ? 'btn' : 'btn secondary'} onClick={() => updateLane(lane.id, 'approved')}>Approve</button>
            <button className="btn ghost" onClick={() => updateLane(lane.id, 'paused')}>Pause</button>
          </div>
        </article>)}
      </div>

      <div className="role-wizard-footer">
        <button className="btn ghost" onClick={() => setStep(2)}>← Back</button>
        <div><b>{approvedCount} approved lane{approvedCount === 1 ? '' : 's'}</b><span>You can refine strategy again inside the role workspace.</span></div>
        <button className="btn" onClick={finish}>Create calibrated workspace →</button>
      </div>
    </div>}
  </section>
}
