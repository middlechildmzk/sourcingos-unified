import type { RoleWorkspace } from './role-workspace'
import { pendingInsightCount } from './calibration-intelligence'

// The Today decision inbox: one ranked recruiter action feed across all roles.
//
// Rules:
// - Deterministic: same workspaces always produce the same feed in the same order.
// - Every item says why it matters, its impact, its effort, and the recommended
//   action, in human-readable language. No raw JSON.
// - The feed never acts on its own. Items deep-link into the canonical surface
//   (Roles tabs) where the recruiter makes the actual decision.

export type TodayItemKind =
  | 'evidence_conflict'
  | 'candidate_decision'
  | 'calibration_approval'
  | 'lane_approval'
  | 'stale_evidence'
  | 'role_blocker'

export type TodayImpact = 'high' | 'medium' | 'low'
export type TodayEffort = 'quick' | 'moderate' | 'deep'

export type TodayItem = {
  id: string
  kind: TodayItemKind
  roleId: string
  roleTitle: string
  title: string
  whyItMatters: string
  impact: TodayImpact
  effort: TodayEffort
  recommendedAction: string
  evidence: string
  aging: string
  href: string
  count: number
}

const KIND_PRIORITY: Record<TodayItemKind, number> = {
  evidence_conflict: 0,
  role_blocker: 1,
  calibration_approval: 2,
  candidate_decision: 3,
  lane_approval: 4,
  stale_evidence: 5,
}

export const TODAY_KIND_LABELS: Record<TodayItemKind, string> = {
  evidence_conflict: 'Evidence conflicts',
  role_blocker: 'Role blockers',
  calibration_approval: 'Calibration approvals',
  candidate_decision: 'Candidate decisions',
  lane_approval: 'Search lane approvals',
  stale_evidence: 'Stale evidence',
}

function daysSince(iso: string, now: Date): number {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return 0
  return Math.max(0, Math.floor((now.getTime() - then) / 86400000))
}

function agingLabel(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return '1 day old'
  return `${days} days old`
}

function oldestDays(isoDates: string[], now: Date): number {
  return isoDates.reduce((max, iso) => Math.max(max, daysSince(iso, now)), 0)
}

