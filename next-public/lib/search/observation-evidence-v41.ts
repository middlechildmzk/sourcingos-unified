/**
 * V41 PR3 — Candidate 360 evidence, contact and company layer for /app/search.
 *
 * Before this module the search inspector rendered requirement evidence as a
 * binary tick/question-mark produced by a substring match, and it built that
 * list by merging must-have requirements with `plan.criteria.skills` — which are
 * discovery expansion terms, i.e. retrieval instructions. Rendering retrieval
 * instructions under a heading called "Requirement evidence" reads to a
 * recruiter as though the candidate was evidenced against them.
 *
 * Everything here is pure and derived from evidence already on screen. It makes
 * no network calls, so opening a candidate can never trigger paid enrichment.
 */

export type ObservationRequirementState = 'supported' | 'contradicted' | 'needs_verification' | 'unknown'

export type RequirementOrigin = 'must_have' | 'preferred' | 'discovery_expansion'

export type ObservationEvidenceField =
  | 'current_title'
  | 'headline'
  | 'current_employer'
  | 'location'
  | 'skills'
  | 'summary'
  | 'experience'

export type ObservationRequirement = {
  text: string
  origin: RequirementOrigin
  clearance: boolean
}

export type ObservationRequirementAssessment = {
  requirement: string
  origin: RequirementOrigin
  state: ObservationRequirementState
  /** Which observed field carried the match. Empty when nothing matched. */
  matchedFields: ObservationEvidenceField[]
  /** The observed text the recruiter should judge, verbatim from the provider. */
  quotedEvidence: string[]
  /** Plain-language explanation. Rendered as "Why this state", secondary. */
  rationale: string
}

export type ObservationLike = {
  provider?: string
  currentTitle?: string
  headline?: string
  currentEmployer?: string
  location?: string
  skills?: string[]
  richProfile?: {
    summary?: string
    experience?: Array<{ title?: string; company?: string; location?: string; description?: string }>
  }
}

const CLEARANCE_TERMS = [
  'clearance', 'cleared', 'secret', 'top secret', 'ts/sci', 'tssci', 'sci',
  'poly', 'polygraph', 'ci poly', 'full scope', 'fsp', 'public trust',
  'dod 8570', 'q clearance', 'l clearance',
]

/**
 * Clearance is never asserted from public evidence. A clearance requirement can
 * reach at most `needs_verification`, and the surfaced text is a breadcrumb the
 * recruiter must confirm directly. This is a platform guardrail, not a display
 * preference, so the check lives with the assessment rather than in the view.
 */
