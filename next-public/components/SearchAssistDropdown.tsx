'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSearchAssistSuggestions, groupSuggestions, type Suggestion } from '@/lib/search-assist'
import { trackClientEvent } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────────
// SearchAssistDropdown — Google-style typeahead under the candidate search input.
// Deterministic suggestions from lib/search-assist. Click or keyboard to add a
// term. Renders an interpretation panel + trust notes. No network, no AI.
//
// Designed to wrap (not replace) the existing composer input: the parent owns
// the query string; this component reads it, shows suggestions, and calls
// onAddTerm(value) when the user picks one.
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

const KIND_COLOR: Record<string, string> = {
  title: 'title', skill: 'skill', tool: 'skill', clearance: 'clearance',
  location: 'location', company: 'company', 'source-lane': 'source',
  exclusion: 'muted', operator: 'muted', related: 'industry',
}

export function SearchAssistDropdown({ query, onAddTerm, selectedLaneId, open, onRequestClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const result = useMemo(
    () => getSearchAssistSuggestions(query, { selectedLaneId }),
    [query, selectedLaneId]
  )
  const groups = useMemo(() => groupSuggestions(result.suggestions), [result.suggestions])
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])

  // Reset highlight when the suggestion set changes.
  useEffect(() => { setActiveIdx(0) }, [query, selectedLaneId])

  // Keyboard navigation on the document while open.
  useEffect(() => {
    if (!open || flat.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Tab' && flat[activeIdx]) { e.preventDefault(); pick(flat[activeIdx]) }
      else if (e.key === 'Escape') { onRequestClose?.() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
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
            Start typing a title, skill, clearance, or market — suggestions appear here.
          </p>
        )
      )}

      {/* Trust notes */}
      {hasContent && result.notes.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {result.notes.map(n => (
            <p key={n} className="muted" style={{ fontSize: 11, margin: '2px 0' }}>· {n}</p>
          ))}
        </div>
      )}
    </div>
  )
}
