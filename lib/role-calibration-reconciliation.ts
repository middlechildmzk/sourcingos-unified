import type { RoleWorkspace } from './role-workspace'
import { reconcileCalibrationState, type CalibrationState } from './calibration-intelligence'
import {
  deriveRoleSearchIntelligenceFromActivityV35,
  isSearchIntelligenceActivityV35,
} from './entity-intelligence/search-approval-events-v35'
import type { RoleSearchIntelligenceStateV35 } from './entity-intelligence/search-approval-v35'

function semanticCalibration(state: CalibrationState | undefined): string {
  if (!state) return JSON.stringify({ insights: [], events: [] })
  return JSON.stringify({
    insights: state.insights.map(insight => ({
      id: insight.id,
      statement: insight.statement,
      editedStatement: insight.editedStatement,
      evidenceClass: insight.evidenceClass,
      confidence: insight.confidence,
      status: insight.status,
      scope: insight.scope,
      subject: insight.subject,
      supportingCandidateIds: insight.supportingCandidateIds,
      contradictingCandidateIds: insight.contradictingCandidateIds,
      positiveExamples: insight.positiveExamples,
      negativeExamples: insight.negativeExamples,
      contradictionNote: insight.contradictionNote,
    })),
    events: state.events.map(event => ({
      id: event.id,
      insightId: event.insightId,
      type: event.type,
      message: event.message,
    })),
  })
}

function semanticSearchIntelligence(state: RoleSearchIntelligenceStateV35 | undefined): string {
  if (!state) return 'none'
  return JSON.stringify({
    version: state.version,
    registryVersion: state.registryVersion,
    approvedEntityIds: [...state.approvedEntityIds].sort(),
    approvedLocationExpansionIds: [...state.approvedLocationExpansionIds].sort(),
  })
}

// Keep calibration derivation in the workspace state transition instead of relying
// on the Calibration tab mounting. Reviewer decisions remain authoritative because
// reconcileCalibrationState preserves reviewed insight state and only refreshes the
// evidence linked to those decisions.
//
// V35.3 also replays recruiter-approved retrieval expansion events here. Search
// intelligence is a separate truth layer: it affects retrieval only and never
// becomes an intake requirement or candidate evidence.
export function reconcileRoleWorkspaceCalibration(
  workspace: RoleWorkspace,
  now = new Date().toISOString()
): RoleWorkspace {
  const hasSearchEvents = workspace.activity.some(isSearchIntelligenceActivityV35)
  const replayedSearch = hasSearchEvents
    ? deriveRoleSearchIntelligenceFromActivityV35(workspace.activity)
    : workspace.searchIntelligence
  const searchChanged = semanticSearchIntelligence(replayedSearch) !== semanticSearchIntelligence(workspace.searchIntelligence)
  const hydratedWorkspace = searchChanged ? { ...workspace, searchIntelligence: replayedSearch } : workspace

  const next = reconcileCalibrationState(hydratedWorkspace, hydratedWorkspace.calibration, now)
  const calibrationChanged = semanticCalibration(next) !== semanticCalibration(hydratedWorkspace.calibration)
  if (!calibrationChanged && !searchChanged) return workspace

  return {
    ...hydratedWorkspace,
    ...(calibrationChanged ? { calibration: next, updatedAt: now } : {}),
  }
}
