'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  buildRoleCandidateReview,
  recordRoleCandidateFitDecision,
  recordRoleCandidateReviewSignal,
  recordRoleCandidateStage,
  type RoleFitDecisionResult,
  type RoleReviewSignalKind,
  type RoleReviewSignalResult,
  type RoleStageResult,
} from '@/lib/role-candidate-review'
import { ROLE_STAGES, stageLabel, type FitDecision, type RoleStage } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

const FIT_DECISIONS: Array<{ value: FitDecision; label: string }> = [
  { value: 'strong_fit', label: 'Strong fit' },
  { value: 'possible_fit', label: 'Possible fit' },
  { value: 'not_fit', label: 'Not fit' },
  { value: 'unreviewed', label: 'Reset decision' },
]

function words(value: string): string {
  return value.split('_').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function RequirementList({
  title,
  supported,
  unconfirmed,
}: {
  title: string
  supported: string[]
  unconfirmed: string[]
}) {
  return (
    <section className="product-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Role requirements</span><h2>{title}</h2></div>
        <span>{supported.length} supported · {unconfirmed.length} unconfirmed</span>
      </div>
      <div className="product-list">
        {supported.map(item => (
          <div className="product-row" key={`supported-${item}`}>
            <div className="product-row-main">
              <div className="product-row-title">{item}</div>
              <div className="product-row-meta">Supported by the current role-review tags or recorded fit reasons. Verify against source evidence.</div>
            </div>
            <span className="status-pill success">Supported</span>
          </div>
        ))}
        {unconfirmed.map(item => (
          <div className="product-row" key={`unconfirmed-${item}`}>
            <div className="product-row-main">
              <div className="product-row-title">{item}</div>
              <div className="product-row-meta">No supporting role-review tag or fit reason has been recorded yet.</div>
            </div>
            <span className="status-pill warning">Unconfirmed</span>
          </div>
        ))}
        {!supported.length && !unconfirmed.length && (
          <div className="product-row">
            <div className="product-row-main">
              <div className="product-row-title">No requirements configured</div>
              <div className="product-row-meta">Add explicit requirements to the role intake before evaluating coverage.</div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export function RoleSpecificCandidateReview({
  roleId,
  candidateId,
}: {
  roleId: string
  candidateId: string
}) {
  const { roles, mode, message, updateRole } = useRoleWorkspaces()
  const [decisionStatus, setDecisionStatus] = useState('')
  const [pendingStage, setPendingStage] = useState<RoleStage | ''>('')
  const [stageStatus, setStageStatus] = useState('')
  const [signalKind, setSignalKind] = useState<RoleReviewSignalKind>('fit_reason')
  const [signalText, setSignalText] = useState('')
  const [signalStatus, setSignalStatus] = useState('')
  const role = roles.find(item => item.id === roleId)
  const candidate = role?.candidates.find(item => item.candidateId === candidateId || item.id === candidateId)

  if (mode === 'checking') {
    return <section className="product-panel"><p className="muted">Loading role-specific review context…</p></section>
  }

  if (!role) {
    return (
      <section className="product-panel">
        <span className="kicker">Role context unavailable</span>
        <h2>This role could not be restored.</h2>
        <p className="muted">{message}</p>
        <div className="button-row"><Link className="btn" href="/app/roles">Open Roles</Link></div>
      </section>
    )
  }

  const roleHref = `/app/roles/${encodeURIComponent(role.id)}?tab=candidates`
  const calibrationHref = `/app/roles/${encodeURIComponent(role.id)}?tab=calibration`

  if (!candidate) {
    return (
      <section className="product-panel">
        <div className="product-panel-head">
          <div><span className="kicker">Role-specific review</span><h2>{role.intake.title}</h2></div>
          <span>Not in role queue</span>
        </div>
        <p className="muted">This canonical candidate is not currently linked to the selected role. Add the person explicitly before recording a role-specific fit decision.</p>
        <div className="button-row"><Link className="btn" href={roleHref}>Open role queue</Link></div>
      </section>
    )
  }

  const activeRoleId = role.id
  const activeStage = candidate.stage
  const activeFitDecision = candidate.fitDecision
  const review = buildRoleCandidateReview(role, candidate)

  function recordDecision(decision: FitDecision) {
    const holder: { result?: RoleFitDecisionResult } = {}
    updateRole(activeRoleId, current => {
      holder.result = recordRoleCandidateFitDecision(current, candidateId, decision)
      return holder.result.workspace
    })

    if (holder.result?.reason === 'updated') {
      setDecisionStatus(`${words(decision)} recorded. Pipeline stage remains ${stageLabel(activeStage)} until you change it explicitly.`)
    } else if (holder.result?.reason === 'unchanged') {
      setDecisionStatus(`${words(decision)} is already the current fit decision. No duplicate activity was created.`)
    } else {
      setDecisionStatus('This candidate could not be found in the active role queue.')
    }
  }

  function updateStage() {
    const selectedStage = pendingStage || activeStage
    const holder: { result?: RoleStageResult } = {}
    updateRole(activeRoleId, current => {
      holder.result = recordRoleCandidateStage(current, candidateId, selectedStage)
      return holder.result.workspace
    })

    if (holder.result?.reason === 'updated') {
      setPendingStage('')
      setStageStatus(`Moved to ${stageLabel(selectedStage)}. Fit decision remains ${words(activeFitDecision)} and no outreach was triggered.`)
    } else if (holder.result?.reason === 'unchanged') {
      setStageStatus(`${stageLabel(selectedStage)} is already the current stage. No duplicate activity was created.`)
    } else {
      setStageStatus('This candidate could not be found in the active role queue.')
    }
  }

  function addReviewSignal() {
    const holder: { result?: RoleReviewSignalResult } = {}
    updateRole(activeRoleId, current => {
      holder.result = recordRoleCandidateReviewSignal(current, candidateId, signalKind, signalText)
      return holder.result.workspace
    })

    if (holder.result?.reason === 'added') {
      setSignalText('')
      setSignalStatus(`${signalKind === 'fit_reason' ? 'Fit rationale' : 'Concern'} added. It remains recruiter-authored review context, not verified evidence.`)
    } else if (holder.result?.reason === 'duplicate') {
      setSignalStatus('That review note is already recorded. No duplicate activity was created.')
    } else if (holder.result?.reason === 'invalid') {
      setSignalStatus('Enter between 3 and 300 characters before adding the review note.')
    } else {
      setSignalStatus('This candidate could not be found in the active role queue.')
    }
  }

  return (
    <section className="product-panel" aria-label={`Role-specific review for ${role.intake.title}`}>
      <div className="product-page-head" style={{ marginBottom: 16 }}>
        <div>
          <span className="kicker">Role-specific Candidate 360</span>
          <h2 style={{ marginTop: 4 }}>{role.intake.title}</h2>
          <p>{review.summary}</p>
        </div>
        <div className="product-page-actions">
          <Link className="btn" href={roleHref}>Back to role queue</Link>
          <Link className="btn ghost" href={calibrationHref}>Role calibration</Link>
        </div>
      </div>

      <div className="product-summary-grid">
        <div className="product-stat"><small>Fit decision</small><b>{words(candidate.fitDecision)}</b><span>Recruiter controlled</span></div>
        <div className="product-stat"><small>Pipeline stage</small><b>{stageLabel(candidate.stage)}</b><span>No automatic advancement</span></div>
        <div className="product-stat"><small>Evidence state</small><b>{words(candidate.evidenceStatus)}</b><span>Role review status</span></div>
        <div className="product-stat"><small>Contact state</small><b>{words(candidate.contactStatus)}</b><span>Unverified unless confirmed</span></div>
      </div>

      <div className="product-layout" style={{ marginTop: 14, marginBottom: 14 }}>
        <div className="cta" style={{ margin: 0 }}>
          <strong>Recruiter fit decision</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>This records your role-specific judgment only. It does not verify identity, advance the pipeline, or trigger outreach.</p>
          <div className="button-row" style={{ marginTop: 10 }} aria-label="Record role fit decision">
            {FIT_DECISIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={candidate.fitDecision === option.value ? 'btn' : 'btn secondary'}
                aria-pressed={candidate.fitDecision === option.value}
                onClick={() => recordDecision(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {decisionStatus && <p role="status" className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>{decisionStatus}</p>}
        </div>

        <div className="cta" style={{ margin: 0 }}>
          <strong>Pipeline stage</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Select and confirm a stage explicitly. This does not change the fit decision, verify contact information, or send outreach.</p>
          <div className="button-row" style={{ marginTop: 10 }}>
            <select
              className="input"
              aria-label="Select candidate pipeline stage"
              value={pendingStage || candidate.stage}
              onChange={event => setPendingStage(event.target.value as RoleStage)}
            >
              {ROLE_STAGES.map(stage => <option value={stage} key={stage}>{stageLabel(stage)}</option>)}
            </select>
            <button
              type="button"
              className="btn secondary"
              disabled={(pendingStage || candidate.stage) === candidate.stage}
              onClick={updateStage}
            >
              Update stage
            </button>
          </div>
          {stageStatus && <p role="status" className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>{stageStatus}</p>}
        </div>
      </div>

      <form className="cta" style={{ marginBottom: 14 }} onSubmit={event => { event.preventDefault(); addReviewSignal() }}>
        <strong>Add recruiter review context</strong>
        <p className="muted" style={{ margin: '4px 0 10px', fontSize: 12 }}>Add your rationale or concern. This text is recruiter-authored and does not become verified evidence or change the current decision automatically.</p>
        <div className="grid two">
          <label>
            Review note type
            <select className="input" value={signalKind} onChange={event => setSignalKind(event.target.value as RoleReviewSignalKind)}>
              <option value="fit_reason">Fit rationale</option>
              <option value="concern">Concern</option>
            </select>
          </label>
          <label>
            Note
            <textarea
              className="textarea"
              maxLength={300}
              value={signalText}
              onChange={event => setSignalText(event.target.value)}
              placeholder={signalKind === 'fit_reason' ? 'Example: Led Kubernetes platform modernization across a regulated environment.' : 'Example: AWS depth is not yet supported by the reviewed evidence.'}
            />
          </label>
        </div>
        <div className="button-row" style={{ marginTop: 10 }}>
          <button className="btn secondary" type="submit" disabled={signalText.trim().length < 3}>Add review note</button>
          <span className="muted" style={{ fontSize: 11 }}>{signalText.length}/300</span>
        </div>
        {signalStatus && <p role="status" className="muted" style={{ margin: '10px 0 0', fontSize: 12 }}>{signalStatus}</p>}
      </form>

      <div className="product-layout" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <RequirementList title="Must-have coverage" supported={review.supportedMustHaves} unconfirmed={review.unconfirmedMustHaves} />
          {(role.intake.niceToHaves.length > 0) && (
            <RequirementList title="Nice-to-have coverage" supported={review.supportedNiceToHaves} unconfirmed={review.unconfirmedNiceToHaves} />
          )}
        </div>

        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section className="product-panel">
            <div className="product-panel-head"><h2>Recorded fit rationale</h2><span>{candidate.fitReasons.length}</span></div>
            <div className="product-list">
              {candidate.fitReasons.map(item => <div className="product-row" key={item}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item}</div></div></div>)}
              {!candidate.fitReasons.length && <div className="product-row"><div className="product-row-main"><div className="product-row-meta">No recruiter-authored fit rationale has been recorded yet.</div></div></div>}
            </div>
          </section>

          <section className="product-panel">
            <div className="product-panel-head"><h2>Recorded concerns</h2><span>{review.concerns.length}</span></div>
            <div className="product-list">
              {review.concerns.map(item => <div className="product-row" key={item}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal' }}>{item}</div></div></div>)}
              {!review.concerns.length && <div className="product-row"><div className="product-row-main"><div className="product-row-meta">No role-specific concerns have been recorded. This does not mean there are none.</div></div></div>}
            </div>
          </section>

          <section className="product-panel">
            <div className="product-panel-head"><h2>Verify next</h2><span>{review.verifyNext.length}</span></div>
            <div className="product-list">
              {review.verifyNext.map(item => <div className="product-row" key={item}><div className="product-row-main"><div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{item}</div></div></div>)}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
