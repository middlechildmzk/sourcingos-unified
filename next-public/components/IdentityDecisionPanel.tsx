'use client'

import { useMemo, useState } from 'react'

type IdentityDecisionAction = 'approve' | 'keep_separate' | 'reject'

type DecisionProposal = {
  id: string
  status: string
  blockingConflictCount: number
  incoming: {
    displayName: string
    source: string
  }
  proposedCandidate: {
    canonicalName: string
  }
  decisionPreconditions: {
    proposalUpdatedAt: string
    sourceUpdatedAt: string
  }
  decisionControls: {
    enabled: boolean
    actions: IdentityDecisionAction[]
    bulkDecisions: false
    automaticAttachment: false
  }
}

type DecisionResponse = {
  ok?: boolean
  available?: boolean
  code?: string
  error?: string
  eventId?: string
}

type Props = {
  proposal: DecisionProposal
  onDecisionComplete: (message: string) => void
  onReloadRequested: () => void
}

const ACTIONS: Record<IdentityDecisionAction, {
  label: string
  submitLabel: string
  confirmation: 'attach_source_profile' | 'keep_profiles_separate' | 'reject_identity_proposal'
  summary: string
  consequence: string
}> = {
  approve: {
    label: 'Approve source attachment',
    submitLabel: 'Approve and attach this source profile',
    confirmation: 'attach_source_profile',
    summary: 'Confirm these public source records represent the same person.',
    consequence: 'Only this source profile and records explicitly tied to it move to the proposed canonical candidate. The provisional candidate is preserved.',
  },
  keep_separate: {
    label: 'Keep profiles separate',
    submitLabel: 'Keep these profiles separate',
    confirmation: 'keep_profiles_separate',
    summary: 'Record that the profiles should remain separate people.',
    consequence: 'No source profile, evidence, contact signal, availability signal, or candidate record is moved.',
  },
  reject: {
    label: 'Reject proposal',
    submitLabel: 'Reject this identity proposal',
    confirmation: 'reject_identity_proposal',
    summary: 'Reject this proposed identity relationship.',
    consequence: 'The proposal is closed as rejected. The source profile and both candidate records remain unchanged.',
  },
}

function words(value: string) {
  return value.replaceAll('_', ' ')
}