export function buildTodayInbox(roles: RoleWorkspace[], now = new Date()): TodayItem[] {
  const items: TodayItem[] = []

  for (const role of roles) {
    if (role.status === 'closed') continue
    const title = role.intake.title || 'Untitled role'

    const conflicts = role.candidates.filter(candidate => candidate.evidenceStatus === 'conflicting')
    if (conflicts.length) {
      const days = oldestDays(conflicts.map(candidate => candidate.updatedAt), now)
      items.push({
        id: `${role.id}:evidence_conflict`,
        kind: 'evidence_conflict',
        roleId: role.id,
        roleTitle: title,
        title: `${conflicts.length} candidate${conflicts.length === 1 ? ' has' : 's have'} conflicting evidence`,
        whyItMatters: 'Decisions made on conflicting evidence can misrepresent candidates to the hiring manager.',
        impact: 'high',
        effort: conflicts.length > 3 ? 'deep' : 'moderate',
        recommendedAction: 'Resolve each conflict before advancing or presenting these candidates.',
        evidence: conflicts.slice(0, 3).map(candidate => candidate.name).join(', ') + (conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ''),
        aging: agingLabel(days),
        href: `/app/roles/${role.id}?tab=candidates`,
        count: conflicts.length,
      })
    }

    const pendingInsights = pendingInsightCount(role.calibration)
    if (pendingInsights) {
      items.push({
        id: `${role.id}:calibration_approval`,
        kind: 'calibration_approval',
        roleId: role.id,
        roleTitle: title,
        title: `${pendingInsights} learned pattern${pendingInsights === 1 ? '' : 's'} awaiting your review`,
        whyItMatters: 'Approved learning sharpens ranking and search lanes. Unreviewed patterns change nothing.',
        impact: 'medium',
        effort: 'quick',
        recommendedAction: 'Approve, edit, or reject each pattern so the search can learn from your decisions.',
        evidence: (role.calibration?.insights || []).filter(insight => insight.status === 'proposed').slice(0, 2).map(insight => insight.subject).join(', '),
        aging: agingLabel(oldestDays((role.calibration?.insights || []).filter(insight => insight.status === 'proposed').map(insight => insight.derivedAt), now)),
        href: `/app/roles/${role.id}?tab=calibration`,
        count: pendingInsights,
      })
    }

    const unreviewed = role.candidates.filter(candidate => candidate.fitDecision === 'unreviewed')
    if (unreviewed.length) {
      const days = oldestDays(unreviewed.map(candidate => candidate.addedAt), now)
      items.push({
        id: `${role.id}:candidate_decision`,
        kind: 'candidate_decision',
        roleId: role.id,
        roleTitle: title,
        title: `${unreviewed.length} candidate${unreviewed.length === 1 ? '' : 's'} waiting for a fit decision`,
        whyItMatters: 'Undecided candidates stall the pipeline and delay hiring-manager updates.',
        impact: unreviewed.length >= 5 ? 'high' : 'medium',
        effort: unreviewed.length > 8 ? 'deep' : 'moderate',
        recommendedAction: 'Work the review queue; keyboard decisions make this fast.',
        evidence: unreviewed.slice(0, 3).map(candidate => candidate.name).join(', ') + (unreviewed.length > 3 ? ` and ${unreviewed.length - 3} more` : ''),
        aging: agingLabel(days),
        href: `/app/roles/${role.id}?tab=candidates`,
        count: unreviewed.length,
      })
    }

    const proposedLanes = role.searchLanes.filter(lane => lane.status === 'proposed')
    if (proposedLanes.length) {
      items.push({
        id: `${role.id}:lane_approval`,
        kind: 'lane_approval',
        roleId: role.id,
        roleTitle: title,
        title: `${proposedLanes.length} search lane${proposedLanes.length === 1 ? '' : 's'} proposed and unapproved`,
        whyItMatters: 'Unapproved lanes are not being worked, which narrows source coverage.',
        impact: 'medium',
        effort: 'quick',
        recommendedAction: 'Approve or pause each lane in the strategy tab.',
        evidence: proposedLanes.slice(0, 3).map(lane => lane.label).join(', '),
        aging: agingLabel(daysSince(role.updatedAt, now)),
        href: `/app/roles/${role.id}?tab=strategy`,
        count: proposedLanes.length,
      })
    }

    const stale = role.candidates.filter(candidate => candidate.evidenceStatus === 'stale')
    if (stale.length) {
      items.push({
        id: `${role.id}:stale_evidence`,
        kind: 'stale_evidence',
        roleId: role.id,
        roleTitle: title,
        title: `${stale.length} candidate${stale.length === 1 ? ' has' : 's have'} stale evidence`,
        whyItMatters: 'A stale fact is not current evidence. Refresh before relying on it.',
        impact: 'low',
        effort: 'moderate',
        recommendedAction: 'Re-verify the underlying sources or mark what is unknown.',
        evidence: stale.slice(0, 3).map(candidate => candidate.name).join(', '),
        aging: agingLabel(oldestDays(stale.map(candidate => candidate.updatedAt), now)),
        href: `/app/roles/${role.id}?tab=candidates`,
        count: stale.length,
      })
    }

    const hasApprovedLane = role.searchLanes.some(lane => lane.status === 'approved')
    if (!hasApprovedLane && (role.status === 'active' || role.status === 'calibrating')) {
      items.push({
        id: `${role.id}:role_blocker`,
        kind: 'role_blocker',
        roleId: role.id,
        roleTitle: title,
        title: 'No approved search lane',
        whyItMatters: 'Without an approved lane this role has no sanctioned search motion.',
        impact: 'high',
        effort: 'quick',
        recommendedAction: 'Open the strategy tab and approve at least one lane.',
        evidence: role.searchLanes.length ? `${role.searchLanes.length} lane${role.searchLanes.length === 1 ? '' : 's'} drafted, none approved` : 'No lanes drafted yet',
        aging: agingLabel(daysSince(role.updatedAt, now)),
        href: `/app/roles/${role.id}?tab=strategy`,
        count: 1,
      })
    }
  }

  return items.sort((a, b) =>
    KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind] ||
    b.count - a.count ||
    a.roleTitle.localeCompare(b.roleTitle) ||
    a.id.localeCompare(b.id)
  )
}

export function todayInboxSummary(items: TodayItem[]): string {
  if (!items.length) return 'No decisions are waiting. Your searches are current.'
  const high = items.filter(item => item.impact === 'high').length
  return `${items.length} decision${items.length === 1 ? '' : 's'} waiting${high ? `, ${high} high impact` : ''}.`
}
