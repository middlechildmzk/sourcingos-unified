'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EvidenceClaim } from '@/lib/evidence-ledger'
import {
  buildRequirementAssessments,
  type RequirementAssessment,
  type RequirementState,
} from '@/lib/requirement-assessment-v32'
import { useRoleWorkspaces } from '@/lib/use-role-workspaces'
import {
  applyReviewDecisionV41,
  createReviewSessionSnapshotV41,
  displayRequirementStateV41,
  firstUndecidedReviewIndexV41,
  requirementStateLabelV41,
  reviewSessionStorageKeyV41,
  undoReviewDecisionV41,
  reviewShortcutBlockedByModifierV41,
  validReviewSessionSnapshotV41,
  type ReviewDecisionMutationV41,
  type ReviewDecisionV41,
  type ReviewSessionSnapshotV41,
} from '@/lib/review/session-v41'
import styles from './ReviewSessionV41.module.css'

function stateClass(state: RequirementState): string {
  if (state === 'supported') return styles.supported
  if (state === 'contradicted') return styles.contradicted
  if (state === 'needs_verification') return styles.verify
  return styles.unknown
}

function tierLabel(tier: RequirementAssessment['tier']): string {
  if (tier === 'must_have') return 'Must have'
  if (tier === 'preferred') return 'Preferred'
  return 'Disqualifier'
}

