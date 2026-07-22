'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoleWorkspace } from '@/lib/role-workspace'
import {
  applyInsightAction,
  insightDisplayStatement,
  pendingInsightCount,
  rankCandidatesWithCalibration,
  recommendLaneChanges,
  reconcileCalibrationState,
  type CalibrationInsight,
  type InsightAction,
  type InsightScope,
} from '@/lib/calibration-intelligence'
import { candidateReviewScore } from '@/components/CandidateReviewPro'

function words(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}

function statusPillClass(status: CalibrationInsight['status']): string {
  if (status === 'approved' || status === 'edited') return 'status-pill success'
  if (status === 'proposed') return 'status-pill warning'
  if (status === 'paused') return 'status-pill active'
  return 'status-pill'
}

function calibrationFingerprint(state: RoleWorkspace['calibration']): string {
  if (!state) return 'none'
  return JSON.stringify({ insights: state.insights, eventCount: state.events.length })
}

export function RoleCalibrationPanel({
  role,
  onUpdate,
  onOpenStrategy,
  onOpenCandidate,
}: {
  role: RoleWorkspace
  onUpdate: (updater: (workspace: RoleWorkspace) => RoleWorkspace) => void
  onOpenStrategy: () => void
  onOpenCandidate: (candidateId: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const reconciling = useRef(false)

  // Re-derive patterns whenever recorded decisions change. Reviewer decisions are
  // preserved by reconcileCalibrationState; we only persist when content changed,
  // so this cannot loop.
  const decisionsKey = useMemo(
    () => role.candidates.map(candidate => `${candidate.id}:${candidate.fitDecision}:${candidate.evidenceStatus}:${candidate.concerns.length}:${candidate.fitReasons.length}`).join('|'),
    [role.candidates]
  )
  useEffect(() => {
    if (reconciling.current) return
    const next = reconcileCalibrationState(role, role.calibration)
    if (calibrationFingerprint(next) === calibrationFingerprint(role.calibration)) return
    reconciling.current = true
    onUpdate(workspace => ({ ...workspace, calibration: reconcileCalibrationState(workspace, workspace.calibration) }))
    setTimeout(() => { reconciling.current = false }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionsKey])

  const state = role.calibration
  const insights = state?.insights || []
  const pending = pendingInsightCount(state)
  const candidateById = useMemo(() => new Map(role.candidates.map(candidate => [candidate.id, candidate])), [role.candidates])

  const ranking = useMemo(
    () => rankCandidatesWithCalibration(role.candidates, candidate => candidateReviewScore(candidate, role.intake), state),
    [role.candidates, role.intake, state]
  )
  const laneRecommendations = useMemo(() => recommendLaneChanges(role.searchLanes, state), [role.searchLanes, state])
  const timeline = useMemo(() => [...(state?.events || [])].reverse().slice(0, 40), [state])

  function review(insightId: string, action: InsightAction, options: { editedStatement?: string; scope?: InsightScope } = {}) {
    onUpdate(workspace => {
      const current = workspace.calibration || reconcileCalibrationState(workspace, undefined)
      const result = applyInsightAction(current, insightId, action, options)
      if (result.error) {
        setNotice(result.error)
        return workspace
      }
      setNotice(result.event?.message || '')
      return { ...workspace, calibration: result.state, updatedAt: new Date().toISOString() }
    })
    setEditingId(null)
  }

  function candidateNames(ids: string[]): { id: string; name: string }[] {
    return ids.map(id => ({ id, name: candidateById.get(id)?.name || 'Removed candidate' }))
  }

  return (
    <div className="role-section-stack">
      <section className="product-panel">
        <div className="product-panel-head">
          <div>
            <span className="kicker">Calibration learning</span>
            <h2>What SourcingOS learned from your decisions</h2>
          </div>
          <span className={pending ? 'status-pill warning' : 'status-pill success'}>{pending ? `${pending} awaiting your review` : 'reviewed'}</span>
        </div>
        <p className="muted normal-wrap">
          These are patterns detected in your recorded candidate decisions. They are not verified facts, and none of them
          changes ranking or search strategy until you approve it. Approve, edit, reject, or pause each one; every action
          can be rolled back.
        </p>
        {notice && <p className="muted normal-wrap" role="status">{notice}</p>}
        <div className="product-list">
          {insights.map(insight => {
            const supporting = candidateNames(insight.supportingCandidateIds)
            const contradicting = candidateNames(insight.contradictingCandidateIds)
            const expanded = expandedId === insight.id
            return (
              <div className="product-row" key={insight.id}>
                <div className="product-row-main">
                  <div className="product-row-title normal-wrap">{insightDisplayStatement(insight)}</div>
                  <div className="product-row-meta normal-wrap">
                    {words(insight.evidenceClass)} · {insight.confidence} confidence · scope: {insight.scope === 'role' ? 'this role only' : 'organizational preference'} · updated {formatDate(insight.updatedAt)}
                  </div>
                  <div className="product-row-meta normal-wrap">
                    Built from {supporting.length} supporting decision{supporting.length === 1 ? '' : 's'}
                    {contradicting.length ? ` and ${contradicting.length} contradicting decision${contradicting.length === 1 ? '' : 's'}` : ''}.
                    {' '}
                    <button className="btn ghost" onClick={() => setExpandedId(expanded ? null : insight.id)} aria-expanded={expanded} aria-label={`Show evidence for ${insight.subject}`}>
                      {expanded ? 'Hide evidence' : 'View evidence'}
                    </button>
                  </div>
                  {insight.contradictionNote && <div className="product-row-meta normal-wrap">Contradiction: {insight.contradictionNote}</div>}
                  {expanded && (
                    <div className="product-row-meta normal-wrap">
                      <div><b>Supporting:</b> {supporting.length ? supporting.map(item => (
                        <button key={item.id} className="btn ghost" onClick={() => onOpenCandidate(item.id)} aria-label={`Open ${item.name}`}>{item.name}</button>
                      )) : 'None recorded'}</div>
                      <div><b>Contradicting:</b> {contradicting.length ? contradicting.map(item => (
                        <button key={item.id} className="btn ghost" onClick={() => onOpenCandidate(item.id)} aria-label={`Open ${item.name}`}>{item.name}</button>
                      )) : 'None recorded'}</div>
                    </div>
                  )}
                  {editingId === insight.id && (
                    <div className="product-row-meta">
                      <label htmlFor={`edit-${insight.id}`} className="kicker">Recruiter wording</label>
                      <textarea
                        id={`edit-${insight.id}`}
                        value={editText}
                        onChange={event => setEditText(event.target.value)}
                        rows={2}
                        style={{ width: '100%' }}
                      />
                      <div className="button-row">
                        <button className="btn" onClick={() => review(insight.id, 'edit', { editedStatement: editText })}>Save edited insight</button>
                        <button className="btn ghost" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="button-row role-panel-actions">
                    {insight.status !== 'approved' && insight.status !== 'edited' && (
                      <button className="btn" onClick={() => review(insight.id, 'approve')} aria-label={`Approve insight about ${insight.subject}`}>Approve</button>
                    )}
                    <button className="btn secondary" onClick={() => { setEditingId(insight.id); setEditText(insightDisplayStatement(insight)) }}>Edit</button>
                    {insight.status !== 'rejected' && (
                      <button className="btn secondary" onClick={() => review(insight.id, 'reject')} aria-label={`Reject insight about ${insight.subject}`}>Reject</button>
                    )}
                    {insight.status !== 'paused' && insight.status !== 'rejected' && (
                      <button className="btn ghost" onClick={() => review(insight.id, 'pause')}>Pause</button>
                    )}
                    <button
                      className="btn ghost"
                      onClick={() => review(insight.id, 'set_scope', { scope: insight.scope === 'role' ? 'organization' : 'role' })}
                    >
                      {insight.scope === 'role' ? 'Save as org preference' : 'Scope to this role'}
                    </button>
                    {(insight.status !== 'proposed') && (
                      <button className="btn ghost" onClick={() => review(insight.id, 'rollback')} aria-label={`Roll back review of ${insight.subject}`}>Roll back</button>
                    )}
                  </div>
                </div>
                <span className={statusPillClass(insight.status)}>{insight.status}</span>
              </div>
            )
          })}
          {!insights.length && (
            <div className="product-row">
              <div className="product-row-main">
                <div className="product-row-title">No learned patterns yet</div>
                <div className="product-row-meta normal-wrap">
                  Record at least two candidate decisions and SourcingOS will surface the patterns it sees for your review.
                  Nothing is learned silently.
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="product-panel">
        <div className="product-panel-head">
          <div>
            <span className="kicker">Before and after</span>
            <h2>How approved learning changes this search</h2>
          </div>
          <span>{ranking.changes.length} ranking change{ranking.changes.length === 1 ? '' : 's'}</span>
        </div>
        <div className="product-list">
          {ranking.changes.map(change => (
            <div className="product-row" key={change.candidateId}>
              <div className="product-row-main">
                <div className="product-row-title">{change.candidateName} moved {change.direction} ({change.delta > 0 ? '+' : ''}{change.delta})</div>
                <div className="product-row-meta normal-wrap">{change.explanation}</div>
              </div>
              <button className="btn ghost" onClick={() => onOpenCandidate(change.candidateId)} aria-label={`Open ${change.candidateName}`}>Open</button>
            </div>
          ))}
          {!ranking.changes.length && (
            <div className="product-row">
              <div className="product-row-main">
                <div className="product-row-meta normal-wrap">
                  No approved learning is adjusting candidate order right now. Review order still follows recorded role signals only.
                </div>
              </div>
            </div>
          )}
          {ranking.uncertain.length > 0 && (
            <div className="product-row">
              <div className="product-row-main">
                <div className="product-row-title">Still uncertain</div>
                <div className="product-row-meta normal-wrap">
                  {ranking.uncertain.length} candidate{ranking.uncertain.length === 1 ? ' has' : 's have'} conflicting or stale evidence. Learning does not resolve evidence; review it in the candidate queue.
                </div>
              </div>
              <span className="status-pill warning">evidence</span>
            </div>
          )}
        </div>
        {laneRecommendations.length > 0 && (
          <div className="product-list">
            {laneRecommendations.map(recommendation => (
              <div className="product-row" key={`${recommendation.laneId}-${recommendation.recommendation}`}>
                <div className="product-row-main">
                  <div className="product-row-title">{recommendation.laneLabel}: {words(recommendation.recommendation)}</div>
                  <div className="product-row-meta normal-wrap">{recommendation.explanation}</div>
                </div>
                <button className="btn secondary" onClick={onOpenStrategy}>Review in strategy</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="product-panel">
        <div className="product-panel-head">
          <div>
            <span className="kicker">Calibration history</span>
            <h2>Timeline</h2>
          </div>
          <span>{timeline.length} events</span>
        </div>
        <div className="product-list">
          {timeline.map(event => (
            <div className="product-row" key={event.id}>
              <div className="product-row-main">
                <div className="product-row-title">{words(event.type)}</div>
                <div className="product-row-meta normal-wrap">{event.message}</div>
              </div>
              <span className="status-pill">{formatDate(event.createdAt)}</span>
            </div>
          ))}
          {!timeline.length && (
            <div className="product-row">
              <div className="product-row-main">
                <div className="product-row-meta">Calibration events will appear here as patterns are detected and reviewed.</div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
