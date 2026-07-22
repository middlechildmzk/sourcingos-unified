import type { RoleCandidate, RoleWorkspace } from './role-workspace'
import { activeInsights, insightDisplayStatement, pendingInsightCount } from './calibration-intelligence'
import { ROLE_STAGES, roleMetrics, stageLabel } from './role-workspace'

// Hiring-manager-ready outputs. Copy-first (markdown), export-friendly.
//
// Evidence honesty rules baked into every output:
// - Recorded recruiter signals are labeled as recorded signals, never as verified facts.
// - Unknown stays unknown. Stale is labeled stale. Conflicts are shown, not hidden.
// - Clearance appears only as an intake requirement; candidate clearance is never
//   asserted because SourcingOS treats public clearance mentions as unverified
//   breadcrumbs, not claims.
// - Learned calibration appears only when the recruiter approved it.

function line(values: string[]): string {
  return values.filter(Boolean).join(' · ')
}

function evidenceLabel(candidate: RoleCandidate): string {
  if (candidate.evidenceStatus === 'conflicting') return 'Conflicting evidence, unresolved'
  if (candidate.evidenceStatus === 'stale') return 'Stale evidence, needs re-verification'
  if (candidate.evidenceStatus === 'reviewed') return 'Evidence reviewed by recruiter'
  return 'Evidence not yet reviewed'
}

function contactLabel(candidate: RoleCandidate): string {
  if (candidate.contactStatus === 'verified') return 'Contact path verified'
  if (candidate.contactStatus === 'signals_found') return 'Contact signals found, unconfirmed'
  if (candidate.contactStatus === 'blocked') return 'Contact currently blocked'
  return 'Contact path unknown'
}

const EVIDENCE_KEY = [
  '**How to read this document:** items marked "recorded signal" come from the recruiter\'s',
  'review of public or user-imported sources. They are supported observations, not',
  'independently verified facts. "Unknown" means exactly that. Stale and conflicting',
  'evidence is flagged rather than hidden, and nothing below asserts a candidate\'s',
  'clearance status; clearance lines describe the role requirement only.',
].join(' ')

export function buildSearchStrategyBrief(role: RoleWorkspace, now = new Date()): string {
  const intake = role.intake
  const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved')
  const proposedLanes = role.searchLanes.filter(lane => lane.status === 'proposed')
  const learned = activeInsights(role.calibration)
  const parts = [
    `# Search strategy brief: ${intake.title}`,
    ``,
    `Prepared ${now.toLocaleDateString()} · ${line([intake.location, intake.workMode !== 'unknown' ? intake.workMode : '', intake.compensation])}`,
    ``,
    EVIDENCE_KEY,
    ``,
    `## Role requirements (from intake)`,
    intake.clearance ? `- Clearance requirement: ${intake.clearance} (role requirement; candidate clearance is never asserted from public text)` : '',
    ...intake.mustHaves.map(item => `- Must have: ${item}`),
    ...intake.niceToHaves.map(item => `- Nice to have: ${item}`),
    ...intake.disqualifiers.map(item => `- Disqualifier: ${item}`),
    intake.targetCompanies.length ? `- Target companies: ${intake.targetCompanies.join(', ')}` : '',
    intake.adjacentBackgrounds.length ? `- Approved adjacent backgrounds: ${intake.adjacentBackgrounds.join(', ')}` : '',
    ``,
    `## Search lanes`,
    ...approvedLanes.map(lane => `- Approved: **${lane.label}**: ${lane.purpose || 'purpose not recorded'}`),
    ...proposedLanes.map(lane => `- Proposed (awaiting recruiter approval): ${lane.label}`),
    !role.searchLanes.length ? '- No search lanes drafted yet.' : '',
    ``,
    `## What recruiter decisions have taught this search`,
    ...(learned.length
      ? learned.map(insight => `- ${insightDisplayStatement(insight)} (approved learning from ${insight.supportingCandidateIds.length} recorded decisions${insight.contradictingCandidateIds.length ? `, ${insight.contradictingCandidateIds.length} contradictions noted` : ''})`)
      : ['- No approved calibration learning yet. Patterns are proposed to the recruiter as decisions accumulate.']),
    pendingInsightCount(role.calibration) ? `- ${pendingInsightCount(role.calibration)} detected pattern(s) still await recruiter review and are excluded above.` : '',
  ]
  return parts.filter(part => part !== '').join('\n')
}

