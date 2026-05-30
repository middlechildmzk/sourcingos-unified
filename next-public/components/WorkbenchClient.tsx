'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { SearchComposer, type ComposerOutput, type RecognizedChip } from '@/components/SearchComposer'
import { WorkbenchResults } from '@/components/WorkbenchResults'
import type { SourceResult } from '@/lib/source-types'

type Tab = 'intake' | 'strategy' | 'discovery' | 'saved'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface IntakeData {
  jobTitle: string; jobDescription: string; mustHaves: string; niceToHaves: string
  location: string; workType: string; clearanceNeeds: string; targetCompanies: string
  disqualifiers: string; compensationNotes: string; hiringManagerNotes: string
}

interface ProjectRecord {
  id: string; name: string; role_title?: string; mode: 'supabase' | 'preview'
}

const defaultIntake: IntakeData = {
  jobTitle: '', jobDescription: '', mustHaves: '', niceToHaves: '',
  location: '', workType: 'any', clearanceNeeds: '', targetCompanies: '',
  disqualifiers: '', compensationNotes: '', hiringManagerNotes: '',
}

// ─── Status badge labels ───────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  live: 'Live', preview: 'Preview', planned: 'Planned', 'manual-safe': 'Manual-safe', 'requires-key': 'API key required',
}
const STATUS_CLASS: Record<string, string> = {
  live: 'status-live', preview: 'status-preview', planned: 'status-planned', 'manual-safe': 'status-manual', 'requires-key': 'status-key',
}

const STRATEGY_SECTIONS = [
  { id: 'summary', label: 'Role Summary' }, { id: 'must', label: 'Must-Have Signals' },
  { id: 'nice', label: 'Nice-to-Have Signals' }, { id: 'disqual', label: 'Disqualifiers' },
  { id: 'titles', label: 'Target Titles' }, { id: 'adjacent', label: 'Adjacent Titles' },
  { id: 'companies', label: 'Target Companies' }, { id: 'lanes', label: 'Search Lanes' },
  { id: 'boolean', label: 'Boolean Strings' }, { id: 'xray', label: 'X-Ray Strings' },
  { id: 'scorecard', label: 'Candidate Scorecard' }, { id: 'calibration', label: 'HM Calibration Questions' },
]

