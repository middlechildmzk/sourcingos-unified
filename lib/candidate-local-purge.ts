'use client'

import { readRoleWorkspaces, writeRoleWorkspaces } from './role-workspace-storage'

/**
 * Remove a deleted canonical candidate from browser-local role workspace state.
 *
 * Role workspaces are local-first and later sync to Supabase. Without this
 * cleanup a stale browser snapshot could reintroduce a deleted role candidate
 * into the recruiter's local view after the server-side hard delete.
 */
export function purgeCandidateFromLocalRoleWorkspaces(candidateId: string): number {
  const roles = readRoleWorkspaces()
  let removed = 0

  for (const role of roles) {
    const before = role.candidates.length
    role.candidates = role.candidates.filter(candidate => candidate.candidateId !== candidateId)
    const delta = before - role.candidates.length
    if (delta > 0) {
      removed += delta
      // Candidate-derived learning may preserve references to the removed record.
      // Clear local calibration for touched roles; the remaining slate can rebuild it.
      role.calibration = undefined
      role.activity = role.activity.filter(event => !['candidate_added', 'candidate_reviewed', 'stage_changed'].includes(event.type))
      role.updatedAt = new Date().toISOString()
    }
  }

  if (removed > 0) writeRoleWorkspaces(roles)
  return removed
}
