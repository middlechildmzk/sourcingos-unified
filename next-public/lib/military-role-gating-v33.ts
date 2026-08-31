import { buildDomainPackProfile } from './domain-packs-v31'
import type { RoleIntake } from './role-workspace'

export type MilitaryTalentGate = {
  enabled: boolean
  reasons: string[]
  federal: boolean
  technical: boolean
  cybersecurity: boolean
  clearanceSpecified: boolean
}

const CYBER = /\b(?:cyber(?:security)?|information security|network security|network defense|incident response|threat|soc analyst|siem|devsecops|zero trust|vulnerability|security engineer|security architect|system administrator|network administrator|systems engineer)\b/i

function roleText(intake: RoleIntake): string {
  return [
    intake.title,
    intake.clearance,
    ...intake.mustHaves,
    ...intake.niceToHaves,
    ...intake.adjacentBackgrounds,
    intake.hiringManagerNotes,
    intake.rawDescription,
  ].join(' ')
}

/**
 * V33.1 domain gate. Military occupational intelligence is intentionally narrow:
 * it is offered for federal/cleared work and for technical cybersecurity roles.
 * Explicit cybersecurity language is itself technical-role evidence even when a
 * generic domain-pack confidence threshold does not activate the technical pack.
 * This controls search-hypothesis availability only, never candidate fitness.
 */
export function militaryTalentGate(intake: RoleIntake): MilitaryTalentGate {
  const profile = buildDomainPackProfile(intake)
  const federal = profile.activeIds.has('federal')
  const cybersecurity = CYBER.test(roleText(intake))
  const technical = profile.activeIds.has('technical') || cybersecurity
  const clearanceSpecified = Boolean(intake.clearance && intake.clearance !== 'Not specified')
  const reasons: string[] = []

  if (federal) reasons.push('Federal / GovCon domain pack is active.')
  if (clearanceSpecified) reasons.push('The role includes recruiter-approved clearance context.')
  if (technical && cybersecurity) reasons.push('Technical cybersecurity requirements are explicit in the role.')

  return {
    enabled: federal || clearanceSpecified || (technical && cybersecurity),
    reasons,
    federal,
    technical,
    cybersecurity,
    clearanceSpecified,
  }
}
