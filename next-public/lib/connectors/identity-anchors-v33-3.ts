/**
 * Cross-source identity anchor assessment for the Technical Talent Graph.
 *
 * This module does exactly one thing: it explains, in typed terms, why two
 * source dossiers might or might not describe the same human. It has no write
 * path, no merge function and no side effects. The canonical Identity Brain
 * (`compareSourceProfiles` plus `createDeterministicIdentityProposals`) remains
 * the only thing that creates recruiter proposals, and only a recruiter can
 * link identities.
 *
 * The distinction that matters:
 *
 *   deterministic  a stable, person-specific identifier appears on both records
 *   supporting     a similarity that ranks a proposal but cannot create one
 *   conflict       evidence that argues against, or blocks, the same-person read
 */

import type {
  IdentityAnchor,
  IdentityAnchorKind,
  TechnicalDossier,
} from './contract-v33-3'

export type AnchorMatch = {
  readonly kind: IdentityAnchorKind
  readonly normalized: string
  readonly leftValue: string
  readonly rightValue: string
  readonly explanation: string
}

export type SupportingSimilarity = {
  readonly kind: 'display_name' | 'stated_location' | 'stated_organization' | 'technology_overlap'
  readonly detail: string
  readonly weight: number
}

export type IdentityConflictFinding = {
  readonly kind:
    | 'different_personal_domain'
    | 'different_public_email'
    | 'different_stated_location'
    | 'different_stated_organization'
    | 'non_person_entity'
  readonly severity: 'blocking' | 'material'
  readonly explanation: string
}

export type CrossSourceIdentityAssessment = {
  readonly deterministicMatches: readonly AnchorMatch[]
  readonly supporting: readonly SupportingSimilarity[]
  readonly conflicts: readonly IdentityConflictFinding[]
  /** Ranking only. Never a merge authority and never shown as a match percentage. */
  readonly reviewPriority: number
  /**
   * `proposal` means a recruiter should be asked. `no_link` means there is not
   * enough to ask about. `blocked` means something argues against the link.
   * There is deliberately no `merge` outcome.
   */
  readonly outcome: 'proposal' | 'no_link' | 'blocked'
  readonly summary: string
}

/**
 * Anchor kinds that identify a specific person rather than a platform.
 * A shared `source_profile_url` host is not an anchor: every GitHub user
 * shares github.com.
 */
const DETERMINISTIC_KINDS: ReadonlySet<IdentityAnchorKind> = new Set<IdentityAnchorKind>([
  'personal_domain',
  'public_email',
  'github_login',
  'orcid',
  'explicit_profile_link',
])

const ANCHOR_EXPLANATIONS: Record<IdentityAnchorKind, string> = {
  personal_domain: 'Both records publish the same personal domain.',
  public_email: 'Both records expose the same public email address.',
  github_login: 'Both records point at the same GitHub account.',
  stackexchange_user_id: 'Both records point at the same Stack Exchange account.',
  orcid: 'Both records carry the same ORCID identifier.',
  explicit_profile_link: 'One record explicitly links to the other profile.',
  source_profile_url: 'Both records reference the same source profile URL.',
}

