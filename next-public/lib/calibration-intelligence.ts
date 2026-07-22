import type { RoleCandidate, RoleIntake, RoleWorkspace, SearchLane } from './role-workspace'

// Calibration intelligence for SourcingOS role workspaces.
//
// Design rules (non-negotiable):
// - Deterministic: same workspace input always derives the same insights.
// - Evidence-linked: every insight lists the exact candidate decisions that produced it.
// - Recruiter-controlled: no derived insight affects ranking or lanes until approved.
// - Contradictions stay visible: opposing decisions are never hidden or averaged away.
// - Rollback is first-class: every review action is an event and can be reversed.
// - Nothing here is a verified fact. Insights are patterns in recorded recruiter
//   decisions, and the copy in this module must always say so.

export type InsightStatus = 'proposed' | 'approved' | 'edited' | 'rejected' | 'paused'
export type InsightScope = 'role' | 'organization'
export type InsightConfidence = 'emerging' | 'moderate' | 'strong'
export type InsightEvidenceClass =
  | 'decision_pattern'
  | 'disqualifier_pattern'
  | 'adjacent_acceptance'
  | 'company_signal'
  | 'evidence_hygiene'

export type CalibrationInsight = {
  id: string
  statement: string
  editedStatement?: string
  evidenceClass: InsightEvidenceClass
  confidence: InsightConfidence
  status: InsightStatus
  scope: InsightScope
  subject: string
  supportingCandidateIds: string[]
  contradictingCandidateIds: string[]
  positiveExamples: string[]
  negativeExamples: string[]
  contradictionNote: string
  derivedAt: string
  reviewedAt?: string
  updatedAt: string
}

export type CalibrationEventType =
  | 'insight_derived'
  | 'insight_updated'
  | 'insight_approved'
  | 'insight_edited'
  | 'insight_rejected'
  | 'insight_paused'
  | 'insight_scope_changed'
  | 'insight_rolled_back'

export type CalibrationEvent = {
  id: string
  insightId: string
  type: CalibrationEventType
  message: string
  createdAt: string
}

export type CalibrationState = {
  insights: CalibrationInsight[]
  events: CalibrationEvent[]
  updatedAt: string
}

export const INSIGHT_STATUSES: ReadonlySet<InsightStatus> = new Set(['proposed', 'approved', 'edited', 'rejected', 'paused'])
export const INSIGHT_SCOPES: ReadonlySet<InsightScope> = new Set(['role', 'organization'])
export const INSIGHT_CONFIDENCES: ReadonlySet<InsightConfidence> = new Set(['emerging', 'moderate', 'strong'])
export const INSIGHT_EVIDENCE_CLASSES: ReadonlySet<InsightEvidenceClass> = new Set([
  'decision_pattern', 'disqualifier_pattern', 'adjacent_acceptance', 'company_signal', 'evidence_hygiene',
])

export function emptyCalibrationState(now = new Date().toISOString()): CalibrationState {
  return { insights: [], events: [], updatedAt: now }
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase()
}

function candidateText(candidate: RoleCandidate): string {
  return [candidate.headline, candidate.company, ...candidate.fitReasons, ...candidate.tags].join(' \n ').toLowerCase()
}

function concernText(candidate: RoleCandidate): string {
  return candidate.concerns.join(' \n ').toLowerCase()
}

function mentionsTerm(candidate: RoleCandidate, term: string): boolean {
  const needle = normalizeTerm(term)
  if (!needle) return false
  return candidateText(candidate).includes(needle) || concernText(candidate).includes(needle)
}

function stableInsightId(evidenceClass: InsightEvidenceClass, subject: string): string {
  const slug = normalizeTerm(subject).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `ci-${evidenceClass}-${slug || 'general'}`
}

function confidenceFor(supporting: number, contradicting: number): InsightConfidence {
  if (supporting >= 5 && contradicting === 0) return 'strong'
  if (supporting >= 3 && contradicting <= 1) return 'moderate'
  return 'emerging'
}

function names(candidates: RoleCandidate[], max = 5): string[] {
  return candidates.slice(0, max).map(candidate => candidate.name).filter(Boolean)
}

const MIN_SUPPORT = 2

