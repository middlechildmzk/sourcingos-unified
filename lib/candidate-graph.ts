// ─────────────────────────────────────────────────────────────────────────────
// SourcingOS candidate graph - V29.2.1 identity trust boundary.
//
// TRUST RULE: a similarity score is never permission to link two source
// profiles. Before V29.2.1 this module appended a source profile into an
// existing candidate group whenever a heuristic score reached 55, which was
// reachable from name plus location plus employer plus one shared skill. That
// is a common-name collision, not an identity. Grouping no longer happens here.
// Each unconfirmed person anchor stays its own candidate record and any
// resemblance is emitted as a separate, explicit proposal for recruiter review.
//
// Exact same-source identity is a different thing from a cross-source merge.
// It stays idempotent and is collapsed by stable key, never by score.
// ─────────────────────────────────────────────────────────────────────────────
import { RefreshPolicy, SourceName, SourceResult } from './source-types'
import { canPromoteToCandidate, classifySourceResult } from './entity-classification'

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

export type IdentityConflictSeverity = 'blocking' | 'material' | 'informational'

export type IdentityConflict = {
  type: string
  severity: IdentityConflictSeverity
  explanation: string
}

export type DeterministicRuleResult = {
  ruleId: string
  passed: boolean
  evidence: string
}

export type IdentityDecisionClass =
  | 'exact_source_reuse'
  | 'high_priority_review'
  | 'standard_review'
  | 'create_new_candidate'
  | 'do_not_link'

/**
 * A proposal is a question put to a recruiter. It carries no linkage. Nothing
 * in this module may set `linked` true; only a recorded recruiter decision can.
 */
export type IdentityMatchProposal = {
  id: string
  incomingSourceProfileId: string
  incomingSourceProfileKey: string
  candidateId: string
  candidateSourceProfileId: string
  decisionClass: IdentityDecisionClass
  score: number
  reasons: string[]
  conflicts: IdentityConflict[]
  deterministicRules: DeterministicRuleResult[]
  reviewRequired: boolean
  linked: false
  decision: MatchDecision
  createdAt: string
}

export type IdentityResolutionDraft = {
  candidates: CandidateGraphProfile[]
  proposals: IdentityMatchProposal[]
  excluded: Array<{ id: string; source: SourceName; entityKind: string; reason: string }>
  duplicatesCollapsed: number
  resolverVersion: string
}

export const RESOLVER_VERSION = 'v29.2.1-proposal-only'

/** Hard cap on emitted proposals so a large result set cannot fan out. */
const MAX_PROPOSALS = 200

