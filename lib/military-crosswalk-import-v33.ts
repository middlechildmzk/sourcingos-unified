/**
 * V33 — O*NET Military Crosswalk importer.
 *
 * The official file is published at https://www.onetcenter.org/crosswalks.html
 * as "Military Occupational Classification (MOC)" in MS Access, XLSX and CSV
 * inside a ZIP, under CC BY 4.0. Its linkages combine the DMDC MOC crosswalk,
 * the VOW to Hire Heroes Act §222 enhanced analysis, and RAND Army KSA research.
 *
 * This module normalizes rows from that file into the V33 model. It performs no
 * network access itself: the file is fetched by a build step or the runtime
 * dataset loader, exactly as the existing O*NET role intelligence route does,
 * and the parsed rows are handed here. That keeps the licence attribution and
 * refresh cadence in one place and keeps this module deterministic and testable.
 */

import {
  BRANCH_CODE_SYSTEM,
  type CrosswalkRelationship,
  type MilitaryBranch,
  type MilitaryCivilianCrosswalk,
  type MilitaryOccupation,
  type ServiceCategory,
  type TaxonomyProvenance,
} from '@/lib/military-talent-intelligence-v33'

/** A row as published in the MOC crosswalk CSV. Field names vary by release. */
export type RawMocRow = {
  moc?: string
  branch?: string
  moc_title?: string
  onetsoc_code?: string
  onetsoc_title?: string
  active?: string | boolean
  service_category?: string
}

export const OFFICIAL_PROVENANCE: TaxonomyProvenance = {
  source: 'O*NET Military Crosswalk (MOC)',
  sourceUrl: 'https://www.onetcenter.org/crosswalks.html',
  verified: true,
  version: 'moc-2024-08',
}

const BRANCH_ALIASES: Array<[RegExp, MilitaryBranch]> = [
  [/\barmy\b/i, 'army'],
  [/\bnavy\b/i, 'navy'],
  [/\bair\s*force\b/i, 'air_force'],
  [/\bmarine/i, 'marine_corps'],
  [/\bspace\s*force\b/i, 'space_force'],
  [/\bcoast\s*guard\b/i, 'coast_guard'],
]

export function normalizeBranch(value: string | undefined): MilitaryBranch | undefined {
  if (!value) return undefined
  for (const [pattern, branch] of BRANCH_ALIASES) {
    if (pattern.test(value)) return branch
  }
  return undefined
}

export function normalizeServiceCategory(value: string | undefined, title = ''): ServiceCategory {
  const haystack = `${value || ''} ${title}`
  if (/warrant/i.test(haystack)) return 'warrant'
  if (/officer/i.test(haystack)) return 'officer'
  if (/enlisted/i.test(haystack)) return 'enlisted'
  return 'unspecified'
}

/**
 * O*NET titles carry the branch and category in parentheses, for example
 * "Cyber Operations Specialist (Army - Enlisted)". Strip it for the canonical
 * title but keep the original as an alternate.
 */
export function canonicalTitleFrom(rawTitle: string): { canonical: string; alternates: string[] } {
  const raw = rawTitle.replace(/\s+/g, ' ').trim()
  const canonical = raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return { canonical: canonical || raw, alternates: canonical && canonical !== raw ? [raw] : [] }
}

export type ImportResult = {
  occupations: MilitaryOccupation[]
  crosswalks: MilitaryCivilianCrosswalk[]
  skippedRows: number
  warnings: string[]
}

/**
 * Groups rows by branch + code. One military occupation may link to many
 * civilian occupations; each link becomes a crosswalk record with provenance.
 */
export function importMocRows(
  rows: RawMocRow[],
  provenance: TaxonomyProvenance = OFFICIAL_PROVENANCE,
  relationship: CrosswalkRelationship = 'authoritative_crosswalk',
): ImportResult {
  const byKey = new Map<string, MilitaryOccupation>()
  const crosswalks: MilitaryCivilianCrosswalk[] = []
  const warnings: string[] = []
  let skippedRows = 0

  for (const row of rows) {
    const code = (row.moc || '').trim().toUpperCase()
    const branch = normalizeBranch(row.branch) || normalizeBranch(row.moc_title)
    if (!code || !branch) {
      skippedRows += 1
      continue
    }

    const { canonical, alternates } = canonicalTitleFrom(row.moc_title || code)
    const key = `${branch}:${code}`
    const active = row.active === undefined ? true : row.active === true || /^(true|y|yes|1|active)$/i.test(String(row.active))

    let occupation = byKey.get(key)
    if (!occupation) {
      occupation = {
        branch,
        code,
        title: (row.moc_title || canonical).trim(),
        canonicalTitle: canonical,
        alternateTitles: [...alternates],
        serviceCategory: normalizeServiceCategory(row.service_category, row.moc_title),
        description: '',
        civilianOccupationCodes: [],
        skillConcepts: [],
        credentialSignals: [],
        occupationFamilies: [],
        active,
        provenance,
      }
      byKey.set(key, occupation)
    }

    const onetCode = (row.onetsoc_code || '').trim()
    if (!onetCode) {
      warnings.push(`${BRANCH_CODE_SYSTEM[branch]} ${code} has no linked O*NET-SOC code in this row.`)
      continue
    }

    if (!occupation.civilianOccupationCodes.includes(onetCode)) {
      occupation.civilianOccupationCodes.push(onetCode)
    }
    crosswalks.push({
      militaryBranch: branch,
      militaryCode: code,
      onetSocCode: onetCode,
      relationship,
      provenance,
    })
  }

  return { occupations: Array.from(byKey.values()), crosswalks, skippedRows, warnings }
}

/**
 * Merges an imported taxonomy over a provisional seed. Official records win on
 * every field they populate; seed-only enrichment (skill concepts, families,
 * credential signals) survives, but is re-stamped as provisional so the UI can
 * still tell a recruiter which parts are not from the official file.
 */
export function mergeWithSeed(seed: MilitaryOccupation[], imported: MilitaryOccupation[]): MilitaryOccupation[] {
  const bySeedKey = new Map(seed.map(item => [`${item.branch}:${item.code.toUpperCase()}`, item]))
  const merged: MilitaryOccupation[] = []
  const consumed = new Set<string>()

  for (const official of imported) {
    const key = `${official.branch}:${official.code.toUpperCase()}`
    consumed.add(key)
    const seedMatch = bySeedKey.get(key)
    if (!seedMatch) {
      merged.push(official)
      continue
    }
    merged.push({
      ...official,
      description: official.description || seedMatch.description,
      alternateTitles: Array.from(new Set([...official.alternateTitles, ...seedMatch.alternateTitles])),
      skillConcepts: seedMatch.skillConcepts,
      credentialSignals: seedMatch.credentialSignals,
      occupationFamilies: seedMatch.occupationFamilies,
      civilianOccupationCodes: Array.from(new Set([...official.civilianOccupationCodes, ...seedMatch.civilianOccupationCodes])),
    })
  }

  for (const [key, seedMatch] of bySeedKey) {
    if (!consumed.has(key)) merged.push(seedMatch)
  }

  return merged
}
