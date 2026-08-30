'use client'

import type { CandidateDossier } from '@/lib/candidate-dossier'
import { buildCandidateRoleEvidenceAnalysis, type CandidateReasoningPoint, type RequirementEvidenceMatch } from '@/lib/role-candidate-evidence-match'
import type { RoleCandidate, RoleWorkspace } from '@/lib/role-workspace'

function words(value: string): string {
  return value.split('_').map(word => word ? word[0].toUpperCase() + word.slice(1) : '').join(' ')
}

function stateClass(state: RequirementEvidenceMatch['state']): string {
  if (state === 'supported') return 'success'
  if (state === 'contradicted') return 'danger'
  if (state === 'needs_verification') return 'warning'
  return ''
}

function provenanceLabel(value: string): string {
  if (value === 'authoritative_registry') return 'Registry evidence'
  if (value === 'candidate_stated') return 'Candidate-stated'
  return 'Public evidence'
}

function RequirementRow({ match }: { match: RequirementEvidenceMatch }) {
  return (
    <div className="product-row">
      <div className="product-row-main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <div className="product-row-title">{match.requirement}</div>
          <span className={`status-pill ${stateClass(match.state)}`}>{words(match.state)}</span>
          <span className="status-pill">{words(match.tier)}</span>
        </div>
        <div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{match.explanation}</div>
        {!!match.evidence.length && (
          <div style={{ display: 'grid', gap: 7, marginTop: 9 }}>
            {match.evidence.slice(0, 4).map(item => (
              <div className="cta" style={{ margin: 0, padding: 10 }} key={item.id}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 12 }}>{item.label}</strong>
                  <span className="status-pill">{provenanceLabel(item.provenanceClass)}</span>
                  <span className="status-pill">{item.source}</span>
                </div>
                <p className="muted" style={{ margin: '5px 0 0', fontSize: 11, lineHeight: 1.5 }}>{item.excerpt}</p>
                {item.url && <a style={{ display: 'inline-block', marginTop: 6, fontSize: 11 }} href={item.url} target="_blank" rel="noreferrer noopener">Open source ↗</a>}
              </div>
            ))}
          </div>
        )}
        {!!match.recruiterContext.length && (
          <details className="advanced-disclosure" style={{ marginTop: 8 }}>
            <summary>Recruiter context ({match.recruiterContext.length})</summary>
            <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>Recruiter-authored context is shown separately and never promoted into source evidence.</p>
            {match.recruiterContext.map((item, index) => <p className="muted" style={{ fontSize: 11 }} key={`${item}-${index}`}>{item}</p>)}
          </details>
        )}
      </div>
    </div>
  )
}

function ReasoningList({ title, subtitle, points, empty }: { title: string; subtitle: string; points: CandidateReasoningPoint[]; empty: string }) {
  return (
    <section className="product-panel">
      <div className="product-panel-head">
        <div><span className="kicker">Independent evidence view</span><h2>{title}</h2></div>
        <span>{points.length}</span>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: -4 }}>{subtitle}</p>
      <div className="product-list">
        {points.map((point, index) => (
          <div className="product-row" key={`${point.title}-${index}`}>
            <div className="product-row-main">
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="product-row-title">{point.title}</div>
                <span className="status-pill">{words(point.basis)}</span>
              </div>
              <div className="product-row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>{point.detail}</div>
            </div>
          </div>
        ))}
        {!points.length && <div className="product-row"><div className="product-row-main"><div className="product-row-meta">{empty}</div></div></div>}
      </div>
    </section>
  )
}

export function RoleCandidateEvidenceMatrix({ role, candidate, dossier }: { role: RoleWorkspace; candidate: RoleCandidate; dossier: CandidateDossier }) {
  const analysis = buildCandidateRoleEvidenceAnalysis(role, candidate, dossier)
  const mustHaves = analysis.requirements.filter(item => item.tier === 'must_have')
  const other = analysis.requirements.filter(item => item.tier !== 'must_have')

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section className="product-panel">
        <div className="product-panel-head">
          <div><span className="kicker">Role ↔ Candidate evidence</span><h2>Requirement evidence matrix</h2></div>
          <span>No fit score</span>
        </div>
        <div className="cta" style={{ margin: '0 0 12px' }}>
          <strong>Evidence coverage, not qualification.</strong>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>{analysis.summary}</p>
        </div>
        <div className="product-list">
          {mustHaves.map(match => <RequirementRow key={`must-${match.requirement}`} match={match} />)}
          {!mustHaves.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No must-have requirements configured</div><div className="product-row-meta">Add explicit recruiter-approved requirements to the role intake before evaluating coverage.</div></div></div>}
        </div>
        {!!other.length && <details className="advanced-disclosure" style={{ marginTop: 12 }}><summary>Nice-to-have and clearance context ({other.length})</summary><div className="product-list" style={{ marginTop: 10 }}>{other.map(match => <RequirementRow key={`${match.tier}-${match.requirement}`} match={match} />)}</div></details>}
      </section>

      <div className="product-layout">
        <div style={{ display: 'grid', gap: 14 }}>
          <ReasoningList
            title="Case for fit"
            subtitle="Only source-linked evidence that supports recruiter-approved requirements appears here."
            points={analysis.caseFor}
            empty="No source-linked requirement support has been established yet."
          />
          <ReasoningList
            title="Case against fit"
            subtitle="Explicit source contradictions and recruiter-authored concerns stay visible rather than being averaged away."
            points={analysis.caseAgainst}
            empty="No explicit contradiction or recruiter concern is recorded. This does not prove fit."
          />
        </div>
        <ReasoningList
          title="Unresolved / verify"
          subtitle="Unknowns, candidate-stated claims, clearance breadcrumbs, stale evidence, and conflicts stay unresolved until reviewed."
          points={analysis.unresolved}
          empty="No unresolved must-have evidence is currently identified. Continue normal recruiter verification before acting."
        />
      </div>
    </div>
  )
}
