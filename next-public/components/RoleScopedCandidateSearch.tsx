'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { WorkbenchClient } from '@/components/WorkbenchClient'
import {
  ROLE_CANDIDATE_SAVED_EVENT,
  addCanonicalCandidateToRole,
  sourceResultToRoleCandidateInput,
  type CanonicalCandidateSavedDetail,
  type RoleCandidateLinkResult,
} from '@/lib/role-candidate-link'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

const WORKBENCH_DRAFT_KEY = 'sourcingos.workbench.intake-draft.v1'
const LEGACY_ACTIVE_ROLE_KEY = 'sourcingos.active-role-context.v1'

export function RoleScopedCandidateSearch({ roleId, laneId }: { roleId?: string; laneId?: string }) {
  const { roles, mode, message, updateRole } = useRoleWorkspaces()
  const role = useMemo(() => roleId ? roles.find(item => item.id === roleId) : undefined, [roleId, roles])
  const lane = useMemo(() => role?.searchLanes.find(item => item.id === laneId), [laneId, role])
  const [prepared, setPrepared] = useState(!roleId)
  const [status, setStatus] = useState('')
  const preparedKey = useRef('')

  useEffect(() => {
    if (!roleId || !role) return
    const key = `${role.id}:${lane?.id || 'role'}`
    if (preparedKey.current === key) return

    const intakeDraft = {
      jobTitle: role.intake.title,
      jobDescription: role.intake.rawDescription,
      mustHaves: lane?.query || role.intake.mustHaves.join(', '),
      niceToHaves: role.intake.niceToHaves.join(', '),
      location: role.intake.location === 'Not specified' ? '' : role.intake.location,
      workType: ['remote', 'hybrid', 'onsite'].includes(role.intake.workMode) ? role.intake.workMode : 'any',
      clearanceNeeds: role.intake.clearance === 'Not specified' ? '' : role.intake.clearance,
      targetCompanies: role.intake.targetCompanies.join('\n'),
      disqualifiers: role.intake.disqualifiers.join(', '),
      compensationNotes: role.intake.compensation === 'Not specified' ? '' : role.intake.compensation,
      hiringManagerNotes: role.intake.hiringManagerNotes,
    }

    try {
      localStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(intakeDraft))
      localStorage.removeItem(LEGACY_ACTIVE_ROLE_KEY)
    } catch {
      setStatus('Role context is available, but this browser blocked local draft storage.')
    }

    preparedKey.current = key
    setPrepared(true)
  }, [lane, role, roleId])

  useEffect(() => {
    if (!roleId) return

    const handleSaved = (event: Event) => {
      const detail = (event as CustomEvent<CanonicalCandidateSavedDetail>).detail
      if (!detail?.candidateId || !detail.result) return

      let outcome: RoleCandidateLinkResult | null = null
      updateRole(roleId, current => {
        outcome = addCanonicalCandidateToRole(
          current,
          sourceResultToRoleCandidateInput(detail.candidateId, detail.result),
        )
        return outcome.workspace
      })

      if (!outcome) return
      if (outcome.reason === 'added') {
        setStatus(`${detail.result.displayName} was saved once and added to this role's review queue.`)
      } else if (outcome.reason === 'existing') {
        setStatus(`${detail.result.displayName} is already in this role. No duplicate was created.`)
      } else if (outcome.reason === 'not_person') {
        setStatus('Only person records can enter a role candidate queue.')
      } else {
        setStatus('The saved profile could not be linked to this role.')
      }
    }

    window.addEventListener(ROLE_CANDIDATE_SAVED_EVENT, handleSaved)
    return () => window.removeEventListener(ROLE_CANDIDATE_SAVED_EVENT, handleSaved)
  }, [roleId, updateRole])

  if (!roleId) return <WorkbenchClient publicMode={false} />

  if (mode === 'checking' || !prepared) {
    return <div className="product-panel"><p className="muted">Preparing the role-scoped search…</p></div>
  }

  if (!role) {
    return (
      <div className="product-panel">
        <span className="kicker">Role context unavailable</span>
        <h2>This role could not be restored.</h2>
        <p className="muted">{message}</p>
        <div className="button-row"><Link className="btn" href="/app/roles">Open Roles</Link></div>
      </div>
    )
  }

  return (
    <>
      <section className="product-panel" style={{ marginBottom: 16 }} aria-label="Active role search context">
        <div className="product-panel-head">
          <div>
            <span className="kicker">Active role context</span>
            <h2>{role.intake.title}</h2>
            <p className="muted" style={{ margin: '5px 0 0', fontSize: 13 }}>
              {[role.intake.location, role.intake.workMode, role.intake.clearance !== 'Not specified' ? `Clearance breadcrumb: ${role.intake.clearance}` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="button-row">
            <Link className="btn ghost" href={`/app/roles/${encodeURIComponent(role.id)}`}>Back to role</Link>
            <Link className="btn secondary" href={`/app/roles/${encodeURIComponent(role.id)}?tab=candidates`}>Role review queue</Link>
          </div>
        </div>

        <div className="chips" style={{ marginTop: 12 }}>
          {role.intake.mustHaves.slice(0, 8).map(item => <span className="tag" key={item}>{item}</span>)}
        </div>

        {lane && (
          <div className="cta" style={{ marginTop: 12, marginBottom: 0 }}>
            <strong>Selected lane:</strong> {lane.label}. The editable search draft starts with: <code>{lane.query}</code>
          </div>
        )}
      </section>

      {status && (
        <div className="cta" role="status" style={{ marginBottom: 14 }}>
          <span>{status}</span>{' '}
          <Link href={`/app/roles/${encodeURIComponent(role.id)}?tab=candidates`} style={{ textDecoration: 'underline' }}>Open role queue</Link>
        </div>
      )}

      <WorkbenchClient key={`${role.id}:${lane?.id || 'role'}`} publicMode={false} initialTab="intake" />
    </>
  )
}