export function isClearanceRequirementV41(text: string): boolean {
  const value = text.toLowerCase()
  return CLEARANCE_TERMS.some(term => value.includes(term))
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#./ ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Generic requirement filler. A recruiter writing "RHEL administration" means
 * RHEL; matching on "administration" alone would manufacture support from a
 * word that appears in almost every technical profile.
 */
const REQUIREMENT_STOPWORDS = new Set([
  'administration', 'administrator', 'admin', 'engineer', 'engineering', 'experience',
  'years', 'year', 'strong', 'solid', 'hands', 'level', 'senior', 'junior', 'lead',
  'skills', 'knowledge', 'proficiency', 'proficient', 'expertise', 'background',
  'ability', 'working', 'support', 'management', 'development', 'developer',
  'the', 'and', 'with', 'for', 'plus', 'must', 'have', 'nice', 'required',
])

/**
 * Requirement text arrives as recruiter prose ("10+ years RHEL / Red Hat
 * administration"). Split on separators so a slash-joined pair matches either
 * side, then also expose distinctive single tokens so the phrase matches an
 * observed skill tag. Fragments under three characters are dropped — they match
 * almost any haystack and would manufacture false support.
 */
export function requirementPhrasesV41(text: string): string[] {
  const cleaned = text.replace(/^(preference|preferred|must have|nice to have)\s*:\s*/i, '')
  const segments = cleaned
    .split(/[/,;|]| or | and /i)
    .map(normalize)
    .filter(part => part.length >= 3)

  const tokens = segments
    .flatMap(segment => segment.split(' '))
    .filter(token => token.length >= 3 && !REQUIREMENT_STOPWORDS.has(token) && !/^\d+\+?$/.test(token))

  return Array.from(new Set([...segments, ...tokens]))
}

const FIELD_LABELS: Record<ObservationEvidenceField, string> = {
  current_title: 'observed current title',
  headline: 'observed headline',
  current_employer: 'observed employer',
  location: 'observed location',
  skills: 'observed skills',
  summary: 'provider-observed summary',
  experience: 'observed experience history',
}

type FieldValue = { field: ObservationEvidenceField; text: string }

function observedFields(person: ObservationLike): FieldValue[] {
  const values: FieldValue[] = []
  if (person.currentTitle) values.push({ field: 'current_title', text: person.currentTitle })
  if (person.headline) values.push({ field: 'headline', text: person.headline })
  if (person.currentEmployer) values.push({ field: 'current_employer', text: person.currentEmployer })
  if (person.location) values.push({ field: 'location', text: person.location })
  for (const skill of person.skills || []) values.push({ field: 'skills', text: skill })
  if (person.richProfile?.summary) values.push({ field: 'summary', text: person.richProfile.summary })
  for (const item of person.richProfile?.experience || []) {
    const text = [item.title, item.company, item.description].filter(Boolean).join(' — ')
    if (text) values.push({ field: 'experience', text })
  }
  return values
}

export function assessObservationRequirementV41(
  person: ObservationLike,
  requirement: ObservationRequirement,
): ObservationRequirementAssessment {
  const phrases = requirementPhrasesV41(requirement.text)
  const fields = observedFields(person)
  const hits = fields.filter(entry => {
    const haystack = normalize(entry.text)
    return phrases.some(phrase => haystack.includes(phrase))
  })

  const matchedFields = Array.from(new Set(hits.map(hit => hit.field)))
  // The recruiter judges the source sentence, not our paraphrase of it.
  const quotedEvidence = Array.from(new Set(hits.map(hit => hit.text))).slice(0, 3)

  if (requirement.clearance) {
    // Maximum reachable state. A public-source hit is a breadcrumb, never proof.
    return {
      requirement: requirement.text,
      origin: requirement.origin,
      state: 'needs_verification',
      matchedFields,
      quotedEvidence,
      rationale: hits.length
        ? 'Unverified clearance breadcrumb found in public source text. Clearance status cannot be verified from public sources. Confirm directly.'
        : 'No clearance breadcrumb in this observation. Absence is not a negative finding. Clearance must be confirmed directly with the candidate or the program.',
    }
  }

  if (!hits.length) {
    return {
      requirement: requirement.text,
      origin: requirement.origin,
      state: 'unknown',
      matchedFields: [],
      quotedEvidence: [],
      rationale: 'No evidence found in this observation. This is not a fail and not a negative finding; the source may simply not carry it.',
    }
  }

  return {
    requirement: requirement.text,
    origin: requirement.origin,
    state: 'supported',
    matchedFields,
    quotedEvidence,
    rationale: `Matched in ${matchedFields.map(field => FIELD_LABELS[field]).join(', ')}. Provider-observed only; not independently verified.`,
  }
}

/**
 * Requirements the recruiter stated are kept strictly separate from discovery
 * expansion terms the planner added to widen retrieval. Expansions are search
 * logic and are never presented as candidate evidence.
 */
export function buildObservationRequirementsV41(plan?: {
  criteria?: { requirements?: Array<{ text: string; mustHave: boolean }>; skills?: string[] }
}): ObservationRequirement[] {
  const stated = plan?.criteria?.requirements || []
  const seen = new Set<string>()
  const output: ObservationRequirement[] = []

  for (const item of stated) {
    const key = normalize(item.text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push({
      text: item.text,
      origin: item.mustHave ? 'must_have' : 'preferred',
      clearance: isClearanceRequirementV41(item.text),
    })
  }

  for (const skill of plan?.criteria?.skills || []) {
    const key = normalize(skill)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push({ text: skill, origin: 'discovery_expansion', clearance: isClearanceRequirementV41(skill) })
  }

  return output
}

export type ObservationEvidenceTally = {
  supported: number
  contradicted: number
  needsVerification: number
  unknown: number
  /** Stated requirements only. Expansion terms are excluded by design. */
  statedRequirements: number
}

/**
 * The tally counts stated requirements only. Counting expansion terms would
 * inflate an evidence signal using the search's own retrieval instructions.
 * There is deliberately no composite score or percentage anywhere.
 */
export function tallyObservationEvidenceV41(
  assessments: readonly ObservationRequirementAssessment[],
): ObservationEvidenceTally {
  const stated = assessments.filter(item => item.origin !== 'discovery_expansion')
  return {
    supported: stated.filter(item => item.state === 'supported').length,
    contradicted: stated.filter(item => item.state === 'contradicted').length,
    needsVerification: stated.filter(item => item.state === 'needs_verification').length,
    unknown: stated.filter(item => item.state === 'unknown').length,
    statedRequirements: stated.length,
  }
}

/* ── Contacts ─────────────────────────────────────────────────────────────── */

export type ContactConfidence = 'verified' | 'likely' | 'possible' | 'not_checked'

export type ContactChannel = 'work_email' | 'personal_email' | 'phone' | 'profile'

export type ContactSignalLike = {
  type?: string
  channelKind?: string
  value: string
  sourceProvider?: string
  deliverability?: string
  permissionStatus?: string
}

export type CanonicalContactEntry = {
  channel: ContactChannel
  value: string
  confidence: ContactConfidence
  provenance: string
}

export type CanonicalContact = {
  primary: CanonicalContactEntry[]
  alternates: CanonicalContactEntry[]
  /** Channels holding more than one distinct value. Never silently merged. */
  conflictingChannels: ContactChannel[]
}

export function contactChannelV41(signal: ContactSignalLike): ContactChannel {
  const kind = `${signal.channelKind || ''} ${signal.type || ''}`.toLowerCase()
  if (kind.includes('phone') || kind.includes('mobile')) return 'phone'
  if (kind.includes('profile') || kind.includes('linkedin') || kind.includes('url')) return 'profile'
  if (kind.includes('personal')) return 'personal_email'
  if (kind.includes('work') || kind.includes('business')) return 'work_email'
  return signal.value.includes('@') ? 'work_email' : 'profile'
}

/**
 * Deliverability language varies by provider, so this maps only what a provider
 * actually asserted. Nothing is upgraded on our side: an unlabelled signal is
 * `possible`, never `likely`, and only an explicit provider verification
 * reaches `verified`.
 */
export function contactConfidenceV41(signal: ContactSignalLike): ContactConfidence {
  const value = `${signal.deliverability || ''}`.toLowerCase()
  if (!value) return 'possible'
  if (value.includes('valid') || value.includes('verified') || value.includes('deliverable')) return 'verified'
  if (value.includes('accept') || value.includes('probable') || value.includes('likely')) return 'likely'
  if (value.includes('unknown') || value.includes('unchecked')) return 'not_checked'
  return 'possible'
}

const CHANNEL_ORDER: ContactChannel[] = ['work_email', 'personal_email', 'phone', 'profile']
const CONFIDENCE_RANK: Record<ContactConfidence, number> = { verified: 3, likely: 2, possible: 1, not_checked: 0 }

export function canonicalContactV41(signals: readonly ContactSignalLike[]): CanonicalContact {
  const byChannel = new Map<ContactChannel, CanonicalContactEntry[]>()

  for (const signal of signals) {
    if (!signal.value) continue
    const channel = contactChannelV41(signal)
    const entry: CanonicalContactEntry = {
      channel,
      value: signal.value,
      confidence: contactConfidenceV41(signal),
      provenance: signal.sourceProvider || 'provider not stated',
    }
    const existing = byChannel.get(channel) || []
    if (existing.some(item => item.value === entry.value && item.provenance === entry.provenance)) continue
    existing.push(entry)
    byChannel.set(channel, existing)
  }

  const primary: CanonicalContactEntry[] = []
  const alternates: CanonicalContactEntry[] = []
  const conflictingChannels: ContactChannel[] = []

  for (const channel of CHANNEL_ORDER) {
    const entries = byChannel.get(channel)
    if (!entries?.length) continue
    const sorted = [...entries].sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence])
    primary.push(sorted[0])
    alternates.push(...sorted.slice(1))
    // Two different values on one channel may be two different humans. Surface
    // the disagreement; do not pick a winner and do not merge identities.
    if (new Set(sorted.map(item => item.value)).size > 1) conflictingChannels.push(channel)
  }

  return { primary, alternates, conflictingChannels }
}

