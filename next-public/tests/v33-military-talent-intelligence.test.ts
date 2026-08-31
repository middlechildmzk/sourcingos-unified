import { describe, expect, it } from 'vitest'

import {
  BRANCH_CODE_SYSTEM,
  buildMilitarySourcingHypothesis,
  lookupMilitaryOccupations,
  militaryContextFromSpan,
  militaryLaneDrafts,
  parseMilitaryCode,
  translateMilitaryToCivilian,
  type OccupationIndex,
} from '@/lib/military-talent-intelligence-v33'
import {
  canonicalTitleFrom,
  importMocRows,
  mergeWithSeed,
  normalizeBranch,
  normalizeServiceCategory,
  OFFICIAL_PROVENANCE,
  type RawMocRow,
} from '@/lib/military-crosswalk-import-v33'
import { SEED_CIVILIAN_OCCUPATIONS, SEED_MILITARY_OCCUPATIONS } from '@/data/military-occupations-seed-v33'

const index: OccupationIndex = { occupations: SEED_MILITARY_OCCUPATIONS, civilian: SEED_CIVILIAN_OCCUPATIONS }

const role = (title: string, mustHaves: string[], niceToHaves: string[] = []) => ({ title, mustHaves, niceToHaves })

describe('V33 · code parsing and lookup', () => {
  it.each([
    ['17C', '17C'],
    ['17c', '17C'],
    ['17-C', '17C'],
    ['MOS 17C', '17C'],
    ['AFSC 1D7X1', '1D7X1'],
    ['  25B  ', '25B'],
  ])('parses %s as %s', (input, expected) => {
    expect(parseMilitaryCode(input)).toBe(expected)
  })

  it.each(['cyber', 'security engineer', '', 'ABC'])('returns undefined for non-code input %s', input => {
    expect(parseMilitaryCode(input)).toBeUndefined()
  })

  it('finds an exact occupation', () => {
    const found = lookupMilitaryOccupations(index, '17C')
    expect(found).toHaveLength(1)
    expect(found[0].branch).toBe('army')
    expect(BRANCH_CODE_SYSTEM[found[0].branch]).toBe('MOS')
  })

  it('disambiguates by branch when asked', () => {
    expect(lookupMilitaryOccupations(index, '17C', 'navy')).toHaveLength(0)
    expect(lookupMilitaryOccupations(index, '17C', 'army')).toHaveLength(1)
  })

  it('returns nothing for an unknown code rather than guessing', () => {
    expect(lookupMilitaryOccupations(index, '99Z')).toHaveLength(0)
  })
})

describe('V33 · military to civilian', () => {
  it('translates a cyber occupation into civilian occupations and search terms', () => {
    const [translation] = translateMilitaryToCivilian(index, '17C')
    expect(translation.civilianOccupations.map(item => item.title)).toContain('Information Security Analysts')
    expect(translation.searchTerms).toContain('17C')
    expect(translation.searchTerms).toContain('Cyber Operations Specialist')
    expect(translation.caveat).toMatch(/not what any individual/i)
  })

  it('carries provenance on every translation', () => {
    const [translation] = translateMilitaryToCivilian(index, '68W')
    expect(translation.provenance.sourceUrl).toMatch(/onetcenter\.org/)
    expect(typeof translation.provenance.verified).toBe('boolean')
  })

  it('produces no translation for an unknown code', () => {
    expect(translateMilitaryToCivilian(index, '99Z')).toHaveLength(0)
  })

  it('flags branch ambiguity when one code exists in several branches', () => {
    const ambiguousIndex: OccupationIndex = {
      civilian: SEED_CIVILIAN_OCCUPATIONS,
      occupations: [
        ...SEED_MILITARY_OCCUPATIONS,
        { ...SEED_MILITARY_OCCUPATIONS[0], branch: 'marine_corps', title: 'Cyber (Marine Corps - Enlisted)' },
      ],
    }
    const translations = translateMilitaryToCivilian(ambiguousIndex, '17C')
    expect(translations).toHaveLength(2)
    expect(translations.every(item => item.ambiguousAcrossBranches)).toBe(true)
  })
})

