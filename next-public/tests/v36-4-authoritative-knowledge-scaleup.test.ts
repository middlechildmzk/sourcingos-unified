import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  authoritativeTitlePhraseFromComposerV36_4,
  rankOnetTitleSuggestionsV36_4,
  sanitizeAuthoritativeTitleQueryV36_4,
  type OnetJobTitleRowV36_4,
  type OnetOccupationRowV36_4,
} from '@/lib/entity-intelligence/onet-title-search-v36-4'

const occupations: OnetOccupationRowV36_4[] = [
  { onetsoc_code: '15-1244.00', title: 'Network and Computer Systems Administrators' },
  { onetsoc_code: '15-1252.00', title: 'Software Developers' },
  { onetsoc_code: '15-1212.00', title: 'Information Security Analysts' },
]

const jobTitles: OnetJobTitleRowV36_4[] = [
  { onetsoc_code: '15-1244.00', title: 'Network and Computer Systems Administrators', alternate_title: 'Linux Systems Administrator' },
  { onetsoc_code: '15-1244.00', title: 'Network and Computer Systems Administrators', alternate_title: 'Systems Administrator' },
  { onetsoc_code: '15-1252.00', title: 'Software Developers', alternate_title: 'Backend Software Engineer' },
  { onetsoc_code: '15-1212.00', title: 'Information Security Analysts', alternate_title: 'Cybersecurity Analyst' },
]

describe('V36.4 authoritative title query boundary', () => {
  it('extracts only a compact role phrase from natural recruiter composer text', () => {
    expect(authoritativeTitlePhraseFromComposerV36_4('find me a RHEL administrator')).toBe('rhel administrator')
    expect(authoritativeTitlePhraseFromComposerV36_4('show me a backend software eng')).toBe('backend software eng')
  })

  it('does not send clearance/citizenship vocabulary to O*NET title search', () => {
    for (const query of ['TS', 'Secret', 'secret clearance', 'TS/SCI', 'public trust', 'citizenship', 'polygraph']) {
      expect(sanitizeAuthoritativeTitleQueryV36_4(query), query).toBe('')
    }
    expect(authoritativeTitlePhraseFromComposerV36_4('RHEL administrator with Secret clearance')).toBe('')
  })
})

describe('V36.4 O*NET title ranking', () => {
  it('ranks source-native alternate job titles without converting them into role truth', () => {
    const result = rankOnetTitleSuggestionsV36_4({ query: 'linux sys admin', occupations, jobTitles })
    expect(result[0]).toMatchObject({
      value: 'Linux Systems Administrator',
      canonicalTitle: 'Network and Computer Systems Administrators',
      onetSocCode: '15-1244.00',
      source: 'onet',
      sourceVersion: '31.0',
      activation: 'suggested_inactive',
      searchOnly: true,
      evidenceEligible: false,
    })
  })

  it('supports partial recruiter typing and deterministic result limits', () => {
    const a = rankOnetTitleSuggestionsV36_4({ query: 'backend soft eng', occupations, jobTitles, limit: 2 })
    const b = rankOnetTitleSuggestionsV36_4({ query: 'backend soft eng', occupations: [...occupations].reverse(), jobTitles: [...jobTitles].reverse(), limit: 2 })
    expect(a).toEqual(b)
    expect(a[0].value).toBe('Backend Software Engineer')
    expect(a.length).toBeLessThanOrEqual(2)
  })

  it('never emits a title suggestion for verification-only clearance text', () => {
    expect(rankOnetTitleSuggestionsV36_4({ query: 'secret clearance', occupations, jobTitles })).toEqual([])
  })
})

describe('V36.4 server-backed authoritative typeahead contract', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/entity-intelligence/authoritative-suggest/route.ts'), 'utf8')
  const server = readFileSync(join(process.cwd(), 'lib/onet-datasets-v36-4.ts'), 'utf8')
  const dropdown = readFileSync(join(process.cwd(), 'components/SearchAssistDropdown.tsx'), 'utf8')

  it('keeps the large O*NET source dataset server-side and source-labelled', () => {
    expect(server).toContain("import 'server-only'")
    expect(route).toContain("fetchOnetDatasetV36_4<OnetJobTitleRowV36_4>('job_titles.json')")
    expect(route).toContain("fetchOnetDatasetV36_4<OnetOccupationRowV36_4>('occupation_data.json')")
    expect(route).toContain("sourceVersion: ONET_VERSION_V36_4")
    expect(route).toContain('searchOnly: true')
    expect(dropdown).not.toContain('job_titles.json')
  })

  it('requires auth and rate limiting before authoritative network-backed suggestions', () => {
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench', gate.userId)")
  })

  it('debounces the authoritative lookup and visibly labels O*NET results as search-only', () => {
    expect(dropdown).toContain('window.setTimeout')
    expect(dropdown).toContain('260')
    expect(dropdown).toContain('O*NET ${item.sourceVersion')
    expect(dropdown).toContain('search-only')
    expect(dropdown).toContain('not candidate evidence or automatic role requirements')
  })
})
