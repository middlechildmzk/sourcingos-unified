import { buildCanonicalAgenticSearchPlan } from './canonical-agentic-search-v30'
import { interpretRoleBrief } from './role-brief-v33'
import type { AgenticSearchLane } from './agentic-search-v30'

export const ROLE_STAGES = [
  'discovered',
  'needs_review',
  'shortlisted',
  'contact_research',
  'ready_for_outreach',
  'outreach_drafted',
  'contacted',
  'responded',
  'interested',
  'submitted',
  'interviewing',
  'offer',
  'closed',
  'archived',
] as const

export type RoleStage = (typeof ROLE_STAGES)[number]
export type FitDecision = 'unreviewed' | 'strong_fit' | 'possible_fit' | 'not_fit'
export type RoleStatus = 'draft' | 'calibrating' | 'active' | 'paused' | 'closed'

export type RoleIntake = {
  title: string
  location: string
  workMode: 'remote' | 'hybrid' | 'onsite' | 'flexible' | 'unknown'
  compensation: string
  clearance: string
  mustHaves: string[]
  niceToHaves: string[]
  disqualifiers: string[]
  targetCompanies: string[]
  adjacentBackgrounds: string[]
  hiringManagerNotes: string
  rawDescription: string
}

export type RoleBriefInterpretationNote = {
  id: string
  label: string
  category: 'scope' | 'location' | 'clearance' | 'work_mode' | 'trust'
  statement: string
  verificationGated?: boolean
}

export type RoleBriefVersion = {
  id: string
  version: number
  status: 'draft' | 'approved' | 'superseded'
  intake: RoleIntake
  interpretations: RoleBriefInterpretationNote[]
  changeSummary: string[]
  createdAt: string
  approvedAt?: string
}

/**
 * Persisted approval projection of the canonical Search Brain hypotheses.
 * `source` is retained for storage/backward compatibility; lane id/label/query
 * now mirror canonical agentic hypotheses rather than defining a second plan.
 */
export type SearchLane = {
  id: string
  label: string
  purpose: string
  query: string
  source: 'candidate_database' | 'network' | 'github' | 'research' | 'healthcare' | 'resume_xray' | 'web_xray'
  status: 'proposed' | 'approved' | 'paused'
}

export type RoleCandidate = {
  id: string
  candidateId?: string
  name: string
  headline: string
  company: string
  location: string
  source: string
  sourceUrl?: string
  stage: RoleStage
  fitDecision: FitDecision
  fitReasons: string[]
  concerns: string[]
  tags: string[]
  contactStatus: 'unknown' | 'signals_found' | 'verified' | 'blocked'
  evidenceStatus: 'unreviewed' | 'reviewed' | 'conflicting' | 'stale'
  addedAt: string
  updatedAt: string
}

export type RoleActivity = {
  id: string
  type: 'role_created' | 'intake_updated' | 'lane_approved' | 'candidate_added' | 'candidate_reviewed' | 'stage_changed' | 'note_added' | 'brief_version_created' | 'brief_approved' | 'search_intelligence_updated'
  message: string
  createdAt: string
}

export type RoleWorkspace = {
  id: string
  status: RoleStatus
  intake: RoleIntake
  searchLanes: SearchLane[]
  candidates: RoleCandidate[]
  activity: RoleActivity[]
  calibration?: import('./calibration-intelligence').CalibrationState
  /**
   * Recruiter-approved retrieval expansions. This is a separate truth layer from
   * the approved Role Brief and can never satisfy candidate requirements.
   */
  searchIntelligence?: import('./entity-intelligence/search-approval-v35').RoleSearchIntelligenceStateV35
  /** V33.4 additive brief artifact metadata. Older workspaces normalize without it. */
  roleBriefVersions?: RoleBriefVersion[]
  activeRoleBriefVersionId?: string
  createdAt: string
  updatedAt: string
}

function unique(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, max)
}

/**
 * One deterministic Role Brain entry point. The shared JD parser handles full
 * descriptions while role-brief-v33 adds conservative natural-language command
 * interpretation. Uncertain preference language stays reviewable, not binding.
 */
