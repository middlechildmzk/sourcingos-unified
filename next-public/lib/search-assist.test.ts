import { describe, expect, it } from 'vitest'
import { getSearchAssistSuggestions } from './search-assist'

function valuesFor(query: string) {
  return getSearchAssistSuggestions(query).suggestions.map(s => s.value)
}

function valuesAndKindsFor(query: string) {
  return getSearchAssistSuggestions(query).suggestions.map(s => ({ value: s.value, kind: s.kind }))
}

function expectSome(values: string[], expected: string[]) {
  expect(values.some(value => expected.includes(value))).toBe(true)
}

function expectNoRecruitingTitles(query: string) {
  const recruitingTitles = new Set([
    'Technical Recruiter',
    'Technical Sourcer',
    'Talent Sourcer',
    'Talent Acquisition',
    'Recruiting Coordinator',
    'TA Partner',
    'Recruitment Marketing',
  ])

  const titleSuggestions = valuesAndKindsFor(query).filter(s => s.kind === 'title').map(s => s.value)
  for (const title of titleSuggestions) {
    expect(recruitingTitles.has(title)).toBe(false)
  }
}

describe('search assist intent calibration', () => {
  it('keeps Machine Learning Engineer in the AI/ML lane', () => {
    const values = valuesFor('Machine Learning Engineer')

    expect(values).toContain('AI Engineer')
    expect(values).toContain('MLOps Engineer')
    expectSome(values, ['Research Engineer', 'Data Scientist', 'Applied Scientist'])
    expectNoRecruitingTitles('Machine Learning Engineer')
  })

  it('keeps Data Scientist PyTorch LLM in the AI/ML lane', () => {
    const values = valuesFor('Data Scientist PyTorch LLM')

    expect(values).toContain('ML Engineer')
    expect(values).toContain('Hugging Face')
    expectSome(values, ['arXiv', 'Hugging Face'])
    expectNoRecruitingTitles('Data Scientist PyTorch LLM')
  })

  it('keeps Technical Sourcer in the recruiting lane', () => {
    const values = valuesFor('Technical Sourcer')

    expect(values).toContain('Technical Recruiter')
    expect(values).toContain('Talent Sourcer')
    expectSome(values, ['TA Researcher', 'Recruiting Researcher', 'Talent Acquisition'])
  })

  it('keeps Technical Recruiter in the recruiting lane', () => {
    const values = valuesFor('Technical Recruiter')

    expect(values).toContain('Technical Sourcer')
    expectSome(values, ['Engineering Recruiter', 'TA Partner', 'Talent Acquisition Partner'])
  })

  it('handles cleared DevSecOps without weakening clearance guardrails', () => {
    const result = getSearchAssistSuggestions('DevSecOps Engineer Kubernetes TS/SCI Northern Virginia')
    const values = result.suggestions.map(s => s.value)

    expect(values).toContain('Platform Engineer')
    expect(values).toContain('Terraform')
    expect(values).toContain('ClearanceJobs')
    expectSome(values, ['Chantilly', 'Reston', 'Herndon'])
    expect(result.notes.some(note => note.includes('Clearance must be confirmed'))).toBe(true)
  })

  it('keeps Nurse Recruiter in the healthcare recruiting lane', () => {
    const values = valuesFor('Nurse Recruiter')

    expect(values).toContain('RN Recruiter')
    expect(values).toContain('Clinical Recruiter')
    expect(values).toContain('Healthcare Recruiter')
    expect(values).toContain('Provider Recruiter')
  })

  it('keeps Epic Analyst in the healthcare IT lane', () => {
    const values = valuesFor('Epic Analyst')

    expect(values).toContain('Cerner')
    expect(values).toContain('HL7')
    expect(values).toContain('FHIR')
    expect(values).toContain('EMR')
    expectNoRecruitingTitles('Epic Analyst')
  })

  it('keeps Cybersecurity Engineer Splunk Secret in the cyber lane', () => {
    const result = getSearchAssistSuggestions('Cybersecurity Engineer Splunk Secret')
    const values = result.suggestions.map(s => s.value)

    expect(values).toContain('Security Engineer')
    expect(values).toContain('SIEM')
    expect(values).toContain('ClearanceJobs')
    expect(result.notes.some(note => note.includes('Clearance must be confirmed'))).toBe(true)
    expectNoRecruitingTitles('Cybersecurity Engineer Splunk Secret')
  })
})
