'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { SearchComposer, type ComposerOutput } from '@/components/SearchComposer'
import { WorkbenchResults, type SavedEntry } from '@/components/WorkbenchResults'
import { CandidateDrawer } from '@/components/CandidateDrawer'
import { parseJobDescription } from '@/lib/jd-parser'
import { SourceLaneStatus, type SourceLane } from '@/components/SourceLaneStatus'
import { ComposerCopilotPanel } from '@/components/ComposerCopilotPanel'
import { SearchModeSelector } from '@/components/SearchModeSelector'
import { MarketMapSummary } from '@/components/MarketMapSummary'
import { fetchWithTimeout, SOURCE_TIMEOUTS_MS, DEFAULT_TIMEOUT_MS } from '@/lib/search/source-timeout'
import { saveSession, listSessions, type SavedSearchSession } from '@/lib/search/saved-sessions'
import { buildVolumeSearchPlan, UNVERIFIED_ITEMS, type MarketMapSnapshot, type SearchMode } from '@/lib/search/volume-plan'
import type { SourceResult } from '@/lib/source-types'

type Tab = 'intake' | 'composer' | 'results' | 'saved'

interface IntakeData {
  jobTitle: string
  jobDescription: string
  mustHaves: string
  niceToHaves: string
  location: string
  workType: string
  clearanceNeeds: string
  targetCompanies: string
  disqualifiers: string
  compensationNotes: string
  hiringManagerNotes: string
}

interface ProjectRecord {
  id: string
  name: string
  role_title?: string
  mode: 'supabase' | 'preview'
}

interface ChipContext {
  hardTerms: string[]
  softFilters: { canonical: string; type: string }[]
  manualSafe: string[]
  hasClearance: boolean
  hasLocation: boolean
  isSkillLight: boolean
}

const defaultIntake: IntakeData = {
  jobTitle: '',
  jobDescription: '',
  mustHaves: '',
  niceToHaves: '',
  location: '',
  workType: 'any',
  clearanceNeeds: '',
  targetCompanies: '',
  disqualifiers: '',
  compensationNotes: '',
  hiringManagerNotes: '',
}

const STRATEGY_SECTIONS = [
  { id: 'summary', label: 'Role Summary' },
  { id: 'must', label: 'Must-Have Signals' },
  { id: 'nice', label: 'Nice-to-Have Signals' },
  { id: 'disqual', label: 'Disqualifiers' },
  { id: 'titles', label: 'Target Titles' },
  { id: 'adjacent', label: 'Adjacent Titles' },
  { id: 'companies', label: 'Target Companies' },
  { id: 'lanes', label: 'Search Lanes' },
  { id: 'boolean', label: 'Boolean Strings' },
  { id: 'xray', label: 'X-Ray Strings' },
  { id: 'scorecard', label: 'Candidate Scorecard' },
  { id: 'calibration', label: 'HM Calibration Questions' },
]

const DRAFT_KEY = 'sourcingos.workbench.intake-draft.v1'

