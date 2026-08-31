'use client'

import { useMemo, useState } from 'react'
import { useRoleIntelligenceV33 } from '@/components/RoleIntelligenceProviderV33'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function branchLabel(value: string): string {
  return value.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}

export function RoleMilitaryIntelligencePanel({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roles, roleId])
  const { military, militaryDrafts, militaryDataset, militaryGate, militaryApproved, loading, error } = useRoleIntelligenceV33()
  const [notice, setNotice] = useState('')

  if (!role || mode === 'checking' || !militaryGate?.enabled) return null
  const draft = militaryDrafts.find(item => item.id === 'military-occupation')
  const canApprove = Boolean(military?.applicable && draft && militaryDataset?.verified && !military.provisionalDataInUse)

  function setMilitaryStatus(status: 'approved' | 'paused') {
    if (status === 'approved' && !canApprove) {
      setNotice('Authoritative O*NET MOC data is required before this lane can enter the Search Plan.')
      return
    }
    if (!draft || !military) return

    updateRole(role.id, current => {
      const nextLane = {
        id: 'military_transition',
        label: 'Military occupation transition',
        purpose: `${military.reason} ${draft.blindSpot}`,
        query: draft.query,
        source: 'web_xray' as const,
        status,
      }
      const searchLanes = current.searchLanes.some(item => item.id === nextLane.id)
        ? current.searchLanes.map(item => item.id === nextLane.id ? nextLane : item)
        : [...current.searchLanes, nextLane]
      const now = new Date().toISOString()
      return {
        ...current,
        searchLanes,
        updatedAt: now,
        activity: [{
          id: crypto.randomUUID(),
          type: 'lane_approved' as const,
          message: `${status === 'approved' ? 'Approved' : 'Paused'} military occupation sourcing hypothesis. Occupation context remains non-qualifying candidate context.`,
          createdAt: now,
        }, ...current.activity],
      }
    })
    setNotice(status === 'approved' ? 'Verified military occupation hypothesis added to the canonical Search Plan.' : 'Military occupation hypothesis paused.')
  }

  return <section className="role-search-studio" aria-label="Military talent intelligence">
    <div className="role-search-studio-head">
      <div>
        <div className="role-search-eyebrow"><span>Military Talent Intelligence · V33.1</span>{militaryDataset?.verified ? <span className="status-pill success">Authoritative O*NET MOC</span> : <span className="status-pill warning">Provisional only</span>}</div>
        <h2>Translate military occupations into recruiter search context.</h2>
        <p>Occupation-level crosswalks can suggest where to look and what to verify. They never satisfy candidate requirements, verify clearance, or create a fit score.</p>
      </div>
      <div className="button-row">
        {militaryApproved ? <button className="btn ghost" onClick={() => setMilitaryStatus('paused')}>Pause military lane</button> : <button className="btn secondary" disabled={!canApprove || loading} onClick={() => setMilitaryStatus('approved')}>Approve into Search Plan</button>}
      </div>
    </div>

    <div className="agentic-source-status-row" aria-label="Military intelligence status">
      {militaryGate.reasons.map(reason => <span className="status-pill" key={reason}>{reason.replace(/\.$/, '')}</span>)}
      {militaryDataset && <span className={`status-pill ${militaryDataset.verified ? 'success' : 'warning'}`}>{militaryDataset.officialOccupationCount} official · {militaryDataset.provisionalOccupationCount} provisional</span>}
      {militaryApproved && <span className="status-pill active">Recruiter approved</span>}
    </div>

    {loading && <div className="cta">Loading O*NET role and military occupation intelligence…</div>}
    {error && <div className="cta"><b>Role intelligence unavailable.</b> {error}</div>}
    {!loading && military && !military.applicable && <div className="cta"><b>No military lane proposed.</b> {military.reason}</div>}

    {military?.applicable && <div className="agentic-plan-grid">
      <div className="agentic-lane-detail">
        <span className="kicker">Occupation hypotheses</span>
        <h3>{military.occupations.length} occupations worth exploring</h3>
        <p>{military.reason}</p>
        <div className="agentic-source-task-list">{military.occupations.slice(0, 8).map(item => <div className="agentic-source-task" key={`${item.branch}:${item.code}`}>
          <div><span className="agentic-mode-dot guided" /><div><b>{item.code} · {item.title}</b><small>{branchLabel(item.branch)} · {item.codeSystem} · {item.sharedCivilianOccupations.slice(0, 2).join(' · ') || 'O*NET civilian crosswalk'}</small><small>{item.rationale}</small></div></div>
          <span className={`status-pill ${item.provenance.verified ? 'success' : 'warning'}`}>{item.provenance.verified ? 'verified crosswalk' : 'provisional'}</span>
        </div>)}</div>
        {draft && <div className="agentic-query-box"><span>Proposed recruiter-run occupation query</span><code>{draft.query}</code></div>}
      </div>

      <aside className="agentic-run-card">
        <div><span className="kicker">Verification boundary</span><h3>Search hypothesis, not candidate qualification.</h3><p>Use the crosswalk to discover plausible military talent pools, then validate each person's actual work through the normal V32 evidence path.</p></div>
        <div><b>Ask candidates</b><ul>{military.verificationQuestions.map(question => <li key={question}>{question}</li>)}</ul></div>
        <div><b>Do not assume</b><ul>{military.doNotAssume.map(item => <li key={item}>{item}</li>)}</ul></div>
        <small className="agentic-run-trust">{military.attribution}</small>
      </aside>
    </div>}

    {militaryDataset && !militaryDataset.verified && <div className="agentic-warning-list"><span>⚠ Official O*NET MOC data could not be loaded. Provisional seed results are visible for debugging/exploration only and approval is disabled.</span>{militaryDataset.warnings.map(item => <span key={item}>⚠ {item}</span>)}</div>}
    {notice && <div className="cta role-search-status" role="status">{notice}</div>}
  </section>
}
