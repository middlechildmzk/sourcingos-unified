'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import type { AgenticSearchLane, AgenticSearchSurface } from '@/lib/agentic-search-v30'
import { buildSearchLanes } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

const CANONICAL_IDS = new Set(['exact_title', 'adjacent_title', 'skill_cluster', 'evidence_first', 'target_company', 'clearance_first'])
const GUIDED: Array<{ surface: AgenticSearchSurface; label: string; brand: string }> = [
  { surface: 'linkedin_recruiter', label: 'LinkedIn Recruiter', brand: 'in' },
  { surface: 'clearancejobs', label: 'ClearanceJobs / ATS', brand: 'C' },
  { surface: 'google_xray', label: 'Google X-Ray', brand: 'G' },
]

function taskFor(lane: AgenticSearchLane | undefined, surface: AgenticSearchSurface) {
  return lane?.tasks.find(task => task.surface === surface)
}

export function RoleCanonicalSearchActions({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roles, roleId])
  const [laneId, setLaneId] = useState('')
  const [notice, setNotice] = useState('')
  const baseline = useMemo(() => role ? buildCanonicalAgenticSearchPlan(role.intake) : null, [role])
  const plan = useMemo(() => role ? buildCanonicalAgenticSearchPlan(role.intake, role.calibration) : null, [role])
  const persisted = useMemo(() => role?.searchLanes.filter(lane => CANONICAL_IDS.has(lane.id)) || [], [role])
  const approved = useMemo(() => new Set(persisted.filter(lane => lane.status === 'approved').map(lane => lane.id)), [persisted])
  const lane = plan?.lanes.find(item => item.id === laneId) || plan?.lanes.find(item => approved.has(item.id)) || plan?.lanes[0]
  const baselineLane = baseline?.lanes.find(item => item.id === lane?.id)
  const legacyFallback = !persisted.length && lane?.id === 'exact_title'
  const isApproved = Boolean(lane && (approved.has(lane.id) || legacyFallback))

  if (!role || !plan || mode === 'checking') return null

  function setStatus(targetId: string, status: 'approved' | 'paused') {
    updateRole(role.id, current => {
      const previous = new Map(current.searchLanes.filter(item => CANONICAL_IDS.has(item.id)).map(item => [item.id, item.status]))
      const searchLanes = buildSearchLanes(current.intake).map(item => ({
        ...item,
        status: item.id === targetId ? status : previous.get(item.id) || item.status,
      }))
      const now = new Date().toISOString()
      return {
        ...current,
        searchLanes,
        updatedAt: now,
        activity: [{ id: crypto.randomUUID(), type: 'lane_approved' as const, message: `${status === 'approved' ? 'Approved' : 'Paused'} canonical search hypothesis: ${searchLanes.find(item => item.id === targetId)?.label || targetId}.`, createdAt: now }, ...current.activity],
      }
    })
    setNotice(status === 'approved' ? 'Hypothesis approved for this sourcing pass.' : 'Hypothesis paused for this sourcing pass.')
  }

  async function copy(label: string, query: string) {
    if (!isApproved) return setNotice('Approve this hypothesis before using its recruiter-run query.')
    try {
      await navigator.clipboard.writeText(query)
      setNotice(`${label} query copied from Search Plan v${plan.revision}. You still run the guided source in your authorized account.`)
    } catch {
      setNotice('Copy failed. Select the query and copy it manually.')
    }
  }

  return <section className="role-search-studio" aria-label="Canonical role search plan">
    <div className="role-search-studio-head">
      <div><div className="role-search-eyebrow"><span>One Search Brain</span><span className="status-pill active">Search Plan v{plan.revision}</span></div><h2>Source {role.intake.title} from one plan.</h2><p>Hypothesis, guided queries, executable sources, and calibration now share the same canonical lane IDs.</p></div>
      <Link className="btn role-search-primary-action" href={`/app/agentic-sourcing/${encodeURIComponent(role.id)}`}>Open supported-source run →</Link>
    </div>

    {!persisted.length && <div className="cta" style={{ marginBottom: 12 }}><b>Legacy role detected.</b> Approving a hypothesis below migrates its old source-lane state to canonical hypothesis IDs without changing candidates.</div>}

    <div className="role-guided-search-area">
      <div className="role-guided-search-head">
        <div><span className="kicker">Canonical sourcing hypothesis</span><h3>{lane?.label}</h3><p>{lane?.hypothesis}</p>{lane?.blindSpot && <small className="muted">Blind spot: {lane.blindSpot}</small>}</div>
        <div className="role-lane-switcher" role="group" aria-label="Canonical search hypothesis">{plan.lanes.map(item => <button key={item.id} className={lane?.id === item.id ? 'active' : ''} onClick={() => setLaneId(item.id)}>{item.label}</button>)}</div>
      </div>

      {lane && <div className="role-calibration-banner"><div><span className="role-calibration-spark">✦</span><div><b>{isApproved ? 'Approved hypothesis' : 'Awaiting recruiter approval'}</b><p>Calibration changes increment this same plan revision rather than creating a second guided plan.</p></div></div><div className="button-row">{!isApproved ? <button className="btn secondary" onClick={() => setStatus(lane.id, 'approved')}>Approve hypothesis</button> : <button className="btn ghost" onClick={() => setStatus(lane.id, 'paused')}>Pause hypothesis</button>}<Link className="btn ghost" href={`/app/roles/${encodeURIComponent(role.id)}?tab=calibration`}>Inspect learning</Link></div></div>}

      {lane && <div className="role-search-surface-grid">{GUIDED.map(meta => {
        const task = taskFor(lane, meta.surface)
        if (!task) return null
        const before = taskFor(baselineLane, meta.surface)
        const changed = Boolean(before && before.query !== task.query)
        return <article className="search-surface-card" key={meta.surface}>
          <div className="search-surface-card-head"><div><span className={`search-surface-brand ${meta.surface === 'linkedin_recruiter' ? 'linkedin' : meta.surface === 'clearancejobs' ? 'clearance' : 'google'}`}>{meta.brand}</span><div><b>{meta.label}</b><small>{task.mode === 'guided' ? 'Guided · recruiter-run' : task.mode}</small></div></div><span className="status-pill">{task.mode}</span></div>
          <textarea className="input search-query-box" rows={5} readOnly value={task.query} />
          <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>{task.truth}</p>
          <div className="button-row"><button className="btn secondary" disabled={!isApproved} onClick={() => void copy(meta.label, task.query)}>Copy query</button>{meta.surface === 'google_xray' && isApproved && <a className="btn ghost" href={`https://www.google.com/search?q=${encodeURIComponent(task.query)}`} target="_blank" rel="noreferrer noopener">Open Google ↗</a>}</div>
          {changed && before && <details className="advanced-disclosure"><summary>What approved learning changed</summary><small>Baseline</small><code>{before.query}</code><small>Search Plan v{plan.revision}</small><code>{task.query}</code></details>}
        </article>
      })}</div>}

      {!!plan.integrityWarnings.length && <div className="role-search-verify"><b>Plan integrity</b><span>{plan.integrityWarnings.join(' ')}</span></div>}
    </div>
    {notice && <div className="cta role-search-status" role="status">{notice}</div>}
  </section>
}
