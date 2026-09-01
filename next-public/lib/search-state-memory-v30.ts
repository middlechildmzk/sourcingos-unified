import type { AgenticLaneId, AgenticSearchSurface } from './agentic-search-v30'
import type { SearchAttemptTelemetry } from './source-orchestration-v33-8'

export type SearchAttemptStatus = 'running' | 'completed' | 'partial' | 'failed' | 'guided'

export type SearchAttempt = {
  id: string
  roleId: string
  laneId: AgenticLaneId
  surface: AgenticSearchSurface
  query: string
  fingerprint: string
  status: SearchAttemptStatus
  resultKeys: string[]
  startedAt: string
  completedAt?: string
  message?: string
  telemetry?: SearchAttemptTelemetry
}

export function searchFingerprint(surface: AgenticSearchSurface, query: string): string {
  const normalized = query
    .toLowerCase()
    .replace(/[()"']/g, ' ')
    .replace(/\b(and|or)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${surface}:${normalized}`
}

export function shouldExecuteSearch(
  attempts: SearchAttempt[],
  surface: AgenticSearchSurface,
  query: string,
): { execute: boolean; reason: string; prior?: SearchAttempt } {
  const fingerprint = searchFingerprint(surface, query)
  const prior = [...attempts].reverse().find(item => item.fingerprint === fingerprint)
  if (!prior) return { execute: true, reason: 'This surface/query combination has not been attempted for the role.' }
  if (prior.status === 'failed') return { execute: true, reason: 'The previous attempt failed, so a recruiter-controlled retry is allowed.', prior }
  if (prior.status === 'running') return { execute: false, reason: 'The same search is already running.', prior }
  return { execute: false, reason: 'The same surface/query combination already ran. Change the lane or criteria before spending another search.', prior }
}

export function resultNoveltyRate(previousKeys: string[], currentKeys: string[]): number {
  const previous = new Set(previousKeys.filter(Boolean))
  const current = Array.from(new Set(currentKeys.filter(Boolean)))
  if (!current.length) return 0
  const novel = current.filter(key => !previous.has(key)).length
  return Math.round((novel / current.length) * 100)
}

export function accumulatedResultKeys(attempts: SearchAttempt[]): string[] {
  return Array.from(new Set(attempts.flatMap(item => item.resultKeys).filter(Boolean)))
}

export function searchCoverageSummary(attempts: SearchAttempt[]) {
  const completed = attempts.filter(item => item.status === 'completed' || item.status === 'partial')
  const uniqueFingerprints = new Set(completed.map(item => item.fingerprint))
  const uniqueSurfaces = new Set(completed.map(item => item.surface))
  const uniqueLanes = new Set(completed.map(item => item.laneId))
  return {
    completedAttempts: completed.length,
    uniqueSearches: uniqueFingerprints.size,
    surfacesSearched: uniqueSurfaces.size,
    lanesAttempted: uniqueLanes.size,
    uniqueResultsSeen: accumulatedResultKeys(completed).length,
    discoveredBeforeCap: completed.reduce((sum, item) => sum + (item.telemetry?.discoveredBeforeCap || 0), 0),
    returnedAfterCap: completed.reduce((sum, item) => sum + (item.telemetry?.returnedAfterCap || 0), 0),
  }
}
