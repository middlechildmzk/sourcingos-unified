export type IdentityEntityKind = 'person' | 'organization' | 'publication' | 'artifact' | 'unknown'
export type IdentityReviewBucket = 'likely_same' | 'ambiguous' | 'unlikely' | 'blocked_conflict'
export type IdentityComponentKey = 'name' | 'organization' | 'location' | 'headline' | 'explicit_identifier' | 'profile_url'

export type IdentityObservedIdentifier = {
  type: 'orcid' | 'npi' | 'public_email' | 'profile_url' | 'other'
  value: string
  source?: string
}

export type IdentityLinkageRecord = {
  id: string
  entityKind: IdentityEntityKind
  displayName?: string
  organization?: string
  location?: string
  headline?: string
  profileUrl?: string
  identifiers?: IdentityObservedIdentifier[]
}

export type IdentityLinkageComponent = {
  key: IdentityComponentKey
  similarity: number
  weight: number
  contribution: number
  explanation: string
}

export type IdentityBlockingConflict = {
  field: string
  left: string
  right: string
  explanation: string
}

export type IdentityLinkageAssessment = {
  leftId: string
  rightId: string
  reviewProbability: number
  bucket: IdentityReviewBucket
  components: IdentityLinkageComponent[]
  blockingConflicts: IdentityBlockingConflict[]
  exactAnchors: string[]
  reviewRequired: true
  mayAutoMerge: false
  explanation: string
}

export type IdentityBenchmarkCase = {
  id: string
  left: IdentityLinkageRecord
  right: IdentityLinkageRecord
  expected: 'same' | 'different' | 'ambiguous'
}

export type IdentityBenchmarkReport = {
  cases: number
  sameCases: number
  differentCases: number
  ambiguousCases: number
  falsePositiveRate: number
  falseNegativeRate: number
  abstentionRate: number
  blockedConflictRate: number
  reviewCoverage: number
  predictions: Array<{ id: string; expected: IdentityBenchmarkCase['expected']; bucket: IdentityReviewBucket; probability: number }>
  note: string
}

