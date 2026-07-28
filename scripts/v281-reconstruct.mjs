import fs from 'node:fs'

const path = 'next-public/components/WorkbenchClient.tsx'
let text = fs.readFileSync(path, 'utf8')

function requireReplace(search, replacement, label) {
  if (!text.includes(search)) {
    if (text.includes(replacement)) return
    throw new Error(`Missing transform marker: ${label}`)
  }
  text = text.replace(search, replacement)
}

requireReplace(
  "import { useState, useCallback, useEffect } from 'react'",
  "import { useState, useCallback, useEffect, useRef } from 'react'",
  'React useRef import',
)

requireReplace(
  "export function WorkbenchClient({ publicMode = false }: { publicMode?: boolean }) {\n  const [tab, setTab] = useState<Tab>('intake')",
  "interface WorkbenchClientProps { publicMode?: boolean; initialTab?: Tab }\n\nexport function WorkbenchClient({ publicMode = false, initialTab }: WorkbenchClientProps) {\n  const [tab, setTab] = useState<Tab>(initialTab || (publicMode ? 'composer' : 'intake'))",
  'Workbench props',
)

const stateMarker = "  const [marketMap, setMarketMap] = useState<MarketMapSnapshot | null>(null)\n  useEffect(() => { setRecentSessions(listSessions()) }, [])"
const stateReplacement = "  const [marketMap, setMarketMap] = useState<MarketMapSnapshot | null>(null)\n  const activeRunRef = useRef<{ id: number; controller: AbortController } | null>(null)\n  const nextRunIdRef = useRef(0)\n\n  useEffect(() => { setRecentSessions(listSessions()) }, [])\n  useEffect(() => () => { activeRunRef.current?.controller.abort() }, [])"
requireReplace(stateMarker, stateReplacement, 'search run refs')

const handleStart = text.indexOf('  const handleSearch = useCallback(async (output: ComposerOutput) => {')
const handleEnd = text.indexOf('\n\n  // Retry a single timed-out / errored source', handleStart)
if (handleStart < 0 || handleEnd < 0) throw new Error('Unable to locate handleSearch block')

const handleBlock = `  const handleSearch = useCallback(async (output: ComposerOutput) => {
    if (!output.rawQuery.trim()) return

    activeRunRef.current?.controller.abort()
    const runId = ++nextRunIdRef.current
    const controller = new AbortController()
    activeRunRef.current = { id: runId, controller }
    const isCurrent = () => activeRunRef.current?.id === runId && !controller.signal.aborted

    setSearching(true); setSearchError('')
    setSearchResults([]); setNoResultsMeta({ sources: [], suggestions: [] }); setMarketMap(null)
    setTab('results')

    const chips = output.chips.map(c => ({ canonical: c.canonical, type: c.type }))
    const hardTerms = chips.filter(c => c.type === 'skill' || c.type === 'tool').map(c => c.canonical)
    const softFilters = chips.filter(c => ['title', 'seniority', 'location', 'company'].includes(c.type)).map(c => ({ canonical: c.canonical, type: c.type }))
    const manualSafe = chips.filter(c => c.type === 'clearance').map(c => c.canonical)
    setChipContext({
      hardTerms, softFilters, manualSafe,
      hasClearance: manualSafe.length > 0,
      hasLocation: softFilters.some(f => f.type === 'location'),
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
        const { timedOut, cancelled, data } = await fetchWithTimeout(
          '/api/workbench/search-source',
          { query: output.rawQuery, source, chips, limit: volumePlan.sourceLimit },
          timeout,
          controller.signal,
        )
        if (cancelled || !isCurrent()) return
        if (timedOut) {
          setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'timed_out' } : lane))
          return
        }

        const json = data as { ok: boolean; results?: SourceResult[]; status?: string }
        const sourceResults = json.results || []
        sourceBreakdown[source] = sourceResults.length
        if (sourceResults.length > 0) {
          setSearchResults(previous => {
            if (!isCurrent()) return previous
            const seenIds = new Set(previous.map(result => result.id))
            const seenUrls = new Set(previous.map(result => result.profileUrl).filter(Boolean))
            return [
              ...previous,
              ...sourceResults.filter(result => !seenIds.has(result.id) && (!result.profileUrl || !seenUrls.has(result.profileUrl))),
            ]
          })
        }
        if (!isCurrent()) return
        setSourceLanes(previous => previous.map(lane => lane.source === source
          ? { ...lane, status: sourceResults.length > 0 ? 'found' : 'no_results', count: sourceResults.length }
          : lane))
      } catch {
        if (!isCurrent()) return
        setSourceLanes(previous => previous.map(lane => lane.source === source ? { ...lane, status: 'error' } : lane))
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
    } catch { /* non-fatal */ }
  }, [currentProject?.id, jdSummary, intake.jobTitle, searchMode])`

text = text.slice(0, handleStart) + handleBlock + text.slice(handleEnd)

const resultsStart = text.indexOf("          {tab === 'results' && (")
const resultsEnd = text.indexOf("\n\n          {tab === 'saved' && (", resultsStart)
if (resultsStart < 0 || resultsEnd < 0) throw new Error('Unable to locate results render block')

const resultsBlock = `          {tab === 'results' && (
            <div className="wb-section">
              {searching && (
                <div className="search-progress-line" role="status" aria-live="polite">
                  Searching public sources{searchResults.length > 0 ? \` · \${searchResults.length} source subjects available to review\` : '…'}
                </div>
              )}

              {searching && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(72,217,255,.2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                  <style>{\`@keyframes spin { to { transform: rotate(360deg) } }\`}</style>
                  <p className="muted">Looking for candidate people and supporting evidence…</p>
                </div>
              )}

              {!searching && searchError && (
                <div className="preview-banner">
                  <span className="pb-icon">✕</span><span>{searchError}</span>
                </div>
              )}

              {!searching && !searchError && searchResults.length === 0 && composerOutput && noResultsMeta.suggestions.length === 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <p className="muted" style={{ fontSize: '13px' }}>No results yet. Refine the search and try again.</p>
                  <button className="btn secondary" onClick={() => setTab('composer')} style={{ marginTop: '10px' }}>
                    ← Refine search
                  </button>
                </div>
              )}

              {!searching && !searchError && searchResults.length === 0 && !composerOutput && (
                <div className="wb-empty">
                  <h3>No search run yet</h3>
                  <p>Open Search Composer, describe the person you need, and run the search.</p>
                  <button className="btn secondary" onClick={() => setTab('composer')}>Open Search Composer →</button>
                </div>
              )}

              {noResultsMeta.usedBroadQuery && (
                <div className="preview-banner" style={{ marginBottom: '12px', borderColor: 'rgba(72,217,255,.3)' }}>
                  <span className="pb-icon">◈</span>
                  <span>No results for the specific query. Showing broader search: <strong>{noResultsMeta.broadQuery}</strong></span>
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
                  onProfileSaved={entry => setSavedEntries(previous => [...previous, entry])}
                  onRetryComposer={() => setTab('composer')}
                  onOpenDrawer={result => { setDrawerResult(result); setDrawerOpen(true) }}
                />
              )}

              {sourceLanes.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <SourceLaneStatus lanes={sourceLanes} onRetry={retrySource} />
                </div>
              )}
              <MarketMapSummary snapshot={marketMap} />
            </div>
          )}`

text = text.slice(0, resultsStart) + resultsBlock + text.slice(resultsEnd)

fs.writeFileSync(path, text)
console.log('Applied V28.1 WorkbenchClient reconstruction')
