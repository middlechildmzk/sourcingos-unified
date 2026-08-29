import type { CalibrationInsight, CalibrationState } from './calibration-intelligence'
import type { RoleCandidate, RoleWorkspace } from './role-workspace'

const FEEDBACK_PREFIX = 'ci-disqualifier_pattern-feedback-'
const MIN_SUPPORT = 2

function normalizedConcern(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function displayConcern(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 100)
}

function stableFeedbackId(subject: string): string {
  const slug = normalizedConcern(subject).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55)
  return `${FEEDBACK_PREFIX}${slug || 'concern'}`
}

function confidenceFor(supporting: number, contradicting: number): CalibrationInsight['confidence'] {
  if (supporting >= 5 && contradicting === 0) return 'strong'
  if (supporting >= 3 && contradicting <= 1) return 'moderate'
  return 'emerging'
}

function candidateHasConcern(candidate: RoleCandidate, subject: string): boolean {
  const target = normalizedConcern(subject)
  return candidate.concerns.some(concern => normalizedConcern(concern) === target)
}

export function isFeedbackRejectionInsight(insight: CalibrationInsight): boolean {
  return insight.id.startsWith(FEEDBACK_PREFIX)
}

export function splitFeedbackRejectionInsights(state: CalibrationState | undefined): {
  baseState: CalibrationState | undefined
  feedbackInsights: CalibrationInsight[]
} {
  if (!state) return { baseState: undefined, feedbackInsights: [] }
  const feedbackInsights = state.insights.filter(isFeedbackRejectionInsight)
  return {
    feedbackInsights,
    baseState: { ...state, insights: state.insights.filter(insight => !isFeedbackRejectionInsight(insight)) },
  }
}

export function reconcileRepeatedRejectionInsights(
  workspace: RoleWorkspace,
  state: CalibrationState,
  previousFeedback: CalibrationInsight[] = [],
  now = new Date().toISOString(),
): CalibrationState {
  const rejected = workspace.candidates.filter(candidate => candidate.fitDecision === 'not_fit')
  const advancing = workspace.candidates.filter(candidate => candidate.fitDecision === 'strong_fit' || candidate.fitDecision === 'possible_fit')
  const grouped = new Map<string, { display: string; candidates: RoleCandidate[] }>()

  for (const candidate of rejected) {
    for (const concern of candidate.concerns) {
      const normalized = normalizedConcern(concern)
      const display = displayConcern(concern)
      if (normalized.length < 3 || normalized.length > 100 || !display) continue
      const current = grouped.get(normalized) || { display, candidates: [] }
      if (!current.candidates.some(item => item.id === candidate.id)) current.candidates.push(candidate)
      grouped.set(normalized, current)
    }
  }

  const previousById = new Map(previousFeedback.map(insight => [insight.id, insight]))
  const nextFeedback: CalibrationInsight[] = []
  const events = [...state.events]

  for (const { display: subject, candidates: supporting } of [...grouped.values()].sort((a, b) => a.display.localeCompare(b.display))) {
    if (supporting.length < MIN_SUPPORT) continue
    const id = stableFeedbackId(subject)
    const contradicting = advancing.filter(candidate => candidateHasConcern(candidate, subject))
    const prior = previousById.get(id)
    const fresh = {
      statement: `Repeated not-fit decisions carry the recorded concern “${subject}”. Treat it as a proposed search or review exclusion only if the recruiter approves it.`,
      evidenceClass: 'disqualifier_pattern' as const,
      confidence: confidenceFor(supporting.length, contradicting.length),
      subject,
      supportingCandidateIds: supporting.map(candidate => candidate.id),
      contradictingCandidateIds: contradicting.map(candidate => candidate.id),
      positiveExamples: supporting.slice(0, 5).map(candidate => candidate.name),
      negativeExamples: contradicting.slice(0, 5).map(candidate => candidate.name),
      contradictionNote: contradicting.length
        ? `${contradicting.length} advancing candidate${contradicting.length === 1 ? '' : 's'} also carries this concern, so it should not become a hard exclusion without recruiter judgment.`
        : '',
    }

    if (!prior) {
      nextFeedback.push({
        id,
        ...fresh,
        status: 'proposed',
        scope: 'role',
        derivedAt: now,
        updatedAt: now,
      })
      events.push({
        id: `ce-${id}-derived-${now}`,
        insightId: id,
        type: 'insight_derived',
        message: `Repeated rejection concern detected from candidate decisions: ${subject}.`,
        createdAt: now,
      })
      continue
    }

    const evidenceChanged =
      prior.supportingCandidateIds.join('|') !== fresh.supportingCandidateIds.join('|') ||
      prior.contradictingCandidateIds.join('|') !== fresh.contradictingCandidateIds.join('|')
    nextFeedback.push({
      ...prior,
      ...fresh,
      derivedAt: now,
      updatedAt: evidenceChanged ? now : prior.updatedAt,
    })
    if (evidenceChanged) {
      events.push({
        id: `ce-${id}-updated-${now}`,
        insightId: id,
        type: 'insight_updated',
        message: `Supporting rejection evidence changed for: ${subject}.`,
        createdAt: now,
      })
    }
  }

  const currentIds = new Set(nextFeedback.map(insight => insight.id))
  for (const prior of previousFeedback) {
    if (currentIds.has(prior.id)) continue
    if (prior.status !== 'proposed') nextFeedback.push(prior)
  }

  return {
    insights: [...state.insights, ...nextFeedback].sort((a, b) => a.id.localeCompare(b.id)),
    events: events.slice(-500),
    updatedAt: now,
  }
}
