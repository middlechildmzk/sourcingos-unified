import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('V36.9 candidate search source-scope UX', () => {
  it('separates external Talent Universe from imported/saved workbench records', () => {
    const source = read('components/RoleScopedCandidateSearch.tsx')
    expect(source).toContain("type SearchSurface = 'talent_universe' | 'workbench'")
    expect(source).toContain('Talent Universe')
    expect(source).toContain('My Database / Workbench')
    expect(source).toContain('Imported LinkedIn connections are not presented as external provider discoveries.')
    expect(source).toContain('<CandidateProviderReadinessV36_9 />')
  })

  it('makes zero-provider readiness explicit instead of silently falling back to imports', () => {
    const source = read('components/CandidateProviderReadinessV36_9.tsx')
    expect(source).toContain('External Talent Universe is not active in this environment.')
    expect(source).toContain('does <b>not</b> silently fall back to your imported LinkedIn connections or Candidate Database')
    expect(source).toContain('Zero professional people-search providers are executable.')
  })
})
