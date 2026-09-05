'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { insightDisplayStatement } from '@/lib/calibration-intelligence'
import { roleMetrics, type RoleActivity, type RoleWorkspace } from '@/lib/role-workspace'

type AttentionItem = {
  id: string
  roleId: string
  title: string
  detail: string
  href: string
  priority: number
  updatedAt: string
}

type ActivityItem = RoleActivity & { roleId: string; roleTitle: string }

function activeBrief(role: RoleWorkspace) {
  const versions = role.roleBriefVersions || []
  return versions.find(version => version.id === role.activeRoleBriefVersionId) || versions.at(-1)
}

function attentionFor(role: RoleWorkspace): AttentionItem[] {
  if (role.status === 'closed') return []
  const metrics = roleMetrics(role)
  const items: AttentionItem[] = []
  const brief = activeBrief(role)
  const pendingLearning = role.calibration?.insights.filter(insight => insight.status === 'proposed').length || 0
  const proposedAngles = role.searchLanes.filter(lane => lane.status === 'proposed').length

  if (brief?.status === 'draft') {
    items.push({
      id: `${role.id}-brief`, roleId: role.id, title: `${role.intake.title}: Role Brief v${brief.version} is waiting`,
      detail: 'A draft exists, but the approved search has not changed.', href: `/app/roles/${role.id}`, priority: 0, updatedAt: role.updatedAt,
    })
  }
  if (pendingLearning) {
    items.push({
      id: `${role.id}-learning`, roleId: role.id, title: `${role.intake.title}: ${pendingLearning} learning proposal${pendingLearning === 1 ? '' : 's'}`,
      detail: 'SourcingOS found a pattern in recruiter decisions. Review it before it can influence search recommendations.',
      href: `/app/roles/${role.id}?tab=calibration`, priority: 1, updatedAt: role.updatedAt,
    })
  }
  if (metrics.conflicts) {
    items.push({
      id: `${role.id}-conflicts`, roleId: role.id, title: `${role.intake.title}: ${metrics.conflicts} evidence conflict${metrics.conflicts === 1 ? '' : 's'}`,
      detail: 'Contradictory candidate evidence needs human review; calibration cannot resolve it.', href: `/app/roles/${role.id}`, priority: 2, updatedAt: role.updatedAt,
    })
  }
  if (metrics.needsReview) {
    items.push({
      id: `${role.id}-review`, roleId: role.id, title: `${role.intake.title}: ${metrics.needsReview} candidate${metrics.needsReview === 1 ? '' : 's'} waiting`,
      detail: 'Review the unreviewed slate so the search can learn from explicit recruiter decisions.', href: `/app/roles/${role.id}`, priority: 3, updatedAt: role.updatedAt,
    })
  }
  if (proposedAngles && !brief?.status?.includes('draft')) {
    items.push({
      id: `${role.id}-angles`, roleId: role.id, title: `${role.intake.title}: ${proposedAngles} proposed search angle${proposedAngles === 1 ? '' : 's'}`,
      detail: 'Search-plan changes are staged until a recruiter approves the angles to run.', href: `/app/roles/${role.id}?tab=strategy`, priority: 4, updatedAt: role.updatedAt,
    })
  }
  if (role.status === 'active' && !metrics.candidateCount) {
    items.push({
      id: `${role.id}-empty`, roleId: role.id, title: `${role.intake.title}: no review slate yet`,
      detail: 'Continue the approved sourcing pass or inspect source availability if the pool remains empty.', href: `/app/roles/${role.id}`, priority: 5, updatedAt: role.updatedAt,
    })
  }
  return items
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'recently'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function RolePortfolioIntelligenceV33_4({ roles }: { roles: RoleWorkspace[] }) {
  const attention = useMemo(() => roles.flatMap(attentionFor)
    .sort((a, b) => a.priority - b.priority || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6), [roles])

  const changes = useMemo<ActivityItem[]>(() => roles.flatMap(role => role.activity.slice(0, 12).map(activity => ({
    ...activity, roleId: role.id, roleTitle: role.intake.title,
  }))).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5), [roles])

  const approvedLearning = useMemo(() => roles.flatMap(role => (role.calibration?.insights || [])
    .filter(insight => insight.status === 'approved' || insight.status === 'edited')
    .map(insight => ({ role, insight })))
    .sort((a, b) => Date.parse(b.insight.updatedAt) - Date.parse(a.insight.updatedAt)).slice(0, 4), [roles])

  return <section className="role-sourcing-desk-v33-4" aria-label="Sourcing desk">
    <div className="role-sourcing-desk-head-v33-4">
      <div><span className="kicker">Sourcing desk</span><h2>What needs your attention</h2><p>One view of decisions, changes, and recruiter-approved learning across your searches.</p></div>
      <span className={attention.length ? 'status-pill warning' : 'status-pill success'}>{attention.length ? `${attention.length} priority item${attention.length === 1 ? '' : 's'}` : 'clear'}</span>
    </div>

    <div className="role-sourcing-desk-grid-v33-4">
      <section>
        <div className="role-sourcing-desk-section-head-v33-4"><b>Attention</b><span>What to do next</span></div>
        <div className="role-sourcing-desk-list-v33-4">
          {attention.map(item => <Link href={item.href} key={item.id}><i /><span><b>{item.title}</b><small>{item.detail}</small></span><em>Open →</em></Link>)}
          {!attention.length && <div className="role-sourcing-desk-empty-v33-4"><b>No urgent review blockers</b><span>Active searches have no visible draft, calibration, conflict, or review queue requiring action.</span></div>}
        </div>
      </section>

      <section>
        <div className="role-sourcing-desk-section-head-v33-4"><b>What changed</b><span>Recent role activity</span></div>
        <div className="role-sourcing-desk-list-v33-4 compact">
          {changes.map(change => <Link href={`/app/roles/${change.roleId}`} key={`${change.roleId}-${change.id}`}><i /><span><b>{change.roleTitle}</b><small>{change.message}</small><em>{formatWhen(change.createdAt)}</em></span></Link>)}
          {!changes.length && <div className="role-sourcing-desk-empty-v33-4"><b>No changes yet</b><span>Search runs, candidate reviews, and Role Brief decisions will appear here.</span></div>}
        </div>
      </section>

      <section>
        <div className="role-sourcing-desk-section-head-v33-4"><b>Approved learning</b><span>Institutional search memory</span></div>
        <div className="role-sourcing-desk-list-v33-4 compact">
          {approvedLearning.map(({ role, insight }) => <Link href={`/app/roles/${role.id}?tab=calibration`} key={`${role.id}-${insight.id}`}><i className="learned" /><span><b>{role.intake.title}</b><small>{insightDisplayStatement(insight)}</small><em>{insight.confidence} · {insight.supportingCandidateIds.length} supporting decision{insight.supportingCandidateIds.length === 1 ? '' : 's'}</em></span></Link>)}
          {!approvedLearning.length && <div className="role-sourcing-desk-empty-v33-4"><b>No approved patterns yet</b><span>Review candidates first. SourcingOS proposes patterns from decisions, but nothing becomes learning silently.</span></div>}
        </div>
      </section>
    </div>
  </section>
}