export function IdentityDecisionPanel({ proposal, onDecisionComplete, onReloadRequested }: Props) {
  const [intent, setIntent] = useState<IdentityDecisionAction | null>(null)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = intent ? ACTIONS[intent] : null
  const reasonLength = reason.trim().length
  const reasonValid = reasonLength >= 10 && reasonLength <= 1000
  const canSubmit = Boolean(intent && confirmed && reasonValid && !submitting)
  const isPending = proposal.status === 'pending'
  const approveBlocked = proposal.blockingConflictCount > 0

  const activationMessage = useMemo(() => {
    if (!isPending) return `This proposal is ${words(proposal.status)} and cannot be decided again.`
    if (!proposal.decisionControls.enabled) return 'Decision controls are built but held. The server activation flag and quarantined SQL require a separate release approval.'
    return 'Each action is single-proposal, recruiter-confirmed, audited, and protected by stale-record checks.'
  }, [isPending, proposal.decisionControls.enabled, proposal.status])

  function open(action: IdentityDecisionAction) {
    setIntent(action)
    setReason('')
    setConfirmed(false)
    setError(null)
  }

  function close() {
    if (submitting) return
    setIntent(null)
    setReason('')
    setConfirmed(false)
    setError(null)
  }

  async function submit() {
    if (!intent || !config || !canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/identity/proposals/${encodeURIComponent(proposal.id)}/decision`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: intent,
          reason: reason.trim(),
          expectedProposalUpdatedAt: proposal.decisionPreconditions.proposalUpdatedAt,
          expectedSourceUpdatedAt: proposal.decisionPreconditions.sourceUpdatedAt,
          confirmation: config.confirmation,
        }),
      })
      const json = await response.json() as DecisionResponse

      if (!response.ok || !json.ok) {
        const message = json.error || 'The identity decision was not applied.'
        setError(message)
        if (response.status === 409 || json.code?.includes('stale') || json.code === 'identity_proposal_not_pending') {
          onReloadRequested()
        }
        return
      }

      const successMessage = intent === 'approve'
        ? `Approved the source-profile attachment for ${proposal.incoming.displayName}. The provisional candidate was preserved.`
        : intent === 'keep_separate'
          ? `Recorded ${proposal.incoming.displayName} and ${proposal.proposedCandidate.canonicalName} as separate profiles.`
          : `Rejected the identity proposal for ${proposal.incoming.displayName}.`

      close()
      onDecisionComplete(successMessage)
    } catch {
      setError('The identity decision request failed before a result was confirmed. Reload the proposal before trying again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <section aria-label="Recruiter identity decision" style={{ display: 'grid', gap: 10 }}>
    <div className="cta" style={{ marginBottom: 0 }}>
      <strong>Recruiter-controlled decision.</strong> {activationMessage}
    </div>

    {isPending && <div className="button-row" style={{ flexWrap: 'wrap' }}>
      <button
        type="button"
        className="btn"
        disabled={!proposal.decisionControls.enabled || approveBlocked}
        onClick={() => open('approve')}
        title={approveBlocked ? 'Approval is blocked by recorded negative identity evidence.' : undefined}
      >
        Approve source attachment
      </button>
      <button
        type="button"
        className="btn secondary"
        disabled={!proposal.decisionControls.enabled}
        onClick={() => open('keep_separate')}
      >
        Keep profiles separate
      </button>
      <button
        type="button"
        className="btn ghost"
        disabled={!proposal.decisionControls.enabled}
        onClick={() => open('reject')}
      >
        Reject proposal
      </button>
    </div>}

    {approveBlocked && isPending && <p className="muted" style={{ margin: 0 }}>
      Approval is disabled because this proposal has {proposal.blockingConflictCount} blocking conflict{proposal.blockingConflictCount === 1 ? '' : 's'}. Keep-separate and reject remain valid recruiter actions after activation.
    </p>}

    {intent && config && <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-decision-title"
      className="product-panel"
      style={{ borderColor: intent === 'approve' ? 'var(--accent)' : undefined }}
    >
      <div className="product-panel-head">
        <div>
          <span className="kicker">Confirm one proposal</span>
          <h3 id="identity-decision-title">{config.label}</h3>
        </div>
        <button type="button" className="btn ghost" onClick={close} disabled={submitting}>Cancel</button>
      </div>

      <div className="product-list">
        <div className="product-row">
          <div className="product-row-main">
            <div className="product-row-title">{proposal.incoming.displayName}</div>
            <div className="product-row-meta">Incoming {words(proposal.incoming.source)} source profile</div>
          </div>
          <span aria-hidden="true">→</span>
          <div className="product-row-main" style={{ textAlign: 'right' }}>
            <div className="product-row-title">{proposal.proposedCandidate.canonicalName}</div>
            <div className="product-row-meta">Proposed canonical candidate</div>
          </div>
        </div>
      </div>

      <p>{config.summary}</p>
      <p className="muted">{config.consequence}</p>

      <label style={{ display: 'grid', gap: 6 }}>
        <strong>Audit reason</strong>
        <textarea
          value={reason}
          onChange={event => setReason(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Explain the public evidence and recruiter judgment behind this decision. Do not add private or sensitive personal information."
          disabled={submitting}
        />
        <span className="muted" style={{ fontSize: 11 }}>
          {reasonLength}/1000 characters. Minimum 10.
        </span>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)}
          disabled={submitting}
        />
        <span>I reviewed the displayed evidence, conflicts, source profile, and proposed candidate. I understand this action is audited and applies only to this proposal.</span>
      </label>

      {error && <div className="cta" role="alert" style={{ marginBottom: 0 }}>{error}</div>}

      <div className="button-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="btn secondary" onClick={close} disabled={submitting}>Cancel</button>
        <button type="button" className="btn" onClick={() => void submit()} disabled={!canSubmit}>
          {submitting ? 'Applying audited decision…' : config.submitLabel}
        </button>
      </div>
    </div>}
  </section>
}