type DerivedInsight = Omit<CalibrationInsight, 'status' | 'scope' | 'reviewedAt' | 'editedStatement' | 'updatedAt'>

// Derive candidate-decision patterns for one role workspace. Pure and deterministic.
export function deriveCalibrationInsights(workspace: RoleWorkspace, now = new Date().toISOString()): DerivedInsight[] {
  const decided = workspace.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed')
  const strong = decided.filter(candidate => candidate.fitDecision === 'strong_fit')
  const possible = decided.filter(candidate => candidate.fitDecision === 'possible_fit')
  const rejectedCandidates = decided.filter(candidate => candidate.fitDecision === 'not_fit')
  const derived: DerivedInsight[] = []

  // 1. Must-have decision patterns: a must-have term that separates strong fits from not fits.
  for (const mustHave of workspace.intake.mustHaves) {
    const supporting = strong.filter(candidate => mentionsTerm(candidate, mustHave))
    const rejectedWithout = rejectedCandidates.filter(candidate => !mentionsTerm(candidate, mustHave))
    const contradicting = strong.filter(candidate => !mentionsTerm(candidate, mustHave))
    if (supporting.length < MIN_SUPPORT) continue
    derived.push({
      id: stableInsightId('decision_pattern', mustHave),
      statement: `Strong-fit decisions consistently show recorded ${mustHave} signals. Candidates without them have mostly been declined.`,
      evidenceClass: 'decision_pattern',
      confidence: confidenceFor(supporting.length, contradicting.length),
      subject: mustHave,
      supportingCandidateIds: supporting.map(candidate => candidate.id),
      contradictingCandidateIds: contradicting.map(candidate => candidate.id),
      positiveExamples: names(supporting),
      negativeExamples: names(rejectedWithout),
      contradictionNote: contradicting.length
        ? `${contradicting.length} strong-fit decision${contradicting.length === 1 ? '' : 's'} lack a recorded ${mustHave} signal, so this pattern is not absolute.`
        : '',
      derivedAt: now,
    })
  }

  // 2. Disqualifier enforcement: not-fit decisions whose recorded concerns match an intake disqualifier.
  for (const disqualifier of workspace.intake.disqualifiers) {
    const supporting = rejectedCandidates.filter(candidate => concernText(candidate).includes(normalizeTerm(disqualifier)))
    const contradicting = [...strong, ...possible].filter(candidate => concernText(candidate).includes(normalizeTerm(disqualifier)))
    if (supporting.length < MIN_SUPPORT) continue
    derived.push({
      id: stableInsightId('disqualifier_pattern', disqualifier),
      statement: `The recorded decisions enforce "${disqualifier}" as a real disqualifier, not a soft preference.`,
      evidenceClass: 'disqualifier_pattern',
      confidence: confidenceFor(supporting.length, contradicting.length),
      subject: disqualifier,
      supportingCandidateIds: supporting.map(candidate => candidate.id),
      contradictingCandidateIds: contradicting.map(candidate => candidate.id),
      positiveExamples: names(supporting),
      negativeExamples: [],
      contradictionNote: contradicting.length
        ? `${contradicting.length} advancing candidate${contradicting.length === 1 ? '' : 's'} carry this concern, so the recruiter is sometimes accepting it.`
        : '',
      derivedAt: now,
    })
  }

  // 3. Adjacent background acceptance: approved adjacent backgrounds actually advancing.
  for (const background of workspace.intake.adjacentBackgrounds) {
    const advancing = [...strong, ...possible].filter(candidate => mentionsTerm(candidate, background))
    const declined = rejectedCandidates.filter(candidate => mentionsTerm(candidate, background))
    if (advancing.length < MIN_SUPPORT) continue
    derived.push({
      id: stableInsightId('adjacent_acceptance', background),
      statement: `The recruiter is accepting adjacent ${background} backgrounds when other recorded signals support the move.`,
      evidenceClass: 'adjacent_acceptance',
      confidence: confidenceFor(advancing.length, declined.length),
      subject: background,
      supportingCandidateIds: advancing.map(candidate => candidate.id),
      contradictingCandidateIds: declined.map(candidate => candidate.id),
      positiveExamples: names(advancing),
      negativeExamples: names(declined),
      contradictionNote: declined.length
        ? `${declined.length} candidate${declined.length === 1 ? '' : 's'} with this background were declined, so the background alone is not sufficient.`
        : '',
      derivedAt: now,
    })
  }

  // 4. Target company signal: strong fits concentrated in intake target companies.
  const targetCompanies = workspace.intake.targetCompanies.map(normalizeTerm).filter(Boolean)
  if (targetCompanies.length) {
    const supporting = strong.filter(candidate => targetCompanies.some(company => normalizeTerm(candidate.company).includes(company)))
    const contradicting = rejectedCandidates.filter(candidate => targetCompanies.some(company => normalizeTerm(candidate.company).includes(company)))
    if (supporting.length >= MIN_SUPPORT) {
      derived.push({
        id: stableInsightId('company_signal', 'target-companies'),
        statement: 'Strong-fit decisions are concentrating in the intake target companies, which supports company-first search lanes.',
        evidenceClass: 'company_signal',
        confidence: confidenceFor(supporting.length, contradicting.length),
        subject: 'target companies',
        supportingCandidateIds: supporting.map(candidate => candidate.id),
        contradictingCandidateIds: contradicting.map(candidate => candidate.id),
        positiveExamples: names(supporting),
        negativeExamples: names(contradicting),
        contradictionNote: contradicting.length
          ? `${contradicting.length} target-company candidate${contradicting.length === 1 ? '' : 's'} were still declined, so company alone is not a fit signal.`
          : '',
        derivedAt: now,
      })
    }
  }

  // 5. Evidence hygiene: decisions made on conflicting or stale evidence.
  const riskyDecided = decided.filter(candidate => candidate.evidenceStatus === 'conflicting' || candidate.evidenceStatus === 'stale')
  if (riskyDecided.length >= MIN_SUPPORT) {
    derived.push({
      id: stableInsightId('evidence_hygiene', 'unresolved-evidence'),
      statement: 'Several decisions were recorded while evidence was still conflicting or stale. Those calls should be revisited before they shape the search.',
      evidenceClass: 'evidence_hygiene',
      confidence: 'emerging',
      subject: 'unresolved evidence',
      supportingCandidateIds: riskyDecided.map(candidate => candidate.id),
      contradictingCandidateIds: [],
      positiveExamples: names(riskyDecided),
      negativeExamples: [],
      contradictionNote: '',
      derivedAt: now,
    })
  }

  return derived.sort((a, b) => a.id.localeCompare(b.id))
}

