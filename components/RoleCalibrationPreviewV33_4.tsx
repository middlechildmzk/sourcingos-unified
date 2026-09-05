'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  applyInsightAction,
  recommendLaneChanges,
  type CalibrationInsight,
} from '@/lib/calibration-intelligence'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function predictedChange(role: NonNullable<ReturnType<typeof roleFor>>, insight: CalibrationInsight): string {
  const state = role.calibration
  if (!state) return 'No search change is authorized by this pattern.'
  const hypothetical = applyInsightAction(state, insight.id, 'approve', {}, state.updatedAt || new Date().toISOString())
  if (hypothetical.error) return 'No search change is authorized by this pattern.'
  const recommendations = recommendLaneChanges(role.searchLanes, hypothetical.state)
  const linked = recommendations.filter(item => item.causedByInsightIds.includes(insight.id))
  if (!linked.length) return 'Approval records this as recruiter-approved role learning. No current search angle would change automatically.'
  return `If approved, SourcingOS would recommend: ${linked.slice(0, 2).map(item => `${item.laneLabel} — ${item.explanation}`).join(' ')}`
}

function roleFor(roles: ReturnType<typeof useRoleWorkspaces>['roles'], roleId: string) {
  return roles.find(role => role.id === roleId)
}

export function RoleCalibrationPreviewV33_4({ roleId }: { roleId: string }) {
  const { roles, updateRole } = useRoleWorkspaces()
  const [notice, setNotice] = useState('')
  const role = useMemo(() => roleFor(roles, roleId), [roleId, roles])
  const proposed = useMemo(() => role?.calibration?.insights.filter(insight => insight.status === 'proposed') || [], [role?.calibration])
  const insight = proposed[0]

  if (!role || !insight) return notice ? <div className="role-learning-notice-v33-4" role="status">{notice}</div> : null

  const prediction = predictedChange(role, insight)

  function review(action: 'approve' | 'reject') {
    updateRole(roleId, workspace => {
      if (!workspace.calibration) return workspace
      const result = applyInsightAction(workspace.calibration, insight.id, action)
      if (result.error) { setNotice(result.error); return workspace }
      setNotice(action === 'approve'
        ? 'Learning approved. Any resulting search-angle recommendation still requires recruiter action.'
        : 'Learning rejected. It will not influence search recommendations.')
      return { ...workspace, calibration: result.state, updatedAt: new Date().toISOString() }
    })
  }

  return <section className="role-learning-preview-v33-4" aria-label="Proposed calibration learning">
    <div className="role-learning-preview-mark-v33-4">↻</div>
    <div className="role-learning-preview-copy-v33-4">
      <div className="role-learning-preview-title-v33-4"><span className="kicker">SourcingOS noticed a pattern</span><span>{insight.confidence} confidence · {insight.supportingCandidateIds.length} supporting decision{insight.supportingCandidateIds.length === 1 ? '' : 's'}{insight.contradictingCandidateIds.length ? ` · ${insight.contradictingCandidateIds.length} contradiction${insight.contradictingCandidateIds.length === 1 ? '' : 's'}` : ''}</span></div>
      <b>{insight.statement}</b>
      {insight.contradictionNote && <p>Counter-signal: {insight.contradictionNote}</p>}
      <small>{prediction}</small>
      <small className="role-learning-preview-boundary-v33-4">This is a pattern in recruiter decisions, not candidate evidence. Nothing changes until you approve it, and search angles remain separately approval-gated.</small>
    </div>
    <div className="role-learning-preview-actions-v33-4">
      <button className="btn" onClick={() => review('approve')}>Approve learning</button>
      <button className="btn ghost" onClick={() => review('reject')}>Not a pattern</button>
      <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(roleId)}?tab=calibration`}>Review evidence{proposed.length > 1 ? ` · +${proposed.length - 1}` : ''}</Link>
    </div>
  </section>
}
