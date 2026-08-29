'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { buildLanes } from '@/lib/jd-boolean-lanes'
import { buildCalibratedGuidedSearchPlan } from '@/lib/calibrated-guided-search'
import { parseJobDescription, parseResume } from '@/lib/jd-parser'
import { addCanonicalCandidateToRole } from '@/lib/role-candidate-link'
import {
  candidateImportToRoleLinkInput,
  RECRUITER_PASTE_BACK_SURFACES,
  type RecruiterPasteBackSurface,
} from '@/lib/role-paste-back'
import type { CandidateRecord, SourceProfileRecord } from '@/lib/candidate-db-v18'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type ImportResumeResponse = {
  ok?: boolean
  error?: string
  candidate?: CandidateRecord
  sourceProfile?: SourceProfileRecord
  contacts?: unknown[]
}

function roleSearchText(role: NonNullable<ReturnType<typeof useRoleWorkspaces>['roles'][number]>) {
  return [
    `Title: ${role.intake.title}`,
    role.intake.location && role.intake.location !== 'Not specified' ? `Location: ${role.intake.location}` : '',
    role.intake.clearance && role.intake.clearance !== 'Not specified' ? `Clearance: ${role.intake.clearance}` : '',
    role.intake.mustHaves.length ? `Required: ${role.intake.mustHaves.join(', ')}` : '',
    role.intake.niceToHaves.length ? `Preferred: ${role.intake.niceToHaves.join(', ')}` : '',
    role.intake.targetCompanies.length ? `Target companies: ${role.intake.targetCompanies.join(', ')}` : '',
    role.intake.adjacentBackgrounds.length ? `Adjacent backgrounds: ${role.intake.adjacentBackgrounds.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

export function RoleSearchActions({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const [guidedLaneId, setGuidedLaneId] = useState<'precision' | 'balanced' | 'expanded'>('balanced')
  const [surface, setSurface] = useState<RecruiterPasteBackSurface>('linkedin_recruiter')
  const [pasteName, setPasteName] = useState('')
  const [pasteUrl, setPasteUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [lastCandidateId, setLastCandidateId] = useState('')

  const searchText = useMemo(() => role ? roleSearchText(role) : '', [role])
  const baselineGuided = useMemo(() => {
    if (!role || !searchText) return null
    return buildLanes(parseJobDescription(searchText), searchText, {
      includeLocation: true,
      isCleared: role.intake.clearance !== 'Not specified',
    })
  }, [role, searchText])
  const guidedPlan = useMemo(() => {
    if (!role || !baselineGuided) return null
    return buildCalibratedGuidedSearchPlan(baselineGuided, role.intake, role.calibration)
  }, [baselineGuided, role])

  if (!role || mode === 'checking') return null

  const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved')
  const baseHref = `/app/candidate-search?roleId=${encodeURIComponent(role.id)}`
  const guided = guidedPlan?.current
  const selectedGuidedLane = guided?.lanes.find(lane => lane.id === guidedLaneId) || guided?.lanes[0]
  const selectedBaselineLane = guidedPlan?.baseline.lanes.find(lane => lane.id === guidedLaneId) || guidedPlan?.baseline.lanes[0]
  const appliedChanges = guidedPlan?.changes.filter(change => change.applied) || []
  const hasSelectedLaneDiff = Boolean(
    selectedGuidedLane && selectedBaselineLane && (
      selectedGuidedLane.linkedin !== selectedBaselineLane.linkedin ||
      selectedGuidedLane.boolean !== selectedBaselineLane.boolean ||
      selectedGuidedLane.googleXray !== selectedBaselineLane.googleXray
    )
  )

  async function copySearch(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setStatus(`${label} search copied from Search Plan v${guidedPlan?.revision || 1}. SourcingOS prepared the query; you still run the guided source yourself.`)
    } catch {
      setStatus('Copy failed. Select the search text and copy it manually.')
    }
  }

  async function importCandidate() {
    if (!role || working) return
    if (pasteText.trim().length < 20) {
      setStatus('Paste at least 20 characters of candidate profile or resume text.')
      return
    }

    setWorking(true)
    setStatus('Importing recruiter-provided candidate text…')
    setLastCandidateId('')
    try {
      const parsed = parseResume(pasteText)
      const response = await fetch('/api/candidate-db/import-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: pasteText,
          fileName: `role-${role.id}-${surface}.txt`,
          name: pasteName.trim() || undefined,
          profileUrl: pasteUrl.trim() || undefined,
          headline: parsed.currentTitle || undefined,
          location: parsed.location || undefined,
          organization: parsed.companies[0] || undefined,
        }),
      })
      const json = await response.json() as ImportResumeResponse
      if (!response.ok || !json.ok || !json.candidate) throw new Error(json.error || 'Candidate import failed.')

      const linkInput = candidateImportToRoleLinkInput({
        candidate: json.candidate,
        sourceProfile: json.sourceProfile,
        surface,
        laneLabel: selectedGuidedLane?.name,
        planRevision: guidedPlan?.revision,
        sourceUrl: pasteUrl,
      })
      const updated = updateRole(role.id, current => addCanonicalCandidateToRole(current, linkInput).workspace)
      if (!updated) throw new Error('The candidate was imported, but the role workspace could not be updated.')
      const linkedCandidate = updated.candidates.find(candidate => candidate.candidateId === json.candidate?.id)
      if (!linkedCandidate) throw new Error('The candidate import succeeded, but it could not be added to the role review queue.')

      setStatus(`${linkInput.displayName} is in this role's review queue with recruiter-provided evidence from Search Plan v${guidedPlan?.revision || 1}. Canonical candidates are linked once per role; SourcingOS did not execute or verify the external source.`)
      setLastCandidateId(json.candidate.id)
      setPasteName('')
      setPasteUrl('')
      setPasteText('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Candidate import failed.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="role-search-studio" aria-label="Role sourcing actions">
      <div className="role-search-studio-head">
        <div>
          <div className="role-search-eyebrow"><span>Role sourcing</span><span className="status-pill active">Search Plan v{guidedPlan?.revision || 1}</span></div>
          <h2>Source this role.</h2>
          <p>Run the approved strategy across supported SourcingOS sources or copy recruiter-ready searches into the systems you already use. Bring people back here to review and calibrate the next pass.</p>
        </div>
        <Link className="btn role-search-primary-action" href={baseHref}>Run supported search →</Link>
      </div>

      <div className="role-search-loop-strip" aria-label="Role sourcing workflow">
        <span className="active"><b>1</b> Search</span><i>→</i><span><b>2</b> Bring back</span><i>→</i><span><b>3</b> Review</span><i>→</i><span><b>4</b> Learn</span><i>→</i><span><b>5</b> Search again</span>
      </div>

      {approvedLanes.length > 0 && <div className="role-search-approved-lanes">
        <span>Approved executable lanes</span>
        <div>{approvedLanes.map(lane => <Link key={lane.id} className="btn secondary" href={`${baseHref}&laneId=${encodeURIComponent(lane.id)}`} title={lane.purpose}>Run {lane.label}</Link>)}</div>
      </div>}

      {selectedGuidedLane && <div className="role-guided-search-area">
        <div className="role-guided-search-head">
          <div><span className="kicker">Recruiter-run sources</span><h3>{selectedGuidedLane.name}</h3><p>{selectedGuidedLane.useCase}</p></div>
          <div className="role-lane-switcher" role="group" aria-label="Guided search lane">
            {guided?.lanes.map(lane => <button key={lane.id} className={guidedLaneId === lane.id ? 'active' : ''} onClick={() => setGuidedLaneId(lane.id)}>{lane.id === 'precision' ? 'Precision' : lane.id === 'balanced' ? 'Balanced' : 'Expanded'}</button>)}
          </div>
        </div>

        {guidedPlan?.calibrated && <div className="role-calibration-banner">
          <div><span className="role-calibration-spark">✦</span><div><b>Approved calibration is shaping this search.</b><p>{appliedChanges.length ? `${appliedChanges.length} approved learning change${appliedChanges.length === 1 ? '' : 's'} rewrites the current guided queries.` : 'Approved learning is active, but it is already represented by the role criteria or remains review guidance, so no duplicate terms were added.'}</p></div></div>
          <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(role.id)}?tab=calibration`}>Inspect learning</Link>
        </div>}

        <div className="role-search-surface-grid">
          <article className="search-surface-card">
            <div className="search-surface-card-head"><div><span className="search-surface-brand linkedin">in</span><div><b>LinkedIn Recruiter</b><small>Guided · recruiter-run</small></div></div><span className="status-pill">copy</span></div>
            <textarea className="input search-query-box" rows={5} readOnly value={selectedGuidedLane.linkedin} />
            <button className="btn secondary" type="button" onClick={() => void copySearch('LinkedIn Recruiter', selectedGuidedLane.linkedin)}>Copy LinkedIn search</button>
          </article>
          <article className="search-surface-card">
            <div className="search-surface-card-head"><div><span className="search-surface-brand clearance">C</span><div><b>ClearanceJobs / ATS</b><small>Guided · recruiter-run</small></div></div><span className="status-pill">copy</span></div>
            <textarea className="input search-query-box" rows={5} readOnly value={selectedGuidedLane.boolean} />
            <button className="btn secondary" type="button" onClick={() => void copySearch('ClearanceJobs / ATS', selectedGuidedLane.boolean)}>Copy Boolean</button>
          </article>
          <article className="search-surface-card">
            <div className="search-surface-card-head"><div><span className="search-surface-brand google">G</span><div><b>Google X-Ray</b><small>Open web · recruiter-run</small></div></div><span className="status-pill">open web</span></div>
            <textarea className="input search-query-box" rows={5} readOnly value={selectedGuidedLane.googleXray} />
            <div className="button-row"><button className="btn secondary" type="button" onClick={() => void copySearch('Google X-Ray', selectedGuidedLane.googleXray)}>Copy X-Ray</button><a className="btn ghost" href={`https://www.google.com/search?q=${encodeURIComponent(selectedGuidedLane.googleXray)}`} target="_blank" rel="noreferrer noopener">Open Google ↗</a></div>
          </article>
        </div>

        {!!selectedGuidedLane.verify.length && <div className="role-search-verify"><b>Recruiter verification</b><span>{selectedGuidedLane.verify.join(' ')}</span></div>}

        {guidedPlan && guidedPlan.revision > 1 && <details className="role-plan-change-log">
          <summary>What changed in Search Plan v{guidedPlan.revision}</summary>
          <div className="role-plan-change-content">
            <div className="product-list">{guidedPlan.changes.map(change => <div className="product-row" key={change.insightId}><div className="product-row-main"><div className="product-row-title">{change.applied ? 'Applied to guided search' : 'Visible review guidance'} · {change.subject}</div><div className="product-row-meta normal-wrap">{change.explanation}</div></div><span className={change.applied ? 'status-pill success' : 'status-pill'}>{change.kind.replaceAll('_', ' ')}</span></div>)}{!guidedPlan.changes.length && <div className="product-row"><div className="product-row-main"><div className="product-row-meta">No approved calibration is changing guided queries right now.</div></div></div>}</div>
            {hasSelectedLaneDiff && selectedBaselineLane && <div className="role-search-before-grid">
              {selectedBaselineLane.linkedin !== selectedGuidedLane.linkedin && <label>LinkedIn · before<textarea className="input" rows={4} readOnly value={selectedBaselineLane.linkedin} /><span className="muted">Now: {selectedGuidedLane.linkedin}</span></label>}
              {selectedBaselineLane.boolean !== selectedGuidedLane.boolean && <label>ClearanceJobs / ATS · before<textarea className="input" rows={4} readOnly value={selectedBaselineLane.boolean} /><span className="muted">Now: {selectedGuidedLane.boolean}</span></label>}
              {selectedBaselineLane.googleXray !== selectedGuidedLane.googleXray && <label>Google X-Ray · before<textarea className="input" rows={4} readOnly value={selectedBaselineLane.googleXray} /><span className="muted">Now: {selectedGuidedLane.googleXray}</span></label>}
            </div>}
          </div>
        </details>}
      </div>}

      <details className="role-pasteback-panel">
        <summary><span><b>Bring candidates back to this role</b><small>Paste recruiter-provided profile or resume text and preserve provenance.</small></span><span>Open import ↓</span></summary>
        <div className="role-pasteback-content">
          <p>Run a guided search in a source you are authorized to use, then paste the candidate profile or resume text here. The imported text becomes recruiter-provided evidence; search context never becomes candidate proof.</p>
          <div className="grid three">
            <label>Source surface<select value={surface} onChange={event => setSurface(event.target.value as RecruiterPasteBackSurface)}>{Object.entries(RECRUITER_PASTE_BACK_SURFACES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Candidate name (optional)<input className="input" value={pasteName} onChange={event => setPasteName(event.target.value)} placeholder="Uses first meaningful line if blank" /></label>
            <label>Profile/source URL (optional)<input className="input" value={pasteUrl} onChange={event => setPasteUrl(event.target.value)} placeholder="https://…" inputMode="url" /></label>
          </div>
          <label>Candidate profile or resume text<textarea className="input" rows={9} value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Paste recruiter-provided candidate text here…" /></label>
          <div className="role-pasteback-footer"><button className="btn" type="button" disabled={working} onClick={() => void importCandidate()}>{working ? 'Importing…' : 'Import & add to role'}</button><span>Lane: {selectedGuidedLane?.name || 'Role search'} · Search Plan v{guidedPlan?.revision || 1}</span></div>
        </div>
      </details>

      {status && <div className="cta role-search-status" role="status"><span>{status}</span>{lastCandidateId && <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(role.id)}?tab=candidates`}>Review role candidates</Link>}</div>}
    </section>
  )
}
