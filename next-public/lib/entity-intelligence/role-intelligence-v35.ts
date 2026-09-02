import { buildJobFamilyRoutingV34 } from '@/lib/job-family-router-v34'
import type { RoleIntake } from '@/lib/role-workspace'
import { entityByIdV35 } from './registry-v35'
import { suggestEntitiesV35 } from './suggest-v35'
import {
  approvedLocationIntentV35,
  approvedSearchEntityIdsV35,
  type RoleSearchIntelligenceStateV35,
} from './search-approval-v35'
import type { EntitySuggestion } from './types-v35'

export type RoleEntityIntelligenceV35 = {
  occupation: {
    family: ReturnType<typeof buildJobFamilyRoutingV34>['primaryFamily']
    resolved: boolean
    rationale: string[]
  }
  contextModifiers: string[]
  location: ReturnType<typeof approvedLocationIntentV35>
  recognized: EntitySuggestion[]
  suggestedExpansions: EntitySuggestion[]
  approvedExpansionIds: string[]
  trust: string[]
  version: 'v35.3'
}

function locationSuggestions(ids: string[]): EntitySuggestion[] {
  return ids.flatMap(id => {
    const entity = entityByIdV35(id)
    if (!entity) return []
    return [{
      entity,
      matchedText: entity.canonicalLabel,
      matchType: 'adjacent' as const,
      explanation: 'Nearby or regional search expansion suggested from the structured location graph.',
      rank: 0.8,
      activation: 'suggested_inactive' as const,
    }]
  })
}

function safeRecruiterExpansion(item: EntitySuggestion): boolean {
  // Clearance levels, SCI/SAP eligibility, and polygraph requirements are
  // consequential security constraints. Legacy "related" clearance vocabulary
  // may be useful research context, but it is not safe Find Similar expansion.
  // Only recruiter-stated clearance remains in the Role Brief.
  const source = item.relationship ? entityByIdV35(item.relationship.fromEntityId) : undefined
  if (source?.kind === 'clearance' || item.entity.kind === 'clearance') return false
  return true
}

export function buildRoleEntityIntelligenceV35(
  intake: RoleIntake,
  searchIntelligence?: RoleSearchIntelligenceStateV35,
): RoleEntityIntelligenceV35 {
  const routing = buildJobFamilyRoutingV34(intake)
  const query = [
    intake.title,
    ...intake.mustHaves,
    ...intake.niceToHaves,
    intake.clearance,
    intake.location,
  ].filter(Boolean).join(' ')
  const suggestions = suggestEntitiesV35({ query, includeRelated: true, maxSuggestions: 24 })
  const location = approvedLocationIntentV35(intake, searchIntelligence)
  const approvedExpansionIds = approvedSearchEntityIdsV35(searchIntelligence)
  const approvedSet = new Set(approvedExpansionIds)
  const seen = new Set<string>()
  const suggestedExpansions = [...locationSuggestions(location.suggestedExpansionIds), ...suggestions.related]
    .filter(safeRecruiterExpansion)
    .filter(item => {
      if (seen.has(item.entity.id)) return false
      seen.add(item.entity.id)
      return true
    })
    .map(item => ({
      ...item,
      activation: approvedSet.has(item.entity.id) ? 'suggested_active' as const : 'suggested_inactive' as const,
    }))

  return {
    occupation: {
      family: routing.primaryFamily,
      resolved: routing.occupationResolved,
      rationale: routing.rationale,
    },
    contextModifiers: routing.contextModifiers.map(item => item.id),
    location,
    recognized: suggestions.matches,
    suggestedExpansions,
    approvedExpansionIds,
    trust: [
      'Normalized aliases may clarify recruiter intent; related/adjacent suggestions do not become must-haves automatically.',
      'Recruiter-approved expansions affect retrieval only. They do not rewrite the approved Role Brief or satisfy candidate requirements.',
      'Nearby and regional geography can broaden discovery only after recruiter approval and never changes a candidate location fact.',
      'Clearance is a recruiter requirement until candidate-level evidence verifies it; clearance/polygraph levels are never broadened through Find Similar.',
    ],
    version: 'v35.3',
  }
}
