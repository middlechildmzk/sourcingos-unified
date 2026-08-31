/**
 * V33 — Military talent intelligence.
 *
 * Occupation-level intelligence for generating and explaining sourcing
 * hypotheses about military and veteran talent. It is deliberately NOT a
 * candidate assessment system.
 *
 * The boundary this module must never cross:
 *
 *   A military occupation code tells you where to look and why.
 *   It never tells you what a specific person can do.
 *
 * Occupation associations may expand a search, seed a lane, and give a
 * recruiter context. They may never produce or upgrade a candidate-level
 * RequirementAssessment. That remains the exclusive job of span-backed
 * EvidenceClaims in the V32 path.
 */

import { containsBoundedTerm } from '@/lib/evidence-span'

/* ------------------------------------------------------------------ model */

export const MILITARY_BRANCHES = ['army', 'navy', 'air_force', 'marine_corps', 'space_force', 'coast_guard'] as const
export type MilitaryBranch = (typeof MILITARY_BRANCHES)[number]

export const BRANCH_CODE_SYSTEM: Record<MilitaryBranch, string> = {
  army: 'MOS',
  navy: 'Rating / NEC',
  air_force: 'AFSC',
  marine_corps: 'MOS',
  space_force: 'SFSC',
  coast_guard: 'Rating',
}

export type ServiceCategory = 'enlisted' | 'warrant' | 'officer' | 'unspecified'

/** Where a relationship came from, and whether we have verified it against the source file. */
export type TaxonomyProvenance = {
  source: string
  sourceUrl: string
  /** false = provisional development seed, not yet reconciled against the official file. */
  verified: boolean
  version: string
}

export type MilitaryOccupation = {
  branch: MilitaryBranch
  code: string
  title: string
  canonicalTitle: string
  alternateTitles: string[]
  serviceCategory: ServiceCategory
  description: string
  /** O*NET-SOC codes linked by an authoritative crosswalk. */
  civilianOccupationCodes: string[]
  /** Occupation-level skill concepts. Never candidate-level claims. */
  skillConcepts: string[]
  credentialSignals: string[]
  occupationFamilies: string[]
  active: boolean
  provenance: TaxonomyProvenance
}

export type CivilianOccupation = {
  onetSocCode: string
  socCode: string
  title: string
  alternateTitles: string[]
  occupationFamily: string
  provenance: TaxonomyProvenance
}

export type CrosswalkRelationship = 'authoritative_crosswalk' | 'enhanced_analysis' | 'skill_overlap' | 'provisional_seed'

export type MilitaryCivilianCrosswalk = {
  militaryBranch: MilitaryBranch
  militaryCode: string
  onetSocCode: string
  relationship: CrosswalkRelationship
  provenance: TaxonomyProvenance
}

/* -------------------------------------------------------------- hypotheses */

export type MilitaryOccupationHypothesis = {
  branch: MilitaryBranch
  codeSystem: string
  code: string
  title: string
  serviceCategory: ServiceCategory
  /** Why this occupation is worth exploring, in recruiter language. */
  rationale: string
  /** Which of the role's concepts this occupation connects to. */
  matchedConcepts: string[]
  sharedCivilianOccupations: string[]
  relationship: CrosswalkRelationship
  provenance: TaxonomyProvenance
  /** Search strings a recruiter can use. Never a fitness judgement. */
  searchTerms: string[]
}

export type MilitarySourcingHypothesis = {
  applicable: boolean
  /** Set when the pack decides military talent is not a sensible lane for this role. */
  reason: string
  roleConcepts: string[]
  occupations: MilitaryOccupationHypothesis[]
  transferableSkillConcepts: string[]
  verificationQuestions: string[]
  doNotAssume: string[]
  provisionalDataInUse: boolean
  attribution: string
}

export const ONET_ATTRIBUTION =
  'Military occupation linkages derive from the O*NET Military Crosswalk (DMDC MOC crosswalk, VOW to Hire Heroes Act §222 enhanced analysis, and RAND Army KSA research). O*NET® is a trademark of the U.S. Department of Labor, Employment and Training Administration, used under CC BY 4.0.'

/* ------------------------------------------------------------------ engine */

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-_.]/g, '')
}

