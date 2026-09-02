'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSearchAssistSuggestions, groupSuggestions, type Suggestion } from '@/lib/search-assist'
import { authoritativeTitlePhraseFromComposerV36_4 } from '@/lib/entity-intelligence/onet-title-search-v36-4'
import { trackClientEvent } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────────
// SearchAssistDropdown — recruiter typeahead under the candidate search input.
//
// V36.4 keeps the reviewed local RIG instant, then adds a debounced server-side
// O*NET 31.0 title search. The browser receives only the top suggestions, never
// the full 54k+ authoritative title dataset. O*NET entries remain search-only.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  query: string
  onAddTerm: (term: string) => void
  /** Currently selected/active source lane id, if any (filters suggestions). */
  selectedLaneId?: string
  /** Anchor visibility to input focus from the parent. */
  open: boolean
  onRequestClose?: () => void
}

type AuthoritativeApiSuggestion = {
  value?: string
  canonicalTitle?: string
  onetSocCode?: string
  sourceVersion?: string
  searchOnly?: boolean
  evidenceEligible?: boolean
}

const KIND_COLOR: Record<string, string> = {
  title: 'title', skill: 'skill', tool: 'skill', credential: 'skill', industry: 'industry', clearance: 'clearance',
  location: 'location', company: 'company', 'source-lane': 'source',
  exclusion: 'muted', operator: 'muted', related: 'industry',
}

function mergeSuggestions(local: Suggestion[], authoritative: Suggestion[]): Suggestion[] {
  const seen = new Set<string>()
  return [...local, ...authoritative]
    .sort((a, b) => a.rank - b.rank || a.value.localeCompare(b.value))
    .filter(suggestion => {
      const key = `${suggestion.kind}:${suggestion.value.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function SearchAssistDropdown({ query, onAddTerm, selectedLaneId, open, onRequestClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [authoritative, setAuthoritative] = useState<Suggestion[]>([])
  const [authoritativeLoading, setAuthoritativeLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const result = useMemo(
    () => getSearchAssistSuggestions(query, { selectedLaneId }),
    [query, selectedLaneId]
  )
  const authoritativePhrase = useMemo(
    () => open ? authoritativeTitlePhraseFromComposerV36_4(query) : '',
    [query, open]
  )

  useEffect(() => {
    if (!open || authoritativePhrase.length < 3) {
      setAuthoritative([])
      setAuthoritativeLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setAuthoritativeLoading(true)
      try {
        const response = await fetch(`/api/entity-intelligence/authoritative-suggest?q=${encodeURIComponent(authoritativePhrase)}&limit=8`, {
          method: 'GET',
          headers: { accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Authoritative suggestion request failed.')
        const payload = await response.json() as { ok?: boolean; suggestions?: AuthoritativeApiSuggestion[] }
        const suggestions: Suggestion[] = (payload.suggestions || [])
          .filter(item => item.value && item.searchOnly === true && item.evidenceEligible === false)
          .map(item => ({
            value: item.value || '',
            kind: 'title',
            reason: `O*NET ${item.sourceVersion || '31.0'} · search-only${item.canonicalTitle && item.canonicalTitle !== item.value ? ` · ${item.canonicalTitle}` : ''}`,
            rank: 0.75,
          }))
        setAuthoritative(suggestions)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setAuthoritative([])
      } finally {
        if (!controller.signal.aborted) setAuthoritativeLoading(false)
      }
    }, 260)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [authoritativePhrase, open])

  const combinedSuggestions = useMemo(
    () => mergeSuggestions(result.suggestions, authoritative),
    [result.suggestions, authoritative]
  )
  const groups = useMemo(() => groupSuggestions(combinedSuggestions), [combinedSuggestions])
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])

  // Reset highlight when the suggestion set changes.
  useEffect(() => { setActiveIdx(0) }, [query, selectedLaneId])

  // Keyboard navigation while open. Capture phase lets Enter pick a suggestion
  // before the parent search input treats Enter as “run search”.
  useEffect(() => {
    if (!open || flat.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      else if ((e.key === 'Tab' || e.key === 'Enter') && flat[activeIdx]) { e.preventDefault(); e.stopPropagation(); pick(flat[activeIdx]) }
      else if (e.key === 'Escape') { onRequestClose?.() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, flat, activeIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(s: Suggestion) {
    if (s.kind === 'source-lane') {
      // Source lanes are guidance, not query terms — surface but don't inject.
      trackClientEvent('assist_lane_hint', s.value)
      return
    }
    trackClientEvent('assist_add_term', `${s.kind}:${s.value}`)
    onAddTerm(s.value)
  }

  if (!open) return null
  const hasContent = result.recognized.length > 0 || flat.length > 0

  return (
    <div className="assist-dropdown" ref={boxRef} role="listbox" aria-label="Search suggestions"
      style={{
        position: 'relative', marginTop: 6, border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 10, background: 'var(--panel, #14141a)', padding: 12, zIndex: 5,
      }}>
      {/* Interpretation panel */}
      {result.recognized.length > 0 && (
        <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <span className="kicker">Search interpretation</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {result.recognized.map(r => (
              <span key={`${r.type}-${r.canonical}`} className={`composer-chip chip-${KIND_COLOR[r.type] || 'muted'}`}
                style={{ fontSize: 12, padding: '2px 8px' }}>
                <span className="chip-type-label">{r.type}</span>&nbsp;{r.canonical}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Grouped suggestions */}
      {flat.length > 0 ? (
        groups.map(group => (
          <div key={group.kind} style={{ marginBottom: 8 }}>
            <div className="composer-section-label" style={{ fontSize: 11, opacity: 0.7 }}>{group.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {group.items.map(s => {
                const idx = flat.indexOf(s)
                const isLane = s.kind === 'source-lane'
                return (
                  <button
                    key={`${s.kind}-${s.value}`}
                    role="option"
                    aria-selected={idx === activeIdx}
                    className="suggestion-tag"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => pick(s)}
                    title={s.reason}
                    style={idx === activeIdx ? { outline: '1px solid var(--amber)', outlineOffset: 1 } : undefined}
                  >
                    {isLane ? '◎ ' : '+ '}{s.value}
                    <span className="muted" style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>{s.reason}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        result.recognized.length === 0 && (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {authoritativeLoading ? 'Checking reviewed and authoritative recruiting vocabulary…' : 'Start typing a title, skill, clearance, or market — suggestions appear here.'}
          </p>
        )
      )}

      {authoritativeLoading && flat.length > 0 && (
        <p className="muted" style={{ fontSize: 10, margin: '4px 0 0' }}>Checking O*NET 31.0 title vocabulary…</p>
      )}

      {flat.length > 0 && (
        <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>
          Use ↑/↓ to move, Enter to add, Esc to close. Press Enter again in the search box to run the search.
        </p>
      )}

      {/* Trust notes */}
      {hasContent && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {result.notes.map(n => (
            <p key={n} className="muted" style={{ fontSize: 11, margin: '2px 0' }}>· {n}</p>
          ))}
          {authoritative.length > 0 && (
            <p className="muted" style={{ fontSize: 11, margin: '2px 0' }}>· O*NET titles are authoritative search vocabulary, not candidate evidence or automatic role requirements.</p>
          )}
        </div>
      )}
    </div>
  )
}