describe('V33 · civilian to military', () => {
  it('produces cyber occupations for a cloud security role', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Cloud Security Engineer', ['cybersecurity', 'network defense', 'incident response']))
    expect(hypothesis.applicable).toBe(true)
    const codes = hypothesis.occupations.map(item => item.code)
    expect(codes).toContain('17C')
    expect(codes).toContain('CTN')
  })

  it('produces healthcare occupations for a clinical role', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('ICU Nurse', ['patient care', 'emergency medicine', 'triage']))
    expect(hypothesis.applicable).toBe(true)
    expect(hypothesis.occupations.map(item => item.code)).toContain('68W')
  })

  it('produces logistics occupations for an operations role', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Operations Manager', ['logistics', 'inventory management', 'operations']))
    expect(hypothesis.applicable).toBe(true)
    expect(hypothesis.occupations.map(item => item.code)).toContain('92Y')
  })

  it('returns not applicable for a role with no military adjacency', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Brand Copywriter', ['copywriting', 'brand voice', 'content strategy']))
    expect(hypothesis.applicable).toBe(false)
    expect(hypothesis.occupations).toHaveLength(0)
    expect(hypothesis.reason).toMatch(/no military occupation/i)
  })

  it('respects recruiter suppression', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Cloud Security Engineer', ['cybersecurity', 'network defense']), { suppressed: true })
    expect(hypothesis.applicable).toBe(false)
    expect(hypothesis.reason).toMatch(/recruiter/i)
  })

  it('requires more than one concept match, so a single generic word cannot open a lane', () => {
    const single = buildMilitarySourcingHypothesis(index, role('Analyst', ['research']))
    expect(single.applicable).toBe(false)
  })

  it('is deterministic across repeated runs', () => {
    const input = role('DevSecOps Engineer', ['cybersecurity', 'system administration', 'infrastructure'])
    const first = buildMilitarySourcingHypothesis(index, input)
    const second = buildMilitarySourcingHypothesis(index, input)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('explains each occupation without asserting candidate fitness', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Security Engineer', ['cybersecurity', 'incident response']))
    for (const occupation of hypothesis.occupations) {
      expect(occupation.rationale).toMatch(/worth exploring/i)
      expect(occupation.rationale).toMatch(/candidate-level evidence is still required/i)
      expect(occupation.rationale).not.toMatch(/qualified|is a fit|meets the requirement/i)
    }
  })

  it('never emits a numeric fitness score anywhere in the output', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Security Engineer', ['cybersecurity', 'incident response']))
    const serialized = JSON.stringify(hypothesis)
    expect(serialized).not.toMatch(/"score"/i)
    expect(serialized).not.toMatch(/fitScore/i)
    expect(serialized).not.toMatch(/confidence"\s*:\s*0?\.\d/)
  })

  it('surfaces that provisional taxonomy data is in use', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Security Engineer', ['cybersecurity', 'incident response']))
    expect(hypothesis.provisionalDataInUse).toBe(true)
    expect(hypothesis.occupations.every(item => item.relationship === 'provisional_seed')).toBe(true)
  })

  it('carries the required do-not-assume boundaries', () => {
    const hypothesis = buildMilitarySourcingHypothesis(index, role('Security Engineer', ['cybersecurity', 'incident response']))
    const joined = hypothesis.doNotAssume.join(' ')
    expect(joined).toMatch(/does not establish a security clearance/i)
    expect(joined).toMatch(/never satisfy a role requirement/i)
    expect(joined).toMatch(/rank, service dates, and discharge/i)
  })
})

describe('V33 · lane generation', () => {
  const hypothesis = buildMilitarySourcingHypothesis(index, role('Cloud Security Engineer', ['cybersecurity', 'network defense', 'incident response']))

  it('drafts lanes that are never pre-approved', () => {
    const lanes = militaryLaneDrafts(hypothesis, role('Cloud Security Engineer', ['cybersecurity', 'network defense']))
    expect(lanes.length).toBeGreaterThan(0)
    expect(lanes.every(lane => lane.approved === false)).toBe(true)
  })

  it('declares an honest source mode and a blind spot for every lane', () => {
    const lanes = militaryLaneDrafts(hypothesis, role('Cloud Security Engineer', ['cybersecurity']))
    for (const lane of lanes) {
      expect(['guided', 'executable', 'provider_optional']).toContain(lane.mode)
      expect(lane.blindSpot.length).toBeGreaterThan(20)
    }
  })

  it('bounds query size so a lane cannot explode', () => {
    const lanes = militaryLaneDrafts(hypothesis, role('Cloud Security Engineer', ['cybersecurity', 'network defense', 'incident response']))
    for (const lane of lanes) {
      const orCount = (lane.query.match(/ OR /g) || []).length
      expect(orCount).toBeLessThanOrEqual(12)
      expect(lane.query.length).toBeLessThan(400)
    }
  })

  it('emits no lanes when the hypothesis does not apply', () => {
    const none = buildMilitarySourcingHypothesis(index, role('Brand Copywriter', ['copywriting', 'brand voice']))
    expect(militaryLaneDrafts(none, role('Brand Copywriter', ['copywriting']))).toHaveLength(0)
  })
})