/** Accepts 17C, 17-C, "17c", "MOS 17C", "AFSC 1D7X1". */
export function parseMilitaryCode(input: string): string | undefined {
  const stripped = input.replace(/\b(mos|afsc|nec|rating|sfsc|rate)\b/gi, ' ')

  // Codes are sometimes written with an internal separator: 17-C, 1D7_X1.
  // Only punctuation separators are joined. Whitespace is never collapsed,
  // because this function also runs over prose spans from candidate sources.
  const hyphenated = stripped.match(/\b([0-9]{1,4})[\-_.]([A-Z]{1,2}[0-9A-Z]{0,3})\b/i)
  if (hyphenated) return normalizeCode(`${hyphenated[1]}${hyphenated[2]}`)

  const match = stripped.match(/\b([0-9]{1,4}[A-Z]{0,2}[0-9A-Z]{0,3})\b/i)
  if (!match) return undefined
  const code = normalizeCode(match[1])
  return /[0-9]/.test(code) ? code : undefined
}

export type OccupationIndex = {
  occupations: MilitaryOccupation[]
  civilian: CivilianOccupation[]
}

/** Military → civilian. Exact code lookup with branch disambiguation. */
export function lookupMilitaryOccupations(
  index: OccupationIndex,
  rawCode: string,
  branch?: MilitaryBranch,
): MilitaryOccupation[] {
  const code = parseMilitaryCode(rawCode)
  if (!code) return []
  return index.occupations.filter(occupation =>
    normalizeCode(occupation.code) === code && (!branch || occupation.branch === branch),
  )
}

export type CivilianTranslation = {
  militaryOccupation: MilitaryOccupation
  civilianOccupations: CivilianOccupation[]
  skillConcepts: string[]
  searchTerms: string[]
  ambiguousAcrossBranches: boolean
  provenance: TaxonomyProvenance
  caveat: string
}

export function translateMilitaryToCivilian(
  index: OccupationIndex,
  rawCode: string,
  branch?: MilitaryBranch,
): CivilianTranslation[] {
  const matches = lookupMilitaryOccupations(index, rawCode, branch)
  const ambiguous = matches.length > 1
  const byCode = new Map(index.civilian.map(item => [item.onetSocCode, item]))

  return matches.map(occupation => ({
    militaryOccupation: occupation,
    civilianOccupations: occupation.civilianOccupationCodes
      .map(code => byCode.get(code))
      .filter((item): item is CivilianOccupation => Boolean(item)),
    skillConcepts: occupation.skillConcepts,
    searchTerms: searchTermsFor(occupation, byCode),
    ambiguousAcrossBranches: ambiguous,
    provenance: occupation.provenance,
    caveat:
      'Occupational crosswalk context only. It indicates what this occupation is associated with in public occupational data, not what any individual service member did or can do.',
  }))
}

function searchTermsFor(occupation: MilitaryOccupation, byCode: Map<string, CivilianOccupation>): string[] {
  const civilianTitles = occupation.civilianOccupationCodes
    .map(code => byCode.get(code)?.title)
    .filter((title): title is string => Boolean(title))
  return dedupe([
    occupation.code,
    occupation.canonicalTitle,
    ...occupation.alternateTitles,
    ...civilianTitles,
    ...occupation.credentialSignals,
  ]).slice(0, 14)
}

/* ------------------------------------------------- civilian → military */

export type CivilianRoleInput = {
  title: string
  mustHaves: string[]
  niceToHaves?: string[]
  rawDescription?: string
}

/** Concepts the role actually states. No inference, no expansion beyond the text. */
export function roleConcepts(role: CivilianRoleInput): string[] {
  return dedupe([role.title, ...role.mustHaves, ...(role.niceToHaves || [])])
}

/** Requirement concepts only. The job title is context, never sufficient on its own. */
function requirementConcepts(role: CivilianRoleInput): string[] {
  return dedupe([...role.mustHaves, ...(role.niceToHaves || [])])
}

function conceptMatchesOccupation(concept: string, occupation: MilitaryOccupation): boolean {
  const haystack = [
    occupation.canonicalTitle,
    ...occupation.alternateTitles,
    ...occupation.skillConcepts,
    ...occupation.occupationFamilies,
    occupation.description,
  ].join(' · ')
  return containsBoundedTerm(haystack, concept)
}

