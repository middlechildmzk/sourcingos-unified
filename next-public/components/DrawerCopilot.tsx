'use client'
import { useState } from 'react'
import type { CopilotCandidateInput, CopilotPlanInput } from '@/lib/ai/types'

// ─────────────────────────────────────────────────────────────────────────────
// DrawerCopilot — AI Copilot section for the candidate drawer.
// Generation is user-triggered (cost control) and auth-gated server-side.
// All outputs labeled AI draft / review-required. Falls back to deterministic.
// ─────────────────────────────────────────────────────────────────────────────

interface DrawerCopilotProps {
  candidate: CopilotCandidateInput
  plan: CopilotPlanInput
  publicMode: boolean
}

type Tool = 'candidate-summary' | 'project-fit' | 'hm-pitch' | 'outreach-angle'

const TOOL_LABELS: Record<Tool, string> = {
  'candidate-summary': 'Summary',
  'project-fit': 'Project fit',
  'hm-pitch': 'HM pitch',
  'outreach-angle': 'Outreach angle',
}

export function DrawerCopilot({ candidate, plan, publicMode }: DrawerCopilotProps) {
  const [active, setActive] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [authPrompt, setAuthPrompt] = useState(false)

  async function run(tool: Tool) {
    if (publicMode) { setAuthPrompt(true); return }
    setActive(tool); setLoading(true); setResult(null); setAuthPrompt(false)
    try {
      const res = await fetch(`/api/ai/${tool}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidate, plan }),
      })
      if (res.status === 401) { setAuthPrompt(true); setLoading(false); return }
      const json = await res.json()
      setResult(json.ok ? json.result : null)
    } catch { setResult(null) }
    finally { setLoading(false) }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => {})

  return (
    <section className="drawer-section copilot-section">
      <div className="drawer-section-title">
        AI Copilot <span className="ai-draft-badge">draft</span>
      </div>

      <div className="copilot-tools">
        {(Object.keys(TOOL_LABELS) as Tool[]).map(t => (
          <button key={t} className={`copilot-tool-btn ${active === t ? 'active' : ''}`} onClick={() => run(t)} disabled={loading}>
            {loading && active === t ? '⟳' : '✦'} {TOOL_LABELS[t]}
          </button>
        ))}
      </div>

      {authPrompt && (
        <div className="copilot-msg copilot-msg-auth">
          AI Copilot is available in signed-in beta.
        </div>
      )}

      {loading && <div className="copilot-skeleton" />}

      {result && !loading && (
        <div className="copilot-output">
          <div className="copilot-output-head">
            <span className={`ai-source-badge ${result.aiGenerated ? 'ai-live' : 'ai-fallback'}`}>
              {result.aiGenerated ? 'AI draft' : 'Deterministic draft'}
            </span>
            <span className="ai-conf">confidence: {String(result.confidence || 'low')}</span>
          </div>

          <p className="copilot-summary">{String(result.summary || '')}</p>

          {/* Project fit score */}
          {active === 'project-fit' && typeof result.fitScore === 'number' && (
            <div className="copilot-fit">
              <span className="copilot-fit-score">{result.fitScore}</span>
              <span className="copilot-fit-label">/100 project-fit · must-have {String(result.mustHaveMatch)}%</span>
            </div>
          )}

          {/* HM pitch */}
          {active === 'hm-pitch' && typeof result.pitch === 'string' && (
            <div className="copilot-block">
              <p>{result.pitch}</p>
              <button className="copilot-copy" onClick={() => copy(String(result.pitch))}>Copy pitch</button>
            </div>
          )}

          {/* Outreach */}
          {active === 'outreach-angle' && (
            <div className="copilot-block">
              {typeof result.linkedinOpener === 'string' && <p><strong>LinkedIn:</strong> {result.linkedinOpener}</p>}
              {typeof result.emailOpener === 'string' && <p><strong>Email:</strong> {result.emailOpener}</p>}
              <button className="copilot-copy" onClick={() => copy(`${result.linkedinOpener}\n\n${result.emailOpener}`)}>Copy openers</button>
            </div>
          )}

          {/* Summary bullets */}
          {active === 'candidate-summary' && Array.isArray(result.whyMatched) && (
            <ul className="copilot-list">
              {(result.whyMatched as string[]).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}

          {/* Missing info + verification — always shown */}
          {Array.isArray(result.missingInfo) && (result.missingInfo as string[]).length > 0 && (
            <div className="copilot-meta">
              <span className="copilot-meta-label">Missing / verify:</span>{' '}
              {(result.missingInfo as string[]).join(' · ')}
            </div>
          )}

          {Array.isArray(result.warnings) && (
            <div className="copilot-warning">
              {(result.warnings as string[]).slice(0, 2).join(' ')}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
