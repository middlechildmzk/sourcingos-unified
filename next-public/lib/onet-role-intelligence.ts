import type { RoleIntake } from './role-workspace'

export type OnetOccupationRef = {
  code: string
  title: string
}

export type OnetRoleIntelligence = {
  provider: 'onet'
  version: string
  configured: boolean
  matchedOccupation?: OnetOccupationRef
  reportedTitles: string[]
  relatedOccupations: OnetOccupationRef[]
  technologyExamples: string[]
  attribution: string
  error?: string
}

export type RoleIntelligenceContext = {
  onet?: OnetRoleIntelligence | null
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 150)
}

function uniq(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, max)
}

export function onetSearchExpansion(intelligence?: OnetRoleIntelligence | null) {
  if (!intelligence?.configured || !intelligence.matchedOccupation) {
    return { canonicalTitle: '', adjacentTitles: [] as string[], technologyHints: [] as string[] }
  }

  const canonicalTitle = clean(intelligence.matchedOccupation.title)
  const adjacentTitles = uniq([
    ...intelligence.reportedTitles,
    ...intelligence.relatedOccupations.map(item => item.title),
  ], 12).filter(title => title.toLowerCase() !== canonicalTitle.toLowerCase())

  return {
    canonicalTitle,
    adjacentTitles,
    technologyHints: uniq(intelligence.technologyExamples, 12),
  }
}

/**
 * O*NET enrichment is discovery context, not a rewrite of the recruiter-approved
 * requirement model. Related occupations may broaden adjacent search language.
 * O*NET technology examples remain source/search hints only; they must not be
 * inserted into recruiter-authored must-have or preferred requirement fields.
 */
export function enrichRoleIntakeWithOnet(intake: RoleIntake, intelligence?: OnetRoleIntelligence | null): RoleIntake {
  const expansion = onetSearchExpansion(intelligence)
  if (!expansion.canonicalTitle) return intake

  return {
    ...intake,
    adjacentBackgrounds: uniq([
      ...intake.adjacentBackgrounds,
      expansion.canonicalTitle,
      ...expansion.adjacentTitles,
    ], 18),
  }
}

export function emptyOnetRoleIntelligence(error?: string): OnetRoleIntelligence {
  return {
    provider: 'onet',
    version: '31.0',
    configured: false,
    reportedTitles: [],
    relatedOccupations: [],
    technologyExamples: [],
    attribution: 'O*NET® is a trademark of the U.S. Department of Labor, Employment and Training Administration. O*NET data is used under its applicable Creative Commons license.',
    ...(error ? { error } : {}),
  }
}