export type MilitaryHypothesisOptions = {
  /** Occupations scored below this many matched concepts are dropped. */
  minimumConceptMatches?: number
  maxOccupations?: number
  /** Roles the recruiter has decided are not military-adjacent. */
  suppressed?: boolean
}

export function buildMilitarySourcingHypothesis(
  index: OccupationIndex,
  role: CivilianRoleInput,
  options: MilitaryHypothesisOptions = {},
): MilitarySourcingHypothesis {
  const minimum = options.minimumConceptMatches ?? 2
  const max = options.maxOccupations ?? 6
  const concepts = roleConcepts(role)
  const byCode = new Map(index.civilian.map(item => [item.onetSocCode, item]))

  const base: MilitarySourcingHypothesis = {
    applicable: false,
    reason: '',
    roleConcepts: concepts,
    occupations: [],
    transferableSkillConcepts: [],
    verificationQuestions: [],
    doNotAssume: DO_NOT_ASSUME,
    provisionalDataInUse: false,
    attribution: ONET_ATTRIBUTION,
  }

  if (options.suppressed) {
    return { ...base, reason: 'A recruiter marked this role as not military-adjacent.' }
  }
  if (!concepts.length) {
    return { ...base, reason: 'The role brief has no approved concepts to reason from yet.' }
  }

  const requirementOnly = requirementConcepts(role)
  const scored = index.occupations
    .map(occupation => {
      const matched = concepts.filter(concept => conceptMatchesOccupation(concept, occupation))
      const matchedRequirements = requirementOnly.filter(concept => conceptMatchesOccupation(concept, occupation))
      return { occupation, matched, matchedRequirements }
    })
    // A job title alone must never open a military lane. "Analyst" matching an
    // occupation title is context; the role's own requirements have to carry it.
    .filter(item => item.matchedRequirements.length >= minimum)
    .sort((a, b) => {
      if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length
      // Deterministic tiebreak so output never depends on array order.
      return `${a.occupation.branch}:${a.occupation.code}`.localeCompare(`${b.occupation.branch}:${b.occupation.code}`)
    })
    .slice(0, max)

  if (!scored.length) {
    return {
      ...base,
      reason: 'No military occupation in the current taxonomy connects to enough of this role\'s approved concepts to be worth a lane.',
    }
  }

  const occupations: MilitaryOccupationHypothesis[] = scored.map(({ occupation, matched }) => ({
    branch: occupation.branch,
    codeSystem: BRANCH_CODE_SYSTEM[occupation.branch],
    code: occupation.code,
    title: occupation.canonicalTitle,
    serviceCategory: occupation.serviceCategory,
    matchedConcepts: matched,
    sharedCivilianOccupations: occupation.civilianOccupationCodes
      .map(code => byCode.get(code)?.title)
      .filter((title): title is string => Boolean(title)),
    relationship: occupation.provenance.verified ? 'authoritative_crosswalk' : 'provisional_seed',
    provenance: occupation.provenance,
    rationale: `${occupation.code} (${BRANCH_CODE_SYSTEM[occupation.branch]}) is worth exploring because occupational data associates it with ${matched.slice(0, 3).join(', ')}. Candidate-level evidence is still required.`,
    searchTerms: searchTermsFor(occupation, byCode),
  }))

  const transferable = dedupe(scored.flatMap(item => item.occupation.skillConcepts)).slice(0, 16)

  return {
    ...base,
    applicable: true,
    reason: `${occupations.length} military occupations connect to the approved role concepts.`,
    occupations,
    transferableSkillConcepts: transferable,
    verificationQuestions: verificationQuestionsFor(occupations),
    provisionalDataInUse: occupations.some(item => !item.provenance.verified),
  }
}

const DO_NOT_ASSUME = [
  'An occupation code does not establish that a person holds any specific skill, tool, or certification.',
  'Military service does not establish a security clearance. Clearance remains candidate-stated or authoritative depending on the source.',
  'Rank, service dates, and discharge characterization are not qualification signals and must not be inferred.',
  'Occupation-level associations expand where to search. They never satisfy a role requirement.',
]

function verificationQuestionsFor(occupations: MilitaryOccupationHypothesis[]): string[] {
  const questions = [
    'Which of these systems or tools did you personally operate, and how recently?',
    'Was your role hands-on, supervisory, or planning-focused in that assignment?',
    'Which certifications did you complete during or after service, and are they current?',
  ]
  if (occupations.some(item => item.serviceCategory === 'officer')) {
    questions.push('How large was the team or programme you were responsible for, and what was your direct technical involvement?')
  }
  return questions
}