const COMMON_NAME_TOKENS = new Set([
  'john', 'james', 'michael', 'david', 'robert', 'jennifer', 'maria', 'jose', 'juan', 'li', 'wang', 'zhang', 'chen',
  'singh', 'patel', 'smith', 'lee', 'kim', 'garcia', 'martinez', 'brown', 'jones', 'williams',
])

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function normalizeText(value?: string): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9@.+:/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUrl(value?: string): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    url.hash = ''
    url.search = ''
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '').toLowerCase()}`
  } catch {
    return normalizeText(raw)
  }
}

function tokens(value?: string): string[] {
  return normalizeText(value).split(' ').filter(Boolean)
}

function jaccard(left?: string, right?: string): number {
  const a = new Set(tokens(left))
  const b = new Set(tokens(right))
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter(token => b.has(token)).length
  const union = new Set([...a, ...b]).size
  return union ? intersection / union : 0
}

function nameSimilarity(left?: string, right?: string): number {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.length || !b.length) return 0
  const joinedA = a.join(' ')
  const joinedB = b.join(' ')
  if (joinedA === joinedB) return 1

  const surnameA = a[a.length - 1]
  const surnameB = b[b.length - 1]
  const firstA = a[0]
  const firstB = b[0]
  if (surnameA !== surnameB) return 0

  if (firstA === firstB) return a.length === b.length ? 0.94 : 0.88
  if (firstA?.[0] === firstB?.[0]) return 0.72
  return 0.25
}

function commonNamePenalty(left?: string, right?: string): number {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.length || !b.length) return 0
  const shared = a.filter(token => b.includes(token))
  return shared.some(token => COMMON_NAME_TOKENS.has(token)) ? 0.1 : 0
}

function normalizedIdentifiers(record: IdentityLinkageRecord): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>()
  const add = (type: string, value?: string) => {
    const normalized = type === 'profile_url' ? normalizeUrl(value) : normalizeText(value)
    if (!normalized) return
    if (!result.has(type)) result.set(type, new Set())
    result.get(type)!.add(normalized)
  }

  for (const identifier of record.identifiers || []) add(identifier.type, identifier.value)
  if (record.profileUrl) add('profile_url', record.profileUrl)
  return result
}

const CONFLICT_BLOCKING_TYPES = new Set(['orcid', 'npi'])

function identifierAnalysis(left: IdentityLinkageRecord, right: IdentityLinkageRecord) {
  const a = normalizedIdentifiers(left)
  const b = normalizedIdentifiers(right)
  const exactAnchors: string[] = []
  const conflicts: IdentityBlockingConflict[] = []

  for (const type of new Set([...a.keys(), ...b.keys()])) {
    const leftValues = a.get(type) || new Set<string>()
    const rightValues = b.get(type) || new Set<string>()
    if (!leftValues.size || !rightValues.size) continue
    const overlap = [...leftValues].filter(value => rightValues.has(value))
    if (overlap.length) {
      exactAnchors.push(`${type}:${overlap[0]}`)
      continue
    }
    if (CONFLICT_BLOCKING_TYPES.has(type)) {
      conflicts.push({
        field: type,
        left: [...leftValues][0] || '',
        right: [...rightValues][0] || '',
        explanation: `Conflicting observed ${type.toUpperCase()} identifiers block an automatic same-person assumption.`,
      })
    }
  }

  return { exactAnchors, conflicts }
}

function component(key: IdentityComponentKey, similarity: number, weight: number, explanation: string): IdentityLinkageComponent {
  return { key, similarity: round(clamp01(similarity)), weight, contribution: round(clamp01(similarity) * weight), explanation }
}

export function assessIdentityLinkage(left: IdentityLinkageRecord, right: IdentityLinkageRecord): IdentityLinkageAssessment {
  if (left.entityKind !== 'person' || right.entityKind !== 'person') {
    return {
      leftId: left.id,
      rightId: right.id,
      reviewProbability: 0,
      bucket: 'blocked_conflict',
      components: [],
      blockingConflicts: [{
        field: 'entity_kind',
        left: left.entityKind,
        right: right.entityKind,
        explanation: 'Only person entities are eligible for person-identity linkage review.',
      }],
      exactAnchors: [],
      reviewRequired: true,
      mayAutoMerge: false,
      explanation: 'Entity-kind mismatch blocks person identity linkage. No merge action is available.',
    }
  }

  const identifiers = identifierAnalysis(left, right)
  const profileA = normalizeUrl(left.profileUrl)
  const profileB = normalizeUrl(right.profileUrl)
  const profileSimilarity = profileA && profileB ? (profileA === profileB ? 1 : 0) : 0
  const explicitIdentifierSimilarity = identifiers.exactAnchors.length ? 1 : 0

  const components = [
    component('explicit_identifier', explicitIdentifierSimilarity, 0.38, identifiers.exactAnchors.length ? 'At least one explicitly observed identifier matches exactly.' : 'No shared explicit identifier was observed.'),
    component('profile_url', profileSimilarity, 0.22, profileSimilarity ? 'The normalized source/profile URL matches exactly.' : 'No exact normalized profile URL match.'),
    component('name', nameSimilarity(left.displayName, right.displayName), 0.18, 'Conservative normalized-name similarity used only as a review signal.'),
    component('organization', jaccard(left.organization, right.organization), 0.1, 'Organization text overlap is weak supporting context, never an identity anchor.'),
    component('location', jaccard(left.location, right.location), 0.06, 'Location overlap is weak supporting context.'),
    component('headline', jaccard(left.headline, right.headline), 0.06, 'Headline/role overlap is weak supporting context.'),
  ]

  if (identifiers.conflicts.length) {
    return {
      leftId: left.id,
      rightId: right.id,
      reviewProbability: 0.02,
      bucket: 'blocked_conflict',
      components,
      blockingConflicts: identifiers.conflicts,
      exactAnchors: identifiers.exactAnchors,
      reviewRequired: true,
      mayAutoMerge: false,
      explanation: 'A conflicting authoritative identifier blocks a same-person assumption. Recruiter review is required and no automatic merge is permitted.',
    }
  }

  const weighted = components.reduce((sum, item) => sum + item.contribution, 0)
  const anchorBoost = identifiers.exactAnchors.length || profileSimilarity ? 0.12 : 0
  const namePenalty = commonNamePenalty(left.displayName, right.displayName)
  const probability = round(clamp01(weighted + anchorBoost - namePenalty))

  let bucket: IdentityReviewBucket = 'ambiguous'
  if (probability >= 0.8 && (identifiers.exactAnchors.length > 0 || profileSimilarity === 1)) bucket = 'likely_same'
  else if (probability < 0.3) bucket = 'unlikely'

  return {
    leftId: left.id,
    rightId: right.id,
    reviewProbability: probability,
    bucket,
    components,
    blockingConflicts: [],
    exactAnchors: identifiers.exactAnchors,
    reviewRequired: true,
    mayAutoMerge: false,
    explanation: bucket === 'likely_same'
      ? 'Strong observed linkage signals make this pair a high-priority same-person review. Human confirmation is still required.'
      : bucket === 'unlikely'
        ? 'Observed linkage signals are weak. Keep records separate unless new evidence appears.'
        : 'Signals are insufficient for a safe same-person conclusion. Route the pair to human identity review.',
  }
}

function predictedSame(bucket: IdentityReviewBucket): boolean {
  return bucket === 'likely_same'
}

export function evaluateIdentityLinkageCases(cases: IdentityBenchmarkCase[]): IdentityBenchmarkReport {
  const predictions = cases.map(item => {
    const assessment = assessIdentityLinkage(item.left, item.right)
    return { id: item.id, expected: item.expected, bucket: assessment.bucket, probability: assessment.reviewProbability }
  })
  const sameCases = cases.filter(item => item.expected === 'same')
  const differentCases = cases.filter(item => item.expected === 'different')
  const ambiguousCases = cases.filter(item => item.expected === 'ambiguous')

  const falsePositives = differentCases.filter(item => predictedSame(assessIdentityLinkage(item.left, item.right).bucket)).length
  const falseNegatives = sameCases.filter(item => assessIdentityLinkage(item.left, item.right).bucket === 'unlikely' || assessIdentityLinkage(item.left, item.right).bucket === 'blocked_conflict').length
  const abstentions = predictions.filter(item => item.bucket === 'ambiguous').length
  const blocked = predictions.filter(item => item.bucket === 'blocked_conflict').length

  return {
    cases: cases.length,
    sameCases: sameCases.length,
    differentCases: differentCases.length,
    ambiguousCases: ambiguousCases.length,
    falsePositiveRate: differentCases.length ? round(falsePositives / differentCases.length) : 0,
    falseNegativeRate: sameCases.length ? round(falseNegatives / sameCases.length) : 0,
    abstentionRate: cases.length ? round(abstentions / cases.length) : 0,
    blockedConflictRate: cases.length ? round(blocked / cases.length) : 0,
    reviewCoverage: cases.length ? 1 : 0,
    predictions,
    note: 'Synthetic benchmark metrics validate the linkage-review contract only. They are not production identity-accuracy claims.',
  }
}
