'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { SearchComposer, type ComposerOutput } from '@/components/SearchComposer'
import { WorkbenchResults, type SavedEntry } from '@/components/WorkbenchResults'
import type { SourceResult } from '@/lib/source-types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Tabs: Role Intake → Search Composer → Results → Saved
// Removed the confusing "Search Strategy" (AI placeholder) and "Discovery" split.
// AI strategy section is collapsed inside the Search Composer tab.
type Tab = 'intake' | 'composer' | 'results' | 'saved'

interface IntakeData {
  jobTitle: string; jobDescription: string; mustHaves: string; niceToHaves: string
  location: string; workType: string; clearanceNeeds: string; targetCompanies: string
  disqualifiers: string; compensationNotes: string; hiringManagerNotes: string
}
interface ProjectRecord { id: string; name: string; role_title?: string; mode: 'supabase' | 'preview' }
interface ChipContext { hardTerms: string[]; softFilters: { canonical: string; type: string }[]; manualSafe: string[]; hasClearance: boolean; hasLocation: boolean; isSkillLight: boolean }

const defaultIntake: IntakeData = {
  jobTitle: '', jobDescription: '', mustHaves: '', niceToHaves: '',
  location: '', workType: 'any', clearanceNeeds: '', targetCompanies: '',
  disqualifiers: '', compensationNotes: '', hiringManagerNotes: '',
}

const STRATEGY_SECTIONS = [
  { id: 'summary', label: 'Role Summary' }, { id: 'must', label: 'Must-Have Signals' },
  { id: 'nice', label: 'Nice-to-Have Signals' }, { id: 'disqual', label: 'Disqualifiers' },
  { id: 'titles', label: 'Target Titles' }, { id: 'adjacent', label: 'Adjacent Titles' },
  { id: 'companies', label: 'Target Companies' }, { id: 'lanes', label: 'Search Lanes' },
  { id: 'boolean', label: 'Boolean Strings' }, { id: 'xray', label: 'X-Ray Strings' },
  { id: 'scorecard', label: 'Candidate Scorecard' }, { id: 'calibration', label: 'HM Calibration Questions' },
]

