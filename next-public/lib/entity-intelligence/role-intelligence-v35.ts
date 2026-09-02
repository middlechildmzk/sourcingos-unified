import { buildJobFamilyRoutingV34 } from '@/lib/job-family-router-v34'
import type { RoleIntake } from '@/lib/role-workspace'
import { resolveLocationIntentV35 } from './location-v35'
import { suggestEntitiesV35 } from './suggest-v35'
import type { EntitySuggestion } from './types-v35'

export type RoleEntityIntelligenceV35 = {
  occupation: {
    family: ReturnType<typeof buildJobFamilyRoutingV34>['primaryFamily']
    resolved: boolean
    rationale: string[]
  }
  contextModifiers: string[]
  location: ReturnType<typeof resolveLocationIntentV35>
  recognized: EntitySuggestion[]
  suggestedExpansions: EntitySuggestion[]
  trust: string[]
  version: 'v35.2'
}

export function buildRoleEntityIntelligenceV35(intake: RoleIntake): RoleEntityIntelligenceV35 {
  const routing = buildJobFamilyRoutingV34(intake)
  const query = [
    intake.title,
    ...intake.mustHaves,
    ...intake.niceToHaves,
    intake.clearance,
    intake.location,
  ].filter(Boolean).join(' ')
  const suggestions = suggestEntitiesV35({ query, includeRelated: true, maxSuggestions: 24 })
  const location = resolveLocationIntentV35(intake.rawDescription || query, intake.location)

  return {
    occupation: {
      family: routing.primaryFamily,
      resolved: routing.occupationResolved,
      rationale: routing.rationale,
    },
    contextModifiers: routing.contextModifiers.map(item => item.id),
    location,
    recognized: suggestions.matches,
    suggestedExpansions: suggestions.related,
    trust: [
      'Normalized aliases may clarify recruiter intent; related/adjacent suggestions do not become must-haves automatically.',
      'Nearby and regional geography can broaden discovery only after recruiter approval and never changes a candidate location fact.',
      'Clearance is a recruiter requirement until candidate-level evidence verifies it.',
    ],
    version: 'v35.2',
  }
}
