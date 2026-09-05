import { CandidateContactSignal, CandidateDbSnapshot, CandidateRecord, EvidenceItemRecord, OpenToWorkSignal, SourceProfileRecord, nowIso, uid } from './candidate-db-v18'

export function daysSince(date?: string) {
  if (!date) return 999
  const t = new Date(date).getTime()
  if (Number.isNaN(t)) return 999
  return Math.floor((Date.now() - t) / 86400000)
}

export function staleStatus(candidate: CandidateRecord, profiles: SourceProfileRecord[]) {
  const candidateDays = daysSince(candidate.lastRefreshedAt || candidate.updatedAt || candidate.createdAt)
  const stalestProfileDays = Math.max(0, ...profiles.map(profile => daysSince(profile.lastSeenAt)))
  const days = Math.max(candidateDays, stalestProfileDays)
  if (days <= 7) return { label: 'Fresh', days, priority: 'low' as const }
  if (days <= 30) return { label: 'Review soon', days, priority: 'medium' as const }
  return { label: 'Stale', days, priority: 'high' as const }
}

export function scoreContactSignal(contact: CandidateContactSignal) {
  let score = 0
  if (contact.type === 'email') score += 40
  if (contact.type === 'linkedin' || contact.type === 'github' || contact.type === 'portfolio') score += 25
  if (contact.type === 'website') score += 15
  if (contact.confidence === 'high') score += 25
  if (contact.confidence === 'medium') score += 15
  if (contact.permissionStatus === 'candidate_provided') score += 25
  if (contact.permissionStatus === 'do_not_contact') score = 0
  if (contact.verified === false) score = Math.min(score, 80)
  return Math.min(score, 100)
}

export function scoreOpenToWorkSignal(signal: OpenToWorkSignal) {
  let score = 0
  const text = `${signal.label} ${signal.detail}`.toLowerCase()
  if (text.includes('open-to-work')) score += 55
  if (text.includes('available')) score += 35
  if (text.includes('resume') || text.includes('cv')) score += 20
  if (signal.confidence === 'high') score += 25
  if (signal.confidence === 'medium') score += 15
  if (signal.requiresReview) score = Math.min(score, 80)
  return Math.min(score, 100)
}

export function buildCandidate360(db: CandidateDbSnapshot, candidateId: string) {
  const candidate = db.candidates.find(item => item.id === candidateId)
  if (!candidate) return null
  const sourceProfiles = db.sourceProfiles.filter(item => candidate.sourceProfileIds.includes(item.id) || item.candidateId === candidate.id)
  const evidence = db.evidenceItems.filter(item => item.candidateId === candidate.id || candidate.evidenceItemIds.includes(item.id))
  const contacts = db.contactSignals.filter(item => item.candidateId === candidate.id || candidate.contactSignalIds.includes(item.id))
  const openToWorkSignals = db.openToWorkSignals.filter(item => item.candidateId === candidate.id || candidate.openToWorkSignalIds.includes(item.id))
  const matchReviews = db.matchReviews.filter(item => item.candidateId === candidate.id || item.sourceProfileIds.some(id => sourceProfiles.some(profile => profile.id === id)))
  const freshness = staleStatus(candidate, sourceProfiles)
  const bestContactScore = Math.max(0, ...contacts.map(scoreContactSignal))
  const openToWorkScore = Math.max(0, ...openToWorkSignals.map(scoreOpenToWorkSignal))
  const evidenceScore = Math.min(100, evidence.length * 6 + sourceProfiles.length * 12)
  return {
    candidate,
    sourceProfiles,
    evidence,
    contacts: contacts.map(contact => ({ ...contact, score: scoreContactSignal(contact) })),
    openToWorkSignals: openToWorkSignals.map(signal => ({ ...signal, score: scoreOpenToWorkSignal(signal) })),
    matchReviews,
    freshness,
    scores: { bestContactScore, openToWorkScore, evidenceScore },
    verifyNext: [
      'Confirm current title and company from a primary source.',
      'Review source-profile identity matches before merging.',
      'Verify contact information through an approved workflow before outreach.',
      'Treat open-to-work signals as reviewable signals, not claims.'
    ]
  }
}

export function markCandidateRefreshed(db: CandidateDbSnapshot, candidateId: string) {
  const candidate = db.candidates.find(item => item.id === candidateId)
  if (!candidate) return null
  candidate.lastRefreshedAt = nowIso()
  candidate.updatedAt = nowIso()
  db.sourceProfiles.filter(item => item.candidateId === candidate.id).forEach(profile => { profile.lastSeenAt = nowIso() })
  db.importBatches.unshift({ id: uid('batch'), importType: 'manual_source_profile', fileName: `refresh:${candidateId}`, rowsSeen: 1, recordsCreated: 0, warnings: ['Preview refresh only. Production refresh should call source APIs and diff changed evidence.'], createdAt: nowIso() })
  return candidate
}

export function createRefreshPlan(db: CandidateDbSnapshot) {
  return db.candidates.map(candidate => {
    const profiles = db.sourceProfiles.filter(profile => profile.candidateId === candidate.id)
    const freshness = staleStatus(candidate, profiles)
    return { candidateId: candidate.id, canonicalName: candidate.canonicalName, profileCount: profiles.length, ...freshness }
  }).sort((a, b) => b.days - a.days)
}
