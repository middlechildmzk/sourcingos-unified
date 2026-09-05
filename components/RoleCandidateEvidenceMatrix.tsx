'use client'

import type { EvidenceClaim } from '@/lib/evidence-ledger'
import {
  buildRequirementAssessments,
  formatRequirementTally,
  requirementAssessmentTally,
  type RequirementAssessment,
} from '@/lib/requirement-assessment-v32'
import type { RoleCandidate, RoleWorkspace } from '@/lib/role-workspace'

function words(value: string): string {
  return value.split('_').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function stateClass(state: RequirementAssessment['state']): string {
  if (state === 'supported') return 'success'
  if (state === 'contradicted') return 'danger'
  if (state === 'needs_verification') return 'warning'
  return ''
}

function sourceTypeLabel(value: EvidenceClaim['sourceType']): string {
  if (value === 'authoritative_registry') return 'Authoritative registry'
  if (value === 'public_profile') return 'Public profile'
  if (value === 'public_artifact') return 'Public artifact'
  if (value === 'uploaded_document') return 'Uploaded document'
  if (value === 'imported_data') return 'Imported data'
  if (value === 'review_event') return 'Review event'
  return 'Unknown source type'
}

function RequirementRow({ assessment }: { assessment: RequirementAssessment }) {
  return (
    <div className="product-row">
      <div className="product-row-main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <div className="product-row-title">{assessment.requirementText}</div>
          <span className={`status-pill ${stateClass(assessment.state)}`}>{words(assessment.state)}</span>
          <span className="status-pill">{words(assessment.tier)}</span>
          {assessment.kind !== 'general' && <span className="status-pill">{words(assessment.kind)}</span>}
        </div>
        <div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{assessment.rationale}</div>

        {!!assessment.claims.length && (
          <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
            {assessment.claims.slice(0, 5).map(claim => (
              <div className="cta" style={{ margin: 0, padding: 10 }} key={claim.id}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12 }}>{words(claim.fieldName)}</strong>
                  <span className="status-pill">{words(claim.evidenceClass)}</span>
                  <span className="status-pill">{sourceTypeLabel(claim.sourceType)}</span>
                  <span className="status-pill">{claim.source}</span>
                </div>
                {claim.spanText ? (
                  <>
                    <p className="muted" style={{ margin: '5px 0 0', fontSize: 11, lineHeight: 1.5 }}>
                      “{claim.spanText}”
                    </p>
                    <p className="muted" style={{ margin: '3px 0 0', fontSize: 10 }}>
                      Exact stored source span {claim.spanStart}:{claim.spanEnd} · {claim.sourceTextRef}
                    </p>
                  </>
                ) : (
                  <p className="muted" style={{ margin: '5px 0 0', fontSize: 11, lineHeight: 1.5 }}>
                    No validated stored source span. This claim cannot by itself produce a Supported requirement state.
                  </p>
                )}
                {claim.sourceUrl && <a style={{ display: 'inline-block', marginTop: 6, fontSize: 11 }} href={claim.sourceUrl} target="_blank" rel="noreferrer noopener">Open source ↗</a>}
              </div>
            ))}
          </div>
        )}

        {!!assessment.recruiterContext.length && (
          <details className="advanced-disclosure" style={{ marginTop: 8 }}>
            <summary>Recruiter context ({assessment.recruiterContext.length})</summary>
            <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>Recruiter-authored context is useful for review, but it is never promoted into source evidence.</p>
            {assessment.recruiterContext.map((item, index) => <p className="muted" style={{ fontSize: 11 }} key={`${item}-${index}`}>{item}</p>)}
          </details>
        )}
      </div>
    </div>
  )
}

export function RoleCandidateEvidenceMatrix({
  role,
  candidate,
  claims,
}: {
  role: RoleWorkspace
  candidate: RoleCandidate
  claims: EvidenceClaim[]
}) {
  const assessments = buildRequirementAssessments(role.intake, claims, candidate)
  const tally = requirementAssessmentTally(assessments)
  const mustHaves = assessments.filter(item => item.tier === 'must_have')
  const other = assessments.filter(item => item.tier !== 'must_have')

  return (
    <section className="product-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Role ↔ Candidate evidence</span><h2>Requirement evidence matrix</h2></div>
        <span>No fit score</span>
      </div>
      <div className="cta" style={{ margin: '0 0 12px' }}>
        <strong>{formatRequirementTally(tally)}</strong>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
          State describes evidence coverage, not qualification. Supported requires exact stored source spans; missing evidence remains Unknown, never a negative score.
        </p>
      </div>
      <div className="product-list">
        {mustHaves.map(assessment => <RequirementRow key={assessment.requirementId} assessment={assessment} />)}
        {!mustHaves.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No must-have requirements configured</div><div className="product-row-meta">Add explicit recruiter-approved requirements to the role intake before evaluating coverage.</div></div></div>}
      </div>
      {!!other.length && (
        <details className="advanced-disclosure" style={{ marginTop: 12 }}>
          <summary>Preferred and disqualifier evidence ({other.length})</summary>
          <div className="product-list" style={{ marginTop: 10 }}>
            {other.map(assessment => <RequirementRow key={assessment.requirementId} assessment={assessment} />)}
          </div>
        </details>
      )}
    </section>
  )
}
