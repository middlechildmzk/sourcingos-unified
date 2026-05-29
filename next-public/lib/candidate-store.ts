import { CandidateGraphProfile, confirmCandidateMerge, mergeRefreshedProfiles, refreshDue } from './candidate-graph'
import { searchSources } from './source-connectors'
import { SourceName, SourceResult } from './source-types'

type StoreShape = {
  candidates: Map<string, CandidateGraphProfile>
  sourceProfiles: Map<string, SourceResult>
  events: { id: string; type: string; candidateId?: string; detail: string; at: string }[]
}

declare global {
  // eslint-disable-next-line no-var
  var __sourcingosCandidateStore: StoreShape | undefined
}

function store(): StoreShape {
  if (!globalThis.__sourcingosCandidateStore) {
    globalThis.__sourcingosCandidateStore = { candidates: new Map(), sourceProfiles: new Map(), events: [] }
  }
  return globalThis.__sourcingosCandidateStore
}

const event = (type: string, detail: string, candidateId?: string) => store().events.unshift({ id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, candidateId, detail, at: new Date().toISOString() })

export function saveCandidateGraph(profiles: CandidateGraphProfile[]) {
  const s = store()
  for (const p of profiles) {
    s.candidates.set(p.id, p)
    for (const sp of p.sourceProfiles) s.sourceProfiles.set(sp.id, sp)
    event('candidate.saved', `Saved ${p.canonicalName} with ${p.sourceProfiles.length} source profile(s).`, p.id)
  }
  return listCandidates()
}

export function listCandidates() {
  const s = store()
  return Array.from(s.candidates.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getCandidate(candidateId: string) { return store().candidates.get(candidateId) || null }

export function applyMergeDecision(candidateId: string, sourceProfileIds: string[], decision: 'pending' | 'confirmed' | 'rejected', decidedBy = 'recruiter') {
  const s = store()
  const candidate = s.candidates.get(candidateId)
  if (!candidate) return null
  const updated = confirmCandidateMerge(candidate, sourceProfileIds, decision, decidedBy)
  s.candidates.set(candidateId, updated)
  event('candidate.merge_decision', `${decision} merge review for ${sourceProfileIds.length} source profile(s).`, candidateId)
  return updated
}

export function queueSnapshot() {
  const candidates = listCandidates()
  const due = candidates.filter(c => c.refreshPolicy.enabled && refreshDue(c))
  return { candidates, due, events: store().events.slice(0, 100) }
}

export async function refreshCandidate(candidateId: string, overrideSources?: SourceName[]) {
  const s = store()
  const candidate = s.candidates.get(candidateId)
  if (!candidate) return null
  const sources = overrideSources?.length ? overrideSources : candidate.refreshPolicy.sourceNames
  const { results, warnings, searchedSources } = await searchSources({
    query: candidate.canonicalName,
    location: candidate.location || '',
    sources,
    limit: 4
  })
  const updated = mergeRefreshedProfiles(candidate, results)
  s.candidates.set(candidateId, updated)
  for (const sp of updated.sourceProfiles) s.sourceProfiles.set(sp.id, sp)
  event('candidate.refreshed', `Refreshed ${candidate.canonicalName} across ${searchedSources.join(', ')}.`, candidateId)
  return { candidate: updated, results, warnings, searchedSources }
}

export async function refreshDueCandidates(max = 10) {
  const due = queueSnapshot().due.slice(0, max)
  const refreshed = []
  for (const candidate of due) {
    const result = await refreshCandidate(candidate.id)
    if (result) refreshed.push(result.candidate)
  }
  return { refreshed, remainingDue: queueSnapshot().due.length, events: store().events.slice(0, 100) }
}