// Merge freshly derived insights with the recruiter-reviewed state.
// Reviewer decisions always win. Evidence and confidence refresh on re-derivation.
// Proposed insights that are no longer supported by the decisions disappear.
// Reviewed insights that lose derivation support are kept with their review intact.
export function reconcileCalibrationState(
  workspace: RoleWorkspace,
  existing: CalibrationState | undefined,
  now = new Date().toISOString()
): CalibrationState {
  const state = existing && Array.isArray(existing.insights) && Array.isArray(existing.events)
    ? existing
    : emptyCalibrationState(now)
  const derived = deriveCalibrationInsights(workspace, now)
  const derivedById = new Map(derived.map(insight => [insight.id, insight]))
  const existingById = new Map(state.insights.map(insight => [insight.id, insight]))
  const nextInsights: CalibrationInsight[] = []
  const nextEvents: CalibrationEvent[] = [...state.events]

  for (const fresh of derived) {
    const prior = existingById.get(fresh.id)
    if (!prior) {
      nextInsights.push({ ...fresh, status: 'proposed', scope: 'role', updatedAt: now })
      nextEvents.push({
        id: `ce-${fresh.id}-derived-${now}`,
        insightId: fresh.id,
        type: 'insight_derived',
        message: `New pattern detected from candidate decisions: ${fresh.subject}.`,
        createdAt: now,
      })
      continue
    }
    const evidenceChanged =
      prior.supportingCandidateIds.join('|') !== fresh.supportingCandidateIds.join('|') ||
      prior.contradictingCandidateIds.join('|') !== fresh.contradictingCandidateIds.join('|')
    nextInsights.push({
      ...prior,
      statement: fresh.statement,
      confidence: fresh.confidence,
      supportingCandidateIds: fresh.supportingCandidateIds,
      contradictingCandidateIds: fresh.contradictingCandidateIds,
      positiveExamples: fresh.positiveExamples,
      negativeExamples: fresh.negativeExamples,
      contradictionNote: fresh.contradictionNote,
      derivedAt: fresh.derivedAt,
      updatedAt: evidenceChanged ? now : prior.updatedAt,
    })
    if (evidenceChanged) {
      nextEvents.push({
        id: `ce-${fresh.id}-updated-${now}`,
        insightId: fresh.id,
        type: 'insight_updated',
        message: `Supporting evidence changed for: ${fresh.subject}.`,
        createdAt: now,
      })
    }
  }

  for (const prior of state.insights) {
    if (derivedById.has(prior.id)) continue
    if (prior.status === 'proposed') continue // unsupported and never reviewed: drop
    nextInsights.push(prior) // reviewed insights survive with their review intact
  }

  nextInsights.sort((a, b) => a.id.localeCompare(b.id))
  return { insights: nextInsights, events: nextEvents.slice(-500), updatedAt: now }
}

