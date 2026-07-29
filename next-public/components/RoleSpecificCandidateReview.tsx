'use client'

import Link from 'next/link'
import { buildRoleCandidateReview } from '@/lib/role-candidate-review'
import { stageLabel } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

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
  const { roles, mode, message } = useRoleWorkspaces()
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

  const review = buildRoleCandidateReview(role, candidate)

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

      <div className="product-layout" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <RequirementList title="Must-have coverage" supported={review.supportedMustHaves} unconfirmed={review.unconfirmedMustHaves} />
          {(role.intake.niceToHaves.length > 0) && (
            <RequirementList title="Nice-to-have coverage" supported={review.supportedNiceToHaves} unconfirmed={review.unconfirmedNiceToHaves} />
          )}
        </div>

        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
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