export function parseRoleIntake(rawDescription: string): RoleIntake {
  return interpretRoleBrief(rawDescription).intake
}

function compatibilitySource(lane: AgenticSearchLane): SearchLane['source'] {
  const executable = lane.tasks.filter(task => task.mode === 'executable')
  if (executable.some(task => task.surface === 'healthcare_registry')) return 'healthcare'
  if (executable.some(task => task.surface === 'github')) return 'github'
  if (executable.some(task => task.surface === 'research_publications')) return 'research'
  if (lane.tasks.some(task => task.surface === 'google_xray')) return 'web_xray'
  if (lane.id === 'skill_cluster') return 'resume_xray'
  return 'candidate_database'
}

/**
 * Backward-compatible persistence projection of the canonical Search Brain.
 * Existing role storage keeps `searchLanes`, but recruiter-facing lane IDs,
 * labels and queries now originate from buildCanonicalAgenticSearchPlan.
 */
export function buildSearchLanes(intake: RoleIntake): SearchLane[] {
  const plan = buildCanonicalAgenticSearchPlan(intake)
  return plan.lanes.map(lane => ({
    id: lane.id,
    label: lane.label,
    purpose: `${lane.hypothesis} Blind spot: ${lane.blindSpot}`,
    query: lane.query,
    source: compatibilitySource(lane),
    // Preserve the historical non-executing baseline approval so API-created
    // roles remain usable. External execution still requires an explicit click.
    status: lane.id === 'exact_title' ? 'approved' : 'proposed',
  }))
}

export function createRoleWorkspace(rawDescription: string, id = crypto.randomUUID(), now = new Date()): RoleWorkspace {
  const intake = parseRoleIntake(rawDescription)
  const createdAt = now.toISOString()
  return {
    id,
    status: 'calibrating',
    intake,
    searchLanes: buildSearchLanes(intake),
    candidates: [],
    activity: [{ id: crypto.randomUUID(), type: 'role_created', message: `Created role workspace for ${intake.title}.`, createdAt }],
    createdAt,
    updatedAt: createdAt,
  }
}

export function roleMetrics(role: RoleWorkspace) {
  const byStage = Object.fromEntries(ROLE_STAGES.map(stage => [stage, role.candidates.filter(candidate => candidate.stage === stage).length])) as Record<RoleStage, number>
  return {
    candidateCount: role.candidates.length,
    strongFits: role.candidates.filter(candidate => candidate.fitDecision === 'strong_fit').length,
    needsReview: role.candidates.filter(candidate => candidate.stage === 'needs_review' || candidate.fitDecision === 'unreviewed').length,
    contactReady: role.candidates.filter(candidate => candidate.stage === 'ready_for_outreach').length,
    conflicts: role.candidates.filter(candidate => candidate.evidenceStatus === 'conflicting').length,
    byStage,
  }
}

export function calibrationInsights(role: RoleWorkspace): string[] {
  const reviewed = role.candidates.filter(candidate => candidate.fitDecision !== 'unreviewed')
  if (reviewed.length < 3) return ['Review at least three candidates before SourcingOS proposes calibration changes.']
  const strong = reviewed.filter(candidate => candidate.fitDecision === 'strong_fit')
  const rejected = reviewed.filter(candidate => candidate.fitDecision === 'not_fit')
  const commonStrongTags = unique(strong.flatMap(candidate => candidate.tags)).filter(tag => strong.filter(candidate => candidate.tags.includes(tag)).length >= 2)
  const commonConcerns = unique(rejected.flatMap(candidate => candidate.concerns)).filter(concern => rejected.filter(candidate => candidate.concerns.includes(concern)).length >= 2)
  return [
    ...(commonStrongTags.length ? [`Strong-fit pattern: ${commonStrongTags.join(', ')}. Consider emphasizing these in approved search lanes.`] : []),
    ...(commonConcerns.length ? [`Repeated rejection pattern: ${commonConcerns.join(', ')}. Consider adding an explicit exclusion or review rule.`] : []),
    `Calibration sample: ${reviewed.length} reviewed, ${strong.length} strong fit, ${rejected.length} not fit.`,
  ]
}

export function stageLabel(stage: RoleStage): string {
  return stage.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}