describe('V33 · Candidate 360 evidence boundary', () => {
  it('reads occupation context only when the code is literally in the span', () => {
    const context = militaryContextFromSpan(index, 'Served as a 17C Cyber Operations Specialist for six years.')
    expect(context?.detectedCode).toBe('17C')
    expect(context?.occupationTitle).toBe('Cyber Operations Specialist')
  })

  it('returns nothing when the span contains no code', () => {
    expect(militaryContextFromSpan(index, 'Army veteran with a cybersecurity background.')).toBeUndefined()
  })

  it('never produces requirement support from occupation context', () => {
    const context = militaryContextFromSpan(index, '17C Cyber Operations Specialist, 2018 to 2024.')
    expect(context?.requirementSupport).toEqual([])
    expect(context?.contextNotes.join(' ')).toMatch(/supports no role requirement/i)
  })

  it('does not infer a clearance from military service', () => {
    const context = militaryContextFromSpan(index, '17C Cyber Operations Specialist supporting classified networks.')
    const serialized = JSON.stringify(context)
    expect(serialized).not.toMatch(/TS\/SCI|Top Secret|clearance.*(verified|granted|holds)/i)
  })

  it('flags branch ambiguity rather than picking one', () => {
    const ambiguousIndex: OccupationIndex = {
      civilian: SEED_CIVILIAN_OCCUPATIONS,
      occupations: [
        ...SEED_MILITARY_OCCUPATIONS,
        { ...SEED_MILITARY_OCCUPATIONS[0], branch: 'navy', title: 'Cyber (Navy - Enlisted)' },
      ],
    }
    const context = militaryContextFromSpan(ambiguousIndex, 'Held 17C during service.')
    expect(context?.branch).toBeUndefined()
    expect(context?.contextNotes.join(' ')).toMatch(/more than one branch/i)
  })

  it('does not surface protected or non-qualification attributes', () => {
    const context = militaryContextFromSpan(index, '17C Cyber Operations Specialist, honorable discharge, E-5, age 29.')
    const serialized = JSON.stringify(context).toLowerCase()
    expect(serialized).not.toMatch(/discharge/)
    expect(serialized).not.toMatch(/\bage\b/)
    expect(serialized).not.toMatch(/\be-5\b/)
  })
})

