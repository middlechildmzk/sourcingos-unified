'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { buildLanes } from '@/lib/jd-boolean-lanes'
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
  const guided = useMemo(() => {
    if (!role || !searchText) return null
    return buildLanes(parseJobDescription(searchText), searchText, {
      includeLocation: true,
      isCleared: role.intake.clearance !== 'Not specified',
    })
  }, [role, searchText])

  if (!role || mode === 'checking') return null

  const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved')
  const baseHref = `/app/candidate-search?roleId=${encodeURIComponent(role.id)}`
  const selectedGuidedLane = guided?.lanes.find(lane => lane.id === guidedLaneId) || guided?.lanes[0]

  async function copySearch(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setStatus(`${label} search copied. SourcingOS prepared the query; you still run the guided source yourself.`)
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
        sourceUrl: pasteUrl,
      })
      const updated = updateRole(role.id, current => addCanonicalCandidateToRole(current, linkInput).workspace)
      if (!updated) throw new Error('The candidate was imported, but the role workspace could not be updated.')
      const linkedCandidate = updated.candidates.find(candidate => candidate.candidateId === json.candidate?.id)
      if (!linkedCandidate) throw new Error('The candidate import succeeded, but it could not be added to the role review queue.')

      setStatus(`${linkInput.displayName} is in this role's review queue with recruiter-provided evidence. Canonical candidates are linked once per role; SourcingOS did not execute or verify the external source.`)
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
    <section className="product-panel" style={{ marginBottom: 14 }} aria-label="Role sourcing actions">
      <div className="product-panel-head">
        <div>
          <span className="kicker">Role sourcing loop</span>
          <h2>Search, bring candidates back, review, calibrate</h2>
          <p className="muted" style={{ margin: '5px 0 0', fontSize: 13 }}>
            SourcingOS keeps the strategy and evidence in this role. Guided sources stay recruiter-run; supported SourcingOS sources remain available through Candidate Search.
          </p>
        </div>
        <Link className="btn" href={baseHref}>Search supported sources</Link>
      </div>

      {approvedLanes.length > 0 && (
        <div className="button-row" style={{ marginTop: 12 }}>
          {approvedLanes.map(lane => (
            <Link
              key={lane.id}
              className="btn secondary"
              href={`${baseHref}&laneId=${encodeURIComponent(lane.id)}`}
              title={lane.purpose}
            >
              Run {lane.label}
            </Link>
          ))}
        </div>
      )}

      {selectedGuidedLane && (
        <details className="advanced-disclosure" open style={{ marginTop: 14 }}>
          <summary>Guided searches for recruiter-run sources</summary>
          <div className="role-section-stack" style={{ marginTop: 12 }}>
            <div className="product-panel-head">
              <div>
                <span className="kicker">Search strategy</span>
                <h3>{selectedGuidedLane.name}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>{selectedGuidedLane.useCase}</p>
              </div>
              <select value={guidedLaneId} onChange={event => setGuidedLaneId(event.target.value as typeof guidedLaneId)} aria-label="Guided search lane">
                {guided?.lanes.map(lane => <option key={lane.id} value={lane.id}>{lane.name}</option>)}
              </select>
            </div>

            <div className="grid three">
              <label>LinkedIn Recruiter
                <textarea className="input" rows={5} readOnly value={selectedGuidedLane.linkedin} />
                <button className="btn secondary" type="button" onClick={() => void copySearch('LinkedIn Recruiter', selectedGuidedLane.linkedin)}>Copy LinkedIn search</button>
              </label>
              <label>ClearanceJobs / ATS
                <textarea className="input" rows={5} readOnly value={selectedGuidedLane.boolean} />
                <button className="btn secondary" type="button" onClick={() => void copySearch('ClearanceJobs / ATS', selectedGuidedLane.boolean)}>Copy ClearanceJobs search</button>
              </label>
              <label>Google X-Ray
                <textarea className="input" rows={5} readOnly value={selectedGuidedLane.googleXray} />
                <div className="button-row">
                  <button className="btn secondary" type="button" onClick={() => void copySearch('Google X-Ray', selectedGuidedLane.googleXray)}>Copy X-Ray</button>
                  <a className="btn ghost" href={`https://www.google.com/search?q=${encodeURIComponent(selectedGuidedLane.googleXray)}`} target="_blank" rel="noreferrer noopener">Open Google</a>
                </div>
              </label>
            </div>

            {!!selectedGuidedLane.verify.length && <p className="muted" style={{ margin: 0 }}>Verify: {selectedGuidedLane.verify.join(' ')}</p>}
          </div>
        </details>
      )}

      <details className="advanced-disclosure" open style={{ marginTop: 14 }}>
        <summary>Paste candidates back into this role</summary>
        <div className="role-section-stack" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            Run a guided search in a source you are authorized to use, then paste the candidate profile or resume text here. The imported text becomes recruiter-provided evidence; search context never becomes candidate proof.
          </p>
          <div className="grid three">
            <label>Source surface
              <select value={surface} onChange={event => setSurface(event.target.value as RecruiterPasteBackSurface)}>
                {Object.entries(RECRUITER_PASTE_BACK_SURFACES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Candidate name (optional)
              <input className="input" value={pasteName} onChange={event => setPasteName(event.target.value)} placeholder="Uses first meaningful line if blank" />
            </label>
            <label>Profile/source URL (optional)
              <input className="input" value={pasteUrl} onChange={event => setPasteUrl(event.target.value)} placeholder="https://…" inputMode="url" />
            </label>
          </div>
          <label>Candidate profile or resume text
            <textarea className="input" rows={9} value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder="Paste recruiter-provided candidate text here…" />
          </label>
          <div className="button-row">
            <button className="btn" type="button" disabled={working} onClick={() => void importCandidate()}>{working ? 'Importing…' : 'Import & add to this role'}</button>
            <span className="muted">Current guided lane: {selectedGuidedLane?.name || 'Role search'}</span>
          </div>
        </div>
      </details>

      {status && <div className="cta" role="status" style={{ marginTop: 14 }}>
        <span>{status}</span>
        {lastCandidateId && <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(role.id)}?tab=candidates`}>Review role candidates</Link>}
      </div>}
    </section>
  )
}
