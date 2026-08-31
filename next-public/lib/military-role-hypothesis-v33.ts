import {
  BRANCH_CODE_SYSTEM,
  ONET_ATTRIBUTION,
  buildMilitarySourcingHypothesis,
  type CivilianRoleInput,
  type MilitaryOccupationHypothesis,
  type MilitarySourcingHypothesis,
  type OccupationIndex,
} from './military-talent-intelligence-v33'

export type CivilianOccupationHint = { code?: string; title?: string }

function uniq(values: string[], max = 16): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const item = value.trim()
    const key = item.toLowerCase()
    if (!item || seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= max) break
  }
  return out
}

/**
 * Prefer an authoritative O*NET-SOC → MOC crosswalk when Role Brain already has
 * a sufficiently close O*NET occupation match. This is occupation adjacency,
 * not candidate-level requirement support. The role must still have at least one
 * recruiter-approved requirement; a job title alone never opens this lane.
 */
export function buildRoleMilitaryHypothesis(
  index: OccupationIndex,
  role: CivilianRoleInput,
  civilianHint: CivilianOccupationHint = {},
): MilitarySourcingHypothesis {
  const baseline = buildMilitarySourcingHypothesis(index, role)
  const code = civilianHint.code?.trim()
  const requirements = uniq([...(role.mustHaves || []), ...(role.niceToHaves || [])])
  if (!code || !requirements.length) return baseline

  const civilianByCode = new Map(index.civilian.map(item => [item.onetSocCode, item]))
  const verified = index.occupations
    .filter(item => item.provenance.verified && item.civilianOccupationCodes.includes(code))
    .sort((a, b) => `${a.branch}:${a.code}`.localeCompare(`${b.branch}:${b.code}`))
    .slice(0, 8)

  if (!verified.length) return baseline

  const occupationTitle = civilianHint.title?.trim() || civilianByCode.get(code)?.title || code
  const occupations: MilitaryOccupationHypothesis[] = verified.map(occupation => {
    const shared = occupation.civilianOccupationCodes
      .map(item => civilianByCode.get(item)?.title)
      .filter((value): value is string => Boolean(value))
    return {
      branch: occupation.branch,
      codeSystem: BRANCH_CODE_SYSTEM[occupation.branch],
      code: occupation.code,
      title: occupation.canonicalTitle,
      serviceCategory: occupation.serviceCategory,
      matchedConcepts: [occupationTitle],
      sharedCivilianOccupations: shared,
      relationship: 'authoritative_crosswalk',
      provenance: occupation.provenance,
      rationale: `${occupation.code} (${BRANCH_CODE_SYSTEM[occupation.branch]}) is worth exploring because the authoritative O*NET Military Crosswalk links it to ${occupationTitle}. The role's approved requirements still require candidate-level evidence.`,
      searchTerms: uniq([
        occupation.code,
        occupation.canonicalTitle,
        ...occupation.alternateTitles,
        occupationTitle,
        ...shared,
      ], 14),
    }
  })

  return {
    applicable: true,
    reason: `${occupations.length} verified military occupations crosswalk to the role's matched O*NET occupation.`,
    roleConcepts: uniq([role.title, ...requirements]),
    occupations,
    transferableSkillConcepts: [],
    verificationQuestions: [
      'Which systems, tools, or mission functions did you personally work with, and how recently?',
      'Was your assignment hands-on, supervisory, or planning-focused?',
      'Which civilian certifications or licenses do you currently hold, if any?',
    ],
    doNotAssume: [
      'An occupation code does not establish that a person holds any specific skill, tool, certification, or civilian qualification.',
      'Military service does not establish a security clearance. Clearance remains candidate-stated or authoritative depending on the source.',
      'Rank, service dates, and discharge characterization are not qualification signals and must not be inferred.',
      'Occupation-level crosswalks expand where to search. They never satisfy a role requirement.',
    ],
    provisionalDataInUse: false,
    attribution: ONET_ATTRIBUTION,
  }
}
