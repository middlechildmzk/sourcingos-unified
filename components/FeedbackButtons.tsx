'use client'
import { useState } from 'react'
import { recordFeedback, type FeedbackType } from '@/lib/feedback/project-memory'

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackButtons — recruiter feedback that updates local project memory.
// Project-scoped, inspectable, resettable. Informs future suggestions only —
// never trains an external model, never auto-acts.
// ─────────────────────────────────────────────────────────────────────────────

interface FeedbackButtonsProps {
  projectId?: string
  sourceProfileId?: string
  candidateId?: string
  searchQuery?: string
  matchedSkills?: string[]
  source?: string
  title?: string
}

const QUICK: { type: FeedbackType; label: string; tone: 'pos' | 'neg' | 'neutral' }[] = [
  { type: 'good_fit', label: '👍 Good fit', tone: 'pos' },
  { type: 'maybe_needs_review', label: '🤔 Maybe', tone: 'neutral' },
  { type: 'not_a_fit', label: '👎 Not a fit', tone: 'neg' },
  { type: 'false_positive', label: '✕ False positive', tone: 'neg' },
]

export function FeedbackButtons(props: FeedbackButtonsProps) {
  const [recorded, setRecorded] = useState<FeedbackType | null>(null)

  function give(type: FeedbackType) {
    recordFeedback({
      projectId: props.projectId || 'default',
      sourceProfileId: props.sourceProfileId,
      candidateId: props.candidateId,
      searchSessionQuery: props.searchQuery,
      feedbackType: type,
      matchedSkills: props.matchedSkills,
      source: props.source,
      title: props.title,
    })
    setRecorded(type)
  }

  return (
    <div className="feedback-buttons">
      <span className="feedback-label">Feedback (improves this project&apos;s suggestions)</span>
      <div className="feedback-row">
        {QUICK.map(q => (
          <button
            key={q.type}
            className={`feedback-btn feedback-${q.tone} ${recorded === q.type ? 'active' : ''}`}
            onClick={() => give(q.type)}
          >
            {q.label}
          </button>
        ))}
      </div>
      {recorded && <span className="feedback-confirm">✓ Recorded — used to improve future searches in this project.</span>}
    </div>
  )
}