export function buildCalibrationReport(role: RoleWorkspace, now = new Date()): string {
  const state = role.calibration
  const insights = state?.insights || []
  const decided = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed')
  const parts = [
    `# Calibration report: ${role.intake.title}`,
    ``,
    `Prepared ${now.toLocaleDateString()} · ${decided.length} recorded decisions`,
    ``,
    EVIDENCE_KEY,
    ``,
    ...(!insights.length ? ['No calibration patterns have been detected yet. At least two consistent recorded decisions are required before a pattern is proposed.'] : []),
    ...insights.map(insight => [
      `## ${insightDisplayStatement(insight)}`,
      `- Status: ${insight.status}${insight.status === 'proposed' ? ' (not yet reviewed; has no effect on the search)' : ''}`,
      `- Scope: ${insight.scope === 'role' ? 'this role only' : 'saved as organizational preference'}`,
      `- Confidence: ${insight.confidence}, from ${insight.supportingCandidateIds.length} supporting decision(s)`,
      insight.positiveExamples.length ? `- Supporting examples: ${insight.positiveExamples.join(', ')}` : '',
      insight.negativeExamples.length ? `- Counter examples: ${insight.negativeExamples.join(', ')}` : '',
      insight.contradictionNote ? `- Contradiction: ${insight.contradictionNote}` : '',
    ].filter(Boolean).join('\n')),
  ]
  return parts.filter(part => part !== '').join('\n')
}

export function buildCandidateSlate(role: RoleWorkspace, now = new Date()): string {
  const slate = role.candidates
    .filter(candidate => candidate.fitDecision === 'strong_fit')
    .sort((a, b) => a.name.localeCompare(b.name))
  const possible = role.candidates.filter(candidate => candidate.fitDecision === 'possible_fit')
  const parts = [
    `# Candidate slate: ${role.intake.title}`,
    ``,
    `Prepared ${now.toLocaleDateString()} · ${slate.length} strong-fit candidate(s), ${possible.length} possible fit(s) in reserve`,
    ``,
    EVIDENCE_KEY,
    ``,
    ...(!slate.length ? ['No candidates carry a strong-fit decision yet.'] : []),
    ...slate.map(candidate => [
      `## ${candidate.name}`,
      `${line([candidate.headline, candidate.company, candidate.location]) || 'Profile details pending review'}`,
      `- Source: ${candidate.source}${candidate.sourceUrl ? ` (${candidate.sourceUrl})` : ''}`,
      `- Stage: ${stageLabel(candidate.stage)}`,
      candidate.fitReasons.length ? `- Recorded signals: ${candidate.fitReasons.join('; ')}` : '- Recorded signals: none captured yet',
      candidate.concerns.length ? `- Open concerns: ${candidate.concerns.join('; ')}` : '',
      `- ${evidenceLabel(candidate)}`,
      `- ${contactLabel(candidate)}`,
    ].filter(Boolean).join('\n')),
  ]
  return parts.filter(part => part !== '').join('\n')
}

export function buildWeeklyUpdate(role: RoleWorkspace, now = new Date()): string {
  const metrics = roleMetrics(role)
  const conflicts = role.candidates.filter(candidate => candidate.evidenceStatus === 'conflicting')
  const stale = role.candidates.filter(candidate => candidate.evidenceStatus === 'stale')
  const unreviewed = role.candidates.filter(candidate => candidate.fitDecision === 'unreviewed')
  const approvedLanes = role.searchLanes.filter(lane => lane.status === 'approved')
  const parts = [
    `# Weekly search update: ${role.intake.title}`,
    ``,
    `Prepared ${now.toLocaleDateString()} · role status: ${role.status}`,
    ``,
    EVIDENCE_KEY,
    ``,
    `## Pipeline`,
    ...ROLE_STAGES.filter(stage => metrics.byStage[stage] > 0).map(stage => `- ${stageLabel(stage)}: ${metrics.byStage[stage]}`),
    !metrics.candidateCount ? '- No candidates in the role yet.' : '',
    ``,
    `## Search motion`,
    `- ${approvedLanes.length} approved search lane(s) of ${role.searchLanes.length} drafted`,
    `- ${metrics.strongFits} strong fit(s), ${unreviewed.length} candidate(s) awaiting a decision`,
    ``,
    `## Risks and honesty flags`,
    conflicts.length ? `- ${conflicts.length} candidate(s) carry unresolved evidence conflicts: ${conflicts.slice(0, 5).map(candidate => candidate.name).join(', ')}` : '- No unresolved evidence conflicts.',
    stale.length ? `- ${stale.length} candidate(s) have stale evidence needing re-verification.` : '',
    pendingInsightCount(role.calibration) ? `- ${pendingInsightCount(role.calibration)} learned pattern(s) await recruiter calibration review.` : '',
  ]
  return parts.filter(part => part !== '').join('\n')
}

export type HmOutputKind = 'search_brief' | 'calibration_report' | 'candidate_slate' | 'weekly_update'

export const HM_OUTPUTS: { kind: HmOutputKind; label: string; description: string; build: (role: RoleWorkspace, now?: Date) => string }[] = [
  { kind: 'search_brief', label: 'Search strategy brief', description: 'Requirements, lanes, and approved learning', build: buildSearchStrategyBrief },
  { kind: 'calibration_report', label: 'Calibration report', description: 'What decisions taught the search, with evidence', build: buildCalibrationReport },
  { kind: 'candidate_slate', label: 'Candidate slate', description: 'Strong fits with honest evidence labels', build: buildCandidateSlate },
  { kind: 'weekly_update', label: 'Weekly search update', description: 'Pipeline, motion, risks, and honesty flags', build: buildWeeklyUpdate },
]
