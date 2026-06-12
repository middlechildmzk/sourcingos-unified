'use client'
import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { SearchComposer, type ComposerOutput } from '@/components/SearchComposer'
import { WorkbenchResults, type SavedEntry } from '@/components/WorkbenchResults'
import { CandidateDrawer } from '@/components/CandidateDrawer'
import { parseJobDescription } from '@/lib/jd-parser'
import { SourceLaneStatus, type SourceLane } from '@/components/SourceLaneStatus'
import { ComposerCopilotPanel } from '@/components/ComposerCopilotPanel'
import { fetchWithTimeout, SOURCE_TIMEOUTS_MS, DEFAULT_TIMEOUT_MS, MANUAL_SAFE_LANES } from '@/lib/search/source-timeout'
import { saveSession, listSessions, type SavedSearchSession } from '@/lib/search/saved-sessions'
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

const DRAFT_KEY = 'sourcingos.workbench.intake-draft.v1'

export function WorkbenchClient({ publicMode = false }: { publicMode?: boolean }) {
  const [tab, setTab] = useState<Tab>('intake')
  const [intake, setIntake] = useState<IntakeData>(defaultIntake)
  const [draftRestored, setDraftRestored] = useState(false)
  const [saveDurability, setSaveDurability] = useState<'durable' | 'preview' | null>(null)

  // ── Intake draft persistence (this browser only — never sent anywhere) ────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as Partial<IntakeData>
        if (draft && typeof draft === 'object' && Object.values(draft).some(v => String(v || '').trim())) {
          setIntake(prev => ({ ...prev, ...draft }))
          setDraftRestored(true)
        }
      }
    } catch { /* corrupted draft — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const hasContent = Object.values(intake).some(v => String(v || '').trim() && v !== 'any')
      if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify(intake))
    } catch { /* storage full/blocked — non-fatal */ }
  }, [intake])

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
    setIntake(defaultIntake)
    setDraftRestored(false)
  }
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
  const [drawerResult, setDrawerResult] = useState<SourceResult | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [jdText, setJdText] = useState('')
  const [jdParsed, setJdParsed] = useState(false)
  const [jdSummary, setJdSummary] = useState<ReturnType<typeof parseJobDescription> | null>(null)
  const [sourceLanes, setSourceLanes] = useState<SourceLane[]>([])
  const [recentSessions, setRecentSessions] = useState<SavedSearchSession[]>([])
  const [composerAppend, setComposerAppend] = useState<{ terms: string[]; nonce: number }>({ terms: [], nonce: 0 })
  const [applyToast, setApplyToast] = useState('')
  useEffect(() => { setRecentSessions(listSessions()) }, [])

  function applyTerms(terms: string[], label: string) {
    if (!terms.length) return
    setComposerAppend(prev => ({ terms, nonce: prev.nonce + 1 }))
    setApplyToast(`Added ${terms.slice(0, 4).join(', ')}${terms.length > 4 ? '…' : ''}`)
    setTimeout(() => setApplyToast(''), 2600)
  }

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
      if (json.ok) {
        setCurrentProject({ id: json.project.id, name: json.project.name, role_title: json.project.role_title, mode: json.mode })
        setSaveDurability(json.mode === 'supabase' ? 'durable' : 'preview')
      } else if (res.status === 401) {
        setProjectError('Sign in to save projects. Your intake draft stays in this browser.')
      } else if (res.status === 503) {
        setProjectError('Saving is unavailable in this environment. Your intake draft stays in this browser.')
      } else {
        setProjectError(json.error || 'Project save failed.')
      }
    } catch { setProjectError('Failed to reach /api/projects/create.') }
    finally { setProjectSaving(false) }
  }

  const handleSearch = useCallback(async (output: ComposerOutput) => {
    if (!output.rawQuery.trim()) return
    setSearching(true); setSearchError('')
    setSearchResults([]); setNoResultsMeta({ sources: [], suggestions: [] })
    setTab('results')

    const chips = output.chips.map(c => ({ canonical: c.canonical, type: c.type }))

    // Derive chip context for the UI (clearance/location/skill-light banners)
    const hardTerms = chips.filter(c => c.type === 'skill' || c.type === 'tool').map(c => c.canonical)
    const softFilters = chips.filter(c => ['title', 'seniority', 'location', 'company'].includes(c.type)).map(c => ({ canonical: c.canonical, type: c.type }))
    const manualSafe = chips.filter(c => c.type === 'clearance').map(c => c.canonical)
    setChipContext({
      hardTerms, softFilters, manualSafe,
      hasClearance: manualSafe.length > 0,
      hasLocation: softFilters.some(f => f.type === 'location'),
      isSkillLight: hardTerms.length === 0,
    })

    // Fast-mode live sources, best-first
    const FAST_ORDER = ['github', 'npm', 'pypi', 'openalex', 'huggingface']
    const requested = (output.recommendedSourceIds.filter(id => FAST_ORDER.includes(id)))
    const liveSources = (requested.length > 0 ? requested : FAST_ORDER.slice(0, 4))
      .sort((a, b) => FAST_ORDER.indexOf(a) - FAST_ORDER.indexOf(b))

    // Seed lane statuses: queued for live, manual-safe lane if clearance present
    const initialLanes: SourceLane[] = liveSources.map(s => ({ source: s, status: 'queued' as const }))
    if (manualSafe.length > 0) {
      initialLanes.push(...MANUAL_SAFE_LANES.slice(0, 2).map(l => ({ source: l.label, status: 'manual_safe' as const, href: l.href })))
    }
    setSourceLanes(initialLanes)

    const runSource = async (source: string) => {
      setSourceLanes(prev => prev.map(l => l.source === source ? { ...l, status: 'searching' } : l))
      const timeout = SOURCE_TIMEOUTS_MS[source] || DEFAULT_TIMEOUT_MS
      try {
        const { timedOut, data } = await fetchWithTimeout('/api/workbench/search-source',
          { query: output.rawQuery, source, chips, limit: 5 }, timeout)
        if (timedOut) {
          setSourceLanes(prev => prev.map(l => l.source === source ? { ...l, status: 'timed_out' } : l))
          return
        }
        const json = data as { ok: boolean; results?: SourceResult[]; status?: string }
        const results = json.results || []
        // Merge + dedupe by id as each source returns (progressive)
        if (results.length > 0) {
          setSearchResults(prev => {
            const seen = new Set(prev.map(r => r.id))
            return [...prev, ...results.filter(r => !seen.has(r.id))]
          })
        }
        setSourceLanes(prev => prev.map(l => l.source === source
          ? { ...l, status: results.length > 0 ? 'found' : 'no_results', count: results.length }
          : l))
      } catch {
        setSourceLanes(prev => prev.map(l => l.source === source ? { ...l, status: 'error' } : l))
      }
    }

    // Fire all live sources in parallel — one slow source never blocks others
    await Promise.allSettled(liveSources.map(runSource))
    setSearching(false)

    // Persist the search session (localStorage; schema-ready for Supabase later)
    try {
      saveSession({
        projectId: currentProject?.id,
        roleTitle: jdSummary?.roleTitle || intake.jobTitle || output.rawQuery.slice(0, 60),
        rawQuery: output.rawQuery,
        liveSearchTerms: hardTerms,
        reviewFilters: softFilters.map(f => f.canonical),
        manualSafeConstraints: manualSafe,
        exclusions: output.falsePosWarnings || [],
        sourceLanes: liveSources,
        resultCount: 0, // updated below via state; sessions are advisory
      })
      setRecentSessions(listSessions())
    } catch { /* non-fatal */ }
  }, [currentProject?.id, jdSummary, intake.jobTitle])

  // Retry a single timed-out / errored source
  const retrySource = useCallback(async (source: string) => {
    if (!composerOutput) return
    const chips = composerOutput.chips.map(c => ({ canonical: c.canonical, type: c.type }))
    setSourceLanes(prev => prev.map(l => l.source === source ? { ...l, status: 'searching' } : l))
    const timeout = SOURCE_TIMEOUTS_MS[source] || DEFAULT_TIMEOUT_MS
    try {
      const { timedOut, data } = await fetchWithTimeout('/api/workbench/search-source',
        { query: composerOutput.rawQuery, source, chips, limit: 5 }, timeout)
      if (timedOut) {
        setSourceLanes(prev => prev.map(l => l.source === source ? { ...l, status: 'timed_out' } : l))
        return
      }
      const json = data as { results?: SourceResult[] }
      const results = json.results || []
      if (results.length > 0) {
        setSearchResults(prev => {
          const seen = new Set(prev.map(r => r.id))
          return [...prev, ...results.filter(r => !seen.has(r.id))]
        })
      }
      setSourceLanes(prev => prev.map(l => l.source === source
        ? { ...l, status: results.length > 0 ? 'found' : 'no_results', count: results.length }
        : l))
    } catch {
      setSourceLanes(prev => prev.map(l => l.source === source ? { ...l, status: 'error' } : l))
    }
  }, [composerOutput])

  const TAB_LABELS: Record<Tab, string> = {
    intake:   '01  Role Intake',
    composer: '02  Search Composer',
    results:  '03  Results',
    saved:    '04  Saved',
  }

  // The initial query for the SearchComposer — pre-populated from Role Intake.
  // CRITICAL: include must-have skills so the live source query has real skill terms.
  // A parsed JD provides jdSummary.composerQuery (title + location + clearance + skills).
  const composerInitialQuery = jdSummary?.composerQuery || [
    intake.jobTitle,
    intake.location,
    intake.clearanceNeeds,
    // Pull skills out of the must-haves field (comma or newline separated)
    ...(intake.mustHaves ? intake.mustHaves.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).slice(0, 4) : []),
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
                  <label>Job description <span className="muted" style={{ fontWeight: 400, fontSize: '11px' }}>— paste a JD and click Parse to auto-fill fields</span></label>
                  <textarea value={intake.jobDescription} onChange={setField('jobDescription')}
                    placeholder="Paste the full JD here, then click 'Parse JD' to extract title, skills, location, clearance, and source lanes." />
                  {intake.jobDescription.trim().length > 40 && (
                    <button
                      type="button"
                      className="btn ghost"
                      style={{ marginTop: '8px', fontSize: '12px', alignSelf: 'flex-start' }}
                      onClick={() => {
                        const parsed = parseJobDescription(intake.jobDescription)
                        setJdSummary(parsed)
                        setIntake(prev => ({
                          ...prev,
                          jobTitle: parsed.roleTitle || prev.jobTitle,
                          location: parsed.location || prev.location,
                          clearanceNeeds: parsed.clearance.join(', ') || prev.clearanceNeeds,
                          mustHaves: parsed.mustHaveSkills.join(', ') || prev.mustHaves,
                          niceToHaves: parsed.preferredSkills.join(', ') || prev.niceToHaves,
                          targetCompanies: parsed.targetCompanies.join('\n') || prev.targetCompanies,
                        }))
                        setJdParsed(true)
                      }}
                    >
                      ⚡ Parse JD → auto-fill fields
                    </button>
                  )}
                  {jdParsed && jdSummary && (
                    <div className="jd-summary">
                      <div className="jd-summary-head">✓ Parsed — review and edit below, then open Search Composer</div>
                      <div className="jd-summary-grid">
                        {jdSummary.roleTitle && (
                          <div className="jd-summary-item"><span className="jd-summary-label">Title</span><span>{jdSummary.roleTitle}</span></div>
                        )}
                        {jdSummary.mustHaveSkills.length > 0 && (
                          <div className="jd-summary-item"><span className="jd-summary-label">Must-haves</span><span>{jdSummary.mustHaveSkills.join(', ')}</span></div>
                        )}
                        {jdSummary.preferredSkills.length > 0 && (
                          <div className="jd-summary-item"><span className="jd-summary-label">Nice-to-haves</span><span>{jdSummary.preferredSkills.join(', ')}</span></div>
                        )}
                        {(jdSummary.seniority || jdSummary.location) && (
                          <div className="jd-summary-item"><span className="jd-summary-label">Review filters</span><span>{[jdSummary.seniority, jdSummary.location].filter(Boolean).join(' · ')}</span></div>
                        )}
                        {jdSummary.clearance.length > 0 && (
                          <div className="jd-summary-item"><span className="jd-summary-label jd-summary-manual">Manual-safe</span><span>{jdSummary.clearance.join(', ')} (not verified)</span></div>
                        )}
                        {jdSummary.suggestedBooleanTerms.length > 0 && (
                          <div className="jd-summary-item"><span className="jd-summary-label jd-summary-live">Live search terms</span><span>{jdSummary.suggestedBooleanTerms.join(', ')}</span></div>
                        )}
                        {jdSummary.relatedTitles.length > 0 && (
                          <div className="jd-summary-item"><span className="jd-summary-label">Adjacent titles</span><span>{jdSummary.relatedTitles.slice(0, 5).join(', ')}</span></div>
                        )}
                        {jdSummary.suggestedSourceLanes.length > 0 && (
                          <div className="jd-summary-item"><span className="jd-summary-label">Source lanes</span><span>{jdSummary.suggestedSourceLanes.join(', ')}</span></div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ fontSize: '13px', flex: '1 1 auto' }}
                          onClick={() => {
                            // Build a ComposerOutput directly from the parsed plan and run search
                            const chips = [
                              ...(jdSummary.roleTitle ? [{ canonical: jdSummary.roleTitle, type: 'title' as const }] : []),
                              ...jdSummary.mustHaveSkills.map(s => ({ canonical: s, type: 'skill' as const })),
                              ...(jdSummary.location ? [{ canonical: jdSummary.location, type: 'location' as const }] : []),
                              ...jdSummary.clearance.map(c => ({ canonical: c, type: 'clearance' as const })),
                            ]
                            const output: ComposerOutput = {
                              rawQuery: jdSummary.composerQuery,
                              chips: chips as ComposerOutput['chips'],
                              booleanString: '', xRayString: '', githubQuery: '', openAlexQuery: '', npmQuery: '',
                              recommendedSourceIds: jdSummary.suggestedSourceLanes,
                              candidateScorecardHints: [], verifyNextItems: [], falsePosWarnings: jdSummary.likelyFalsePositives,
                            }
                            setComposerOutput(output)
                            handleSearch(output)
                          }}
                        >
                          ⚡ Accept &amp; Search
                        </button>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{ fontSize: '13px' }}
                          onClick={() => setTab('composer')}
                        >
                          Refine in Composer →
                        </button>
                      </div>
                    </div>
                  )}
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
                  Project: <strong>{currentProject.name}</strong> ({currentProject.mode === 'supabase' ? 'persisted to your account' : 'preview mode — not durable'})
                </p>
              )}
              {saveDurability === 'preview' && (
                <div className="cta" style={{ marginTop: '10px', fontSize: '13px' }}>
                  <strong>Heads up:</strong> this environment is in preview mode — your saved project
                  will <strong>not</strong> survive a restart. Your intake draft is kept in this
                  browser only. Sign in on the production app for durable saves.
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px' }}>
                {draftRestored && (
                  <span className="muted" style={{ fontSize: '12px' }}>
                    ✓ Draft restored from this browser (saved locally as you type — never uploaded).
                  </span>
                )}
                {(draftRestored || Object.values(intake).some(v => String(v || '').trim() && v !== 'any')) && (
                  <button className="btn ghost" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={clearDraft}>
                    Clear draft
                  </button>
                )}
              </div>
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

              {recentSessions.length > 0 && (
                <div className="recent-searches">
                  <span className="recent-searches-label">Recent searches</span>
                  <div className="recent-searches-list">
                    {recentSessions.slice(0, 5).map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="recent-search-chip"
                        title={`${s.liveSearchTerms.join(' ')}${s.manualSafeConstraints.length ? ' · manual-safe: ' + s.manualSafeConstraints.join(', ') : ''}`}
                        onClick={() => {
                          const out: ComposerOutput = {
                            rawQuery: s.rawQuery,
                            chips: [
                              ...(s.roleTitle ? [{ canonical: s.roleTitle, type: 'title' as const }] : []),
                              ...s.liveSearchTerms.map(t => ({ canonical: t, type: 'skill' as const })),
                              ...s.manualSafeConstraints.map(c => ({ canonical: c, type: 'clearance' as const })),
                            ] as ComposerOutput['chips'],
                            booleanString: '', xRayString: '', githubQuery: '', openAlexQuery: '', npmQuery: '',
                            recommendedSourceIds: s.sourceLanes,
                            candidateScorecardHints: [], verifyNextItems: [], falsePosWarnings: s.exclusions,
                          }
                          setComposerOutput(out)
                          handleSearch(out)
                        }}
                      >
                        <span className="recent-search-title">{s.roleTitle || s.rawQuery.slice(0, 40)}</span>
                        <span className="recent-search-terms">{s.liveSearchTerms.slice(0, 3).join(' · ') || s.rawQuery.slice(0, 40)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <ComposerCopilotPanel
                publicMode={publicMode}
                projectId={currentProject?.id}
                plan={{
                  roleTitle: jdSummary?.roleTitle || intake.jobTitle,
                  rawQuery: composerInitialQuery,
                  mustHaveSkills: jdSummary?.mustHaveSkills || [],
                  niceToHaveSkills: jdSummary?.preferredSkills || [],
                  location: jdSummary?.location || intake.location,
                  manualSafeConstraints: jdSummary?.clearance || (intake.clearanceNeeds ? [intake.clearanceNeeds] : []),
                  exclusions: jdSummary?.likelyFalsePositives || [],
                  sourceLanes: jdSummary?.suggestedSourceLanes || [],
                }}
                onApplyTitles={(t) => applyTerms(t, 'titles')}
                onApplySkills={(s) => applyTerms(s, 'skills')}
                onApplyQuery={(q) => applyTerms(q.split(/\s+/), 'query')}
              />

              {applyToast && <div className="apply-toast">✓ {applyToast} — added to your search</div>}

              <SearchComposer
                externalAppend={composerAppend}
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
              {/* Per-source status dashboard — visible during and after search */}
              {sourceLanes.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="wb-section-title" style={{ marginBottom: '8px' }}>
                    Source lanes {searching && <span className="muted" style={{ fontWeight: 400, fontSize: '12px' }}>— results stream in as each source returns</span>}
                  </div>
                  <SourceLaneStatus lanes={sourceLanes} onRetry={retrySource} />
                </div>
              )}

              {searching && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(72,217,255,.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <p className="muted">Querying fast sources…</p>
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
                  <p>Go to Search Composer, enter your search, and click &ldquo;Search →&rdquo;.</p>
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

              {(searchResults.length > 0 || (!searching && noResultsMeta.suggestions.length > 0)) && (
                <WorkbenchResults
                  results={searchResults}
                  noResultsSources={noResultsMeta.sources}
                  suggestions={noResultsMeta.suggestions}
                  searchedQuery={composerOutput?.rawQuery}
                  chipContext={chipContext}
                  projectId={currentProject?.id}
                  publicMode={publicMode}
                  onProfileSaved={entry => setSavedEntries(prev => [...prev, entry])}
                  onRetryComposer={() => setTab('composer')}
                  onOpenDrawer={r => { setDrawerResult(r); setDrawerOpen(true) }}
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

      {/* ── Right-side candidate/profile drawer ──────────────────────────── */}
      <CandidateDrawer
        result={drawerResult}
        open={drawerOpen}
        publicMode={publicMode}
        projectId={currentProject?.id}
        plan={{
          roleTitle: jdSummary?.roleTitle || intake.jobTitle,
          rawQuery: composerOutput?.rawQuery,
          mustHaveSkills: jdSummary?.mustHaveSkills || (chipContext?.hardTerms ?? []),
          niceToHaveSkills: jdSummary?.preferredSkills || [],
          location: jdSummary?.location || intake.location,
          manualSafeConstraints: jdSummary?.clearance || (chipContext?.manualSafe ?? []),
          exclusions: jdSummary?.likelyFalsePositives || [],
          sourceLanes: sourceLanes.map(l => l.source),
        }}
        onClose={() => setDrawerOpen(false)}
        onSaved={(id, displayName, source) => setSavedEntries(prev =>
          prev.some(e => e.id === id) ? prev : [...prev, { id, displayName, source }]
        )}
      />
    </div>
  )
}
