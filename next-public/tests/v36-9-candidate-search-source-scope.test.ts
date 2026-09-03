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

  it('makes provider runtime visibility prominent instead of silently falling back to imports', () => {
    const source = read('components/CandidateProviderReadinessV36_9.tsx')
    expect(source).toContain('Provider connections:')
    expect(source).toContain('professional search provider')
    expect(source).toContain('does <b>not</b> silently fall back to imported LinkedIn connections or Candidate Database records')
    expect(source).toContain('Missing from this runtime:')
    expect(source).toContain('CORESIGNAL_API_KEY')
  })

  it('distinguishes configured provider credentials from successful live vendor verification', () => {
    const source = read('components/CandidateProviderReadinessV36_9.tsx')
    expect(source).toContain('key present')
    expect(source).toContain('does not prove vendor authentication')
    expect(source).toContain('live-verified only after a real search succeeds')
    expect(source).toContain('even if they exist elsewhere in Vercel')
  })
})
