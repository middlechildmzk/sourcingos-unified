'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { parseResume } from '@/lib/jd-parser'
import { addCanonicalCandidateToRole } from '@/lib/role-candidate-link'
import { candidateImportToRoleLinkInput, RECRUITER_PASTE_BACK_SURFACES, type RecruiterPasteBackSurface } from '@/lib/role-paste-back'
import type { CandidateRecord, SourceProfileRecord } from '@/lib/candidate-db-v18'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

type ImportResponse = { ok?: boolean; error?: string; candidate?: CandidateRecord; sourceProfile?: SourceProfileRecord }
const CANONICAL_IDS = new Set(['exact_title', 'adjacent_title', 'skill_cluster', 'evidence_first', 'target_company', 'clearance_first'])

export function RolePasteBackV33({ roleId }: { roleId: string }) {
  const { roles, mode, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roles.find(item => item.id === roleId), [roles, roleId])
  const plan = useMemo(() => role ? buildCanonicalAgenticSearchPlan(role.intake, role.calibration) : null, [role])
  const approvedIds = useMemo(() => new Set(role?.searchLanes.filter(item => CANONICAL_IDS.has(item.id) && item.status === 'approved').map(item => item.id) || []), [role])
  const approvedLanes = plan?.lanes.filter(item => approvedIds.has(item.id)) || []
  const [laneId, setLaneId] = useState('')
  const lane = approvedLanes.find(item => item.id === laneId) || approvedLanes[0] || plan?.lanes[0]
  const [surface, setSurface] = useState<RecruiterPasteBackSurface>('linkedin_recruiter')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')
  const [lastCandidateId, setLastCandidateId] = useState('')

  if (!role || !plan || mode === 'checking') return null
  const activeRole = role
  const activePlan = plan

  async function importCandidate() {
    if (!lane || working) return
    if (approvedLanes.length && !approvedIds.has(lane.id)) return setNotice('Choose an approved canonical search hypothesis before importing.')
    if (text.trim().length < 20) return setNotice('Paste at least 20 characters of candidate profile or resume text.')

    setWorking(true)
    setLastCandidateId('')
    setNotice('Importing recruiter-provided candidate text…')
    try {
      const parsed = parseResume(text)
      const response = await fetch('/api/candidate-db/import-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          fileName: `role-${activeRole.id}-${surface}.txt`,
          name: name.trim() || undefined,
          profileUrl: url.trim() || undefined,
          headline: parsed.currentTitle || undefined,
          location: parsed.location || undefined,
          organization: parsed.companies[0] || undefined,
        }),
      })
      const json = await response.json() as ImportResponse
      if (!response.ok || !json.ok || !json.candidate) throw new Error(json.error || 'Candidate import failed.')

      const linkInput = candidateImportToRoleLinkInput({ candidate: json.candidate, sourceProfile: json.sourceProfile, surface, laneLabel: lane.label, planRevision: activePlan.revision, sourceUrl: url })
      const updated = updateRole(activeRole.id, current => addCanonicalCandidateToRole(current, linkInput).workspace)
      if (!updated) throw new Error('Candidate imported, but the role workspace could not be updated.')

      setNotice(`${linkInput.displayName} is in the review queue from ${lane.label}, Search Plan v${activePlan.revision}. Pasted text remains recruiter-provided evidence, not verified truth.`)
      setLastCandidateId(json.candidate.id)
      setName('')
      setUrl('')
      setText('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Candidate import failed.')
    } finally {
      setWorking(false)
    }
  }

  return <section className="role-search-studio" aria-label="Role-aware candidate paste-back">
    <details className="role-pasteback-panel">
      <summary><span><b>Bring candidates back to this role</b><small>Preserve canonical hypothesis and Search Plan revision while keeping pasted evidence unverified.</small></span><span>Open import ↓</span></summary>
      <div className="role-pasteback-content">
        <p>Use this after a guided recruiter-run search. Search context explains where the candidate came from; it never becomes candidate proof.</p>
        <div className="grid three">
          <label>Search hypothesis<select value={lane?.id || ''} onChange={event => setLaneId(event.target.value)}>{(approvedLanes.length ? approvedLanes : activePlan.lanes.slice(0, 1)).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Source surface<select value={surface} onChange={event => setSurface(event.target.value as RecruiterPasteBackSurface)}>{Object.entries(RECRUITER_PASTE_BACK_SURFACES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Profile/source URL (optional)<input className="input" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></label>
        </div>
        <label>Candidate name (optional)<input className="input" value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Candidate profile or resume text<textarea className="input" rows={9} value={text} onChange={event => setText(event.target.value)} placeholder="Paste recruiter-provided candidate text here…" /></label>
        <div className="role-pasteback-footer"><button className="btn" disabled={working} onClick={() => void importCandidate()}>{working ? 'Importing…' : 'Import & add to role'}</button><span>{lane?.label || 'Role search'} · Search Plan v{activePlan.revision}</span></div>
      </div>
    </details>
    {notice && <div className="cta role-search-status" role="status"><span>{notice}</span>{lastCandidateId && <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(activeRole.id)}?tab=candidates`}>Review role candidates</Link>}</div>}
  </section>
}
