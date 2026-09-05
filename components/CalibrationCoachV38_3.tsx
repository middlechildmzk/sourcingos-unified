'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { activeInsights, applyInsightAction, insightDisplayStatement, pendingInsightCount, recommendLaneChanges } from '@/lib/calibration-intelligence'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import type { RoleCandidate } from '@/lib/role-workspace'
import styles from './CalibrationCoachV38_3.module.css'

const positiveReasons = [
  'Strong hands-on technical depth',
  'Relevant title and scope',
  'Strong adjacent background',
  'Target-company experience',
  'Location aligns',
  'Clearance evidence aligns',
]

const negativeReasons = [
  'Missing must-have evidence',
  'Wrong technical depth',
  'Title/background mismatch',
  'Location mismatch',
  'Clearance not evidenced',
  'Too senior for this role',
  'Too junior for this role',
  'Industry/background mismatch',
]

function calibrationSearchQuery(role: ReturnType<typeof useRoleWorkspaces>['roles'][number]) {
  const approved = activeInsights(role.calibration)
  const prioritize = approved.filter(item => !['disqualifier_pattern', 'evidence_hygiene'].includes(item.evidenceClass)).map(item => item.subject)
  const avoid = approved.filter(item => item.evidenceClass === 'disqualifier_pattern').map(item => item.subject)
  return [
    role.intake.title,
    role.intake.mustHaves.length ? `must have ${role.intake.mustHaves.join(', ')}` : '',
    role.intake.location !== 'Not specified' ? `in or near ${role.intake.location}` : '',
    role.intake.clearance !== 'Not specified' ? `${role.intake.clearance} clearance` : '',
    prioritize.length ? `based on approved recruiter calibration prioritize ${prioritize.join(', ')}` : '',
    avoid.length ? `avoid ${avoid.join(', ')}` : '',
  ].filter(Boolean).join(' · ')
}

function decisionLabel(candidate: RoleCandidate) {
  if (candidate.fitDecision === 'strong_fit') return 'Yes · strong fit'
  if (candidate.fitDecision === 'possible_fit') return 'Maybe'
  if (candidate.fitDecision === 'not_fit') return 'No'
  return 'Unreviewed'
}

