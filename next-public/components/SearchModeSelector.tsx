'use client'

import { trackEvent } from '@/lib/analytics'
import { SEARCH_MODE_COPY, type SearchMode } from '@/lib/search/volume-plan'

const modes: SearchMode[] = ['precision', 'balanced', 'broad', 'market_map']

export function SearchModeSelector({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  return (
    <div className="jd-summary" style={{ marginBottom: '16px' }}>
      <div className="jd-summary-head">Search mode</div>
      <p className="muted" style={{ margin: '6px 0 12px', lineHeight: 1.55 }}>
        Choose how much source coverage you want. Broader modes expand public-source lanes and manual-safe discovery without fabricating profiles.
      </p>
      <div className="grid two">
        {modes.map(m => {
          const copy = SEARCH_MODE_COPY[m]
          const active = mode === m
          return (
            <button
              key={m}
              type="button"
              className="card"
              onClick={() => {
                trackEvent('candidate_search_mode_selected', { mode: m })
                onChange(m)
              }}
              style={{ textAlign: 'left', borderColor: active ? 'var(--teal)' : undefined, cursor: 'pointer' }}
            >
              <span className="kicker">{active ? 'Selected' : 'Mode'}</span>
              <h3>{copy.title}</h3>
              <p className="muted">{copy.description}</p>
            </button>
          )
        })}
      </div>
      <div className="preview-banner" style={{ marginTop: '12px', fontSize: '12px' }}>
        <span className="pb-icon">◈</span>
        <span><strong>Trust guardrail:</strong> Market Map means public-source discovery across available lanes, not full market coverage or verified candidates.</span>
      </div>
    </div>
  )
}
