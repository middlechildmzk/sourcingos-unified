import type { CandidateDataSearchRequestV36_8, CandidateProviderObservationV36_8 } from './types-v36-8'

export type RetrievalRelevanceDecisionV37 = {
  admitted: boolean
  reasons: string[]
}

const GENERIC_ROLE_TOKENS = new Set([
  'senior', 'sr', 'junior', 'jr', 'lead', 'principal', 'staff', 'engineer', 'engineering',
  'developer', 'administrator', 'admin', 'specialist', 'manager', 'director', 'analyst',
  'consultant', 'architect', 'associate', 'professional', 'technical', 'technology',
])

function normalize(value: string | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9+#./ -]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(value: string | undefined, excludeGeneric = false): string[] {
  return Array.from(new Set(normalize(value)
    .split(/[\s/|,()-]+/)
    .filter(token => token.length >= 2)
    .filter(token => !excludeGeneric || !GENERIC_ROLE_TOKENS.has(token))))
}

function phrases(values: string[] | undefined): string[] {
  return Array.from(new Set((values || []).map(normalize).filter(value => value.length >= 2)))
}

function richText(observation: CandidateProviderObservationV36_8): string[] {
  const rich = observation.richProfile
  if (!rich) return []
  return [
    rich.summary,
    ...(rich.experience || []).flatMap(item => [item.title, item.company, item.location, item.description]),
    ...(rich.certifications || []).flatMap(item => [item.name, item.issuer]),
    ...(rich.projects || []).flatMap(item => [item.name, item.description, ...(item.technologies || [])]),
  ].map(value => normalize(value)).filter(Boolean)
}

function corpus(observation: CandidateProviderObservationV36_8): string {
  return [
    observation.displayName,
    observation.headline,
    observation.currentTitle,
    observation.currentEmployer,
    observation.location,
    ...observation.skills,
    ...richText(observation),
  ].map(value => normalize(value)).filter(Boolean).join(' | ')
}

function phraseMatch(haystack: string, value: string): boolean {
  const normalized = normalize(value)
  if (!normalized) return false
  if (haystack.includes(normalized)) return true
  const parts = tokens(normalized)
  return parts.length > 1 && parts.every(part => haystack.includes(part))
}

function titleMatch(observation: CandidateProviderObservationV36_8, requestedTitles: string[]): boolean {
  if (!requestedTitles.length) return false
  const observedTitle = normalize([observation.currentTitle, observation.headline].filter(Boolean).join(' '))
  if (!observedTitle) return false
  return requestedTitles.some(title => {
    const normalized = normalize(title)
    if (observedTitle.includes(normalized) || normalized.includes(observedTitle)) return true
    const distinctive = tokens(normalized, true)
    if (distinctive.length) return distinctive.some(token => observedTitle.includes(token))
    const all = tokens(normalized)
    return all.length > 0 && all.some(token => observedTitle.includes(token))
  })
}

function nameMatch(observation: CandidateProviderObservationV36_8, names: string[]): boolean {
  const observedName = normalize(observation.displayName)
  if (!observedName || !names.length) return false
  return names.some(name => {
    const requested = normalize(name)
    if (!requested) return false
    if (observedName === requested || observedName.includes(requested) || requested.includes(observedName)) return true
    const requestedTokens = tokens(requested)
    const observedTokens = new Set(tokens(observedName))
    return requestedTokens.length >= 2 && requestedTokens.every(token => observedTokens.has(token))
  })
}

function professionalEvidence(observation: CandidateProviderObservationV36_8): boolean {
  return Boolean(
    observation.currentTitle
    || observation.headline
    || observation.currentEmployer
    || observation.skills.length
    || observation.richProfile?.experience?.length
    || observation.richProfile?.projects?.length
    || observation.profileUrls.length
  )
}

/**
 * Minimum retrieval admission only. This must never be presented as candidate
 * fit, qualification, hiring probability, verified evidence, or a rejection.
 * Missing fields remain unknown; the gate only prevents obviously unrelated
 * provider observations from consuming the visible interleaved slate.
 */
export function retrievalRelevanceDecisionV37(
  request: CandidateDataSearchRequestV36_8,
  observation: CandidateProviderObservationV36_8,
): RetrievalRelevanceDecisionV37 {
  const text = corpus(observation)
  const names = phrases(request.names)
  const titles = phrases(request.titles)
  const skills = phrases(request.skills)
  const companies = phrases(request.companies)
  const requirements = (request.requirements || []).map(item => normalize(item.text)).filter(Boolean)

  const matchedName = nameMatch(observation, names)
  if (matchedName) return { admitted: true, reasons: ['explicit_name_anchor'] }

  const matchedTitle = titleMatch(observation, titles)
  const matchedSkills = skills.filter(skill => phraseMatch(text, skill))
  const matchedCompanies = companies.filter(company => phraseMatch(normalize(observation.currentEmployer) || text, company))
  const matchedRequirements = requirements.filter(requirement => phraseMatch(text, requirement))

  const reasons: string[] = []
  if (matchedTitle) reasons.push('title_signal')
  if (matchedSkills.length) reasons.push('skill_signal')
  if (matchedCompanies.length) reasons.push('company_signal')
  if (matchedRequirements.length) reasons.push('requirement_signal')

  // When the recruiter supplied an explicit person anchor, unrelated names do
  // not get admitted just because they have a professional profile.
  if (names.length) return { admitted: false, reasons: ['explicit_name_not_observed'] }

  // Role/skill/company anchors are retrieval intent. Require at least one such
  // signal before a result can consume the diversity/interleaving cap. Location,
  // clearance, tenure, and other missing fields are intentionally not hard-reject
  // gates because absence is unknown rather than negative evidence.
  if (titles.length || skills.length || companies.length) {
    return reasons.some(reason => ['title_signal', 'skill_signal', 'company_signal'].includes(reason))
      ? { admitted: true, reasons }
      : { admitted: false, reasons: ['no_role_skill_or_company_signal'] }
  }

  if (matchedRequirements.length) return { admitted: true, reasons }
  if (professionalEvidence(observation)) return { admitted: true, reasons: ['professional_evidence_present'] }
  return { admitted: false, reasons: ['insufficient_candidate_retrieval_evidence'] }
}

export function passesRetrievalRelevanceGateV37(
  request: CandidateDataSearchRequestV36_8,
  observation: CandidateProviderObservationV36_8,
): boolean {
  return retrievalRelevanceDecisionV37(request, observation).admitted
}
