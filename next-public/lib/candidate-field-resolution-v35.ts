import type { CandidateDbSnapshot } from './candidate-db-v18'
import type { EvidenceLedgerSnapshot } from './evidence-ledger'

export type CandidateFieldV35 =
  | 'name'
  | 'headline'
  | 'current_title'
  | 'current_company'
  | 'location'

export type ResolutionStateV35 =
  | 'resolved'
  | 'resolved_with_conflict'
  | 'needs_review'
  | 'unknown'
  | 'stale'

export type CandidateFieldObservationV35 = {
  id: string
  field: CandidateFieldV35
  value: string
  normalizedValue: string
  source: string
  sourceProfileId?: string
  observedAt: string
  authority: number
  freshness: 'current' | 'aging' | 'stale' | 'unknown'
  rationale: string[]
}

export type ResolvedCandidateFieldV35 = {
  field: CandidateFieldV35
  state: ResolutionStateV35
  value?: string
  winningObservationId?: string
  winningSource?: string
  rationale: string[]
  alternatives: Array<{
    observationId: string
    value: string
    source: string
    reasonNotSelected: string
  }>
  conflicts: Array<{
    observationIds: string[]
    severity: 'informational' | 'material'
    reason: string
  }>
  sourceCount: number
}

export type ResolvedContactV35 = {
  value: string
  state: 'resolved' | 'resolved_with_conflict' | 'unknown' | 'stale'
  source: string
  sourceCount: number
  verified: boolean
  permissionStatus: string
  freshness: 'current' | 'aging' | 'stale' | 'unknown'
  rationale: string[]
  alternatives: Array<{
    value: string
    source: string
    permissionStatus: string
    freshness: string
  }>
}

export type Candidate360ResolvedProfileV35 = {
  name: ResolvedCandidateFieldV35
  headline: ResolvedCandidateFieldV35
  currentTitle: ResolvedCandidateFieldV35
  currentCompany: ResolvedCandidateFieldV35
  location: ResolvedCandidateFieldV35
  primaryWorkEmail?: ResolvedContactV35
  conflictCount: number
  reviewCount: number
  resolverVersion: 'v35.0-shadow'
  policyVersion: 'v35.0-shadow'
  shadowOnly: true
}

type ResolveOptions = {
  now?: Date
}

type Group = {
  key: string
  observations: CandidateFieldObservationV35[]
  score: number
  distinctSources: number
}