export function WorkbenchClient({
  publicMode = false,
  initialTab,
}: {
  publicMode?: boolean
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab || (publicMode ? 'composer' : 'intake'))
  const [intake, setIntake] = useState<IntakeData>(defaultIntake)
  const [draftRestored, setDraftRestored] = useState(false)
  const [saveDurability, setSaveDurability] = useState<'durable' | 'preview' | null>(null)
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
  const [jdParsed, setJdParsed] = useState(false)
  const [jdSummary, setJdSummary] = useState<ReturnType<typeof parseJobDescription> | null>(null)
  const [sourceLanes, setSourceLanes] = useState<SourceLane[]>([])
  const [recentSessions, setRecentSessions] = useState<SavedSearchSession[]>([])
  const [composerAppend, setComposerAppend] = useState<{ terms: string[]; nonce: number }>({ terms: [], nonce: 0 })
  const [applyToast, setApplyToast] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('balanced')
  const [marketMap, setMarketMap] = useState<MarketMapSnapshot | null>(null)

  const runCounterRef = useRef(0)
  const activeRunRef = useRef<{ id: number; controller: AbortController } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw) as Partial<IntakeData>
        if (draft && typeof draft === 'object' && Object.values(draft).some(value => String(value || '').trim())) {
          setIntake(previous => ({ ...previous, ...draft }))
          setDraftRestored(true)
        }
      }
    } catch {
      // Corrupted or blocked browser storage is non-fatal.
    }
  }, [])

  useEffect(() => {
    try {
      const hasContent = Object.values(intake).some(value => String(value || '').trim() && value !== 'any')
      if (hasContent) localStorage.setItem(DRAFT_KEY, JSON.stringify(intake))
    } catch {
      // Storage full or blocked is non-fatal.
    }
  }, [intake])

  useEffect(() => {
    setRecentSessions(listSessions())
    return () => {
      activeRunRef.current?.controller.abort()
      activeRunRef.current = null
    }
  }, [])

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* no-op */ }
    setIntake(defaultIntake)
    setDraftRestored(false)
  }

  function applyTerms(terms: string[], label: string) {
    if (!terms.length) return
    setComposerAppend(previous => ({ terms, nonce: previous.nonce + 1 }))
    setApplyToast(`Added ${terms.slice(0, 4).join(', ')}${terms.length > 4 ? '…' : ''} from ${label}`)
    window.setTimeout(() => setApplyToast(''), 2600)
  }

  const setField = (field: keyof IntakeData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setIntake(previous => ({ ...previous, [field]: event.target.value }))

  async function saveProject() {
    if (!intake.jobTitle.trim()) return
    setProjectSaving(true)
    setProjectError('')
    try {
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: intake.jobTitle,
          role_title: intake.jobTitle,
          jd: intake.jobDescription,
          must_haves: intake.mustHaves ? [intake.mustHaves] : [],
          nice_to_haves: intake.niceToHaves ? [intake.niceToHaves] : [],
          disqualifiers: intake.disqualifiers ? [intake.disqualifiers] : [],
          target_companies: intake.targetCompanies.split(/[\n,]+/).map(value => value.trim()).filter(Boolean),
        }),
      })
      const json = await response.json()
      if (json.ok) {
        setCurrentProject({ id: json.project.id, name: json.project.name, role_title: json.project.role_title, mode: json.mode })
        setSaveDurability(json.mode === 'supabase' ? 'durable' : 'preview')
      } else if (response.status === 401) {
        setProjectError('Sign in to save projects. Your intake draft stays in this browser.')
      } else if (response.status === 503) {
        setProjectError('Saving is unavailable in this environment. Your intake draft stays in this browser.')
      } else {
        setProjectError(json.error || 'Project save failed.')
      }
    } catch {
      setProjectError('Failed to reach /api/projects/create.')
    } finally {
      setProjectSaving(false)
    }
  }

  const handleSearch = useCallback(async (output: ComposerOutput) => {
    if (!output.rawQuery.trim()) return

    activeRunRef.current?.controller.abort()
    const runId = ++runCounterRef.current
    const controller = new AbortController()
    activeRunRef.current = { id: runId, controller }
    const isCurrent = () => activeRunRef.current?.id === runId && !controller.signal.aborted

    setSearching(true)
    setSearchError('')
    setSearchResults([])
    setNoResultsMeta({ sources: [], suggestions: [] })
    setMarketMap(null)
    setTab('results')

    const chips = output.chips.map(chip => ({ canonical: chip.canonical, type: chip.type }))
    const hardTerms = chips.filter(chip => chip.type === 'skill' || chip.type === 'tool').map(chip => chip.canonical)
    const softFilters = chips.filter(chip => ['title', 'seniority', 'location', 'company'].includes(chip.type)).map(chip => ({ canonical: chip.canonical, type: chip.type }))
    const manualSafe = chips.filter(chip => chip.type === 'clearance').map(chip => chip.canonical)

    setChipContext({
      hardTerms,
      softFilters,
      manualSafe,
      hasClearance: manualSafe.length > 0,
      hasLocation: softFilters.some(filter => filter.type === 'location'),
      isSkillLight: hardTerms.length === 0,
    })

    const volumePlan = buildVolumeSearchPlan({
      rawQuery: output.rawQuery,
      chips,
      recommendedSourceIds: output.recommendedSourceIds,
      mode: searchMode,
    })
    const liveSources = volumePlan.liveSources
    const sourceBreakdown: Record<string, number> = Object.fromEntries(liveSources.map(source => [source, 0]))
    const initialLanes: SourceLane[] = [
      ...liveSources.map(source => ({ source, status: 'queued' as const })),
      ...volumePlan.manualSafeLanes.map(lane => ({ source: lane.label, status: 'manual_safe' as const, href: lane.href })),
    ]
    setSourceLanes(initialLanes)

    const runSource = async (source: string) => {
      if (!isCurrent()) return
      setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'searching' } : lane))
      const timeout = SOURCE_TIMEOUTS_MS[source] || DEFAULT_TIMEOUT_MS

      try {
        const { timedOut, aborted, data } = await fetchWithTimeout(
          '/api/workbench/search-source',
          { query: output.rawQuery, source, chips, limit: volumePlan.sourceLimit },
          timeout,
          { signal: controller.signal },
        )
        if (aborted || !isCurrent()) return
        if (timedOut) {
          setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'timed_out' } : lane))
          return
        }

        const json = data as { ok?: boolean; results?: SourceResult[] }
        const results = Array.isArray(json.results) ? json.results : []
        sourceBreakdown[source] = results.length

        if (results.length > 0 && isCurrent()) {
          setSearchResults(previous => {
            if (!isCurrent()) return previous
            const seenIds = new Set(previous.map(result => result.id))
            const seenUrls = new Set(previous.map(result => result.profileUrl).filter(Boolean))
            return [
              ...previous,
              ...results.filter(result => !seenIds.has(result.id) && (!result.profileUrl || !seenUrls.has(result.profileUrl))),
            ]
          })
        }

        if (isCurrent()) {
          setSourceLanes(previous => previous.map(lane => lane.source === source
            ? { ...lane, status: results.length > 0 ? 'found' : 'no_results', count: results.length }
            : lane))
        }
      } catch {
        if (isCurrent()) {
          setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'error' } : lane))
        }
      }
    }

    await Promise.allSettled(liveSources.map(runSource))
    if (!isCurrent()) return

    setSearching(false)
    const totalResults = Object.values(sourceBreakdown).reduce((sum, count) => sum + count, 0)
    const noResultSources = Object.entries(sourceBreakdown).filter(([, count]) => count === 0).map(([source]) => source)
    const lowVolume = totalResults < 3

    setMarketMap({
      mode: searchMode,
      modeLabel: volumePlan.modeLabel,
      totalResults,
      liveSources,
      manualSafeLanes: volumePlan.manualSafeLanes,
      sourceBreakdown,
      queryVariants: volumePlan.queryVariants,
      lowResultActions: volumePlan.lowResultActions,
      unverified: UNVERIFIED_ITEMS,
    })

    if (lowVolume || noResultSources.length > 0) {
      setNoResultsMeta({
        sources: noResultSources,
        suggestions: volumePlan.lowResultActions,
        broadQuery: volumePlan.queryVariants.find(variant => variant.id === 'skills-only')?.query,
        usedBroadQuery: false,
      })
    }

    try {
      saveSession({
        projectId: currentProject?.id,
        roleTitle: jdSummary?.roleTitle || intake.jobTitle || output.rawQuery.slice(0, 60),
        rawQuery: output.rawQuery,
        liveSearchTerms: hardTerms,
        reviewFilters: softFilters.map(filter => filter.canonical),
        manualSafeConstraints: manualSafe,
        exclusions: output.falsePosWarnings || [],
        sourceLanes: liveSources,
        resultCount: totalResults,
      })
      if (isCurrent()) setRecentSessions(listSessions())
    } catch {
      // Session history is non-fatal.
    }
  }, [currentProject?.id, intake.jobTitle, jdSummary, searchMode])

  const retrySource = useCallback(async (source: string) => {
    if (!composerOutput) return
    const chips = composerOutput.chips.map(chip => ({ canonical: chip.canonical, type: chip.type }))
    const retryPlan = buildVolumeSearchPlan({
      rawQuery: composerOutput.rawQuery,
      chips,
      recommendedSourceIds: composerOutput.recommendedSourceIds,
      mode: searchMode,
    })
    setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'searching' } : lane))

    try {
      const { timedOut, data } = await fetchWithTimeout(
        '/api/workbench/search-source',
        { query: composerOutput.rawQuery, source, chips, limit: retryPlan.sourceLimit },
        SOURCE_TIMEOUTS_MS[source] || DEFAULT_TIMEOUT_MS,
      )
      if (timedOut) {
        setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'timed_out' } : lane))
        return
      }
      const json = data as { results?: SourceResult[] }
      const results = Array.isArray(json.results) ? json.results : []
      if (results.length > 0) {
        setSearchResults(previous => {
          const seenIds = new Set(previous.map(result => result.id))
          const seenUrls = new Set(previous.map(result => result.profileUrl).filter(Boolean))
          return [...previous, ...results.filter(result => !seenIds.has(result.id) && (!result.profileUrl || !seenUrls.has(result.profileUrl)))]
        })
      }
      setSourceLanes(previous => previous.map(lane => lane.source === source
        ? { ...lane, status: results.length > 0 ? 'found' : 'no_results', count: results.length }
        : lane))
    } catch {
      setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'error' } : lane))
    }
  }, [composerOutput, searchMode])

  const composerInitialQuery = jdSummary?.composerQuery || [
    intake.jobTitle,
    intake.location,
    intake.clearanceNeeds,
    ...intake.mustHaves.split(/[\n,]+/).map(value => value.trim()).filter(Boolean).slice(0, 4),
  ].filter(Boolean).join(' ')

  const tabLabels: Record<Tab, string> = {
    intake: '01  Role Intake',
    composer: '02  Search Composer',
    results: '03  Results',
    saved: '04  Saved',
  }

  function parsedSearchOutput(): ComposerOutput | null {
    if (!jdSummary) return null
    return {
      rawQuery: jdSummary.composerQuery,
      chips: [
        ...(jdSummary.roleTitle ? [{ canonical: jdSummary.roleTitle, type: 'title' as const }] : []),
        ...jdSummary.mustHaveSkills.map(skill => ({ canonical: skill, type: 'skill' as const })),
        ...(jdSummary.location ? [{ canonical: jdSummary.location, type: 'location' as const }] : []),
        ...jdSummary.clearance.map(clearance => ({ canonical: clearance, type: 'clearance' as const })),
      ] as ComposerOutput['chips'],
      booleanString: '',
      xRayString: '',
      githubQuery: '',
      openAlexQuery: '',
      npmQuery: '',
      recommendedSourceIds: jdSummary.suggestedSourceLanes,
      candidateScorecardHints: [],
      verifyNextItems: [],
      falsePosWarnings: jdSummary.likelyFalsePositives,
    }
  }

  return (
    <div>
      {currentProject && (
        <div className="project-bar">
          <span className="project-bar-label">Project:</span>
          <span className="project-bar-name">{currentProject.name}</span>
          <span className="project-bar-mode">{currentProject.mode === 'supabase' ? <span className="status-live">Persisted</span> : <span className="status-preview">Preview</span>}</span>
        </div>
      )}

      <div className="workbench">
        <div className="wb-tabs">
          {(['intake', 'composer', 'results', 'saved'] as Tab[]).map(item => (
            <button key={item} className={`wb-tab ${tab === item ? 'active' : ''}`} onClick={() => setTab(item)}>
              {tabLabels[item]}
              {item === 'results' && searchResults.length > 0 && <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--green)', fontWeight: 900 }}>{searchResults.length}</span>}
              {item === 'saved' && savedEntries.length > 0 && <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--accent)', fontWeight: 900 }}>{savedEntries.length}</span>}
            </button>
          ))}
        </div>

        <div className="wb-content">
          {tab === 'intake' && (
            <div className="wb-section">
              <div className="wb-section-title">Role intake</div>
              <div className="wb-form-grid">
                <div className="wb-form-row full">
                  <label>Job title *</label>
                  <input value={intake.jobTitle} onChange={setField('jobTitle')} placeholder="e.g. DevSecOps Engineer, Staff ML Engineer" />
                </div>
                <div className="wb-form-row full">
                  <label>Job description <span className="muted" style={{ fontWeight: 400, fontSize: '11px' }}>Paste a JD and parse it to auto-fill fields</span></label>
                  <textarea value={intake.jobDescription} onChange={setField('jobDescription')} placeholder="Paste the full job description" />
                  {intake.jobDescription.trim().length > 40 && (
                    <button type="button" className="btn ghost" style={{ marginTop: '8px', alignSelf: 'flex-start' }} onClick={() => {
                      const parsed = parseJobDescription(intake.jobDescription)
                      setJdSummary(parsed)
                      setIntake(previous => ({
                        ...previous,
                        jobTitle: parsed.roleTitle || previous.jobTitle,
                        location: parsed.location || previous.location,
                        clearanceNeeds: parsed.clearance.join(', ') || previous.clearanceNeeds,
                        mustHaves: parsed.mustHaveSkills.join(', ') || previous.mustHaves,
                        niceToHaves: parsed.preferredSkills.join(', ') || previous.niceToHaves,
                        targetCompanies: parsed.targetCompanies.join('\n') || previous.targetCompanies,
                      }))
                      setJdParsed(true)
                    }}>⚡ Parse JD and auto-fill</button>
                  )}
                  {jdParsed && jdSummary && (
                    <div className="jd-summary">
                      <div className="jd-summary-head">Parsed. Review the criteria, then search or refine.</div>
                      <div className="jd-summary-grid">
                        {jdSummary.roleTitle && <div className="jd-summary-item"><span className="jd-summary-label">Title</span><span>{jdSummary.roleTitle}</span></div>}
                        {jdSummary.mustHaveSkills.length > 0 && <div className="jd-summary-item"><span className="jd-summary-label">Must-haves</span><span>{jdSummary.mustHaveSkills.join(', ')}</span></div>}
                        {jdSummary.location && <div className="jd-summary-item"><span className="jd-summary-label">Location</span><span>{jdSummary.location}</span></div>}
                        {jdSummary.clearance.length > 0 && <div className="jd-summary-item"><span className="jd-summary-label jd-summary-manual">Manual-safe</span><span>{jdSummary.clearance.join(', ')} (not verified)</span></div>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                        <button type="button" className="btn" onClick={() => {
                          const output = parsedSearchOutput()
                          if (!output) return
                          setComposerOutput(output)
                          void handleSearch(output)
                        }}>⚡ Accept and search</button>
                        <button type="button" className="btn secondary" onClick={() => setTab('composer')}>Refine in Composer →</button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="wb-form-row"><label>Must-haves</label><textarea value={intake.mustHaves} onChange={setField('mustHaves')} placeholder="Non-negotiable requirements" /></div>
                <div className="wb-form-row"><label>Nice-to-haves</label><textarea value={intake.niceToHaves} onChange={setField('niceToHaves')} placeholder="Bonus qualifications" /></div>
                <div className="wb-form-row"><label>Location</label><input value={intake.location} onChange={setField('location')} placeholder="e.g. Northern Virginia, Remote US" /></div>
                <div className="wb-form-row"><label>Work type</label><select value={intake.workType} onChange={setField('workType')}><option value="any">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option></select></div>
                <div className="wb-form-row"><label>Clearance / security needs</label><input value={intake.clearanceNeeds} onChange={setField('clearanceNeeds')} placeholder="e.g. Active TS/SCI" /></div>
                <div className="wb-form-row"><label>Target companies</label><textarea value={intake.targetCompanies} onChange={setField('targetCompanies')} placeholder="One per line or comma-separated" /></div>
                <div className="wb-form-row"><label>Disqualifiers</label><textarea value={intake.disqualifiers} onChange={setField('disqualifiers')} placeholder="Hard stops" /></div>
                <div className="wb-form-row"><label>Compensation notes</label><input value={intake.compensationNotes} onChange={setField('compensationNotes')} placeholder="Budget range" /></div>
                <div className="wb-form-row full"><label>Hiring manager notes</label><textarea value={intake.hiringManagerNotes} onChange={setField('hiringManagerNotes')} placeholder="Non-obvious requirements" /></div>
              </div>

              {projectError && <div className="preview-banner"><span className="pb-icon">✕</span><span>{projectError}</span></div>}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                <button className="wb-generate" style={{ flex: 1 }} onClick={() => setTab('composer')} disabled={!intake.jobTitle.trim()}>{intake.jobTitle.trim() ? 'Open Search Composer →' : 'Enter a job title to continue'}</button>
                <button className="btn secondary" onClick={() => void saveProject()} disabled={!intake.jobTitle.trim() || projectSaving}>{projectSaving ? 'Saving…' : currentProject ? '✓ Project saved' : 'Save project'}</button>
              </div>
              {saveDurability === 'preview' && <div className="cta" style={{ marginTop: '10px' }}><strong>Preview mode:</strong> project data is not durable in this environment.</div>}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px' }}>
                {draftRestored && <span className="muted" style={{ fontSize: '12px' }}>Draft restored from this browser.</span>}
                {(draftRestored || Object.values(intake).some(value => String(value || '').trim() && value !== 'any')) && <button className="btn ghost" onClick={clearDraft}>Clear draft</button>}
              </div>
            </div>
          )}

          {tab === 'composer' && (
            <div className="wb-section">
              <div className="wb-section-title">Search Composer</div>
              <SearchModeSelector mode={searchMode} onChange={setSearchMode} />
              {recentSessions.length > 0 && (
                <div className="recent-searches">
                  <span className="recent-searches-label">Recent searches</span>
                  <div className="recent-searches-list">
                    {recentSessions.slice(0, 5).map(session => (
                      <button key={session.id} type="button" className="recent-search-chip" onClick={() => {
                        const output: ComposerOutput = {
                          rawQuery: session.rawQuery,
                          chips: [
                            ...(session.roleTitle ? [{ canonical: session.roleTitle, type: 'title' as const }] : []),
                            ...session.liveSearchTerms.map(term => ({ canonical: term, type: 'skill' as const })),
                            ...session.manualSafeConstraints.map(constraint => ({ canonical: constraint, type: 'clearance' as const })),
                          ] as ComposerOutput['chips'],
                          booleanString: '', xRayString: '', githubQuery: '', openAlexQuery: '', npmQuery: '',
                          recommendedSourceIds: session.sourceLanes,
                          candidateScorecardHints: [], verifyNextItems: [], falsePosWarnings: session.exclusions,
                        }
                        setComposerOutput(output)
                        void handleSearch(output)
                      }}>
                        <span className="recent-search-title">{session.roleTitle || session.rawQuery.slice(0, 40)}</span>
                        <span className="recent-search-terms">{session.liveSearchTerms.slice(0, 3).join(' · ') || session.rawQuery.slice(0, 40)}</span>
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
                onApplyTitles={titles => applyTerms(titles, 'titles')}
                onApplySkills={skills => applyTerms(skills, 'skills')}
                onApplyQuery={query => applyTerms(query.split(/\s+/), 'query')}
              />
              {applyToast && <div className="apply-toast">✓ {applyToast}</div>}
              <SearchComposer externalAppend={composerAppend} onOutput={setComposerOutput} onSearch={handleSearch} initialQuery={composerInitialQuery} />

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                <button className="composer-toggle-btn" onClick={() => setShowAiStrategy(value => !value)} style={{ width: '100%', textAlign: 'left' }}>
                  {showAiStrategy ? '▾' : '▸'} AI search strategy — private beta
                </button>
                {showAiStrategy && (
                  <div className="strategy-grid" style={{ marginTop: '14px' }}>
                    {STRATEGY_SECTIONS.map(section => <div className="strategy-card" key={section.id}><div className="sc-head"><h4>{section.label}</h4><span className="wb-preview-label">preview</span></div><div className="sc-body">AI output unlocked in beta</div></div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'results' && (
            <div className="wb-section">
              {searching && (
                <div className="recruiter-trust-note" role="status" aria-live="polite" style={{ marginBottom: '12px' }}>
                  <strong>Searching public sources.</strong>
                  <span>{searchResults.length > 0 ? `${searchResults.length} results available now; remaining sources continue below.` : 'The first results will appear as soon as a source returns.'}</span>
                </div>
              )}

              {searching && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '28px 0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(72,217,255,.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  <p className="muted">Querying public sources…</p>
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
                  onProfileSaved={entry => setSavedEntries(previous => previous.some(saved => saved.id === entry.id) ? previous : [...previous, entry])}
                  onRetryComposer={() => setTab('composer')}
                  onOpenDrawer={result => { setDrawerResult(result); setDrawerOpen(true) }}
                />
              )}

              {!searching && searchError && <div className="preview-banner"><span className="pb-icon">✕</span><span>{searchError}</span></div>}
              {!searching && !searchError && searchResults.length === 0 && !composerOutput && (
                <div className="wb-empty"><h3>No search run yet</h3><p>Open Search Composer, enter a search, and run it.</p><button className="btn secondary" onClick={() => setTab('composer')}>Open Search Composer →</button></div>
              )}
              {noResultsMeta.usedBroadQuery && <div className="preview-banner"><span className="pb-icon">◈</span><span>Showing a broader search: <strong>{noResultsMeta.broadQuery}</strong></span></div>}

              {sourceLanes.length > 0 && (
                <div style={{ marginTop: '18px' }}>
                  <SourceLaneStatus lanes={sourceLanes} onRetry={retrySource} />
                </div>
              )}
              <MarketMapSummary snapshot={marketMap} />
            </div>
          )}

          {tab === 'saved' && (
            <div className="wb-section">
              {savedEntries.length === 0 ? (
                <div className="wb-empty"><h3>No saved candidates yet</h3><p>Run a search, review a person profile, and save it for recruiter identity review.</p><button className="btn secondary" onClick={() => setTab('composer')}>Open Search Composer</button></div>
              ) : (
                <>
                  <div className="wb-section-title">Saved this session — {savedEntries.length}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {savedEntries.map(entry => (
                      <div key={entry.id} className="result-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div><div className="result-name">{entry.displayName}</div><div className="muted">{entry.source}</div></div>
                        <a className="btn secondary" href={`/app/candidate/${entry.id}`}>View 360 →</a>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '16px' }}><Link className="btn secondary" href="/app/candidate-database">View full Candidate Database →</Link></div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

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
          sourceLanes: sourceLanes.map(lane => lane.source),
        }}
        onClose={() => setDrawerOpen(false)}
        onSaved={(id, displayName, source) => setSavedEntries(previous => previous.some(entry => entry.id === id) ? previous : [...previous, { id, displayName, source }])}
      />
    </div>
  )
}
