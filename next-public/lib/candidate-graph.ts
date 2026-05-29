import { RefreshPolicy, SourceName, SourceResult } from './source-types'

export type MatchDecision = 'pending' | 'confirmed' | 'rejected'

export type IdentityMatchReview = {
  id: string
  candidateId: string
  sourceProfileIds: string[]
  score: number
  reasons: string[]
  decision: MatchDecision
  decidedAt?: string
  decidedBy?: string
}

export type CandidateGraphProfile = {
  id: string
  canonicalName: string
  headline?: string
  location?: string
  sourceProfiles: SourceResult[]
  evidenceCount: number
  contactSignalCount: number
  matchScore: number
  status: 'needs_review' | 'linked' | 'rejected'
  matchReviews: IdentityMatchReview[]
  refreshPolicy: RefreshPolicy
  nextRefreshAt: string
  lastRefreshedAt: string
  updatedAt: string
}

const norm = (value?: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const tokenSet = (items: string[]) => new Set(items.map(norm).filter(Boolean))
const overlap = (a: Set<string>, b: Set<string>) => Array.from(a).filter(x => b.has(x)).length
const nowIso = () => new Date().toISOString()
const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString()

export function identityMatchScore(a: SourceResult, b: SourceResult) {
  let score = 0
  const reasons: string[] = []
  if (norm(a.displayName) && norm(a.displayName) === norm(b.displayName)) { score += 25; reasons.push('Exact name match') }
  else if (norm(a.displayName).slice(0, 6) && norm(b.displayName).includes(norm(a.displayName).slice(0, 6))) { score += 12; reasons.push('Partial name overlap') }
  if (a.location && b.location && norm(a.location) === norm(b.location)) { score += 18; reasons.push('Location match') }
  const aWeb = a.contactSignals.find(s => s.type === 'website')?.value
  const bWeb = b.contactSignals.find(s => s.type === 'website')?.value
  if (aWeb && bWeb && norm(aWeb) === norm(bWeb)) { score += 30; reasons.push('Website match') }
  const aEmail = a.contactSignals.find(s => s.type === 'public_email')?.value
  const bEmail = b.contactSignals.find(s => s.type === 'public_email')?.value
  if (aEmail && bEmail && norm(aEmail) === norm(bEmail)) { score += 35; reasons.push('Public email match') }
  if (a.organization && b.organization && norm(a.organization) === norm(b.organization)) { score += 10; reasons.push('Organization match') }
  const skillOverlap = overlap(tokenSet(a.skills), tokenSet(b.skills))
  if (skillOverlap) { const pts = Math.min(15, skillOverlap * 3); score += pts; reasons.push(`${skillOverlap} skill/topic overlaps`) }
  const finalScore = Math.max(0, Math.min(100, score))
  return { score: finalScore, reasons, status: finalScore >= 70 ? 'likely_match' : finalScore >= 40 ? 'needs_review' : 'weak_match' }
}

function defaultRefreshPolicy(sourceProfiles: SourceResult[]): RefreshPolicy {
  const sourceNames = Array.from(new Set(sourceProfiles.map(p => p.source))) as SourceName[]
  return { cadenceHours: 24, staleAfterHours: 48, sourceNames, enabled: true }
}

function makeReview(candidateId: string, sourceProfiles: SourceResult[], score: number, reasons: string[]): IdentityMatchReview {
  return {
    id: `review-${candidateId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    candidateId,
    sourceProfileIds: sourceProfiles.map(p => p.id),
    score,
    reasons,
    decision: 'pending',
    decidedAt: undefined,
    decidedBy: undefined
  }
}

export function buildCandidateGraph(results: SourceResult[]): CandidateGraphProfile[] {
  const groups: CandidateGraphProfile[] = []
  for (const result of results) {
    let bestIndex = -1
    let bestScore = 0
    let bestReasons: string[] = []
    for (let i = 0; i < groups.length; i++) {
      const matches = groups[i].sourceProfiles.map(p => identityMatchScore(p, result))
      const best = matches.sort((a, b) => b.score - a.score)[0]
      if (best && best.score > bestScore) { bestScore = best.score; bestIndex = i; bestReasons = best.reasons }
    }
    if (bestIndex >= 0 && bestScore >= 55) {
      const g = groups[bestIndex]
      g.sourceProfiles.push(result)
      g.evidenceCount += result.evidence.length
      g.contactSignalCount += result.contactSignals.length
      g.matchScore = Math.max(g.matchScore, bestScore)
      g.status = 'needs_review'
      g.refreshPolicy = defaultRefreshPolicy(g.sourceProfiles)
      g.nextRefreshAt = hoursFromNow(g.refreshPolicy.cadenceHours)
      g.lastRefreshedAt = nowIso()
      g.updatedAt = nowIso()
      g.matchReviews.push(makeReview(g.id, g.sourceProfiles, bestScore, bestReasons))
    } else {
      const id = `candidate-${groups.length + 1}-${Date.now()}`
      const policy = defaultRefreshPolicy([result])
      groups.push({
        id,
        canonicalName: result.displayName,
        headline: result.headline,
        location: result.location,
        sourceProfiles: [result],
        evidenceCount: result.evidence.length,
        contactSignalCount: result.contactSignals.length,
        matchScore: 0,
        status: 'needs_review',
        matchReviews: [],
        refreshPolicy: policy,
        nextRefreshAt: hoursFromNow(policy.cadenceHours),
        lastRefreshedAt: result.refreshedAt,
        updatedAt: nowIso()
      })
    }
  }
  return groups.sort((a, b) => b.evidenceCount + b.matchScore - (a.evidenceCount + a.matchScore))
}

export function confirmCandidateMerge(profile: CandidateGraphProfile, sourceProfileIds: string[], decision: MatchDecision, decidedBy = 'recruiter'): CandidateGraphProfile {
  const updatedReviews = profile.matchReviews.map(r => sourceProfileIds.every(id => r.sourceProfileIds.includes(id)) ? { ...r, decision, decidedAt: nowIso(), decidedBy } : r)
  const status = decision === 'confirmed' ? 'linked' : decision === 'rejected' ? 'rejected' : 'needs_review'
  return { ...profile, status, matchReviews: updatedReviews, updatedAt: nowIso() }
}

export function mergeRefreshedProfiles(existing: CandidateGraphProfile, refreshedProfiles: SourceResult[]) {
  const byKey = new Map(existing.sourceProfiles.map(p => [`${p.source}:${p.sourceProfileId}`, p]))
  for (const p of refreshedProfiles) byKey.set(`${p.source}:${p.sourceProfileId}`, p)
  const sourceProfiles = Array.from(byKey.values())
  const refreshPolicy = defaultRefreshPolicy(sourceProfiles)
  return {
    ...existing,
    sourceProfiles,
    evidenceCount: sourceProfiles.reduce((sum, p) => sum + p.evidence.length, 0),
    contactSignalCount: sourceProfiles.reduce((sum, p) => sum + p.contactSignals.length, 0),
    refreshPolicy,
    lastRefreshedAt: nowIso(),
    nextRefreshAt: hoursFromNow(refreshPolicy.cadenceHours),
    updatedAt: nowIso()
  }
}

export function refreshDue(profile: CandidateGraphProfile, hours = profile.refreshPolicy?.staleAfterHours || 24) {
  const last = new Date(profile.lastRefreshedAt).getTime()
  return Number.isFinite(last) ? Date.now() - last > hours * 60 * 60 * 1000 : true
}
