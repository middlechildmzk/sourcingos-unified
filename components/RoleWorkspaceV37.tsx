'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { roleMetrics, stageLabel, type FitDecision, type RoleCandidate, type RoleWorkspace } from '@/lib/role-workspace'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function candidatePriority(candidate: RoleCandidate) {
  if (candidate.evidenceStatus === 'conflicting') return 0
  if (candidate.fitDecision === 'unreviewed') return 1
  if (candidate.stage === 'needs_review') return 2
  if (candidate.fitDecision === 'possible_fit') return 3
  if (candidate.fitDecision === 'strong_fit') return 4
  return 5
}

function evidenceTone(candidate: RoleCandidate) {
  if (candidate.evidenceStatus === 'conflicting') return 'is-danger'
  if (candidate.evidenceStatus === 'reviewed') return 'is-supported'
  if (candidate.evidenceStatus === 'stale') return 'is-warning'
  return 'is-unknown'
}

function decisionLabel(decision: FitDecision) {
  if (decision === 'strong_fit') return 'Strong'
  if (decision === 'possible_fit') return 'Possible'
  if (decision === 'not_fit') return 'Not fit'
  return 'Review'
}

export function RoleWorkspaceV37({ roleId }: { roleId: string }) {
  const { roles, mode, message, updateRole, syncWorkspace } = useRoleWorkspaces()
  const [selectedId, setSelectedId] = useState('')
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState('all')
  const [status, setStatus] = useState('')

  const role = useMemo(() => roles.find(item => item.id === roleId), [roleId, roles])
  const metrics = role ? roleMetrics(role) : null
  const candidates = useMemo(() => {
    if (!role) return []
    const needle = query.trim().toLowerCase()
    return [...role.candidates]
      .filter(candidate => stage === 'all' || candidate.stage === stage)
      .filter(candidate => !needle || [candidate.name, candidate.headline, candidate.company, candidate.location, candidate.source, ...candidate.tags].join(' ').toLowerCase().includes(needle))
      .sort((a, b) => candidatePriority(a) - candidatePriority(b) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [query, role, stage])
  const selected = candidates.find(candidate => candidate.id === selectedId) || candidates[0] || null

  useEffect(() => {
    if (!selectedId && candidates[0]) setSelectedId(candidates[0].id)
    if (selectedId && !candidates.some(candidate => candidate.id === selectedId)) setSelectedId(candidates[0]?.id || '')
  }, [candidates, selectedId])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!candidates.length) return
      const index = Math.max(0, candidates.findIndex(candidate => candidate.id === selected?.id))
      if (event.key.toLowerCase() === 'j') { event.preventDefault(); setSelectedId(candidates[Math.min(candidates.length - 1, index + 1)].id) }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setSelectedId(candidates[Math.max(0, index - 1)].id) }
      if (event.key.toLowerCase() === 'a' && selected) { event.preventDefault(); review(selected, 'strong_fit') }
      if (event.key.toLowerCase() === 'p' && selected) { event.preventDefault(); review(selected, 'possible_fit') }
      if (event.key.toLowerCase() === 'x' && selected) { event.preventDefault(); review(selected, 'not_fit') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function updateSelected(updater: (workspace: RoleWorkspace) => RoleWorkspace) {
    return updateRole(roleId, current => ({ ...updater(current), updatedAt: new Date().toISOString() }))
  }

  function review(candidate: RoleCandidate, decision: FitDecision) {
    const now = new Date().toISOString()
    updateSelected(current => ({
      ...current,
      candidates: current.candidates.map(item => item.id === candidate.id ? {
        ...item,
        fitDecision: decision,
        stage: decision === 'strong_fit' ? 'shortlisted' : decision === 'not_fit' ? 'archived' : item.stage,
        updatedAt: now,
      } : item),
      activity: [{ id: crypto.randomUUID(), type: 'candidate_reviewed', message: `${candidate.name}: ${decisionLabel(decision)}.`, createdAt: now }, ...current.activity],
    }))
    setStatus(`${candidate.name} marked ${decisionLabel(decision).toLowerCase()}.`)
  }

  if (!role && mode === 'checking') return <div className="role-workspace-v37-loading">Loading role workspace…</div>
  if (!role || !metrics) return <div className="role-workspace-v37-missing"><span>Role not found</span><h1>This workspace is not available.</h1><p>{message}</p><Link href="/app/roles">Back to roles</Link></div>

  const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved')
  const proposedLanes = role.searchLanes.filter(lane => lane.status === 'proposed')
  const searchQuery = [role.intake.title, role.intake.location, role.intake.clearance && role.intake.clearance !== 'Not specified' ? role.intake.clearance : '', ...role.intake.mustHaves].filter(Boolean).join(' · ')

  return <div className="role-workspace-v37">
    <header className="role-workspace-v37-header">
      <div className="role-workspace-v37-heading">
        <Link href="/app/roles" className="role-back-link">← Roles</Link>
        <div><span className="search-kicker">Role workspace</span><h1>{role.intake.title}</h1><p>{[role.intake.location, label(role.intake.workMode), role.intake.clearance && role.intake.clearance !== 'Not specified' ? `Clearance: ${role.intake.clearance}` : ''].filter(Boolean).join(' · ')}</p></div>
      </div>
      <div className="role-workspace-v37-actions">
        <span className={`role-status-dot is-${role.status}`}>{label(role.status)}</span>
        <button type="button" onClick={() => void syncWorkspace(role)}>Sync</button>
        <Link href={`/app/search?roleId=${encodeURIComponent(role.id)}&q=${encodeURIComponent(searchQuery)}`} className="primary">Search for this role</Link>
      </div>
    </header>

    {status && <div className="role-workspace-v37-toast">{status}</div>}

    <div className="role-workspace-v37-grid">
      <aside className="role-workspace-v37-brief">
        <section>
          <div className="search-section-title"><span>Role Brain</span><small>{role.status}</small></div>
          <div className="role-brief-block"><small>Must have</small>{role.intake.mustHaves.length ? <div className="role-brief-tags">{role.intake.mustHaves.map(item => <span className="is-must" key={item}>{item}</span>)}</div> : <p>No explicit must-haves yet.</p>}</div>
          <div className="role-brief-block"><small>Prioritize</small>{role.intake.niceToHaves.length ? <div className="role-brief-tags">{role.intake.niceToHaves.map(item => <span key={item}>{item}</span>)}</div> : <p>No recruiter preferences yet.</p>}</div>
          <div className="role-brief-block"><small>Target companies</small>{role.intake.targetCompanies.length ? <div className="role-brief-tags">{role.intake.targetCompanies.map(item => <span key={item}>{item}</span>)}</div> : <p>Open market.</p>}</div>
          <div className="role-brief-block"><small>Disqualifiers</small>{role.intake.disqualifiers.length ? <div className="role-brief-tags">{role.intake.disqualifiers.map(item => <span className="is-warning" key={item}>{item}</span>)}</div> : <p>None explicitly defined.</p>}</div>
        </section>

        <section className="role-search-plan-v37">
          <div className="search-section-title"><span>Search strategy</span><small>{approvedLanes.length} approved</small></div>
          {[...approvedLanes, ...proposedLanes].slice(0, 6).map(lane => <div className="role-search-lane-v37" key={lane.id}><i className={lane.status} /><span><b>{lane.label}</b><small>{lane.status === 'approved' ? 'Approved lane' : 'Needs review'}</small></span></div>)}
          <Link href={`/app/search?roleId=${encodeURIComponent(role.id)}&q=${encodeURIComponent(searchQuery)}`}>Open Search Workspace →</Link>
        </section>

        <section className="role-workspace-v37-stats">
          <div><b>{metrics.candidateCount}</b><span>Candidates</span></div><div><b>{metrics.needsReview}</b><span>Need review</span></div><div><b>{metrics.strongFits}</b><span>Strong</span></div><div><b>{metrics.conflicts}</b><span>Conflicts</span></div>
        </section>
      </aside>

      <main className="role-workspace-v37-slate">
        <div className="role-slate-toolbar-v37">
          <div><span className="search-kicker">Candidate slate</span><h2>{candidates.length} people</h2></div>
          <div className="role-slate-controls-v37"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter this slate…" /><select value={stage} onChange={event => setStage(event.target.value)}><option value="all">All stages</option><option value="needs_review">Needs review</option><option value="shortlisted">Shortlisted</option><option value="contact_research">Contact research</option><option value="ready_for_outreach">Ready for outreach</option><option value="archived">Archived</option></select></div>
        </div>
        <div className="role-keyboard-hint-v37"><span>J/K navigate</span><span>A strong</span><span>P possible</span><span>X not fit</span></div>
        <div className="role-candidate-list-v37">
          {candidates.map((candidate, index) => <button type="button" key={candidate.id} className={`role-candidate-row-v37 ${selected?.id === candidate.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(candidate.id)}>
            <span className="role-candidate-rank-v37">{index + 1}</span>
            <span className="role-candidate-copy-v37"><span><strong>{candidate.name}</strong><em className={evidenceTone(candidate)}>{label(candidate.evidenceStatus)}</em></span><small>{[candidate.headline, candidate.company, candidate.location].filter(Boolean).join(' · ') || 'Candidate record'}</small>{!!candidate.tags.length && <span className="role-candidate-tags-v37">{candidate.tags.slice(0, 5).map(tag => <i key={tag}>{tag}</i>)}</span>}<span className="role-candidate-reason-v37">{candidate.fitReasons[0] || candidate.concerns[0] || `Added from ${candidate.source}; review candidate-specific evidence.`}</span></span>
            <span className="role-candidate-meta-v37"><b>{decisionLabel(candidate.fitDecision)}</b><small>{stageLabel(candidate.stage)}</small><small>{candidate.contactStatus === 'signals_found' || candidate.contactStatus === 'verified' ? 'Contact found' : 'Contact unknown'}</small></span>
          </button>)}
          {!candidates.length && <div className="role-workspace-v37-empty"><h3>No candidates in this view.</h3><p>Run the canonical Search Workspace or change the slate filters. Missing candidates are not treated as failed candidates.</p><Link href={`/app/search?roleId=${encodeURIComponent(role.id)}&q=${encodeURIComponent(searchQuery)}`}>Search for candidates</Link></div>}
        </div>
      </main>

      <aside className="role-workspace-v37-inspector">
        {!selected ? <div className="role-inspector-empty-v37"><span className="search-kicker">Candidate inspector</span><h3>Select a candidate</h3><p>Review evidence, role-specific decisions, contact state, and provenance without leaving the slate.</p></div> : <>
          <section className="role-inspector-identity-v37"><span className="search-kicker">Candidate {Math.max(1, candidates.findIndex(item => item.id === selected.id) + 1)} of {candidates.length}</span><h2>{selected.name}</h2><p>{[selected.headline, selected.company].filter(Boolean).join(' · ') || 'Candidate record'}</p><small>{selected.location || 'Location not evidenced'}</small>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}</section>
          <section className="role-inspector-section-v37"><div className="search-section-title"><span>Role decision</span><small>recruiter judgment</small></div><div className="role-fit-actions-v37"><button className={selected.fitDecision === 'strong_fit' ? 'active strong' : ''} onClick={() => review(selected, 'strong_fit')}>Strong</button><button className={selected.fitDecision === 'possible_fit' ? 'active possible' : ''} onClick={() => review(selected, 'possible_fit')}>Possible</button><button className={selected.fitDecision === 'not_fit' ? 'active reject' : ''} onClick={() => review(selected, 'not_fit')}>Not fit</button></div></section>
          <section className="role-inspector-section-v37"><div className="search-section-title"><span>Evidence state</span><small>{label(selected.evidenceStatus)}</small></div><div className={`role-evidence-state-v37 ${evidenceTone(selected)}`}><b>{selected.evidenceStatus === 'conflicting' ? 'Conflicting evidence' : selected.evidenceStatus === 'reviewed' ? 'Evidence reviewed' : selected.evidenceStatus === 'stale' ? 'Evidence may be stale' : 'Evidence needs review'}</b><span>{selected.evidenceStatus === 'unreviewed' ? 'Unknown is not a rejection. Review candidate-specific observations before making a judgment.' : 'This state describes evidence quality, not candidate qualification.'}</span></div></section>
          <section className="role-inspector-section-v37"><div className="search-section-title"><span>Why this role</span><small>role-specific</small></div>{selected.fitReasons.length ? <ul>{selected.fitReasons.map(item => <li key={item}>{item}</li>)}</ul> : <p>No positive fit reasons have been recorded yet.</p>}{selected.concerns.length ? <div className="role-concerns-v37"><b>Concerns</b>{selected.concerns.map(item => <span key={item}>{item}</span>)}</div> : null}</section>
          <section className="role-inspector-section-v37"><div className="search-section-title"><span>Provenance & contact</span><small>{label(selected.source)}</small></div><div className="role-contact-state-v37"><div><small>Contact</small><b>{label(selected.contactStatus)}</b></div><div><small>Stage</small><b>{stageLabel(selected.stage)}</b></div></div></section>
          <footer className="role-inspector-actions-v37"><Link href={selected.candidateId ? `/app/candidate/${encodeURIComponent(selected.candidateId)}` : '/app/candidate-database'}>Open Candidate 360</Link><Link className="secondary" href={`/app/search?roleId=${encodeURIComponent(role.id)}&q=${encodeURIComponent(selected.name)}`}>Find similar / research</Link></footer>
        </>}
      </aside>
    </div>

    <footer className="role-workspace-v37-footer"><span>{mode === 'supabase' ? 'Connected workspace' : mode === 'preview' ? 'Local preview workspace' : message}</span><nav><Link href={`/app/roles/${encodeURIComponent(role.id)}/activity`}>Activity</Link><Link href={`/app/roles/${encodeURIComponent(role.id)}/advanced`}>Advanced controls</Link></nav></footer>
  </div>
}
