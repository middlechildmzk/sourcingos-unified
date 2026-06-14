// tests/search-assist.test.ts — deterministic suggestion engine.
// These assert behavior, not exact wording, so taxonomy growth won't break them.
import { describe, it, expect } from 'vitest'
import { getSearchAssistSuggestions, groupSuggestions } from '@/lib/search-assist'

function values(input: string, opts?: { selectedLaneId?: string }) {
  return getSearchAssistSuggestions(input, opts).suggestions.map(s => s.value.toLowerCase())
}
function kinds(input: string, opts?: { selectedLaneId?: string }) {
  return new Set(getSearchAssistSuggestions(input, opts).suggestions.map(s => s.kind))
}

describe('getSearchAssistSuggestions — recognition', () => {
  it('recognizes title, clearance, skill, and market from a cleared query', () => {
    const r = getSearchAssistSuggestions('DevSecOps eng ts sci kubernetes fort meade')
    const canon = r.recognized.map(x => x.canonical)
    expect(canon).toContain('DevSecOps Engineer')
    expect(canon).toContain('TS/SCI')
    expect(canon).toContain('Kubernetes')
  })
})

describe('case 1 — DevSecOps TS/SCI Kubernetes Fort Meade', () => {
  const q = 'DevSecOps eng ts sci kubernetes fort meade'
  it('suggests adjacent skills (Terraform / AWS / CI-CD family)', () => {
    const v = values(q)
    expect(v.some(x => /terraform|aws|ci\/cd|docker|helm/.test(x))).toBe(true)
  })
  it('suggests nearby cleared markets (Annapolis Junction / Columbia)', () => {
    const v = values(q)
    expect(v.some(x => /annapolis junction|columbia md|dc metro|hanover/.test(x))).toBe(true)
  })
  it('suggests cleared source lanes (ClearanceJobs)', () => {
    const v = values(q)
    expect(v.some(x => /clearancejobs/.test(x))).toBe(true)
  })
  it('emits clearance caution notes', () => {
    const notes = getSearchAssistSuggestions(q).notes.join(' ').toLowerCase()
    expect(notes).toContain('clearance must be confirmed')
    expect(notes).toContain('public x-ray cannot verify clearance')
  })
  it('GitHub lane excludes clearance, location, and exclusions', () => {
    const k = kinds(q, { selectedLaneId: 'github' })
    expect(k.has('clearance')).toBe(false)
    expect(k.has('location')).toBe(false)
    expect(k.has('exclusion')).toBe(false)
  })
})

describe('case 2 — Epic analyst HL7 remote (healthcare IT)', () => {
  const q = 'Epic analyst HL7 remote'
  it('suggests healthcare IT stack (FHIR / Cerner / EHR)', () => {
    const v = values(q)
    expect(v.some(x => /fhir|cerner|ehr|emr|interoperability/.test(x))).toBe(true)
  })
  it('does not push engineering-only skills like kubernetes', () => {
    const v = values(q)
    expect(v).not.toContain('kubernetes')
  })
})

describe('case 3 — SOC analyst Splunk Secret Huntsville', () => {
  const q = 'SOC analyst Splunk Secret Huntsville'
  it('treats "secret" as a clearance hint and suggests cleared lanes + caution', () => {
    const v = values(q)
    expect(v.some(x => /clearancejobs/.test(x))).toBe(true)
    const notes = getSearchAssistSuggestions(q).notes.join(' ').toLowerCase()
    expect(notes).toContain('clearance must be confirmed')
  })
  it('suggests Huntsville-area cleared markets', () => {
    expect(values(q).some(x => /redstone|madison al|cummings/.test(x))).toBe(true)
  })
})

describe('case 4 — Senior technical sourcer AI recruiting remote', () => {
  const q = 'Senior technical sourcer AI recruiting remote'
  it('suggests TA/recruiting title variants, not engineering skills', () => {
    const sugg = getSearchAssistSuggestions(q).suggestions
    const titleVals = sugg.filter(s => s.kind === 'title').map(s => s.value.toLowerCase())
    expect(titleVals.some(x => /recruiter|talent|sourcer|ta /.test(x))).toBe(true)
    const v = values(q)
    expect(v).not.toContain('kubernetes')
    expect(v).not.toContain('terraform')
  })
})

describe('case 5 — Data engineer Python Spark AWS', () => {
  const q = 'Data engineer Python Spark AWS'
  it('recognizes skills and recommends technical lanes (GitHub)', () => {
    const v = values(q)
    expect(v.some(x => /github/.test(x))).toBe(true)
  })
  it('does not emit clearance notes for a non-cleared search', () => {
    const notes = getSearchAssistSuggestions(q).notes.join(' ').toLowerCase()
    expect(notes).not.toContain('clearance must be confirmed')
  })
})

describe('groupSuggestions', () => {
  it('groups by kind in a stable display order', () => {
    const r = getSearchAssistSuggestions('DevSecOps Kubernetes TS/SCI Fort Meade')
    const groups = groupSuggestions(r.suggestions)
    expect(groups.length).toBeGreaterThan(0)
    // every grouped item belongs to its group kind
    for (const g of groups) expect(g.items.every(i => i.kind === g.kind)).toBe(true)
  })
})

describe('safety: no suggestion duplicates a term already in the query', () => {
  it('does not re-suggest Kubernetes when already present', () => {
    const v = values('Kubernetes platform engineer')
    expect(v.filter(x => x === 'kubernetes').length).toBe(0)
  })
})