/* ── Company context ──────────────────────────────────────────────────────── */

export type SlateCompanyContext = {
  company: string
  /** Candidates in the current slate observed at this employer. */
  observedInSlate: number
  /** Distinct titles observed at this employer, in this slate only. */
  observedTitles: string[]
  /** Locations observed at this employer, in this slate only. */
  observedLocations: string[]
  /** Other employers in this slate — adjacent targets the search already found. */
  adjacentCompanies: string[]
}

/**
 * Company context is computed from the candidates already returned by this
 * search. It is not an enrichment call, not a vendor firmographic record, and
 * not a claim about the company in general — industry, headcount and technology
 * stack are absent because nothing in hand evidences them, and inventing them
 * would be fabricated evidence. What a sourcer gets instead is true and useful:
 * who else this search found at this employer, and where else to look next.
 */
export function slateCompanyContextV41(
  company: string | undefined,
  slate: readonly ObservationLike[],
): SlateCompanyContext | null {
  const target = normalize(company || '')
  if (!target) return null

  const atCompany = slate.filter(person => normalize(person.currentEmployer || '') === target)
  const others = slate
    .map(person => person.currentEmployer || '')
    .filter(value => value && normalize(value) !== target)

  return {
    company: company as string,
    observedInSlate: atCompany.length,
    observedTitles: Array.from(new Set(atCompany.map(person => person.currentTitle || person.headline || '').filter(Boolean))).slice(0, 6),
    observedLocations: Array.from(new Set(atCompany.map(person => person.location || '').filter(Boolean))).slice(0, 4),
    adjacentCompanies: Array.from(new Set(others)).slice(0, 8),
  }
}
