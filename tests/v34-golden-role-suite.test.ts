import { describe, expect, it } from 'vitest'
import { mergeAiRoleBriefV33_11 } from '@/lib/ai/role-brief-parser-v33-4'
import { buildJobFamilyRoutingV34 } from '@/lib/job-family-router-v34'
import { GOLDEN_ROLE_CASES_V34 } from './fixtures/golden-role-cases-v34'

const adversarialModel = {
  title: 'Unrelated TypeScript engineer',
  location: 'Melbourne, Australia',
  workMode: 'remote',
  compensation: '$999,999',
  clearance: 'TS/SCI or higher',
  mustHaves: ['TypeScript', 'React'],
  niceToHaves: ['Vue'],
  disqualifiers: ['unrelated invented exclusion'],
  targetCompanies: ['Invented Company'],
  adjacentBackgrounds: ['Frontend developer'],
  hiringManagerNotes: 'This deliberately wrong model output must never replace a short recruiter search contract.',
}

describe('V34 Golden Role cross-domain recruiter truth suite', () => {
  for (const golden of GOLDEN_ROLE_CASES_V34) {
    it(`${golden.id}: preserves explicit recruiter truth and routes the intended job family`, () => {
      const intake = mergeAiRoleBriefV33_11(golden.prompt, adversarialModel)
      const searchable = [
        intake.title,
        intake.location,
        intake.clearance,
        ...intake.mustHaves,
        ...intake.niceToHaves,
        ...intake.adjacentBackgrounds,
      ].join(' ')

      expect(intake.title.toLowerCase()).toContain(golden.expectedTitleText.toLowerCase())
      for (const mustHave of golden.expectedMustHaves || []) {
        expect(intake.mustHaves).toContain(mustHave)
      }
      if (golden.expectedClearance) expect(intake.clearance).toBe(golden.expectedClearance)
      if (golden.expectedLocationText) expect(intake.location.toLowerCase()).toContain(golden.expectedLocationText.toLowerCase())
      for (const forbidden of golden.forbiddenRoleTokens || []) {
        expect(searchable.toLowerCase()).not.toContain(forbidden.toLowerCase())
      }

      const routing = buildJobFamilyRoutingV34(intake)
      expect(routing.primaryFamily).toBe(golden.expectedFamily)
      for (const modifier of golden.expectedContextModifiers || []) {
        expect(routing.contextModifiers.map(item => item.id), `${golden.id} lost context modifier ${modifier}`).toContain(modifier)
      }
    })
  }

  it('keeps the permanent suite meaningfully cross-domain rather than collapsing back to technical-only tests', () => {
    const families = new Set(GOLDEN_ROLE_CASES_V34.map(golden => golden.expectedFamily))
    const familyList = Array.from(families)
    expect(GOLDEN_ROLE_CASES_V34.length).toBeGreaterThanOrEqual(16)
    expect(families.size).toBeGreaterThanOrEqual(12)
    expect(familyList).toEqual(expect.arrayContaining([
      'infrastructure',
      'software',
      'cloud_devops',
      'cybersecurity',
      'ai_ml',
      'data',
      'healthcare_clinical',
      'research_science',
      'program_management',
      'product_management',
      'finance_regulated',
      'aviation',
    ]))
  })
})
