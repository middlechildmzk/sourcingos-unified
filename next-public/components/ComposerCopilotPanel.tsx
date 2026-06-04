'use client'
import { useState } from 'react'
import type { CopilotPlanInput } from '@/lib/ai/types'

// ─────────────────────────────────────────────────────────────────────────────
// ComposerCopilotPanel — AI Search Strategy in the composer (V3.1 Package 1).
// Calls /api/ai/search-strategy (auth-gated). Suggestions never overwrite the
// parser output — the user clicks Apply. Falls back to deterministic when no key.
// ─────────────────────────────────────────────────────────────────────────────

interface ComposerCopilotPanelProps {
  plan: CopilotPlanInput
  publicMode: boolean
  onApplyTitles?: (titles: string[]) => void
  onApplySkills?: (skills: string[]) => void
  onApplyQuery?: (query: string) => void
}

export function ComposerCopilotPanel({ plan, publicMode, onApplyTitles, onApplySkills, onApplyQuery }: ComposerCopilotPanelProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [strategy, setStrategy] = useState<Record<string, unknown> | null>(null)
  const [authPrompt, setAuthPrompt] = useState(false)

  async function generate() {
    if (publicMode) { setAuthPrompt(true); setOpen(true); return }
    setOpen(true); setLoading(true); setStrategy(null); setAuthPrompt(false)
    try {
      const res = await fetch('/api/ai/search-strategy', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan),
      })
      if (res.status === 401) { setAuthPrompt(true); setLoading(false); return }
      const json = await res.json()
      setStrategy(json.ok ? json.result : null)
    } catch { setStrategy(null) } finally { setLoading(false) }
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t).catch(() => {})
  const arr = (k: string): string[] => Array.isArray(strategy?.[k]) ? (strategy![k] as string[]) : []

  return (
    <div className="composer-copilot">
      <button type="button" className="composer-copilot-trigger" onClick={generate} disabled={loading}>
        {loading ? '⟳ Generating strategy…' : '✦ AI Search Strategy'}
        <span className="ai-draft-badge">draft</span>
      </button>

      {open && (
        <div className="composer-copilot-body">
          {authPrompt && <div className="copilot-msg copilot-msg-auth">AI Copilot is available in signed-in beta.</div>}
          {loading && <div className="copilot-skeleton" />}

          {strategy && !loading && (
            <div className="copilot-output">
              <div className="copilot-output-head">
                <span className={`ai-source-badge ${strategy.aiGenerated ? 'ai-live' : 'ai-fallback'}`}>
                  {strategy.aiGenerated ? 'AI draft' : 'Deterministic draft'}
                </span>
                <span className="ai-conf">confidence: {String(strategy.confidence || 'low')}</span>
              </div>

              {typeof strategy.roleSummary === 'string' && strategy.roleSummary && (
                <p className="copilot-summary">{strategy.roleSummary}</p>
              )}

              {arr('searchRisks').length > 0 && (
                <div className="cc-block"><span className="cc-label">Search risks</span>
                  <ul className="copilot-list">{arr('searchRisks').map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}

              {(arr('similarTitles').length > 0 || arr('adjacentTitles').length > 0) && (
                <div className="cc-block">
                  <span className="cc-label">Title expansions</span>
                  <div className="cc-chips">{[...arr('similarTitles'), ...arr('adjacentTitles')].map((t, i) => <span key={i} className="cc-chip">{t}</span>)}</div>
                  {onApplyTitles && <button className="cc-apply" onClick={() => onApplyTitles([...arr('similarTitles'), ...arr('adjacentTitles')])}>Apply titles</button>}
                </div>
              )}

              {arr('skillSynonyms').length > 0 && (
                <div className="cc-block">
                  <span className="cc-label">Skill expansions</span>
                  <div className="cc-chips">{arr('skillSynonyms').map((s, i) => <span key={i} className="cc-chip">{s}</span>)}</div>
                  {onApplySkills && <button className="cc-apply" onClick={() => onApplySkills(arr('skillSynonyms'))}>Apply skills</button>}
                </div>
              )}

              {typeof strategy.firstSearchRecommendation === 'string' && strategy.firstSearchRecommendation && (
                <div className="cc-block">
                  <span className="cc-label">First search (skill-first)</span>
                  <code className="cc-code">{strategy.firstSearchRecommendation}</code>
                  <div className="cc-actions">
                    {onApplyQuery && <button className="cc-apply" onClick={() => onApplyQuery(String(strategy.firstSearchRecommendation))}>Apply query</button>}
                    <button className="copilot-copy" onClick={() => copy(String(strategy.firstSearchRecommendation))}>Copy</button>
                  </div>
                </div>
              )}

              {typeof strategy.booleanSuggestion === 'string' && strategy.booleanSuggestion && (
                <div className="cc-block"><span className="cc-label">Boolean</span>
                  <code className="cc-code">{strategy.booleanSuggestion}</code>
                  <button className="copilot-copy" onClick={() => copy(String(strategy.booleanSuggestion))}>Copy</button>
                </div>
              )}
              {typeof strategy.xRaySuggestion === 'string' && strategy.xRaySuggestion && (
                <div className="cc-block"><span className="cc-label">X-Ray</span>
                  <code className="cc-code">{strategy.xRaySuggestion}</code>
                  <button className="copilot-copy" onClick={() => copy(String(strategy.xRaySuggestion))}>Copy</button>
                </div>
              )}

              {arr('manualSafeWorkflow').length > 0 && (
                <div className="cc-block"><span className="cc-label cc-label-manual">Manual-safe workflow</span>
                  <ul className="copilot-list">{arr('manualSafeWorkflow').map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}

              {arr('calibrationQuestions').length > 0 && (
                <div className="cc-block">
                  <span className="cc-label">HM calibration questions</span>
                  <ul className="copilot-list">{arr('calibrationQuestions').map((q, i) => <li key={i}>{q}</li>)}</ul>
                  <button className="copilot-copy" onClick={() => copy(arr('calibrationQuestions').join('\n'))}>Copy questions</button>
                </div>
              )}

              {Array.isArray(strategy.warnings) && (
                <div className="copilot-warning">{(strategy.warnings as string[]).slice(0, 2).join(' ')}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