export function CalibrationCoachV38_3({ roleId }: { roleId?: string }) {
  const { roles, updateRole } = useRoleWorkspaces()
  const role = roleId ? roles.find(item => item.id === roleId) : undefined
  const reviewed = role?.candidates.filter(item => item.fitDecision !== 'unreviewed') || []
  const [selectedId, setSelectedId] = useState<string>('')
  const [note, setNote] = useState('')
  const selected = reviewed.find(item => item.id === selectedId) || reviewed[0]
  const calibration = role?.calibration
  const approved = activeInsights(calibration)
  const laneRecommendations = role ? recommendLaneChanges(role.searchLanes, calibration) : []
  const sampleGoal = 5
  const progress = Math.min(100, Math.round((reviewed.length / sampleGoal) * 100))
  const query = useMemo(() => role ? calibrationSearchQuery(role) : '', [role])

  if (!role) return null
  const activeRoleId = role.id

  function updateReason(candidate: RoleCandidate, reason: string) {
    const cleanReason = reason.trim()
    if (!cleanReason) return
    updateRole(activeRoleId, workspace => ({
      ...workspace,
      candidates: workspace.candidates.map(item => {
        if (item.id !== candidate.id) return item
        if (candidate.fitDecision === 'not_fit') {
          return { ...item, concerns: Array.from(new Set([...item.concerns, cleanReason])).slice(0, 20), updatedAt: new Date().toISOString() }
        }
        return { ...item, fitReasons: Array.from(new Set([...item.fitReasons, cleanReason])).slice(0, 20), updatedAt: new Date().toISOString() }
      }),
      activity: [{ id: crypto.randomUUID(), type: 'candidate_reviewed' as const, message: `Calibration reason captured for ${candidate.name}: ${cleanReason}`, createdAt: new Date().toISOString() }, ...workspace.activity],
      updatedAt: new Date().toISOString(),
    }))
  }

  function removeReason(candidate: RoleCandidate, reason: string) {
    updateRole(activeRoleId, workspace => ({
      ...workspace,
      candidates: workspace.candidates.map(item => item.id !== candidate.id ? item : {
        ...item,
        fitReasons: item.fitReasons.filter(value => value !== reason),
        concerns: item.concerns.filter(value => value !== reason),
        updatedAt: new Date().toISOString(),
      }),
      updatedAt: new Date().toISOString(),
    }))
  }

  function saveNote() {
    if (!selected || !note.trim()) return
    updateReason(selected, note.trim())
    setNote('')
  }

  function act(insightId: string, action: 'approve' | 'reject' | 'pause' | 'rollback') {
    const currentRole = roles.find(item => item.id === activeRoleId)
    if (!currentRole?.calibration) return
    const result = applyInsightAction(currentRole.calibration, insightId, action)
    if (result.error) return
    updateRole(activeRoleId, workspace => ({ ...workspace, calibration: result.state, updatedAt: new Date().toISOString() }))
  }

  const reasonChoices = selected?.fitDecision === 'not_fit' ? negativeReasons : positiveReasons
  const selectedReasons = selected ? Array.from(new Set([...selected.fitReasons, ...selected.concerns])) : []

  return <section className={styles.coach} aria-label="Recruiter calibration">
    <div className={styles.head}>
      <div><span>Calibration</span><h2>Teach SourcingOS what “good” means for this role.</h2><p>Your Yes / Maybe / No decisions stay recruiter-authored. SourcingOS proposes patterns only after repeated decisions, and nothing changes search behavior until you approve it.</p></div>
      <div className={styles.progress}><strong>{reviewed.length}/{sampleGoal}</strong><small>initial reviews</small></div>
    </div>
    <div className={styles.track}><i style={{ width: `${progress}%` }} /></div>

    {reviewed.length === 0 ? <div className={styles.empty}>Review the first candidate in the slate as <strong>Yes</strong>, <strong>Maybe</strong>, or <strong>No</strong>. Then tell SourcingOS why.</div> : <>
      <div className={styles.reviewGrid}>
        <div className={styles.candidateList}>{reviewed.slice(0, 10).map(candidate => <button key={candidate.id} type="button" data-active={(selected?.id || '') === candidate.id} onClick={() => setSelectedId(candidate.id)}><strong>{candidate.name}</strong><span>{decisionLabel(candidate)}</span></button>)}</div>
        {selected && <div className={styles.whyPanel}>
          <div className={styles.whyHead}><div><small>Why?</small><strong>{selected.name} · {decisionLabel(selected)}</strong></div><span>{selected.fitDecision.replaceAll('_', ' ')}</span></div>
          <div className={styles.reasonChoices}>{reasonChoices.map(reason => <button key={reason} type="button" onClick={() => updateReason(selected, reason)}>+ {reason}</button>)}</div>
          <div className={styles.noteRow}><input value={note} onChange={event => setNote(event.target.value)} placeholder="Add the actual recruiter reason…" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveNote() } }} /><button type="button" onClick={saveNote} disabled={!note.trim()}>Add reason</button></div>
          {selectedReasons.length > 0 && <div className={styles.selectedReasons}>{selectedReasons.map(reason => <button key={reason} type="button" title="Remove reason" onClick={() => removeReason(selected, reason)}>{reason} ×</button>)}</div>}
        </div>}
      </div>
    </>}

    {(calibration?.insights.length || 0) > 0 && <div className={styles.insights}>
      <div className={styles.sectionTitle}><strong>SourcingOS learning proposals</strong><span>{pendingInsightCount(calibration)} awaiting review · {approved.length} approved</span></div>
      {calibration?.insights.slice(0, 8).map(insight => <article key={insight.id} data-status={insight.status}>
        <div><small>{insight.evidenceClass.replaceAll('_', ' ')} · {insight.confidence}</small><p>{insightDisplayStatement(insight)}</p>{insight.contradictionNote && <em>{insight.contradictionNote}</em>}<span>Based on: {insight.positiveExamples.join(', ') || insight.supportingCandidateIds.length + ' reviewed candidates'}</span></div>
        <div className={styles.insightActions}>{insight.status === 'proposed' ? <><button type="button" onClick={() => act(insight.id, 'approve')}>Approve</button><button type="button" onClick={() => act(insight.id, 'reject')}>Reject</button></> : insight.status === 'approved' || insight.status === 'edited' ? <button type="button" onClick={() => act(insight.id, 'pause')}>Pause</button> : <button type="button" onClick={() => act(insight.id, 'rollback')}>Reconsider</button>}</div>
      </article>)}
    </div>}

    {approved.length > 0 && <div className={styles.approvedBar}><div><strong>{approved.length} approved calibration signal{approved.length === 1 ? '' : 's'}</strong><span>Approved learning can be passed transparently into the next retrieval plan; original role requirements remain unchanged.</span></div><Link href={`/app/search?roleId=${encodeURIComponent(activeRoleId)}&q=${encodeURIComponent(query)}&from=calibration`}>Run calibrated search</Link></div>}

    {laneRecommendations.length > 0 && <div className={styles.lanes}><strong>Search-lane recommendations</strong>{laneRecommendations.slice(0, 4).map(item => <p key={`${item.laneId}:${item.recommendation}`}>{item.laneLabel}: {item.explanation}</p>)}</div>}
  </section>
}