/* ---------------------------------------------------------- search lanes */

export type MilitaryLaneDraft = {
  id: string
  label: string
  purpose: string
  query: string
  blindSpot: string
  mode: 'guided' | 'executable' | 'provider_optional'
  surface: string
  approved: false
}

const MAX_QUERY_TERMS = 8

/**
 * Produces lane drafts, never approved lanes. A recruiter approves an
 * occupational hypothesis before it can enter a search plan.
 */
export function militaryLaneDrafts(hypothesis: MilitarySourcingHypothesis, role: CivilianRoleInput): MilitaryLaneDraft[] {
  if (!hypothesis.applicable || !hypothesis.occupations.length) return []

  const codes = dedupe(hypothesis.occupations.map(item => item.code)).slice(0, 4)
  const titles = dedupe(hypothesis.occupations.map(item => item.title)).slice(0, 3)
  const roleTerms = dedupe(role.mustHaves).slice(0, 3)

  const quoted = (values: string[]) => values.map(value => `"${value}"`).join(' OR ')

  return [
    {
      id: 'military-occupation',
      label: 'Military occupation transition',
      purpose: 'Profiles that state a relevant military occupation code or title alongside civilian technical evidence.',
      query: `(${quoted(codes.slice(0, MAX_QUERY_TERMS))} OR ${quoted(titles)})${roleTerms.length ? ` AND (${quoted(roleTerms)})` : ''}`,
      blindSpot: 'Many veterans never publish their occupation code, so this lane under-returns and skews toward recent separations.',
      mode: 'guided',
      surface: 'LinkedIn Recruiter',
      approved: false,
    },
    {
      id: 'military-transition-language',
      label: 'Transition language',
      purpose: 'Profiles using separation and transition vocabulary rather than occupation codes.',
      query: `("transitioning veteran" OR "recently separated" OR "military veteran")${roleTerms.length ? ` AND (${quoted(roleTerms)})` : ''}`,
      blindSpot: 'Transition vocabulary fades within a year or two of separation, so this misses experienced veterans entirely.',
      mode: 'guided',
      surface: 'Google X-Ray',
      approved: false,
    },
  ]
}

/* ------------------------------------------------- candidate 360 context */

export type MilitaryCandidateContext = {
  /** Only set when the source text literally contains the code. */
  detectedCode?: string
  /**
   * The matched code substring only. The full span is deliberately NOT carried
   * forward: surrounding text routinely contains rank, discharge characterization,
   * service dates and age, none of which are qualification signals and some of
   * which are protected-adjacent. Minimize at the boundary, not at render time.
   */
  matchedText: string
  branch?: MilitaryBranch
  occupationTitle?: string
  contextNotes: string[]
  /** Always empty. Occupation context never yields requirement support. */
  requirementSupport: never[]
}

/**
 * Reads occupation context from a candidate source span. The span text must
 * already have been validated by the V32 evidence path; this function never
 * infers a code that is not literally present.
 */
export function militaryContextFromSpan(index: OccupationIndex, spanText: string): MilitaryCandidateContext | undefined {
  const code = parseMilitaryCode(spanText)
  if (!code) return undefined
  const matches = index.occupations.filter(occupation => normalizeCode(occupation.code) === code)
  if (!matches.length) return undefined
  if (!containsBoundedTerm(spanText, matches[0].code)) return undefined

  const branches = dedupe(matches.map(item => item.branch))
  return {
    detectedCode: matches[0].code,
    matchedText: matches[0].code,
    branch: branches.length === 1 ? matches[0].branch : undefined,
    occupationTitle: branches.length === 1 ? matches[0].canonicalTitle : undefined,
    contextNotes: [
      branches.length === 1
        ? `${matches[0].code} is associated in occupational data with ${matches[0].occupationFamilies.join(', ') || 'related civilian occupations'}.`
        : `${code} appears in more than one branch taxonomy (${branches.join(', ')}). Confirm the branch before using this context.`,
      'This is occupational context. It supports no role requirement on its own.',
    ],
    requirementSupport: [],
  }
}

/* ------------------------------------------------------------- utilities */

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}
