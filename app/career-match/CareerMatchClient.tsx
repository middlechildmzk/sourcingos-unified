'use client'

import { useMemo, useState } from 'react'
import type { CareerMatchErrorResponse, CareerMatchResponse, CareerPreferences, MatchGroup, RecruitingRoleFamily } from '@/lib/career-match/types'
import { recruitingRoleTaxonomy } from '@/lib/career-match/role-taxonomy'
import { MatchCard } from './components/MatchCard'
import { CompactMatchRow } from './components/CompactMatchRow'
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

function compactGroups(groups: MatchGroup[], showStretch: boolean): MatchGroup[] {
  return groups
    .map(group => ({
      ...group,
      matches: group.matches.filter(match => showStretch || (match.fitBand !== 'Stretch' && !match.qualityBadges?.includes('Remote mismatch'))),
    }))
    .filter(group => group.matches.length > 0 && (showStretch || group.id !== 'domain-shift-stretch'))
}

export default function CareerMatchClient() {
  const [resumeText, setResumeText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileMessage, setFileMessage] = useState('')
  const [preferences, setPreferences] = useState<CareerPreferences>(emptyPreferences())
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<CareerMatchResponse | null>(null)
  const [error, setError] = useState('')
  const [showStretch, setShowStretch] = useState(false)
  const charsRemaining = useMemo(() => Math.max(0, 180 - resumeText.trim().length), [resumeText])
  const canSubmit = selectedFile !== null || resumeText.trim().length >= 180
  const visibleGroups = useMemo(() => result ? compactGroups(result.matchGroups, showStretch) : [], [result, showStretch])

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
    setFileMessage(`${file.name} attached. It will be sent to the server, parsed in memory when you generate the report, and not stored.`)
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
    setShowStretch(false)

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
        <span className="kicker">Free V1.1.2 report</span>
        <h2>Upload your resume or paste the text.</h2>
        <p className="muted">PDF, DOCX, and TXT uploads work. Uploaded files are sent to the server, parsed in memory for this report, and not stored. Paste text if a designed or scanned PDF cannot be read cleanly.</p>

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
          {status === 'loading' ? 'Improving match quality and ranking...' : selectedFile ? 'Upload and generate Career Match' : 'Generate Career Match'}
        </button>
        {status === 'error' && error ? <p className="cm-error">{error}</p> : null}
      </section>

      {result ? (
        <section className="cm-results">
          <div className="card cm-profile-card cm-profile-readout">
            <span className="kicker">SourcingOS profile read</span>
            <h2>{result.profile.currentTitle}</h2>
            <div className="cm-readout-grid">
              <div>
                <p className="cm-mini-label">Likely current lane</p>
                <strong>{recruitingRoleTaxonomy[result.profile.primaryFamily].label}</strong>
              </div>
              <div>
                <p className="cm-mini-label">Seniority</p>
                <strong>{result.profile.seniority}</strong>
              </div>
              <div>
                <p className="cm-mini-label">Strongest lane</p>
                <strong>{result.roleUniverse.strongestLane}</strong>
              </div>
              <div>
                <p className="cm-mini-label">Jobs surfaced</p>
                <strong>{result.debug.dedupedJobs} deduped / {result.debug.scoredJobs} scored</strong>
              </div>
            </div>
            <p className="cm-mini-label">Strongest evidence</p>
            <div className="chips">
              {result.roleUniverse.strongestSignals.length ? result.roleUniverse.strongestSignals.map(signal => <span className="chip" key={signal}>{signal}</span>) : <span className="chip">No strong signals detected yet</span>}
            </div>
            <p className="cm-mini-label">Tools detected</p>
            <div className="chips">
              {result.profile.tools.length ? result.profile.tools.slice(0, 12).map(tool => <span className="chip" key={tool}>{tool}</span>) : <span className="chip">No tools detected</span>}
            </div>
            <p className="cm-mini-label">Also viable</p>
            <div className="chips">
              {result.roleUniverse.alsoViable.map(lane => <span className="chip" key={lane}>{lane}</span>)}
            </div>
            <details className="cm-details">
              <summary>View parser details and query expansion</summary>
              <p className="muted">{result.profile.profileSummary}</p>
              <ul className="muted">
                {result.profile.confidenceNotes.map(note => <li key={note}>{note}</li>)}
                {result.notes.slice(-4).map(note => <li key={note}>{note}</li>)}
              </ul>
              <p className="cm-mini-label">Queries run</p>
              <div className="chips">
                {result.debug.queriesRun.slice(0, 28).map(query => <span className="chip" key={query}>{query}</span>)}
              </div>
            </details>
          </div>

          <section className="card cm-universe-card">
            <span className="kicker">Your matched role universe</span>
            <h2>{result.debug.shownJobs} recruiter/TA matches scored across {result.debug.queriesRun.length} searches.</h2>
            <p className="muted">Low-result rescue tier used: {result.debug.rescueTierUsed}. Raw jobs found: {result.debug.rawJobsFound}. Deduped jobs: {result.debug.dedupedJobs}.</p>
            <div className="cm-summary-grid">
              <div>
                <p className="cm-mini-label">Best exact matches</p>
                <ul>{result.roleUniverse.bestExactMatches.length ? result.roleUniverse.bestExactMatches.map(item => <li key={item}>{item}</li>) : <li>No exact-title matches found yet.</li>}</ul>
              </div>
              <div>
                <p className="cm-mini-label">Best remote matches</p>
                <ul>{result.roleUniverse.bestRemoteMatches.length ? result.roleUniverse.bestRemoteMatches.map(item => <li key={item}>{item}</li>) : <li>No remote matches found yet.</li>}</ul>
              </div>
              <div>
                <p className="cm-mini-label">Best adjacent lanes</p>
                <ul>{result.roleUniverse.bestAdjacentLanes.length ? result.roleUniverse.bestAdjacentLanes.map(item => <li key={item}>{item}</li>) : <li>No adjacent lanes detected yet.</li>}</ul>
              </div>
            </div>
            <p className="muted">{result.roleUniverse.stretchReason}</p>
            <div className="chips">
              {result.roleUniverse.queryLanes.map(query => <span className="chip" key={query}>{query}</span>)}
            </div>
          </section>

          <div className="cm-result-headline">
            <div>
              <span className="kicker">Grouped match lanes</span>
              <h2>Top matches grouped by role path.</h2>
              <p className="muted">V1.1.2 keeps the fan-out search but tightens ranking so exact title, remote compatibility, seniority fit, and clearance cautioning matter more than broad weak signals.</p>
            </div>
            <label className="cm-filter-toggle">
              <input type="checkbox" checked={showStretch} onChange={event => setShowStretch(event.target.checked)} />
              Show stretch / weak-location matches
            </label>
          </div>

          {visibleGroups.length ? (
            <div className="cm-group-list">
              {visibleGroups.map(group => {
                const expanded = group.matches.slice(0, 3)
                const compact = group.matches.slice(3)
                return (
                  <section className="cm-match-group" key={group.id}>
                    <div className="cm-group-heading">
                      <div>
                        <span className="kicker">{group.matches.length} matches</span>
                        <h3>{group.label}</h3>
                        <p className="muted">{group.description}</p>
                      </div>
                    </div>
                    <div className="cm-match-list">
                      {expanded.map(match => <MatchCard key={`${group.id}-${match.job.id}`} match={match} />)}
                      {compact.length ? (
                        <div className="cm-compact-list">
                          <p className="cm-mini-label">More in this lane</p>
                          {compact.map(match => <CompactMatchRow key={`${group.id}-compact-${match.job.id}`} match={match} />)}
                        </div>
                      ) : null}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="card">
              <h3>No strong matches surfaced yet.</h3>
              <p className="muted">Try showing stretch matches, using a broader role lane, removing strict location preferences, or adding more resume text with tools, industries, and titles.</p>
            </div>
          )}

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
            <span className="kicker">Next paid layer</span>
            <h2>Full Career Match Report comes after match quality is proven.</h2>
            <p className="muted">Next paid layer should package the full role universe, PDF export, alerts, grounded rewrite suggestions, and saved jobs. V1.1.2 focuses on making the top matches feel obviously smarter first.</p>
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
