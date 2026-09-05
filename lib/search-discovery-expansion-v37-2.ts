import type { CandidateDataSearchRequestV36_8 } from './candidate-data/types-v36-8'

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalized(value: string | undefined): string {
  return clean(value || '').toLowerCase().replace(/[^a-z0-9+#. -]+/g, ' ')
}

function union(base: string[] | undefined, additions: string[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...(base || []), ...additions]) {
    const value = clean(raw)
    const key = normalized(value)
    if (!value || !key || seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length >= max) break
  }
  return out
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some(needle => haystack.includes(needle))
}

/**
 * Bounded retrieval expansion only. These aliases broaden where providers look;
 * they do not change recruiter requirements, establish qualifications, or turn
 * missing evidence into a negative signal.
 */
export function applySearchDiscoveryExpansionV37_2<T extends CandidateDataSearchRequestV36_8>(request: T): T {
  const query = normalized(request.query)
  const titleText = normalized((request.titles || []).join(' '))
  const skillText = normalized((request.skills || []).join(' '))
  const corpus = `${query} ${titleText} ${skillText}`

  let titleAdditions: string[] = []
  let skillAdditions: string[] = []
  let locationAdditions: string[] = []

  if (hasAny(corpus, ['rhel', 'red hat enterprise linux', 'red hat linux'])) {
    titleAdditions = [
      'RHEL Administrator',
      'Red Hat Enterprise Linux Administrator',
      'Red Hat Linux Administrator',
      'Linux Administrator',
      'Linux Systems Administrator',
      'Systems Administrator',
    ]
    skillAdditions = ['RHEL', 'Red Hat Enterprise Linux', 'Red Hat Linux']
  }

  if (hasAny(corpus, ['cybersecurity engineer', 'cyber security engineer'])) {
    titleAdditions = [...titleAdditions, 'Cybersecurity Engineer', 'Cyber Security Engineer', 'Information Security Engineer', 'Security Engineer']
  }

  if (hasAny(corpus, ['machine learning researcher', 'ml researcher'])) {
    titleAdditions = [...titleAdditions, 'Machine Learning Researcher', 'Machine Learning Scientist', 'Research Scientist', 'Applied Scientist']
  }

  if (hasAny(corpus, ['talent sourcer', 'technical sourcer', 'recruiting sourcer'])) {
    titleAdditions = [...titleAdditions, 'Talent Sourcer', 'Senior Talent Sourcer', 'Technical Sourcer', 'Recruiting Sourcer', 'Sourcing Recruiter']
  }

  const asksForProximity = /\b(?:near|around|in or near|in or around|within)\b/i.test(request.query)
  const locations = (request.locations || []).map(normalized)
  if (asksForProximity && locations.some(value => value.includes('annapolis junction'))) {
    locationAdditions = ['Fort Meade, MD', 'Jessup, MD', 'Laurel, MD', 'Columbia, MD', 'Odenton, MD']
  }
  if (asksForProximity && locations.some(value => value.includes('fort meade'))) {
    locationAdditions = [...locationAdditions, 'Annapolis Junction, MD', 'Odenton, MD', 'Severn, MD', 'Jessup, MD', 'Laurel, MD', 'Columbia, MD']
  }

  return {
    ...request,
    titles: union(request.titles, titleAdditions, 20),
    skills: union(request.skills, skillAdditions, 40),
    locations: union(request.locations, locationAdditions, 20),
  }
}
