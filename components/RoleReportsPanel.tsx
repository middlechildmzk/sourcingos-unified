'use client'

import { useState } from 'react'
import type { RoleWorkspace } from '@/lib/role-workspace'
import { HM_OUTPUTS, type HmOutputKind } from '@/lib/hm-outputs'

export function RoleReportsPanel({ role }: { role: RoleWorkspace }) {
  const [openKind, setOpenKind] = useState<HmOutputKind | null>(null)
  const [copied, setCopied] = useState('')

  const active = HM_OUTPUTS.find(output => output.kind === openKind)
  const content = active ? active.build(role) : ''

  async function copy() {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied('Copied. Paste into email, Teams, or a doc.')
      window.setTimeout(() => setCopied(''), 4000)
    } catch {
      setCopied('Copy failed. Select the text below and copy manually.')
    }
  }

  return (
    <section className="product-panel">
      <div className="product-panel-head">
        <div>
          <span className="kicker">Hiring manager outputs</span>
          <h2>Reports ready to copy</h2>
        </div>
        <span>{HM_OUTPUTS.length} formats</span>
      </div>
      <p className="muted normal-wrap">
        Every report labels recorded signals, unknowns, stale evidence, and conflicts honestly, and never asserts a
        candidate&apos;s clearance from public text.
      </p>
      <div className="button-row role-panel-actions">
        {HM_OUTPUTS.map(output => (
          <button
            key={output.kind}
            className={openKind === output.kind ? 'btn' : 'btn secondary'}
            onClick={() => setOpenKind(openKind === output.kind ? null : output.kind)}
            aria-pressed={openKind === output.kind}
            aria-label={`${output.label}: ${output.description}`}
          >
            {output.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="product-row-main">
          <div className="button-row role-panel-actions">
            <button className="btn" onClick={copy} aria-label={`Copy ${active.label}`}>Copy {active.label.toLowerCase()}</button>
            {copied && <span className="status-pill success" role="status">{copied}</span>}
          </div>
          <textarea
            readOnly
            value={content}
            rows={16}
            style={{ width: '100%' }}
            aria-label={`${active.label} content`}
            onFocus={event => event.currentTarget.select()}
          />
        </div>
      )}
    </section>
  )
}
