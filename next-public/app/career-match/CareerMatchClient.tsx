'use client'

import { useMemo, useState } from 'react'
import type { CareerMatchErrorResponse, CareerMatchResponse, CareerPreferences, RecruitingRoleFamily } from '@/lib/career-match/types'
import { recruitingRoleTaxonomy } from '@/lib/career-match/role-taxonomy'
import { MatchCard } from './components/MatchCard'
import { AdjacentRoleCard } from './components/AdjacentRoleCard'
import { TrustBlock } from './components/TrustBlock'

type Status = 'idle' | 'loading' | 'success' | 'error'

const roleOptions: Array<{ value: RecruitingRoleFamily | 'any'; label: string }> = [
  { value: 'any', label: 'Best fit across recruiting roles' },
  ...Object.values(recruitingRoleTaxonomy).map(entry => ({ value: entry.id, label: entry.label })),
]

function emptyPreferences(): CareerPreferences {
  return {
    desiredRoleType: 'any',
    workMode: 'any',
    location: '',
    salaryMin: null,
    salaryMax: null,
    industryFocus: '',
    openToAdjacentRoles: true,
    clearedFederalInterest: false,
  }
}

function supportedUploadName(file: File): boolean {
  const name = file.name.toLowerCase()
  return /\.(pdf|docx|txt|md|text)$/i.test(name) || file.type === 'application/pdf' || file.type.startsWith('text/')
}

