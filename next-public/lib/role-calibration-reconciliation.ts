import type { RoleWorkspace } from './role-workspace'
import { reconcileCalibrationState, type CalibrationState } from './calibration-intelligence'

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

// Keep calibration derivation in the workspace state transition instead of relying
// on the Calibration tab mounting. Reviewer decisions remain authoritative because
// reconcileCalibrationState preserves reviewed insight state and only refreshes the
// evidence linked to those decisions.
export function reconcileRoleWorkspaceCalibration(
  workspace: RoleWorkspace,
  now = new Date().toISOString()
): RoleWorkspace {
  const next = reconcileCalibrationState(workspace, workspace.calibration, now)
  if (semanticCalibration(next) === semanticCalibration(workspace.calibration)) return workspace
  return { ...workspace, calibration: next, updatedAt: now }
}
