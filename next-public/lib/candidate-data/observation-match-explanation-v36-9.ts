import type { CandidateDataSearchRequestV36_8, CandidateProviderObservationV36_8 } from './types-v36-8'

function clean(value?: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#./\- ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function canonicalToken(value: string): string {
  const token = value.toLowerCase()
  if (token === 'administrator' || token === 'administration' || token === 'admin') return 'admin'
  if (token === 'engineering' || token === 'engineer') return 'engineer'
  if (token === 'development' || token === 'developer' || token === 'dev') return 'developer'
  if (token === 'recruiting' || token === 'recruiter') return 'recruiter'
  if (token === 'sourcing' || token === 'sourcer') return 'sourcer'
  if (token === 'analysis' || token === 'analyst') return 'analyst'
  if (token === 'systems' || token === 'system') return 'system'
  return token
}

function comparableTokens(value?: string): string[] {
  return clean(value).split(' ').filter(token => token.length >= 2).map(canonicalToken)
}

function looseContains(haystack: string, needle: string): boolean {
  const h = clean(haystack)
  const n = clean(needle)
  if (!h || !n) return false
  if (h.includes(n) || n.includes(h)) return true
  const wanted = comparableTokens(n)
  if (!wanted.length) return false
  const available = new Set(comparableTokens(h))
  return wanted.filter(token => available.has(token)).length / wanted.length >= 0.6
}

function observedText(observation: CandidateProviderObservationV36_8): string {
  return [
    observation.currentTitle,
    observation.headline,
    observation.currentEmployer,
    observation.location,
    ...observation.skills,
  ].filter(Boolean).join(' · ')
}

export function candidateObservationMatchExplanationV36_9(
  request: CandidateDataSearchRequestV36_8,
  observation: CandidateProviderObservationV36_8,
): string {
  const titleText = [observation.currentTitle, observation.headline].filter(Boolean).join(' · ')
  const skillText = observation.skills.join(' · ')
  const locationText = observation.location || ''

  const titleMatches = (request.titles || []).filter(term => looseContains(titleText, term)).slice(0, 3)
  const skillMatches = (request.skills || []).filter(term => looseContains(skillText, term)).slice(0, 5)
  const locationMatches = (request.locations || []).filter(term => looseContains(locationText, term)).slice(0, 2)

  const observed = observedText(observation)
  const unverifiedRequirements = (request.requirements || [])
    .filter(requirement => requirement.mustHave && !looseContains(observed, requirement.text))
    .map(requirement => requirement.text)
    .slice(0, 4)

  const overlaps = [
    titleMatches.length ? `title: ${titleMatches.join(' / ')}` : '',
    skillMatches.length ? `skills: ${skillMatches.join(' / ')}` : '',
    locationMatches.length ? `location: ${locationMatches.join(' / ')}` : '',
  ].filter(Boolean)

  const observedPart = overlaps.length
    ? `Observed search overlap — ${overlaps.join('; ')}.`
    : 'Provider returned this record, but SourcingOS did not observe a direct title, skill, or location overlap in the normalized provider fields.'

  const verificationPart = unverifiedRequirements.length
    ? ` Must-haves not verified in normalized provider fields: ${unverifiedRequirements.join('; ')}.`
    : ''

  return `${observedPart}${verificationPart} Retrieval is not a qualification decision.`
}