describe('V33 · crosswalk importer', () => {
  const rows: RawMocRow[] = [
    { moc: '17C', branch: 'Army', moc_title: 'Cyber Operations Specialist (Army - Enlisted)', onetsoc_code: '15-1212.00', onetsoc_title: 'Information Security Analysts', active: 'Y' },
    { moc: '17C', branch: 'Army', moc_title: 'Cyber Operations Specialist (Army - Enlisted)', onetsoc_code: '15-1244.00', onetsoc_title: 'Network and Computer Systems Administrators', active: 'Y' },
    { moc: '0963', branch: 'Navy', moc_title: 'Primary Care Nurse Practitioner (Navy - Commissioned Officer only)', onetsoc_code: '29-1141.00', active: 'Y' },
    { moc: '', branch: 'Army', moc_title: 'Broken row', onetsoc_code: '15-1212.00' },
    { moc: '9999', branch: 'Unknown Service', moc_title: 'Unmappable', onetsoc_code: '15-1212.00' },
  ]

  it('groups rows into occupations with multiple civilian links', () => {
    const result = importMocRows(rows)
    const army = result.occupations.find(item => item.code === '17C')
    expect(army?.civilianOccupationCodes).toEqual(['15-1212.00', '15-1244.00'])
    expect(result.crosswalks).toHaveLength(3)
  })

  it('skips rows it cannot map instead of guessing', () => {
    const result = importMocRows(rows)
    expect(result.skippedRows).toBe(2)
  })

  it('derives a canonical title and keeps the raw title as an alternate', () => {
    const { canonical, alternates } = canonicalTitleFrom('Cyber Operations Specialist (Army - Enlisted)')
    expect(canonical).toBe('Cyber Operations Specialist')
    expect(alternates).toEqual(['Cyber Operations Specialist (Army - Enlisted)'])
  })

  it('derives service category from the title when the column is absent', () => {
    expect(normalizeServiceCategory(undefined, 'Primary Care Nurse Practitioner (Navy - Commissioned Officer only)')).toBe('officer')
    expect(normalizeServiceCategory(undefined, 'Cyber Operations Specialist (Army - Enlisted)')).toBe('enlisted')
    expect(normalizeServiceCategory(undefined, 'Information Services Technician (Army - Warrant Officer)')).toBe('warrant')
  })

  it.each([
    ['Army', 'army'],
    ['U.S. Air Force', 'air_force'],
    ['Marine Corps', 'marine_corps'],
    ['Coast Guard', 'coast_guard'],
    ['Space Force', 'space_force'],
  ])('normalizes branch %s', (input, expected) => {
    expect(normalizeBranch(input)).toBe(expected)
  })

  it('stamps official provenance as verified', () => {
    const result = importMocRows(rows)
    expect(result.occupations.every(item => item.provenance.verified)).toBe(true)
    expect(result.occupations[0].provenance.sourceUrl).toBe(OFFICIAL_PROVENANCE.sourceUrl)
  })

  it('merges official records over the provisional seed while keeping seed enrichment', () => {
    const imported = importMocRows(rows).occupations
    const merged = mergeWithSeed(SEED_MILITARY_OCCUPATIONS, imported)
    const army17c = merged.find(item => item.branch === 'army' && item.code === '17C')
    expect(army17c?.provenance.verified).toBe(true)
    expect(army17c?.skillConcepts).toContain('incident response')
    expect(merged.length).toBeGreaterThan(imported.length)
  })
})

describe('V33 · retrieval quality on a synthetic corpus', () => {
  type EvalCase = { role: ReturnType<typeof role>; relevant: string[] }

  const cases: EvalCase[] = [
    { role: role('Cloud Security Engineer', ['cybersecurity', 'network defense', 'incident response']), relevant: ['17C', '1D7X1', 'CTN', '5C0X1'] },
    { role: role('Systems Administrator', ['system administration', 'network administration', 'infrastructure']), relevant: ['25B', '0651', 'IT'] },
    { role: role('Intelligence Analyst', ['intelligence analysis', 'threat analysis', 'reporting']), relevant: ['35F', '1N4X1'] },
    { role: role('Emergency Department Nurse', ['patient care', 'emergency medicine', 'triage']), relevant: ['68W', 'HM'] },
    { role: role('Supply Chain Analyst', ['logistics', 'supply chain', 'inventory management']), relevant: ['92Y'] },
  ]

  it('reports precision and recall at k without optimizing to a vanity number', () => {
    let precisionSum = 0
    let recallSum = 0
    let familyDiversity = 0

    for (const testCase of cases) {
      const hypothesis = buildMilitarySourcingHypothesis(index, testCase.role)
      const returned = hypothesis.occupations.map(item => item.code)
      const hits = returned.filter(code => testCase.relevant.includes(code))
      precisionSum += returned.length ? hits.length / returned.length : 0
      recallSum += testCase.relevant.length ? hits.length / testCase.relevant.length : 0
      familyDiversity += new Set(hypothesis.occupations.map(item => item.branch)).size
    }

    const precision = precisionSum / cases.length
    const recall = recallSum / cases.length
    const branches = familyDiversity / cases.length

    // Thresholds are intentionally modest. The seed taxonomy is small, and the
    // point of the gate is to catch a regression, not to look impressive.
    expect(precision).toBeGreaterThan(0.6)
    expect(recall).toBeGreaterThan(0.5)
    expect(branches).toBeGreaterThan(1)
  })

  it('gives every returned occupation a source URL', () => {
    for (const testCase of cases) {
      const hypothesis = buildMilitarySourcingHypothesis(index, testCase.role)
      for (const occupation of hypothesis.occupations) {
        expect(occupation.provenance.sourceUrl).toMatch(/^https:\/\//)
        expect(occupation.provenance.source.length).toBeGreaterThan(3)
      }
    }
  })
})