const norm = (value?: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const tokenSet = (items: string[]) => new Set(items.map(norm).filter(Boolean))
const overlap = (a: Set<string>, b: Set<string>) => Array.from(a).filter(x => b.has(x)).length
const nowIso = () => new Date().toISOString()
const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString()

/**
 * Emails must not go through `norm`, which strips `@` and `.` and would make
 * alex@example.com collide with alexexample.com.
 */
function normalizeEmail(value?: string): string {
  const raw = String(value || '').trim().toLowerCase()
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(raw) ? raw : ''
}

function normalizeDomain(value?: string): string {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const host = withoutScheme.split(/[/?#]/)[0].replace(/^www\./, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : ''
}

function normalizeUrl(value?: string): string {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  return raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
}

function contactValue(result: SourceResult, type: 'public_email' | 'website'): string {
  return result.contactSignals.find(signal => signal.type === type)?.value || ''
}

function stableKey(result: SourceResult): string {
  return `${result.source}:${result.sourceProfileId}`
}

/** Every URL-shaped string this profile exposes, for cross-link detection. */
function outboundUrls(result: SourceResult): Set<string> {
  const values = [
    result.profileUrl,
    contactValue(result, 'website'),
    ...result.identitySignals
      .filter(signal => signal.type === 'website' || signal.type === 'source_url')
      .map(signal => signal.value),
    ...result.evidence.map(item => item.url || ''),
  ]
  return new Set(values.map(normalizeUrl).filter(Boolean))
}

/**
 * Explainable component comparison. Returns reasons, conflicts and
 * deterministic anchors. The score ranks review order only. It is deliberately
 * not a merge authority and no caller may treat it as one.
 */
export function compareSourceProfiles(a: SourceResult, b: SourceResult) {
  let score = 0
  const reasons: string[] = []
  const conflicts: IdentityConflict[] = []
  const deterministicRules: DeterministicRuleResult[] = []

  const sameStableId = a.source === b.source && a.sourceProfileId === b.sourceProfileId
  deterministicRules.push({
    ruleId: 'same_source_stable_id',
    passed: sameStableId,
    evidence: sameStableId ? `Same ${a.source} record ${a.sourceProfileId}` : 'Different source records',
  })

  const emailA = normalizeEmail(contactValue(a, 'public_email'))
  const emailB = normalizeEmail(contactValue(b, 'public_email'))
  const sameEmail = Boolean(emailA && emailB && emailA === emailB)
  deterministicRules.push({
    ruleId: 'same_observed_public_email',
    passed: sameEmail,
    evidence: sameEmail
      ? 'Both profiles expose the same observed public email'
      : 'No shared observed public email',
  })
  if (sameEmail) {
    score += 35
    reasons.push('Same observed public email')
  } else if (emailA && emailB) {
    conflicts.push({
      type: 'different_public_email',
      severity: 'material',
      explanation: `Different observed public emails: ${emailA} vs ${emailB}. People may use multiple addresses, so this requires review rather than an automatic rejection.`,
    })
  }

  const domainA = normalizeDomain(contactValue(a, 'website'))
  const domainB = normalizeDomain(contactValue(b, 'website'))
  const sameDomain = Boolean(domainA && domainB && domainA === domainB)
  deterministicRules.push({
    ruleId: 'same_personal_website_domain',
    passed: sameDomain,
    evidence: sameDomain ? `Shared personal domain ${domainA}` : 'No shared personal domain',
  })
  if (sameDomain) {
    score += 30
    reasons.push(`Shared personal domain ${domainA}`)
  } else if (domainA && domainB) {
    conflicts.push({
      type: 'different_personal_website',
      severity: 'material',
      explanation: `Different personal websites: ${domainA} vs ${domainB}`,
    })
  }

  const urlsA = outboundUrls(a)
  const urlsB = outboundUrls(b)
  const aLinksB = Boolean(normalizeUrl(b.profileUrl) && urlsA.has(normalizeUrl(b.profileUrl)))
  const bLinksA = Boolean(normalizeUrl(a.profileUrl) && urlsB.has(normalizeUrl(a.profileUrl)))
  const crossLinked = aLinksB || bLinksA
  deterministicRules.push({
    ruleId: 'explicit_cross_profile_link',
    passed: crossLinked,
    evidence: crossLinked ? 'One profile explicitly links to the other' : 'No explicit cross-profile link',
  })
  if (crossLinked) {
    score += 30
    reasons.push('One profile explicitly links to the other')
  }

  const nameA = norm(a.displayName)
  const nameB = norm(b.displayName)
  if (nameA && nameA === nameB) {
    score += 25
    reasons.push('Exact display-name match')
  } else if (nameA && nameB && nameA.slice(0, 6) && nameB.includes(nameA.slice(0, 6))) {
    score += 12
    reasons.push('Partial display-name overlap')
  } else if (nameA && nameB) {
    conflicts.push({
      type: 'different_display_name',
      severity: 'material',
      explanation: `Different display names: ${a.displayName} vs ${b.displayName}`,
    })
  }

  if (a.location && b.location) {
    if (norm(a.location) === norm(b.location)) {
      score += 18
      reasons.push('Same stated location')
    } else {
      conflicts.push({
        type: 'location_mismatch',
        severity: 'informational',
        explanation: `Stated locations differ: ${a.location} vs ${b.location}. People relocate, so this alone is not disqualifying.`,
      })
    }
  }

  if (a.organization && b.organization) {
    if (norm(a.organization) === norm(b.organization)) {
      score += 10
      reasons.push('Same stated organization')
    } else {
      conflicts.push({
        type: 'organization_mismatch',
        severity: 'informational',
        explanation: `Stated organizations differ: ${a.organization} vs ${b.organization}`,
      })
    }
  }

  const skillOverlap = overlap(tokenSet(a.skills), tokenSet(b.skills))
  if (skillOverlap) {
    const points = Math.min(15, skillOverlap * 3)
    score += points
    reasons.push(`${skillOverlap} skill/topic overlap(s)`)
  }

  for (const profile of [a, b]) {
    if (!canPromoteToCandidate(profile.entityKind)) {
      conflicts.push({
        type: 'non_person_subject',
        severity: 'blocking',
        explanation: `${profile.source} result is classified as ${profile.entityKind}, not a person anchor`,
      })
    }
  }

  const deterministicAnchor = deterministicRules.some(
    rule => rule.passed && rule.ruleId !== 'same_source_stable_id',
  )
  const blocked = conflicts.some(conflict => conflict.severity === 'blocking')

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    conflicts,
    deterministicRules,
    deterministicAnchor,
    blocked,
    sameStableId,
  }
}

/**
 * Backward-compatible shape for existing callers. The `status` label is
 * advisory ranking only. It has never been, and must not become, an
 * instruction to link records.
 */
export function identityMatchScore(a: SourceResult, b: SourceResult) {
  const comparison = compareSourceProfiles(a, b)
  return {
    score: comparison.score,
    reasons: comparison.reasons,
    conflicts: comparison.conflicts,
    status: comparison.deterministicAnchor && !comparison.blocked ? 'needs_review' : 'weak_match',
  }
}

function defaultRefreshPolicy(sourceProfiles: SourceResult[]): RefreshPolicy {
  const sourceNames = Array.from(new Set(sourceProfiles.map(p => p.source))) as SourceName[]
  return { cadenceHours: 24, staleAfterHours: 48, sourceNames, enabled: true }
}

function newCandidateRecord(result: SourceResult): CandidateGraphProfile {
  const policy = defaultRefreshPolicy([result])
  return {
    id: `candidate-${result.source}-${encodeURIComponent(result.sourceProfileId)}`,
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
    updatedAt: nowIso(),
  }
}

/**
 * Build unmerged candidate drafts plus separate review proposals.
 *
 * Every person anchor becomes exactly one candidate record holding exactly one
 * source profile. Resemblance between two records produces a proposal, never a
 * grouping.
 */
export function buildIdentityResolutionDraft(results: SourceResult[]): IdentityResolutionDraft {
  const classified = results.map(classifySourceResult)
  const candidates: CandidateGraphProfile[] = []
  const proposals: IdentityMatchProposal[] = []
  const excluded: IdentityResolutionDraft['excluded'] = []
  const seen = new Map<string, string>()
  let duplicatesCollapsed = 0

  for (const result of classified) {
    if (!canPromoteToCandidate(result.entityKind)) {
      excluded.push({
        id: result.id,
        source: result.source,
        entityKind: result.entityKind,
        reason: `Classified as ${result.entityKind}. Only person anchors may become candidate records.`,
      })
      continue
    }

    const key = stableKey(result)
    const existingCandidateId = seen.get(key)
    if (existingCandidateId) {
      // Exact same-source identity. Idempotent reuse, not a merge decision.
      duplicatesCollapsed += 1
      proposals.push({
        id: `proposal-${proposals.length + 1}-${key}`,
        incomingSourceProfileId: result.id,
        incomingSourceProfileKey: key,
        candidateId: existingCandidateId,
        candidateSourceProfileId: result.id,
        decisionClass: 'exact_source_reuse',
        score: 100,
        reasons: [`Same ${result.source} record ${result.sourceProfileId}`],
        conflicts: [],
        deterministicRules: [
          { ruleId: 'same_source_stable_id', passed: true, evidence: `Stable key ${key}` },
        ],
        reviewRequired: false,
        linked: false,
        decision: 'pending',
        createdAt: nowIso(),
      })
      continue
    }

    const record = newCandidateRecord(result)
    seen.set(key, record.id)

    for (const existing of candidates) {
      if (proposals.length >= MAX_PROPOSALS) break
      const other = existing.sourceProfiles[0]
      if (!other) continue
      const comparison = compareSourceProfiles(other, result)
      if (!comparison.reasons.length) continue

      proposals.push({
        id: `proposal-${proposals.length + 1}-${key}-${existing.id}`,
        incomingSourceProfileId: result.id,
        incomingSourceProfileKey: key,
        candidateId: existing.id,
        candidateSourceProfileId: other.id,
        decisionClass: comparison.blocked
          ? 'do_not_link'
          : comparison.deterministicAnchor
            ? 'high_priority_review'
            : 'standard_review',
        score: comparison.score,
        reasons: comparison.reasons,
        conflicts: comparison.conflicts,
        deterministicRules: comparison.deterministicRules,
        reviewRequired: !comparison.blocked,
        linked: false,
        decision: 'pending',
        createdAt: nowIso(),
      })
    }

    candidates.push(record)
  }

  return {
    candidates,
    proposals,
    excluded,
    duplicatesCollapsed,
    resolverVersion: RESOLVER_VERSION,
  }
}

/**
 * Preserved signature for existing callers. Returns unmerged candidate drafts.
 * Callers that need resemblance information must read `proposals` from
 * buildIdentityResolutionDraft instead of expecting pre-merged groups.
 */
export function buildCandidateGraph(results: SourceResult[]): CandidateGraphProfile[] {
  return buildIdentityResolutionDraft(results).candidates
}

export function confirmCandidateMerge(profile: CandidateGraphProfile, sourceProfileIds: string[], decision: MatchDecision, decidedBy = 'recruiter'): CandidateGraphProfile {
  if (sourceProfileIds.length < 2) return profile

  const matchingReview = profile.matchReviews.find(review =>
    review.decision === 'pending'
    && review.sourceProfileIds.length === sourceProfileIds.length
    && sourceProfileIds.every(id => review.sourceProfileIds.includes(id)),
  )
  if (!matchingReview) return profile

  const updatedReviews = profile.matchReviews.map(review =>
    review.id === matchingReview.id
      ? { ...review, decision, decidedAt: nowIso(), decidedBy }
      : review,
  )
  const status = decision === 'confirmed' ? 'linked' : decision === 'rejected' ? 'rejected' : 'needs_review'
  return { ...profile, status, matchReviews: updatedReviews, updatedAt: nowIso() }
}

export function mergeRefreshedProfiles(existing: CandidateGraphProfile, refreshedProfiles: SourceResult[]) {
  // Keyed by stable source identity so a refresh replaces the same record and
  // can never introduce a second person into an existing candidate.
  const byKey = new Map(existing.sourceProfiles.map(p => [stableKey(p), p]))
  const permitted = new Set(existing.sourceProfiles.map(stableKey))
  for (const p of refreshedProfiles) {
    if (permitted.has(stableKey(p))) byKey.set(stableKey(p), p)
  }
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
