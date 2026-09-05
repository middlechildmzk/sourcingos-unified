import type { RoleIntake } from './role-workspace'

const TECHNICAL_ADMIN = /\b(?:rhel|red\s+hat|linux|unix|sysadmin|systems?\s+administrator|systems?\s+admin|linux\s+administrator|linux\s+admin|unix\s+administrator|unix\s+admin|network\s+administrator|network\s+admin|database\s+administrator|database\s+admin|dba|cloud\s+administrator|cloud\s+admin|infrastructure\s+administrator|infrastructure\s+admin)\b/i
const LINUX_FAMILY = /\b(?:rhel|red\s+hat|linux|unix|sysadmin)\b/i
const NETWORK_FAMILY = /\bnetwork\s+(?:administrator|admin)\b/i
const DATABASE_FAMILY = /\b(?:database\s+(?:administrator|admin)|dba)\b/i
const CLOUD_FAMILY = /\bcloud\s+(?:administrator|admin)\b/i
const INCOMPATIBLE_ADMIN_OCCUPATION = /\b(?:education|school|principal|superintendent|preschool|daycare|childcare|kindergarten|secondary|athletic\s+director|curriculum)\b/i
const COMPATIBLE_TECH_OCCUPATION = /\b(?:computer|systems?|network|information\s+technology|technology|infrastructure|linux|unix|database|cloud)\b/i

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function uniq(values: string[], max = 12): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, max)
}

function roleText(intake: RoleIntake): string {
  return [intake.title, intake.rawDescription, ...intake.mustHaves, ...intake.niceToHaves].filter(Boolean).join(' ')
}

export function isTechnicalAdministrationRole(intake: RoleIntake): boolean {
  return TECHNICAL_ADMIN.test(roleText(intake))
}

export function technicalAdministrationAdjacentTitles(intake: RoleIntake): string[] {
  const text = roleText(intake)
  if (!isTechnicalAdministrationRole(intake)) return []

  if (DATABASE_FAMILY.test(text)) {
    return ['Database Administrator', 'DBA', 'Database Engineer', 'Senior Database Administrator']
  }
  if (NETWORK_FAMILY.test(text)) {
    return ['Network Administrator', 'Network Engineer', 'Systems and Network Administrator', 'Infrastructure Engineer']
  }
  if (CLOUD_FAMILY.test(text)) {
    return ['Cloud Administrator', 'Cloud Engineer', 'Cloud Infrastructure Engineer', 'Systems Administrator', 'Infrastructure Engineer']
  }
  if (LINUX_FAMILY.test(text)) {
    return [
      'RHEL Administrator',
      'Red Hat Linux Administrator',
      'Linux Systems Administrator',
      'Linux Administrator',
      'Unix Administrator',
      'Systems Administrator',
      'Linux Engineer',
      'Infrastructure Engineer',
    ]
  }
  return ['Systems Administrator', 'System Administrator', 'Infrastructure Engineer', 'Linux Systems Administrator']
}

/**
 * O*NET is useful discovery context only when the matched occupation is actually
 * compatible with the recruiter's domain. Ambiguous words such as "admin" must
 * never pull a technical role into school/business administration title families.
 */
export function onetOccupationCompatibleWithRole(intake: RoleIntake, occupationTitle: string): boolean {
  if (!isTechnicalAdministrationRole(intake)) return true
  const title = clean(occupationTitle)
  if (!title) return false
  if (INCOMPATIBLE_ADMIN_OCCUPATION.test(title)) return false
  return COMPATIBLE_TECH_OCCUPATION.test(title)
}

export function mergeTechnicalAdjacentTitles(intake: RoleIntake): RoleIntake {
  const technical = technicalAdministrationAdjacentTitles(intake)
  if (!technical.length) return intake
  return {
    ...intake,
    adjacentBackgrounds: uniq([...technical, ...intake.adjacentBackgrounds], 18),
  }
}
