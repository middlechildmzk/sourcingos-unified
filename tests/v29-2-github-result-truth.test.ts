import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { enforceGitHubResultTruth } from '../lib/github-result-truth'
import type { SourceResult } from '../lib/source-types'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function githubResult(raw: unknown, skills = ['Kubernetes', 'Terraform']): SourceResult {
  return {
    id: 'github:ada',
    source: 'github',
    entityKind: 'person',
    sourceProfileId: 'ada',
    displayName: 'Ada Engineer',
    skills,
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-07-29T18:00:00.000Z',
    raw,
  }
}

describe('V29.2 GitHub result truth boundary', () => {
  it('keeps only observed repository languages and topics as GitHub skills', () => {
    const result = enforceGitHubResultTruth(githubResult({
      strategy: 'repository_contributors',
      repositories: [
        { language: 'Go', topics: ['kubernetes', 'Terraform'] },
        { language: 'TypeScript', topics: ['Kubernetes', 'platform-engineering'] },
      ],
    }))

    expect(result.skills).toEqual(['Go', 'kubernetes', 'Terraform', 'TypeScript', 'platform-engineering'])
    expect(result.skills).not.toContain('AWS')
  })

  it('does not present recruiter query terms as observed skills for user-search fallback', () => {
    const result = enforceGitHubResultTruth(githubResult({
      strategy: 'user_search_fallback',
      profile: { bio: 'Public GitHub profile' },
    }, ['Kubernetes', 'Terraform', 'AWS']))

    expect(result.skills).toEqual([])
    expect(result.evidence).toEqual([])
  })

  it('does not alter non-GitHub source results', () => {
    const original: SourceResult = {
      ...githubResult({}, ['Python']),
      id: 'openalex:1',
      source: 'openalex',
      sourceProfileId: '1',
    }

    expect(enforceGitHubResultTruth(original)).toBe(original)
  })

  it('enforces the truth boundary before the public search response is returned', () => {
    const route = read('app/api/workbench/search-source/route.ts')

    expect(route).toContain('enforceGitHubResultsTruth(classifyRealSourceResults(response.results))')
    expect(route).toContain('GitHub skills are derived from observed repository languages and topics, not copied from search terms.')
    expect(route).toContain("import type { SourceExecutionDiagnostics } from '@/lib/search/source-diagnostics'")
    expect(route).not.toContain('type SourceExecutionDiagnostics = {')
  })
})