export type InsightAction = 'approve' | 'edit' | 'reject' | 'pause' | 'set_scope' | 'rollback'

// Apply one recruiter review action. Pure: returns a new state plus the event recorded.
export function applyInsightAction(
  state: CalibrationState,
  insightId: string,
  action: InsightAction,
  options: { editedStatement?: string; scope?: InsightScope } = {},
  now = new Date().toISOString()
): { state: CalibrationState; event: CalibrationEvent | null; error?: string } {
  const insight = state.insights.find(item => item.id === insightId)
  if (!insight) return { state, event: null, error: 'Insight not found.' }

  let updated: CalibrationInsight = insight
  let type: CalibrationEventType | null = null
  let message = ''

  if (action === 'approve') {
    updated = { ...insight, status: 'approved', reviewedAt: now, updatedAt: now }
    type = 'insight_approved'
    message = `Approved: ${insight.subject}. Approved learning may now influence ranking and lane recommendations.`
  } else if (action === 'edit') {
    const edited = (options.editedStatement || '').trim()
    if (!edited) return { state, event: null, error: 'An edited statement is required.' }
    updated = { ...insight, status: 'edited', editedStatement: edited.slice(0, 500), reviewedAt: now, updatedAt: now }
    type = 'insight_edited'
    message = `Edited and adopted: ${insight.subject}.`
  } else if (action === 'reject') {
    updated = { ...insight, status: 'rejected', reviewedAt: now, updatedAt: now }
    type = 'insight_rejected'
    message = `Rejected: ${insight.subject}. This pattern will not influence the search.`
  } else if (action === 'pause') {
    updated = { ...insight, status: 'paused', reviewedAt: now, updatedAt: now }
    type = 'insight_paused'
    message = `Paused: ${insight.subject}. It stays visible but has no effect while paused.`
  } else if (action === 'set_scope') {
    const scope = options.scope
    if (!scope || !INSIGHT_SCOPES.has(scope)) return { state, event: null, error: 'A valid scope is required.' }
    updated = { ...insight, scope, updatedAt: now }
    type = 'insight_scope_changed'
    message = scope === 'organization'
      ? `Saved as an organizational preference: ${insight.subject}. It still requires approval per role before it changes anything.`
      : `Scoped to this role only: ${insight.subject}.`
  } else if (action === 'rollback') {
    updated = { ...insight, status: 'proposed', editedStatement: undefined, reviewedAt: undefined, updatedAt: now }
    type = 'insight_rolled_back'
    message = `Rolled back: ${insight.subject}. The review was reversed and the pattern returned to proposed.`
  }

  if (!type) return { state, event: null, error: 'Unsupported action.' }

  const event: CalibrationEvent = {
    id: `ce-${insight.id}-${type}-${now}`,
    insightId: insight.id,
    type,
    message,
    createdAt: now,
  }
  return {
    state: {
      insights: state.insights.map(item => (item.id === insightId ? updated : item)),
      events: [...state.events, event].slice(-500),
      updatedAt: now,
    },
    event,
  }
}