function normalizedIndex(anchors: readonly IdentityAnchor[]): Map<string, IdentityAnchor> {
  const index = new Map<string, IdentityAnchor>()
  for (const anchor of anchors) {
    if (!anchor.normalized) continue
    index.set(`${anchor.kind}|${anchor.normalized}`, anchor)
  }
  return index
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeLoose(value: string | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function anchorValues(anchors: readonly IdentityAnchor[], kind: IdentityAnchorKind): string[] {
  return anchors.filter(anchor => anchor.kind === kind).map(anchor => anchor.normalized).filter(Boolean)
}

/**
 * Compare two dossiers.
 *
 * Cross-source explicit links are matched loosely on both sides: a Stack
 * Overflow profile whose website is `github.com/jane` matches a GitHub dossier
 * whose login is `jane`, because that is a genuine person-specific pointer.
 */
export function assessCrossSourceIdentity(
  left: TechnicalDossier,
  right: TechnicalDossier,
): CrossSourceIdentityAssessment {
  const deterministicMatches: AnchorMatch[] = []
  const supporting: SupportingSimilarity[] = []
  const conflicts: IdentityConflictFinding[] = []

  const leftIndex = normalizedIndex(left.anchors)
  const rightIndex = normalizedIndex(right.anchors)

  for (const [key, anchor] of leftIndex) {
    if (!DETERMINISTIC_KINDS.has(anchor.kind)) continue
    if (anchor.strength !== 'deterministic') continue
    const counterpart = rightIndex.get(key)
    if (!counterpart) continue
    deterministicMatches.push({
      kind: anchor.kind,
      normalized: anchor.normalized,
      leftValue: anchor.value,
      rightValue: counterpart.value,
      explanation: ANCHOR_EXPLANATIONS[anchor.kind],
    })
  }

  // Cross-kind pointer: an explicit link on one side naming the other's account.
  const crossPointer = (
    pointerSide: TechnicalDossier,
    targetSide: TechnicalDossier,
  ): AnchorMatch | null => {
    const targetLogin = targetSide.source === 'github' ? targetSide.person.sourceProfileId.toLowerCase() : ''
    if (!targetLogin) return null
    const pointer = pointerSide.anchors.find(
      anchor =>
        anchor.kind === 'explicit_profile_link' &&
        anchor.strength === 'deterministic' &&
        anchor.normalized.includes(`github.com/${targetLogin}`),
    )
    if (!pointer) return null
    return {
      kind: 'explicit_profile_link',
      normalized: pointer.normalized,
      leftValue: pointer.value,
      rightValue: targetSide.person.profileUrl,
      explanation: `The ${pointerSide.source} profile explicitly links to the ${targetSide.source} account ${targetLogin}.`,
    }
  }

  const pointerLeft = crossPointer(left, right)
  const pointerRight = crossPointer(right, left)
  if (pointerLeft) deterministicMatches.push(pointerLeft)
  if (pointerRight) deterministicMatches.push(pointerRight)

  // Conflicts.
  const leftDomains = anchorValues(left.anchors, 'personal_domain')
  const rightDomains = anchorValues(right.anchors, 'personal_domain')
  if (leftDomains.length && rightDomains.length && !leftDomains.some(domain => rightDomains.includes(domain))) {
    conflicts.push({
      kind: 'different_personal_domain',
      severity: 'material',
      explanation: `Different personal domains: ${leftDomains.join(', ')} versus ${rightDomains.join(', ')}. People do run more than one site, so this is a reason for review rather than an automatic rejection.`,
    })
  }

  const leftEmails = anchorValues(left.anchors, 'public_email')
  const rightEmails = anchorValues(right.anchors, 'public_email')
  if (leftEmails.length && rightEmails.length && !leftEmails.some(email => rightEmails.includes(email))) {
    conflicts.push({
      kind: 'different_public_email',
      severity: 'material',
      explanation: `Different public emails: ${leftEmails.join(', ')} versus ${rightEmails.join(', ')}.`,
    })
  }

  const leftLocation = normalizeLoose(left.person.statedLocation)
  const rightLocation = normalizeLoose(right.person.statedLocation)
  if (leftLocation && rightLocation && leftLocation !== rightLocation) {
    conflicts.push({
      kind: 'different_stated_location',
      severity: 'material',
      explanation: `Self-stated locations differ: ${left.person.statedLocation} versus ${right.person.statedLocation}. Profiles go stale and people relocate, so this is context for review, not proof of two people.`,
    })
  }

  // Supporting similarities.
  const leftName = normalizeName(left.person.displayName)
  const rightName = normalizeName(right.person.displayName)
  if (leftName && leftName === rightName) {
    supporting.push({
      kind: 'display_name',
      detail: `Both records display the name ${left.person.displayName}. Common names collide constantly, so this cannot create a proposal on its own.`,
      weight: 20,
    })
  }

  if (leftLocation && leftLocation === rightLocation) {
    supporting.push({
      kind: 'stated_location',
      detail: `Both records state the location ${left.person.statedLocation}.`,
      weight: 10,
    })
  }

  const leftOrg = normalizeLoose(left.person.statedOrganization)
  const rightOrg = normalizeLoose(right.person.statedOrganization)
  if (leftOrg && leftOrg === rightOrg) {
    supporting.push({
      kind: 'stated_organization',
      detail: `Both records state the organization ${left.person.statedOrganization}.`,
      weight: 10,
    })
  }

  const leftTech = new Set(left.technologies.map(item => item.value.toLowerCase()))
  const overlap = right.technologies.map(item => item.value.toLowerCase()).filter(value => leftTech.has(value))
  if (overlap.length >= 2) {
    supporting.push({
      kind: 'technology_overlap',
      detail: `Shared observed technologies: ${Array.from(new Set(overlap)).slice(0, 6).join(', ')}. Two people found by the same search overlap by construction, so this only ranks a proposal.`,
      weight: Math.min(12, overlap.length * 2),
    })
  }

  const blocking = conflicts.some(conflict => conflict.severity === 'blocking')
  const outcome: CrossSourceIdentityAssessment['outcome'] = blocking
    ? 'blocked'
    : deterministicMatches.length
      ? 'proposal'
      : 'no_link'

  const reviewPriority = Math.min(
    100,
    deterministicMatches.length * 40 +
      supporting.reduce((sum, item) => sum + item.weight, 0) -
      conflicts.length * 5,
  )

  const summary =
    outcome === 'proposal'
      ? `Possible same person. ${deterministicMatches.length} deterministic anchor${deterministicMatches.length === 1 ? '' : 's'} found. Recruiter review required before these records are linked.`
      : outcome === 'blocked'
        ? 'Blocked. Evidence argues against these records describing the same person.'
        : 'No deterministic cross-source anchor. These records stay separate.'

  return {
    deterministicMatches,
    supporting,
    conflicts,
    reviewPriority: Math.max(0, reviewPriority),
    outcome,
    summary,
  }
}

/**
 * Assess every cross-source pair in a batch.
 *
 * Same-source pairs are skipped: collapsing two records from one source is a
 * deterministic same-id operation handled upstream, not an identity judgement.
 */
export function assessDossierBatch(dossiers: readonly TechnicalDossier[]): Array<{
  left: TechnicalDossier
  right: TechnicalDossier
  assessment: CrossSourceIdentityAssessment
}> {
  const out: Array<{ left: TechnicalDossier; right: TechnicalDossier; assessment: CrossSourceIdentityAssessment }> = []
  for (let i = 0; i < dossiers.length; i += 1) {
    for (let j = i + 1; j < dossiers.length; j += 1) {
      const left = dossiers[i]
      const right = dossiers[j]
      if (left.source === right.source) continue
      const assessment = assessCrossSourceIdentity(left, right)
      if (assessment.outcome === 'no_link') continue
      out.push({ left, right, assessment })
    }
  }
  return out.sort((a, b) => b.assessment.reviewPriority - a.assessment.reviewPriority)
}