export function WorkbenchClient() {
  const [tab, setTab] = useState<Tab>('intake')
  const [intake, setIntake] = useState<IntakeData>(defaultIntake)
  const [currentProject, setCurrentProject] = useState<ProjectRecord | null>(null)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectError, setProjectError] = useState('')
  const [composerOutput, setComposerOutput] = useState<ComposerOutput | null>(null)
  const [searchResults, setSearchResults] = useState<SourceResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [chipContext, setChipContext] = useState<ChipContext | null>(null)
  const [noResultsMeta, setNoResultsMeta] = useState<{ sources: string[]; suggestions: string[]; broadQuery?: string; usedBroadQuery?: boolean }>({ sources: [], suggestions: [] })
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([])
  const [showAiStrategy, setShowAiStrategy] = useState(false)

  const setField = (f: keyof IntakeData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setIntake(prev => ({ ...prev, [f]: e.target.value }))

  // After Role Intake "Generate" → move to Search Composer
  const generateAndNavigate = () => {
    if (!intake.jobTitle.trim()) return
    setTab('composer')
  }

  async function saveProject() {
    if (!intake.jobTitle.trim()) return
    setProjectSaving(true); setProjectError('')
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: intake.jobTitle, role_title: intake.jobTitle, jd: intake.jobDescription,
          must_haves: intake.mustHaves ? [intake.mustHaves] : [],
          nice_to_haves: intake.niceToHaves ? [intake.niceToHaves] : [],
          disqualifiers: intake.disqualifiers ? [intake.disqualifiers] : [],
          target_companies: intake.targetCompanies ? intake.targetCompanies.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : [],
        }),
      })
      const json = await res.json()
      if (json.ok) setCurrentProject({ id: json.project.id, name: json.project.name, role_title: json.project.role_title, mode: json.mode })
      else setProjectError(json.error || 'Project save failed.')
    } catch { setProjectError('Failed to reach /api/projects/create.') }
    finally { setProjectSaving(false) }
  }

  const handleSearch = useCallback(async (output: ComposerOutput) => {
    if (!output.rawQuery.trim()) return
    setSearching(true); setSearchError('')
    setSearchResults([]); setNoResultsMeta({ sources: [], suggestions: [] }); setChipContext(null)
    // Auto-switch to results tab immediately so user sees loading state
    setTab('results')
    try {
      const res = await fetch('/api/workbench/search', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: output.rawQuery,
          chips: output.chips.map(c => ({ canonical: c.canonical, type: c.type })),
          sources: output.recommendedSourceIds.filter(id =>
            ['github', 'npm', 'pypi', 'openalex', 'huggingface', 'crates', 'rubygems'].includes(id)
          ),
          limit: 5,
          projectId: currentProject?.id,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setSearchResults(json.results || [])
        setChipContext(json.chipContext || null)
        if ((json.results || []).length === 0) {
          setNoResultsMeta({
            sources: json.noResultsSources || [],
            suggestions: json.suggestions || [],
            broadQuery: json.broadQuery,
            usedBroadQuery: json.usedBroadQuery,
          })
        }
      } else {
        setSearchError(json.error || 'Search failed.')
      }
    } catch { setSearchError('Search request failed — check your network connection.') }
    finally { setSearching(false) }
  }, [currentProject?.id])

  const TAB_LABELS: Record<Tab, string> = {
    intake:   '01  Role Intake',
    composer: '02  Search Composer',
    results:  '03  Results',
    saved:    '04  Saved',
  }

  // The initial query for the SearchComposer — pre-populated from Role Intake
  const composerInitialQuery = [
    intake.jobTitle,
    intake.location,
    intake.clearanceNeeds,
  ].filter(Boolean).join(' ')

  return (
    <div>
      {/* ── Project bar ──────────────────────────────────────────────────── */}
      {currentProject && (
        <div className="project-bar">
          <span className="project-bar-label">Project:</span>
          <span className="project-bar-name">{currentProject.name}</span>
          <span className="project-bar-mode">
            {currentProject.mode === 'supabase'
              ? <span className="status-live">Persisted</span>
              : <span className="status-preview">Preview</span>}
          </span>
        </div>
      )}

      <div className="workbench">
        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="wb-tabs">
          {(['intake', 'composer', 'results', 'saved'] as Tab[]).map(t => (
            <button key={t} className={`wb-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {TAB_LABELS[t]}
              {t === 'results' && searchResults.length > 0 && (
                <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--green)', fontWeight: 900 }}>
                  {searchResults.length}
                </span>
              )}
              {t === 'saved' && savedEntries.length > 0 && (
                <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--accent)', fontWeight: 900 }}>
                  {savedEntries.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="wb-content">

          {/* ── 01 Role Intake ─────────────────────────────────────────────── */}
          {tab === 'intake' && (
            <div className="wb-section">
              <div className="wb-section-title">Role intake</div>
              <div className="wb-form-grid">
                <div className="wb-form-row full">
                  <label>Job title *</label>
                  <input type="text" value={intake.jobTitle} onChange={setField('jobTitle')}
                    placeholder="e.g. DevSecOps Engineer, Staff ML Engineer, Cleared Cyber Analyst" />
                </div>
                <div className="wb-form-row full">
                  <label>Job description</label>
                  <textarea value={intake.jobDescription} onChange={setField('jobDescription')}
                    placeholder="Paste the full JD." />
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
                  <input type="text" value={intake.clearanceNeeds} onChange={setField('clearanceNeeds')}
                    placeholder="e.g. Active TS/SCI, no clearance required" />
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
                  <input type="text" value={intake.compensationNotes} onChange={setField('compensationNotes')} placeholder="Budget range, equity constraints" />
                </div>
                <div className="wb-form-row full">
                  <label>Hiring manager notes</label>
                  <textarea value={intake.hiringManagerNotes} onChange={setField('hiringManagerNotes')}
                    placeholder="Non-obvious requirements from HM conversation" />
                </div>
              </div>

              {projectError && (
                <div className="preview-banner" style={{ marginBottom: '12px' }}>
                  <span className="pb-icon">✕</span><span>{projectError}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button
                  className="wb-generate"
                  style={{ flex: 1 }}
                  onClick={generateAndNavigate}
                  disabled={!intake.jobTitle.trim()}
                >
                  {intake.jobTitle.trim() ? 'Open Search Composer →' : 'Enter a job title to continue'}
                </button>
                <button
                  className="btn secondary"
                  onClick={saveProject}
                  disabled={!intake.jobTitle.trim() || projectSaving}
                  style={{ flexShrink: 0 }}
                >
                  {projectSaving ? 'Saving…' : currentProject ? '✓ Project saved' : 'Save project'}
                </button>
              </div>
              {currentProject && (
                <p className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                  Project: <strong>{currentProject.name}</strong> ({currentProject.mode === 'supabase' ? 'persisted to Supabase' : 'preview mode — not durable'})
                </p>
              )}
            </div>
          )}

          {/* ── 02 Search Composer ─────────────────────────────────────────── */}
          {tab === 'composer' && (
            <div className="wb-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <div className="wb-section-title">Search Composer</div>
                {chipContext && (
                  <div className="chip-legend">
                    {chipContext.hardTerms.length > 0 && (
                      <span className="chip-legend-item chip-legend-live">
                        Live search: {chipContext.hardTerms.slice(0, 3).join(', ')}
                      </span>
                    )}
                    {chipContext.softFilters.length > 0 && (
                      <span className="chip-legend-item chip-legend-soft">
                        Review filters: {chipContext.softFilters.slice(0, 2).map(f => f.canonical).join(', ')}
                      </span>
                    )}
                    {chipContext.manualSafe.length > 0 && (
                      <span className="chip-legend-item chip-legend-manual">
                        Manual-safe: {chipContext.manualSafe.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {chipContext?.hasClearance && (
                <div className="preview-banner" style={{ marginBottom: '14px', borderColor: 'rgba(138,124,255,.35)' }}>
                  <span className="pb-icon">◈</span>
                  <span>
                    <strong>Clearance detected.</strong> Clearance is not visible on public sources like GitHub, npm, or OpenAlex —
                    those will search for technical skills only. For clearance-specific sourcing, use ClearanceJobs (manual-safe) after finding technical matches.
                  </span>
                </div>
              )}

              {chipContext?.isSkillLight && (
                <div className="preview-banner" style={{ marginBottom: '14px', borderColor: 'rgba(246,201,107,.3)' }}>
                  <span className="pb-icon">◈</span>
                  <span>
                    <strong>Tip:</strong> Public sources respond better to specific skills than job titles.
                    Add a technical skill (React, Python, Kubernetes) for better results.
                  </span>
                </div>
              )}

              <SearchComposer
                onOutput={setComposerOutput}
                onSearch={handleSearch}
                initialQuery={composerInitialQuery}
              />

              {/* ── Collapsed AI Strategy section ────────────────────────── */}
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                <button
                  className="composer-toggle-btn"
                  onClick={() => setShowAiStrategy(v => !v)}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  {showAiStrategy ? '▾' : '▸'} AI search strategy — private beta
                  <span className="wb-preview-label" style={{ marginLeft: '10px' }}>preview</span>
                </button>

                {showAiStrategy && (
                  <div style={{ marginTop: '14px' }}>
                    <div className="preview-banner" style={{ marginBottom: '14px' }}>
                      <span className="pb-icon">◈</span>
                      <span>
                        <strong>AI strategy generation is in private beta.</strong> The structure below shows what
                        SourcingOS will produce per role. <Link href="/waitlist" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>Request AI beta access →</Link>
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
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 03 Results ─────────────────────────────────────────────────── */}
          {tab === 'results' && (
            <div className="wb-section">
              {searching && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(72,217,255,.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <p className="muted">Searching live sources…</p>
                </div>
              )}

              {!searching && searchError && (
                <div className="preview-banner">
                  <span className="pb-icon">✕</span><span>{searchError}</span>
                </div>
              )}

              {!searching && !searchError && searchResults.length === 0 && composerOutput && (
                <div style={{ marginBottom: '8px' }}>
                  <p className="muted" style={{ fontSize: '13px' }}>No results yet. Run a search in the Search Composer tab.</p>
                  <button className="btn secondary" onClick={() => setTab('composer')} style={{ marginTop: '10px' }}>
                    ← Back to Search Composer
                  </button>
                </div>
              )}

              {!searching && !searchError && searchResults.length === 0 && !composerOutput && (
                <div className="wb-empty">
                  <h3>No search run yet</h3>
                  <p>Go to Search Composer, enter your search, and click "Search →".</p>
                  <button className="btn secondary" onClick={() => setTab('composer')}>
                    Open Search Composer →
                  </button>
                </div>
              )}

              {noResultsMeta.usedBroadQuery && (
                <div className="preview-banner" style={{ marginBottom: '12px', borderColor: 'rgba(72,217,255,.3)' }}>
                  <span className="pb-icon">◈</span>
                  <span>
                    No results for the specific query. Showing results for broader search: <strong>{noResultsMeta.broadQuery}</strong>
                  </span>
                </div>
              )}

              {(searchResults.length > 0 || noResultsMeta.suggestions.length > 0) && !searching && (
                <WorkbenchResults
                  results={searchResults}
                  noResultsSources={noResultsMeta.sources}
                  suggestions={noResultsMeta.suggestions}
                  searchedQuery={composerOutput?.rawQuery}
                  chipContext={chipContext}
                  projectId={currentProject?.id}
                  onProfileSaved={entry => setSavedEntries(prev => [...prev, entry])}
                  onRetryComposer={() => setTab('composer')}
                />
              )}
            </div>
          )}

          {/* ── 04 Saved ───────────────────────────────────────────────────── */}
          {tab === 'saved' && (
            <div className="wb-section">
              {savedEntries.length === 0 ? (
                <div className="wb-empty">
                  <h3>No saved candidates yet</h3>
                  <p>Run a search in Search Composer, review source profiles in Results, and save them to the Candidate Graph.</p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn secondary" onClick={() => setTab('composer')}>Open Search Composer</button>
                    <Link className="btn ghost" href="/app/candidate-database">View Candidate Database</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="wb-section-title">
                    Saved this session — {savedEntries.length} source profile{savedEntries.length !== 1 ? 's' : ''}
                  </div>
                  <div className="preview-banner" style={{ marginBottom: '16px' }}>
                    <span className="pb-icon">◈</span>
                    <span>Source profiles are pending recruiter review. Open Candidate 360 to confirm identity and review evidence.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {savedEntries.map(entry => (
                      <div key={entry.id} className="result-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <span className="result-source-badge" style={{ flexShrink: 0, fontSize: '10px', padding: '2px 7px' }}>
                            {entry.source}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className="result-name" style={{ fontSize: '15px' }}>{entry.displayName}</div>
                            <div className="muted" style={{ fontSize: '11px', fontFamily: 'monospace', marginTop: '2px', opacity: .5 }}>{entry.id}</div>
                          </div>
                        </div>
                        <a className="btn secondary" href={`/app/candidate/${entry.id}`} style={{ fontSize: '12px', padding: '6px 14px', flexShrink: 0 }}>
                          View 360 →
                        </a>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <Link className="btn secondary" href="/app/candidate-database">View full Candidate Database →</Link>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
