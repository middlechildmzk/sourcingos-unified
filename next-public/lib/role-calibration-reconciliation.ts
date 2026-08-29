import type { RoleWorkspace } from './role-workspace'
import { reconcileCalibrationState, type CalibrationState } from './calibration-intelligence'
import {
  reconcileRepeatedRejectionInsights,
  splitFeedbackRejectionInsights,
} from './role-rejection-calibration'

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

export function reconcileRoleCalibrationState(
  workspace: RoleWorkspace,
  existing: CalibrationState | undefined,
  now = new Date().toISOString(),
): CalibrationState {
  const { baseState, feedbackInsights } = splitFeedbackRejectionInsights(existing)
  const base = reconcileCalibrationState(workspace, baseState, now)
  return reconcileRepeatedRejectionInsights(workspace, base, feedbackInsights, now)
}

// Keep calibration derivation in the workspace state transition instead of relying
// on the Calibration tab mounting. Reviewer decisions remain authoritative because
// reconciliation preserves reviewed insight state and only refreshes the evidence
// linked to those decisions. Repeated exact rejection concerns are treated the same
// way: proposed first, recruiter-controlled, and never silently applied.
export function reconcileRoleWorkspaceCalibration(
  workspace: RoleWorkspace,
  now = new Date().toISOString()
): RoleWorkspace {
  const next = reconcileRoleCalibrationState(workspace, workspace.calibration, now)
  if (semanticCalibration(next) === semanticCalibration(workspace.calibration)) return workspace
  return { ...workspace, calibration: next, updatedAt: now }
}