function formatDate(value?: string): string {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'Date unavailable'
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

function displayTally(assessments: RequirementAssessment[]) {
  const tally = { supported: 0, contradicted: 0, verify: 0, unknown: 0 }
  for (const assessment of assessments) {
    const state = displayRequirementStateV41(assessment)
    if (state === 'supported') tally.supported += 1
    if (state === 'contradicted') tally.contradicted += 1
    if (state === 'needs_verification') tally.verify += 1
    if (state === 'unknown') tally.unknown += 1
  }
  const parts = [`${tally.supported} supported`]
  if (tally.contradicted) parts.push(`${tally.contradicted} contradicted`)
  parts.push(`${tally.verify} need verification`, `${tally.unknown} unknown`)
  return parts.join(' · ')
}

function sourceClaims(assessment: RequirementAssessment): EvidenceClaim[] {
  return assessment.claims.filter(claim => claim.spanValidated === true && Boolean(claim.spanText)).slice(0, 4)
}

export function ReviewSessionV41({ roleId }: { roleId: string }) {
  const router = useRouter()
  const { roles, mode, message, updateRole } = useRoleWorkspaces()
  const role = roles.find(item => item.id === roleId)
  const [snapshot, setSnapshot] = useState<ReviewSessionSnapshotV41 | null>(null)
  const [index, setIndex] = useState(0)
  const [claims, setClaims] = useState<EvidenceClaim[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [focusedRequirement, setFocusedRequirement] = useState(0)
  const [lastMutation, setLastMutation] = useState<ReviewDecisionMutationV41 | null>(null)
  const [pendingDecision, setPendingDecision] = useState<ReviewDecisionV41 | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!role || snapshot) return
    const key = reviewSessionStorageKeyV41(role.id)
    let restored: ReviewSessionSnapshotV41 | null = null
    try {
      restored = validReviewSessionSnapshotV41(JSON.parse(window.localStorage.getItem(key) || 'null'), role)
    } catch {
      restored = null
    }
    const next = restored || createReviewSessionSnapshotV41(role)
    setSnapshot(next)
    setIndex(firstUndecidedReviewIndexV41(role, next))
    window.localStorage.setItem(key, JSON.stringify(next))
  }, [role, snapshot])

  const candidateId = snapshot?.candidateIds[index]
  const candidate = role?.candidates.find(item => item.id === candidateId)

  useEffect(() => {
    const canonicalCandidateId = candidate?.candidateId
    if (!canonicalCandidateId) {
      setClaims([])
      setEvidenceError(candidate ? 'This role candidate is not linked to a canonical candidate record yet.' : null)
      return
    }
    let cancelled = false
    setEvidenceLoading(true)
    setEvidenceError(null)
    void (async () => {
      try {
        const response = await fetch(`/api/candidate-db/evidence-ledger?candidateId=${encodeURIComponent(canonicalCandidateId)}`, {
          headers: { accept: 'application/json' },
          cache: 'no-store',
        })
        const json = await response.json() as { ok?: boolean; claims?: EvidenceClaim[]; error?: string }
        if (!response.ok || !json.ok) throw new Error(json.error || 'Evidence could not be loaded.')
        if (!cancelled) setClaims(Array.isArray(json.claims) ? json.claims : [])
      } catch (error) {
        if (!cancelled) {
          setClaims([])
          setEvidenceError(error instanceof Error ? error.message : 'Evidence provider failed for this candidate.')
        }
      } finally {
        if (!cancelled) setEvidenceLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [candidate?.candidateId, candidate])

  const assessments = useMemo(() => {
    if (!role || !candidate) return []
    return buildRequirementAssessments(role.intake, claims, candidate)
  }, [role, candidate, claims])

  useEffect(() => {
    if (focusedRequirement >= assessments.length) setFocusedRequirement(Math.max(0, assessments.length - 1))
  }, [assessments.length, focusedRequirement])

  const sessionCandidates = useMemo(() => {
    if (!role || !snapshot) return []
    const byId = new Map(role.candidates.map(item => [item.id, item]))
    return snapshot.candidateIds.map(id => byId.get(id)).filter(Boolean)
  }, [role, snapshot])

  const decidedCount = sessionCandidates.filter(item => item?.fitDecision !== 'unreviewed').length
  const completed = Boolean(snapshot?.candidateIds.length) && decidedCount === snapshot?.candidateIds.length

  const toggleRequirement = useCallback((id: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const advance = useCallback((direction: 1 | -1) => {
    if (!snapshot) return
    setIndex(current => Math.max(0, Math.min(snapshot.candidateIds.length - 1, current + direction)))
    setFocusedRequirement(0)
    setExpanded(new Set())
  }, [snapshot])

  const commitDecision = useCallback((decision: ReviewDecisionV41, note = '') => {
    if (!role || !candidate) return
    let mutation: ReviewDecisionMutationV41 | null = null
    updateRole(role.id, workspace => {
      const applied = applyReviewDecisionV41(workspace, candidate.id, decision)
      mutation = applied.mutation
      if (!note.trim()) return applied.role
      const createdAt = new Date().toISOString()
      return {
        ...applied.role,
        activity: [{
          id: crypto.randomUUID(),
          type: 'note_added' as const,
          message: `Review note for ${candidate.name}: ${note.trim().slice(0, 1000)}`,
          createdAt,
        }, ...applied.role.activity].slice(0, 200),
      }
    })
    setLastMutation(mutation)
    setPendingDecision(null)
    setNoteDraft('')
    if (snapshot && index < snapshot.candidateIds.length - 1) advance(1)
  }, [role, candidate, updateRole, snapshot, index, advance])

  const requestDecision = useCallback((decision: ReviewDecisionV41, withNote = false) => {
    if (withNote) {
      setPendingDecision(decision)
      setNoteDraft('')
      setTimeout(() => noteRef.current?.focus(), 0)
      return
    }
    commitDecision(decision)
  }, [commitDecision])

  const undo = useCallback(() => {
    if (!role || !lastMutation) return
    updateRole(role.id, workspace => undoReviewDecisionV41(workspace, lastMutation))
    const targetIndex = snapshot?.candidateIds.indexOf(lastMutation.candidateId) ?? -1
    if (targetIndex >= 0) setIndex(targetIndex)
    setLastMutation(null)
  }, [role, lastMutation, updateRole, snapshot])

  const finish = useCallback(() => {
    if (role) window.localStorage.removeItem(reviewSessionStorageKeyV41(role.id))
    router.push(`/app/roles/${encodeURIComponent(roleId)}`)
  }, [role, roleId, router])

  const exit = useCallback(() => {
    router.push(`/app/roles/${encodeURIComponent(roleId)}`)
  }, [roleId, router])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (pendingDecision) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setPendingDecision(null)
          setNoteDraft('')
        }
        return
      }
      if (isTypingTarget(event.target)) return
      if (reviewShortcutBlockedByModifierV41(event)) return
      const key = event.key.toLowerCase()
      if (key === 'f') { event.preventDefault(); requestDecision('evidence_fit', event.shiftKey); return }
      if (key === 'x') { event.preventDefault(); requestDecision('not_fit', event.shiftKey); return }
      if (key === 'v') { event.preventDefault(); requestDecision('needs_verification', event.shiftKey); return }
      if (key === 'j' || event.key === 'ArrowRight') { event.preventDefault(); advance(1); return }
      if (key === 'k' || event.key === 'ArrowLeft') { event.preventDefault(); advance(-1); return }
      if (key === 'u') { event.preventDefault(); undo(); return }
      if (key === '?') { event.preventDefault(); setShortcutsOpen(value => !value); return }
      if (event.key === 'Escape') { event.preventDefault(); exit(); return }
      if (/^[1-9]$/.test(event.key)) {
        const target = Number(event.key) - 1
        if (target < assessments.length) { event.preventDefault(); setFocusedRequirement(target) }
        return
      }
      if (key === 'e') {
        const assessment = assessments[focusedRequirement]
        if (assessment) { event.preventDefault(); toggleRequirement(assessment.requirementId) }
        return
      }
      if (key === 'o') {
        const claim = assessments[focusedRequirement]?.claims.find(item => item.sourceUrl)
        if (claim?.sourceUrl) { event.preventDefault(); window.open(claim.sourceUrl, '_blank', 'noopener,noreferrer') }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advance, assessments, exit, focusedRequirement, pendingDecision, requestDecision, toggleRequirement, undo])

  if (!role) {
    return <main className={styles.shell}><div className={styles.loading}>{mode === 'checking' ? 'Loading review session…' : `Role not found. ${message}`}</div></main>
  }

  if (!snapshot) return <main className={styles.shell}><div className={styles.loading}>Preparing bounded review set…</div></main>

  if (!snapshot.candidateIds.length) {
    return <main className={styles.shell}>
      <section className={styles.empty}>
        <span className={styles.eyebrow}>Review complete</span>
        <h1>Nothing pending for {role.intake.title}</h1>
        <p>Every candidate currently in this role has a recruiter-authored review state. New discoveries will join a future session, not this completed one.</p>
        <button className={styles.primaryButton} onClick={finish}>Back to role</button>
      </section>
    </main>
  }

  if (!candidate) return <main className={styles.shell}><div className={styles.loading}>Candidate is no longer available in this role.</div></main>

  const progress = `${index + 1} of ${snapshot.candidateIds.length}`

  return <main className={styles.shell}>
    <header className={styles.sessionBar}>
      <div className={styles.sessionIdentity}>
        <span className={styles.eyebrow}>Evidence review</span>
        <strong>{role.intake.title}</strong>
        <span>{role.intake.location || 'Location not specified'}</span>
      </div>
      <div className={styles.progressBlock}>
        <strong>{progress}</strong>
        <span>{decidedCount} decided · {snapshot.candidateIds.length - decidedCount} pending</span>
      </div>
      <div className={styles.topActions}>
        <button className={styles.textButton} onClick={() => setShortcutsOpen(value => !value)}>Shortcuts <kbd>?</kbd></button>
        <button className={styles.textButton} onClick={exit}>Exit</button>
        <button className={styles.primaryButton} onClick={finish}>Finish review</button>
      </div>
    </header>

    <section className={styles.workspace}>
      <section className={styles.requirementsPane} aria-label="Requirement evidence">
        <div className={styles.paneHeader}>
          <div>
            <span className={styles.eyebrow}>Requirements first</span>
            <h1>Does the evidence meet the brief?</h1>
          </div>
          <p className={styles.tally}>{displayTally(assessments)}</p>
        </div>

        {evidenceLoading && <div className={styles.loadingRows}>Loading validated evidence…</div>}
        {evidenceError && <div className={styles.providerError}><strong>Evidence source error</strong><span>{evidenceError}</span><small>This is not the same as “no evidence found.”</small></div>}

        <div className={styles.requirementGroups}>
          {(['must_have', 'preferred', 'disqualifier'] as const).map(tier => {
            const group = assessments.filter(item => item.tier === tier)
            if (!group.length) return null
            return <section key={tier} className={styles.requirementGroup}>
              <h2>{tier === 'must_have' ? 'Must haves' : tier === 'preferred' ? 'Preferred' : 'Disqualifiers'}</h2>
              {group.map(assessment => {
                const absoluteIndex = assessments.findIndex(item => item.requirementId === assessment.requirementId)
                const state = displayRequirementStateV41(assessment)
                const isExpanded = expanded.has(assessment.requirementId)
                const isFocused = absoluteIndex === focusedRequirement
                const quotes = sourceClaims(assessment)
                return <article key={assessment.requirementId} className={`${styles.requirementCard} ${isFocused ? styles.focused : ''}`}>
                  <button className={styles.requirementSummary} onClick={() => { setFocusedRequirement(absoluteIndex); toggleRequirement(assessment.requirementId) }} aria-expanded={isExpanded}>
                    <span className={`${styles.stateBadge} ${stateClass(state)}`}>{requirementStateLabelV41(assessment)}</span>
                    <span className={styles.requirementText}>{assessment.requirementText}</span>
                    <span className={styles.requirementMeta}>{tierLabel(assessment.tier)} · {quotes.length || assessment.claims.length} source{(quotes.length || assessment.claims.length) === 1 ? '' : 's'}</span>
                    <span className={styles.expandIcon}>{isExpanded ? '−' : '+'}</span>
                  </button>
                  {isExpanded && <div className={styles.evidenceDetail}>
                    {assessment.kind === 'clearance' && <div className={styles.clearanceNotice}>Clearance status cannot be verified from public sources. Confirm directly.</div>}
                    {state === 'unknown' && !evidenceError && <p className={styles.noEvidence}>No public evidence found. Missing evidence is not a negative finding.</p>}
                    {quotes.map(claim => <blockquote key={claim.id} className={styles.quote}>
                      <p>“{claim.spanText}”</p>
                      <footer>
                        <span>{claim.source}</span>
                        <span>{claim.sourceType.replaceAll('_', ' ')}</span>
                        <span>Retrieved {formatDate(claim.retrievedAt)}</span>
                        {claim.sourceUrl && <a href={claim.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}
                      </footer>
                    </blockquote>)}
                    {assessment.contradictions.map(claim => <div className={styles.contradiction} key={`contradiction-${claim.id}`}><strong>Contradicting evidence</strong><span>{claim.spanText || claim.detail || claim.claimedValue}</span>{claim.sourceUrl && <a href={claim.sourceUrl} target="_blank" rel="noreferrer">Open source</a>}</div>)}
                    <div className={styles.rationale}><strong>Why this state</strong><p>{assessment.rationale}</p></div>
                  </div>}
                </article>
              })}
            </section>
          })}
          {!assessments.length && !evidenceLoading && <div className={styles.noEvidence}>This role has no structured must-have, preferred, disqualifier, or clearance requirements to assess yet.</div>}
        </div>
      </section>

      <aside className={styles.candidatePane} aria-label="Candidate context">
        <div className={styles.candidateHeader}>
          <span className={styles.eyebrow}>Candidate context</span>
          <h2>{candidate.name}</h2>
          <p>{candidate.headline || candidate.company || 'Professional profile'}</p>
          <div className={styles.contextLine}><span>{candidate.company || 'Company not recorded'}</span><span>{candidate.location || 'Location not recorded'}</span></div>
        </div>

        <section className={styles.contextSection}>
          <h3>Current review state</h3>
          <div className={styles.contextGrid}>
            <div><span>Decision</span><strong>{candidate.fitDecision.replaceAll('_', ' ')}</strong></div>
            <div><span>Evidence</span><strong>{candidate.evidenceStatus.replaceAll('_', ' ')}</strong></div>
            <div><span>Stage</span><strong>{candidate.stage.replaceAll('_', ' ')}</strong></div>
            <div><span>Source</span><strong>{candidate.source || 'Unknown'}</strong></div>
          </div>
          <p className={styles.boundary}>Review decisions do not automatically move this candidate to another pipeline stage.</p>
        </section>

        {(candidate.fitReasons.length > 0 || candidate.concerns.length > 0) && <section className={styles.contextSection}>
          <h3>Recruiter context</h3>
          {candidate.fitReasons.length > 0 && <div className={styles.contextList}><strong>Recorded reasons</strong>{candidate.fitReasons.map(value => <span key={value}>{value}</span>)}</div>}
          {candidate.concerns.length > 0 && <div className={styles.contextList}><strong>Recorded concerns</strong>{candidate.concerns.map(value => <span key={value}>{value}</span>)}</div>}
        </section>}

        <section className={styles.contextSection}>
          <h3>Evidence discipline</h3>
          <p>Only validated source quotations can support requirements. Unknown stays neutral. Contradictions remain visible. Search terms never become candidate evidence.</p>
        </section>
      </aside>
    </section>

    <footer className={styles.decisionBar}>
      <div className={styles.navigationActions}>
        <button onClick={() => advance(-1)} disabled={index === 0}>← Previous <kbd>K</kbd></button>
        <button onClick={() => advance(1)} disabled={index >= snapshot.candidateIds.length - 1}>Next <kbd>J</kbd> →</button>
      </div>
      <div className={styles.decisionActions}>
        <button className={styles.notFitButton} onClick={() => requestDecision('not_fit')}>Not a fit <kbd>X</kbd></button>
        <button className={styles.verifyButton} onClick={() => requestDecision('needs_verification')}>Needs verification <kbd>V</kbd></button>
        <button className={styles.fitButton} onClick={() => requestDecision('evidence_fit')}>Evidence fit <kbd>F</kbd></button>
        <button className={styles.undoButton} onClick={undo} disabled={!lastMutation}>Undo <kbd>U</kbd></button>
      </div>
    </footer>

    {completed && <div className={styles.completedToast}>Session complete. Review the final candidate or choose Finish review.</div>}

    {pendingDecision && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Add review note">
      <div className={styles.noteCard}>
        <span className={styles.eyebrow}>Shift + decision</span>
        <h2>Add a note before committing</h2>
        <textarea ref={noteRef} value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="Recruiter-authored context…" maxLength={1000} />
        <div className={styles.noteActions}><button onClick={() => { setPendingDecision(null); setNoteDraft('') }}>Cancel</button><button className={styles.primaryButton} onClick={() => commitDecision(pendingDecision, noteDraft)}>Save decision</button></div>
      </div>
    </div>}

    {shortcutsOpen && <div className={styles.shortcuts}>
      <strong>Keyboard</strong>
      <span>F Evidence fit · X Not a fit · V Needs verification</span>
      <span>Shift + decision Add note first · U Undo</span>
      <span>J / → Next · K / ← Previous</span>
      <span>1–9 Focus requirement · E Expand · O Open source</span>
      <span>Esc Exit with progress kept · ? Toggle this guide</span>
    </div>}
  </main>
}