export function activeInsights(state: CalibrationState | undefined): CalibrationInsight[] {
  if (!state) return []
  return state.insights.filter(insight => insight.status === 'approved' || insight.status === 'edited')
}

export function pendingInsightCount(state: CalibrationState | undefined): number {
  if (!state) return 0
  return state.insights.filter(insight => insight.status === 'proposed').length
}

export function insightDisplayStatement(insight: CalibrationInsight): string {
  return insight.status === 'edited' && insight.editedStatement ? insight.editedStatement : insight.statement
}

// Explainable, calibration-aware candidate ordering.
// Only approved or edited insights move anyone, and every move carries its cause.
export type RankingChange = {
  candidateId: string
  candidateName: string
  direction: 'up' | 'down'
  delta: number
  causedByInsightIds: string[]
  explanation: string
}

export type CalibratedRanking = {
  orderedCandidateIds: string[]
  adjustments: Map<string, number>
  changes: RankingChange[]
  uncertain: string[]
}

export function rankCandidatesWithCalibration(
  candidates: RoleCandidate[],
  baseScore: (candidate: RoleCandidate) => number,
  state: CalibrationState | undefined
): CalibratedRanking {
  const approved = activeInsights(state)
  const adjustments = new Map<string, number>()
  const changes: RankingChange[] = []
  const uncertain: string[] = []

  for (const candidate of candidates) {
    let delta = 0
    const causes: string[] = []
    const reasons: string[] = []
    for (const insight of approved) {
      if (insight.evidenceClass === 'evidence_hygiene') continue
      const matches = mentionsTerm(candidate, insight.subject)
      if (insight.evidenceClass === 'disqualifier_pattern') {
        if (concernText(candidate).includes(normalizeTerm(insight.subject))) {
          delta -= 12
          causes.push(insight.id)
          reasons.push(`carries the approved disqualifier pattern "${insight.subject}"`)
        }
        continue
      }
      if (matches) {
        delta += 8
        causes.push(insight.id)
        reasons.push(`matches the approved learning "${insight.subject}"`)
      }
    }
    if (delta !== 0) {
      adjustments.set(candidate.id, delta)
      changes.push({
        candidateId: candidate.id,
        candidateName: candidate.name,
        direction: delta > 0 ? 'up' : 'down',
        delta,
        causedByInsightIds: causes,
        explanation: `${candidate.name} moved ${delta > 0 ? 'up' : 'down'} because the profile ${reasons.join(' and ')}. This reflects recorded signals only, not verified facts.`,
      })
    }
    if (candidate.evidenceStatus === 'conflicting' || candidate.evidenceStatus === 'stale') {
      uncertain.push(candidate.id)
    }
  }

  const ordered = [...candidates]
    .map(candidate => ({ candidate, score: baseScore(candidate) + (adjustments.get(candidate.id) || 0) }))
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .map(item => item.candidate.id)

  return { orderedCandidateIds: ordered, adjustments, changes, uncertain }
}

// Advisory lane recommendations. Never auto-applied: the recruiter approves lane
// changes through the existing strategy controls.
export type LaneRecommendation = {
  laneId: string
  laneLabel: string
  recommendation: 'raise_priority' | 'review_alignment'
  causedByInsightIds: string[]
  explanation: string
}

export function recommendLaneChanges(lanes: SearchLane[], state: CalibrationState | undefined): LaneRecommendation[] {
  const approved = activeInsights(state)
  if (!approved.length) return []
  const recommendations: LaneRecommendation[] = []
  for (const lane of lanes) {
    const laneText = `${lane.label} ${lane.purpose} ${lane.query}`.toLowerCase()
    const aligned = approved.filter(insight =>
      insight.evidenceClass !== 'evidence_hygiene' &&
      insight.evidenceClass !== 'disqualifier_pattern' &&
      laneText.includes(normalizeTerm(insight.subject))
    )
    if (aligned.length && lane.status !== 'approved') {
      recommendations.push({
        laneId: lane.id,
        laneLabel: lane.label,
        recommendation: 'raise_priority',
        causedByInsightIds: aligned.map(insight => insight.id),
        explanation: `This lane targets ${aligned.map(insight => insight.subject).join(', ')}, which approved learning says is producing strong-fit decisions. Consider approving it.`,
      })
    }
    const misaligned = approved.filter(insight =>
      insight.evidenceClass === 'disqualifier_pattern' && laneText.includes(normalizeTerm(insight.subject))
    )
    if (misaligned.length) {
      recommendations.push({
        laneId: lane.id,
        laneLabel: lane.label,
        recommendation: 'review_alignment',
        causedByInsightIds: misaligned.map(insight => insight.id),
        explanation: `This lane overlaps the enforced disqualifier ${misaligned.map(insight => insight.subject).join(', ')}. Review whether its query needs to exclude that pattern.`,
      })
    }
  }
  return recommendations
}