// ─── Main component ────────────────────────────────────────────────────────────
export function WorkbenchClient() {
  const [tab, setTab] = useState<Tab>('intake')
  const [intake, setIntake] = useState<IntakeData>(defaultIntake)
  const [strategyGenerated, setStrategyGenerated] = useState(false)
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [composerOutput, setComposerOutput] = useState<ComposerOutput | null>(null)
  const [searchResults, setSearchResults] = useState<SourceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [savedCandidateIds, setSavedCandidateIds] = useState<string[]>([])

  const setField = (field: keyof IntakeData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setIntake(prev => ({ ...prev, [field]: e.target.value }))

  const generateStrategy = () => {
    if (!intake.jobTitle.trim()) return
    setStrategyGenerated(true)
    setTab('strategy')
  }

  // ── Save project ──────────────────────────────────────────────────────────────
  async function saveProject() {
    if (!intake.jobTitle.trim()) return
    setProjectSaving(true)
    setProjectError('')
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: intake.jobTitle,
          role_title: intake.jobTitle,
          jd: intake.jobDescription,
          must_haves: intake.mustHaves ? [intake.mustHaves] : [],
          nice_to_haves: intake.niceToHaves ? [intake.niceToHaves] : [],
          disqualifiers: intake.disqualifiers ? [intake.disqualifiers] : [],
          target_companies: intake.targetCompanies ? intake.targetCompanies.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [],
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setCurrentProject({ id: json.project.id, name: json.project.name, role_title: json.project.role_title, mode: json.mode })
      } else {
        setProjectError(json.error || 'Project save failed.')
      }
    } catch {
      setProjectError('Failed to reach /api/projects/create.')
    } finally {
      setProjectSaving(false)
    }
  }

  // ── Run workbench search ──────────────────────────────────────────────────────
  const handleSearch = useCallback(async (output: ComposerOutput) => {
    if (!output.rawQuery.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchResults([])
    try {
      const res = await fetch('/api/workbench/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: output.rawQuery,
          sources: output.recommendedSourceIds.filter(id => ['github', 'npm', 'pypi', 'openalex', 'huggingface', 'crates', 'rubygems'].includes(id)),
          limit: 5,
          projectId: currentProject?.id,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setSearchResults(json.results || [])
        if ((json.results || []).length === 0) setSearchError('No results from live connectors for this query. Try broader terms or check the X-Ray string.')
      } else {
        setSearchError(json.error || 'Search failed.')
      }
    } catch {
      setSearchError('Search request failed — check your network connection.')
    } finally {
      setSearching(false)
    }
  }, [currentProject?.id])

  const TAB_LABELS: Record<Tab, string> = {
    intake: '01  Role Intake',
    strategy: '02  Search Strategy',
    discovery: '03  Discovery',
    saved: '04  Saved',
  }

  return (
    <div>
      {/* ── Project bar ─────────────────────────────────────────────────────── */}
      {currentProject && (
        <div className="project-bar">
          <span className="project-bar-label">Project:</span>
          <span className="project-bar-name">{currentProject.name}</span>
          <span className="project-bar-mode">
            {currentProject.mode === 'supabase' ? <span className="status-live">Persisted</span> : <span className="status-preview">Preview</span>}
          </span>
        </div>
      )}

      <div className="workbench">
        {/* ── Tabs ────────────────────────────────────────────────────────────── */}
        <div className="wb-tabs">
          {(['intake', 'strategy', 'discovery', 'saved'] as Tab[]).map(t => (
            <button key={t} className={`wb-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="wb-content">

          {/* ── 01 Role Intake ──────────────────────────────────────────────── */}
          {tab === 'intake' && (
            <div className="wb-section">
              <div className="wb-section-title">Role intake</div>
              <div className="wb-form-grid">
                <div className="wb-form-row full">
                  <label>Job title *</label>
                  <input type="text" value={intake.jobTitle} onChange={setField('jobTitle')} placeholder="e.g. DevSecOps Engineer, Staff ML Engineer, Cleared Cyber Analyst" />
                </div>
                <div className="wb-form-row full">
                  <label>Job description</label>
                  <textarea value={intake.jobDescription} onChange={setField('jobDescription')} placeholder="Paste the full JD." />
                </div>
                <div className="wb-form-row">
                  <label>Must-haves</label>
                  <textarea value={intake.mustHaves} onChange={setField('mustHaves')} placeholder="Non-negotiable requirements" />
                </div>
                <div className="wb-form-row">
                  <label>Nice-to-haves</label>
                  <textarea value={intake.niceToHaves} onChange={setField('niceToHaves')} placeholder="Bonus qualifications" />
                </div>
                <div className="wb-form-row">
                  <label>Location</label>
                  <input type="text" value={intake.location} onChange={setField('location')} placeholder="e.g. Northern Virginia, Remote US" />
                </div>
                <div className="wb-form-row">
                  <label>Work type</label>
                  <select value={intake.workType} onChange={setField('workType')}>
                    <option value="any">Any</option><option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option><option value="onsite">Onsite</option>
                  </select>
                </div>
                <div className="wb-form-row">
                  <label>Clearance / security needs</label>
                  <input type="text" value={intake.clearanceNeeds} onChange={setField('clearanceNeeds')} placeholder="e.g. Active TS/SCI, no clearance required" />
                </div>
                <div className="wb-form-row">
                  <label>Target / donor companies</label>
                  <textarea value={intake.targetCompanies} onChange={setField('targetCompanies')} placeholder="One per line or comma-separated" />
                </div>
                <div className="wb-form-row">
                  <label>Disqualifiers</label>
                  <textarea value={intake.disqualifiers} onChange={setField('disqualifiers')} placeholder="Hard stops" />
                </div>
                <div className="wb-form-row">
                  <label>Compensation notes</label>
                  <input type="text" value={intake.compensationNotes} onChange={setField('compensationNotes')} placeholder="Budget range, equity, comp constraints" />
                </div>
                <div className="wb-form-row full">
                  <label>Hiring manager notes</label>
                  <textarea value={intake.hiringManagerNotes} onChange={setField('hiringManagerNotes')} placeholder="Non-obvious requirements from HM conversation" />
                </div>
              </div>

              {projectError && <div className="preview-banner" style={{ marginBottom: '12px' }}><span className="pb-icon">✕</span><span>{projectError}</span></div>}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button className="wb-generate" style={{ flex: 1 }} onClick={generateStrategy} disabled={!intake.jobTitle.trim()}>
                  {intake.jobTitle.trim() ? 'Generate search strategy →' : 'Enter a job title to continue'}
                </button>
                <button className="btn secondary" onClick={saveProject} disabled={!intake.jobTitle.trim() || projectSaving} style={{ flexShrink: 0 }}>
                  {projectSaving ? 'Saving…' : currentProject ? '✓ Project saved' : 'Save project'}
                </button>
              </div>

              {currentProject && (
                <div className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                  Project saved: <strong>{currentProject.name}</strong> ({currentProject.mode === 'supabase' ? 'persisted to Supabase' : 'preview mode — not durable'})
                </div>
              )}
            </div>
          )}

          {/* ── 02 Search Strategy ──────────────────────────────────────────── */}
          {tab === 'strategy' && (
            <div className="wb-section">
              {!strategyGenerated ? (
                <div className="wb-empty">
                  <h3>No strategy generated yet</h3>
                  <p>Complete Role Intake and click "Generate search strategy."</p>
                  <Link className="btn secondary" href="/waitlist">Request AI-powered strategy beta</Link>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div className="wb-section-title">Search strategy — {intake.jobTitle}</div>
                    <span className="wb-preview-label">⚡ AI output in beta</span>
                  </div>
                  <div className="preview-banner">
                    <span className="pb-icon">◈</span>
                    <span>
                      <strong>Beta preview:</strong> AI-powered strategy generation is in private beta.
                      Use the Discovery tab to run searches now with the smart composer.{' '}
                      <Link href="/waitlist" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>Request AI strategy beta →</Link>
                    </span>
                  </div>
                  <div className="strategy-grid">
                    {STRATEGY_SECTIONS.map(s => (
                      <div className="strategy-card" key={s.id}>
                        <div className="sc-head"><h4>{s.label}</h4><span className="wb-preview-label">preview</span></div>
                        <div className="sc-body">AI output unlocked in beta</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="btn secondary" onClick={() => setTab('discovery')}>Open Discovery tab →</button>
                    <Link className="btn ghost" href="/tools/boolean-generator">Build Boolean strings</Link>
                    <Link className="btn ghost" href="/tools/xray-search">Launch X-Ray</Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 03 Discovery ────────────────────────────────────────────────── */}
          {tab === 'discovery' && (
            <div className="wb-section">
              <div className="wb-section-title">Discovery — Smart search composer</div>
              <div className="preview-banner" style={{ marginBottom: '16px' }}>
                <span className="pb-icon">◈</span>
                <span>
                  <strong>Research only.</strong> Contact signals are unverified. Open-to-work is a signal.
                  Clearance mentions are unverified breadcrumbs. No auto-merge at any confidence level.
                </span>
              </div>

              <SearchComposer
                onOutput={setComposerOutput}
                onSearch={handleSearch}
                initialQuery={intake.jobTitle ? `${intake.jobTitle}${intake.location ? ' ' + intake.location : ''}${intake.clearanceNeeds ? ' ' + intake.clearanceNeeds : ''}` : ''}
              />

              {searching && (
                <div className="cta" style={{ textAlign: 'center', marginTop: '20px' }}>
                  Searching live sources…
                </div>
              )}

              {searchError && !searching && (
                <div className="preview-banner" style={{ marginTop: '16px', borderColor: 'rgba(246,201,107,.35)' }}>
                  <span className="pb-icon">⚠</span><span>{searchError}</span>
                </div>
              )}

              {searchResults.length > 0 && (
                <WorkbenchResults
                  results={searchResults}
                  projectId={currentProject?.id}
                  onProfileSaved={id => setSavedCandidateIds(prev => [...prev, id])}
                />
              )}
            </div>
          )}

          {/* ── 04 Saved ────────────────────────────────────────────────────── */}
          {tab === 'saved' && (
            <div className="wb-section">
              {savedCandidateIds.length === 0 ? (
                <div className="wb-empty">
                  <h3>No saved candidates yet</h3>
                  <p>Run a search in the Discovery tab, review source profiles, and save them to the Candidate Graph.</p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn secondary" onClick={() => setTab('discovery')}>Open Discovery</button>
                    <Link className="btn ghost" href="/app/candidate-database">View Candidate Database</Link>
                  </div>
                </div>
              ) : (
                <div className="wb-section">
                  <div className="wb-section-title">Saved this session — {savedCandidateIds.length} source profile{savedCandidateIds.length !== 1 ? 's' : ''}</div>
                  <div className="preview-banner">
                    <span className="pb-icon">◈</span>
                    <span>Saved source profiles are pending recruiter review. Open Candidate 360 to confirm identity, review evidence, and run merge review.</span>
                  </div>
                  <div style={{ display: 'flex', flex: 'column', gap: '10px', marginTop: '14px' }}>
                    {savedCandidateIds.map(id => (
                      <div key={id} className="result-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="muted" style={{ fontSize: '13px', fontFamily: 'monospace' }}>{id}</span>
                        <a className="btn secondary" href={`/app/candidate/${id}`} style={{ fontSize: '12px', padding: '6px 14px' }}>
                          View Candidate 360 →
                        </a>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <Link className="btn secondary" href="/app/candidate-database">View full Candidate Database →</Link>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