function clean(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

function basicKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameKey(value: string): string {
  return basicKey(value).replace(/\./g, '')
}

function companyKey(value: string): string {
  return basicKey(value)
    .replace(/\b(?:incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleKey(value: string): string {
  return basicKey(value)
    .replace(/\bsr\b/g, 'senior')
    .replace(/\bjr\b/g, 'junior')
    .replace(/\s+/g, ' ')
    .trim()
}

function locationKey(value: string): string {
  const cityLike = value.split(',')[0] || value
  return basicKey(cityLike)
    .replace(/^greater\s+/, '')
    .replace(/\bmetropolitan area\b/g, '')
    .replace(/\bmetro area\b/g, '')
    .replace(/\bmetro\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizerFor(field: CandidateFieldV35): (value: string) => string {
  if (field === 'name') return nameKey
  if (field === 'current_company') return companyKey
  if (field === 'current_title' || field === 'headline') return titleKey
  if (field === 'location') return locationKey
  return basicKey
}

function freshnessFor(observedAt: string, now: Date, staleDays = 180): CandidateFieldObservationV35['freshness'] {
  const timestamp = new Date(observedAt).getTime()
  if (!Number.isFinite(timestamp)) return 'unknown'
  const ageDays = Math.max(0, now.getTime() - timestamp) / 86_400_000
  if (ageDays > staleDays) return 'stale'
  if (ageDays > staleDays * 0.66) return 'aging'
  return 'current'
}

function freshnessAdjustment(status: CandidateFieldObservationV35['freshness']): number {
  if (status === 'current') return 8
  if (status === 'aging') return 2
  if (status === 'stale') return -10
  return 0
}

function handleLike(value: string): boolean {
  const trimmed = value.trim()
  return Boolean(trimmed && !/\s/.test(trimmed) && /^[a-z0-9._-]+$/.test(trimmed))
}

function observation(
  field: CandidateFieldV35,
  value: string,
  source: string,
  observedAt: string,
  authority: number,
  now: Date,
  sourceProfileId?: string,
): CandidateFieldObservationV35 | null {
  const cleaned = clean(value)
  if (!cleaned) return null
  const normalizedValue = normalizerFor(field)(cleaned)
  if (!normalizedValue) return null
  const freshness = freshnessFor(observedAt, now, field === 'name' ? 3650 : 180)
  let adjustedAuthority = authority
  const rationale: string[] = []
  if (field === 'name' && handleLike(cleaned)) {
    adjustedAuthority = Math.min(adjustedAuthority, 25)
    rationale.push('Single-token handle-like names are weak canonical-name evidence.')
  }
  rationale.push(`${source} observation is ${freshness}.`)
  return {
    id: `${field}:${source}:${sourceProfileId || 'candidate'}:${normalizedValue}`,
    field,
    value: cleaned,
    normalizedValue,
    source,
    sourceProfileId,
    observedAt,
    authority: adjustedAuthority,
    freshness,
    rationale,
  }
}

function fieldObservations(
  snapshot: CandidateDbSnapshot,
  candidateId: string,
  field: CandidateFieldV35,
  now: Date,
): CandidateFieldObservationV35[] {
  const candidate = snapshot.candidates.find(item => item.id === candidateId)
  if (!candidate) return []
  const values: CandidateFieldObservationV35[] = []

  const legacyValue = field === 'name'
    ? candidate.canonicalName
    : field === 'headline'
      ? candidate.headline
      : field === 'current_title'
        ? candidate.currentTitle
        : field === 'current_company'
          ? candidate.currentCompany
          : candidate.location

  const legacy = observation(
    field,
    clean(legacyValue),
    'legacy_candidate_scalar',
    candidate.updatedAt || candidate.createdAt,
    82,
    now,
  )
  if (legacy) values.push(legacy)

  for (const profile of snapshot.sourceProfiles) {
    if (profile.candidateId !== candidateId || profile.status === 'rejected') continue
    const profileValue = field === 'name'
      ? profile.displayName
      : field === 'headline' || field === 'current_title'
        ? profile.headline
        : field === 'current_company'
          ? profile.organization
          : profile.location
    const authority = profile.status === 'confirmed' ? 80 : 66
    const next = observation(
      field,
      clean(profileValue),
      `source_profile:${profile.source}`,
      profile.lastSeenAt || profile.createdAt,
      authority,
      now,
      profile.id,
    )
    if (next) values.push(next)
  }

  return values
}

function groupsFor(observations: CandidateFieldObservationV35[]): Group[] {
  const groups = new Map<string, CandidateFieldObservationV35[]>()
  for (const item of observations) {
    const group = groups.get(item.normalizedValue) || []
    group.push(item)
    groups.set(item.normalizedValue, group)
  }

  return Array.from(groups.entries()).map(([key, items]) => {
    const distinctSources = new Set(items
      .filter(item => item.source !== 'legacy_candidate_scalar')
      .map(item => item.source)).size
    const strongest = Math.max(...items.map(item => item.authority + freshnessAdjustment(item.freshness)))
    const corroboration = Math.min(18, Math.max(0, distinctSources - 1) * 9)
    return { key, observations: items, score: strongest + corroboration, distinctSources }
  }).sort((a, b) => b.score - a.score || b.observations.length - a.observations.length || a.key.localeCompare(b.key))
}

function resolveField(
  field: CandidateFieldV35,
  observations: CandidateFieldObservationV35[],
): ResolvedCandidateFieldV35 {
  const groups = groupsFor(observations)
  const best = groups[0]
  if (!best) {
    return { field, state: 'unknown', rationale: ['No attached observation is available.'], alternatives: [], conflicts: [], sourceCount: 0 }
  }

  const winning = [...best.observations].sort((a, b) =>
    (b.authority + freshnessAdjustment(b.freshness)) - (a.authority + freshnessAdjustment(a.freshness))
      || b.observedAt.localeCompare(a.observedAt))[0]
  const runnerUp = groups[1]
  const conflicts: ResolvedCandidateFieldV35['conflicts'] = []
  let state: ResolutionStateV35 = winning.freshness === 'stale' ? 'stale' : 'resolved'

  if (runnerUp) {
    const scoreGap = best.score - runnerUp.score
    conflicts.push({
      observationIds: [winning.id, runnerUp.observations[0].id],
      severity: 'material',
      reason: `Competing ${field.replace('_', ' ')} observations disagree.`,
    })
    state = scoreGap <= 8 ? 'needs_review' : 'resolved_with_conflict'
  }

  const alternatives = groups.slice(1).flatMap(group => group.observations.slice(0, 1).map(item => ({
    observationId: item.id,
    value: item.value,
    source: item.source,
    reasonNotSelected: `Resolution utility ${group.score} was below winning group ${best.score}.`,
  })))

  const rationale = [
    `Selected ${winning.source} using field-specific authority, freshness, and corroboration.`,
    best.distinctSources > 1 ? `${best.distinctSources} independent source types corroborate the normalized value.` : 'No multi-source corroboration bonus applied.',
    ...winning.rationale,
  ]
  if (runnerUp) rationale.push(`A competing observation group remains visible; score gap ${best.score - runnerUp.score}.`)

  return {
    field,
    state,
    value: winning.value,
    winningObservationId: winning.id,
    winningSource: winning.source,
    rationale,
    alternatives,
    conflicts,
    sourceCount: new Set(best.observations.map(item => item.source)).size,
  }
}

function resolvePrimaryEmail(
  snapshot: CandidateDbSnapshot,
  ledger: EvidenceLedgerSnapshot,
  candidateId: string,
  now: Date,
): ResolvedContactV35 | undefined {
  const linkedProfiles = new Set(snapshot.sourceProfiles.filter(profile => profile.candidateId === candidateId && profile.status !== 'rejected').map(profile => profile.id))
  const blockedClaims = new Set(ledger.claims
    .filter(claim => claim.candidateId === candidateId && claim.fieldName === 'contact.email' && claim.permittedUse === 'blocked')
    .map(claim => claim.claimedValue.toLowerCase()))

  const candidates = snapshot.contactSignals.flatMap(signal => {
    if (signal.type !== 'email') return []
    const linked = signal.candidateId === candidateId || Boolean(signal.sourceProfileId && linkedProfiles.has(signal.sourceProfileId))
    if (!linked) return []
    const value = clean(signal.value, 320).toLowerCase()
    if (!value || blockedClaims.has(value) || signal.permissionStatus === 'do_not_contact') return []
    const freshness = freshnessFor(signal.createdAt, now, 60)
    const base = signal.verified ? 82 : signal.confidence === 'high' ? 70 : signal.confidence === 'medium' ? 60 : 48
    const permissionBoost = signal.permissionStatus === 'candidate_provided' ? 8 : signal.permissionStatus === 'company_owned' ? 4 : 0
    return [{ signal, value, freshness, score: base + permissionBoost + freshnessAdjustment(freshness) }]
  })

  if (!candidates.length) return undefined
  const grouped = new Map<string, typeof candidates>()
  for (const item of candidates) grouped.set(item.value, [...(grouped.get(item.value) || []), item])
  const ranked = Array.from(grouped.entries()).map(([value, items]) => ({
    value,
    items,
    score: Math.max(...items.map(item => item.score)) + Math.min(12, Math.max(0, new Set(items.map(item => item.signal.source)).size - 1) * 6),
  })).sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))

  const best = ranked[0]
  const winner = [...best.items].sort((a, b) => b.score - a.score)[0]
  const alternatives = ranked.slice(1).map(group => {
    const item = [...group.items].sort((a, b) => b.score - a.score)[0]
    return { value: group.value, source: String(item.signal.source), permissionStatus: item.signal.permissionStatus, freshness: item.freshness }
  })
  return {
    value: best.value,
    state: winner.freshness === 'stale' ? 'stale' : ranked.length > 1 ? 'resolved_with_conflict' : 'resolved',
    source: String(winner.signal.source),
    sourceCount: new Set(best.items.map(item => item.signal.source)).size,
    verified: Boolean(winner.signal.verified),
    permissionStatus: winner.signal.permissionStatus,
    freshness: winner.freshness,
    rationale: [
      'Email resolution keeps ownership/provenance separate from permission to contact.',
      `${best.items.length} attached observation(s) support the normalized email.`,
      winner.signal.verified ? 'The winning legacy contact observation is marked verified.' : 'The winning contact remains unverified.',
      `Permission status remains ${winner.signal.permissionStatus}.`,
    ],
    alternatives,
  }
}

export function resolveCandidate360FieldsV35(
  snapshot: CandidateDbSnapshot,
  ledger: EvidenceLedgerSnapshot,
  candidateId: string,
  options: ResolveOptions = {},
): Candidate360ResolvedProfileV35 {
  const now = options.now || new Date()
  const name = resolveField('name', fieldObservations(snapshot, candidateId, 'name', now))
  const headline = resolveField('headline', fieldObservations(snapshot, candidateId, 'headline', now))
  const currentTitle = resolveField('current_title', fieldObservations(snapshot, candidateId, 'current_title', now))
  const currentCompany = resolveField('current_company', fieldObservations(snapshot, candidateId, 'current_company', now))
  const location = resolveField('location', fieldObservations(snapshot, candidateId, 'location', now))
  const primaryWorkEmail = resolvePrimaryEmail(snapshot, ledger, candidateId, now)
  const fields = [name, headline, currentTitle, currentCompany, location]
  const conflictCount = fields.reduce((sum, field) => sum + field.conflicts.length, 0) + (primaryWorkEmail?.alternatives.length || 0)
  const reviewCount = fields.filter(field => field.state === 'needs_review').length

  return {
    name,
    headline,
    currentTitle,
    currentCompany,
    location,
    ...(primaryWorkEmail ? { primaryWorkEmail } : {}),
    conflictCount,
    reviewCount,
    resolverVersion: 'v35.0-shadow',
    policyVersion: 'v35.0-shadow',
    shadowOnly: true,
  }
}