// Normalization for persistence round-trips. Unknown shapes fail closed to empty state.
export function normalizeCalibrationState(value: unknown): CalibrationState {
  if (!value || typeof value !== 'object') return emptyCalibrationState()
  const raw = value as Record<string, unknown>
  const insights: CalibrationInsight[] = Array.isArray(raw.insights)
    ? raw.insights.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const insight = item as Record<string, unknown>
        const id = typeof insight.id === 'string' ? insight.id.slice(0, 120) : ''
        const statement = typeof insight.statement === 'string' ? insight.statement.slice(0, 500) : ''
        if (!id || !statement) return []
        const evidenceClass = INSIGHT_EVIDENCE_CLASSES.has(insight.evidenceClass as InsightEvidenceClass)
          ? (insight.evidenceClass as InsightEvidenceClass) : 'decision_pattern'
        const status = INSIGHT_STATUSES.has(insight.status as InsightStatus) ? (insight.status as InsightStatus) : 'proposed'
        const scope = INSIGHT_SCOPES.has(insight.scope as InsightScope) ? (insight.scope as InsightScope) : 'role'
        const confidence = INSIGHT_CONFIDENCES.has(insight.confidence as InsightConfidence)
          ? (insight.confidence as InsightConfidence) : 'emerging'
        const strings = (input: unknown, max: number, itemMax = 200): string[] =>
          Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.slice(0, itemMax)).slice(0, max) : []
        return [{
          id,
          statement,
          editedStatement: typeof insight.editedStatement === 'string' ? insight.editedStatement.slice(0, 500) : undefined,
          evidenceClass,
          confidence,
          status,
          scope,
          subject: typeof insight.subject === 'string' ? insight.subject.slice(0, 200) : '',
          supportingCandidateIds: strings(insight.supportingCandidateIds, 5000, 120),
          contradictingCandidateIds: strings(insight.contradictingCandidateIds, 5000, 120),
          positiveExamples: strings(insight.positiveExamples, 10),
          negativeExamples: strings(insight.negativeExamples, 10),
          contradictionNote: typeof insight.contradictionNote === 'string' ? insight.contradictionNote.slice(0, 500) : '',
          derivedAt: typeof insight.derivedAt === 'string' ? insight.derivedAt : new Date(0).toISOString(),
          reviewedAt: typeof insight.reviewedAt === 'string' ? insight.reviewedAt : undefined,
          updatedAt: typeof insight.updatedAt === 'string' ? insight.updatedAt : new Date(0).toISOString(),
        } satisfies CalibrationInsight]
      })
    : []
  const eventTypes = new Set<CalibrationEventType>([
    'insight_derived', 'insight_updated', 'insight_approved', 'insight_edited',
    'insight_rejected', 'insight_paused', 'insight_scope_changed', 'insight_rolled_back',
  ])
  const events: CalibrationEvent[] = Array.isArray(raw.events)
    ? raw.events.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const event = item as Record<string, unknown>
        if (typeof event.id !== 'string' || typeof event.insightId !== 'string' || typeof event.message !== 'string') return []
        if (!eventTypes.has(event.type as CalibrationEventType)) return []
        return [{
          id: event.id.slice(0, 200),
          insightId: event.insightId.slice(0, 120),
          type: event.type as CalibrationEventType,
          message: event.message.slice(0, 500),
          createdAt: typeof event.createdAt === 'string' ? event.createdAt : new Date(0).toISOString(),
        } satisfies CalibrationEvent]
      }).slice(-500)
    : []
  return {
    insights,
    events,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  }
}