export default function CareerMatchClient() {
  const [resumeText, setResumeText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileMessage, setFileMessage] = useState('')
  const [preferences, setPreferences] = useState<CareerPreferences>(emptyPreferences())
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<CareerMatchResponse | null>(null)
  const [error, setError] = useState('')
  const charsRemaining = useMemo(() => Math.max(0, 180 - resumeText.trim().length), [resumeText])
  const canSubmit = selectedFile !== null || resumeText.trim().length >= 180

  async function handleResumeFile(file: File | null) {
    if (!file) return
    setError('')
    setStatus('idle')
    setResult(null)

    if (!supportedUploadName(file)) {
      setSelectedFile(null)
      setFileMessage('')
      setStatus('error')
      setError('Unsupported file type. Upload a PDF, DOCX, TXT, or paste resume text.')
      return
    }

    const name = file.name.toLowerCase()
    if (/\.(txt|md|text)$/i.test(name) || file.type.startsWith('text/')) {
      const text = await file.text()
      setResumeText(text)
      setSelectedFile(null)
      setFileMessage(`Loaded text from ${file.name}.`)
      return
    }

    setSelectedFile(file)
    setFileMessage(`${file.name} attached. It will be extracted server-side when you generate the report.`)
  }

  function clearAttachedFile() {
    setSelectedFile(null)
    setFileMessage('')
  }

  function updatePreference<K extends keyof CareerPreferences>(key: K, value: CareerPreferences[K]) {
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  async function submit() {
    setStatus('loading')
    setError('')
    setResult(null)

    try {
      let res: Response
      if (selectedFile) {
        const form = new FormData()
        form.append('resumeFile', selectedFile)
        form.append('preferences', JSON.stringify(preferences))
        if (resumeText.trim()) form.append('resumeText', resumeText.trim())
        res = await fetch('/api/career-match', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/career-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeText, preferences }),
        })
      }

      const json = (await res.json()) as CareerMatchResponse | CareerMatchErrorResponse
      if (!res.ok || !json.ok) {
        setStatus('error')
        setError(!json.ok ? json.error : 'Career Match could not run. Try again with more resume text.')
        return
      }
      setResult(json)
      setStatus('success')
    } catch {
      setStatus('error')
      setError('Career Match could not connect. Please try again.')
    }
  }

  return (
    <div className="cm-flow">
      <section className="card cm-upload-card">
        <span className="kicker">Free V1 report</span>
        <h2>Upload your resume or paste the text.</h2>
        <p className="muted">PDF, DOCX, and TXT uploads now work. You can also paste text directly. Scanned/image-only PDFs may still need pasted text.</p>

        <label htmlFor="resume-file">Resume file</label>
        <input
          id="resume-file"
          className="input"
          type="file"
          accept=".pdf,.docx,.txt,.md,.text,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={event => void handleResumeFile(event.target.files?.[0] || null)}
        />
        {fileMessage ? (
          <p className="cm-file-note">
            {fileMessage}
            {selectedFile ? <button type="button" onClick={clearAttachedFile}>Remove file</button> : null}
          </p>
        ) : null}

        <label htmlFor="resume-text">Or paste resume text</label>
        <textarea
          id="resume-text"
          className="textarea big cm-resume-textarea"
          value={resumeText}
          onChange={event => {
            setResumeText(event.target.value)
            if (selectedFile) clearAttachedFile()
          }}
          placeholder="Paste your resume text here. Include titles, companies, dates, tools, industries, and sourcing/recruiting accomplishments."
        />
        <p className="muted">{selectedFile ? 'Ready to extract from the attached file.' : resumeText.trim().length < 180 ? `${charsRemaining} more characters needed for a basic parse.` : 'Enough text for the deterministic parser.'}</p>
      </section>

      <section className="card cm-preferences-card">
        <span className="kicker">Preferences</span>
        <h2>Tell it where to aim.</h2>
        <div className="cm-form-grid">
          <label>
            Target role lane
            <select
              value={preferences.desiredRoleType || 'any'}
              onChange={event => updatePreference('desiredRoleType', event.target.value as CareerPreferences['desiredRoleType'])}
            >
              {roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label>
            Work mode
            <select
              value={preferences.workMode || 'any'}
              onChange={event => updatePreference('workMode', event.target.value as CareerPreferences['workMode'])}
            >
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </label>

          <label>
            Location
            <input
              className="input"
              value={preferences.location || ''}
              onChange={event => updatePreference('location', event.target.value)}
              placeholder="Remote, Minneapolis, Dallas, etc."
            />
          </label>

          <label>
            Industry focus
            <input
              className="input"
              value={preferences.industryFocus || ''}
              onChange={event => updatePreference('industryFocus', event.target.value)}
              placeholder="Tech, healthcare, federal, RPO, AI, etc."
            />
          </label>

          <label>
            Salary minimum
            <input
              className="input"
              type="number"
              value={preferences.salaryMin ?? ''}
              onChange={event => updatePreference('salaryMin', event.target.value ? Number(event.target.value) : null)}
              placeholder="90000"
            />
          </label>

          <label>
            Salary maximum
            <input
              className="input"
              type="number"
              value={preferences.salaryMax ?? ''}
              onChange={event => updatePreference('salaryMax', event.target.value ? Number(event.target.value) : null)}
              placeholder="150000"
            />
          </label>
        </div>

        <div className="cm-checks">
          <label>
            <input
              type="checkbox"
              checked={preferences.openToAdjacentRoles !== false}
              onChange={event => updatePreference('openToAdjacentRoles', event.target.checked)}
            />
            Show adjacent recruiting career lanes
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(preferences.clearedFederalInterest)}
              onChange={event => updatePreference('clearedFederalInterest', event.target.checked)}
            />
            I am interested in federal or cleared recruiting roles
          </label>
        </div>

        <button className="btn cm-submit" type="button" onClick={() => void submit()} disabled={status === 'loading' || !canSubmit}>
          {status === 'loading' ? 'Reading resume and matching jobs...' : selectedFile ? 'Upload and generate Career Match' : 'Generate Career Match'}
        </button>
        {status === 'error' && error ? <p className="cm-error">{error}</p> : null}
      </section>

      {result ? (
        <section className="cm-results">
          <div className="card cm-profile-card">
            <span className="kicker">Parsed recruiting profile</span>
            <h2>{result.profile.currentTitle}</h2>
            <p className="lead">{result.profile.profileSummary}</p>
            <div className="chips">
              <span className="chip">Primary lane: {recruitingRoleTaxonomy[result.profile.primaryFamily].label}</span>
              <span className="chip">Seniority: {result.profile.seniority}</span>
              {result.profile.tools.slice(0, 8).map(tool => <span className="chip" key={tool}>{tool}</span>)}
            </div>
            <ul className="muted">
              {result.profile.confidenceNotes.map(note => <li key={note}>{note}</li>)}
              {result.notes.slice(-3).map(note => <li key={note}>{note}</li>)}
            </ul>
          </div>

          <div className="cm-result-headline">
            <div>
              <span className="kicker">Top 5 free matches</span>
              <h2>Matched against {result.jobCount} live recruiting jobs.</h2>
              <p className="muted">These cards use real job feed metadata and original apply links from the existing SourcingOS jobs surface.</p>
            </div>
          </div>

          <div className="cm-match-list">
            {result.matches.length ? result.matches.map(match => <MatchCard key={match.job.id} match={match} />) : (
              <div className="card">
                <h3>No strong matches surfaced yet.</h3>
                <p className="muted">Try a broader role lane, remove strict location preferences, or add more resume text with tools, industries, and titles.</p>
              </div>
            )}
          </div>

          {result.adjacentRoles.length ? (
            <section className="cm-adjacent-section">
              <span className="kicker">Adjacent role universe</span>
              <h2>Roles you may not be searching yet.</h2>
              <div className="grid two">
                {result.adjacentRoles.map(role => <AdjacentRoleCard key={role.family} role={role} />)}
              </div>
            </section>
          ) : null}

          <section className="card cm-upgrade-card">
            <span className="kicker">Paid report placeholder</span>
            <h2>Next paid layer: full Career Match Report.</h2>
            <p className="muted">V1 leaves the Stripe and PDF layer as a clear next pass. The locked report should include more matches, downloadable PDF, saved jobs, AI narrative, and grounded resume rewrites.</p>
            <div className="chips">
              <span className="chip">Full role universe</span>
              <span className="chip">PDF report</span>
              <span className="chip">Ongoing alerts</span>
              <span className="chip">Grounded rewrite suggestions</span>
            </div>
          </section>
        </section>
      ) : null}

      <TrustBlock />
    </div>
  )
}
