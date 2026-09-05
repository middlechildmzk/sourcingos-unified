import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('server-only', () => ({}))

import {
  buildGitHubRepositoryQuery,
  githubDiscoveryTerms,
  isLikelyBotAccount,
  searchGitHubPeople,
} from '../lib/github-person-discovery'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function response(
  data: unknown,
  status = 200,
  headers: Record<string, string> = { 'x-ratelimit-remaining': '50', 'x-ratelimit-reset': '1785358800' },
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

const request = {
  query: 'Kubernetes Terraform location:"Austin"',
  location: 'Austin',
  sources: ['github' as const],
  limit: 6,
}

const fixedNow = () => new Date('2026-07-29T18:00:00.000Z')

describe('V29.2 GitHub person discovery', () => {
  it('builds a bounded repository query without applying a user-location qualifier to repositories', () => {
    expect(githubDiscoveryTerms(request.query)).toEqual(['Kubernetes', 'Terraform'])
    expect(buildGitHubRepositoryQuery(request.query)).toBe(
      'Kubernetes Terraform in:name,description,readme fork:false archived:false',
    )
    expect(buildGitHubRepositoryQuery('one two three four five six seven')).toBe(
      'one two three four five in:name,description,readme fork:false archived:false',
    )
  })

  it('recognizes common bot-account patterns without treating normal users as bots', () => {
    expect(isLikelyBotAccount('dependabot[bot]')).toBe(true)
    expect(isLikelyBotAccount('renovate-bot')).toBe(true)
    expect(isLikelyBotAccount('release_bot')).toBe(true)
    expect(isLikelyBotAccount('github-actions')).toBe(true)
    expect(isLikelyBotAccount('renovate')).toBe(true)
    expect(isLikelyBotAccount('ada-engineer')).toBe(false)
  })

  it('discovers people through query-relevant repository contributor evidence', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/search/repositories')) {
        return response({
          items: [{
            full_name: 'example/platform-runtime',
            html_url: 'https://github.com/example/platform-runtime',
            description: 'Kubernetes and Terraform platform runtime',
            language: 'Go',
            topics: ['kubernetes', 'terraform'],
            stargazers_count: 240,
            contributors_url: 'https://api.github.com/repos/example/platform-runtime/contributors',
            archived: false,
            fork: false,
          }],
        })
      }
      if (url.includes('/contributors')) {
        return response([
          { login: 'ada-engineer', html_url: 'https://github.com/ada-engineer', type: 'User', contributions: 12 },
          { login: 'dependabot[bot]', html_url: 'https://github.com/apps/dependabot', type: 'Bot', contributions: 200 },
          { login: 'example-org', html_url: 'https://github.com/example-org', type: 'Organization', contributions: 5 },
        ], 200, { 'x-ratelimit-remaining': '48' })
      }
      if (url.endsWith('/users/ada-engineer')) {
        return response({
          login: 'ada-engineer',
          name: 'Ada Engineer',
          html_url: 'https://github.com/ada-engineer',
          type: 'User',
          bio: 'Platform engineer building reliable Kubernetes systems',
          company: 'Example Cloud',
          location: 'Austin, TX',
          blog: 'https://ada.example',
          public_repos: 42,
        }, 200, { 'x-ratelimit-remaining': '47' })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchGitHubPeople(request, { fetchImpl, now: fixedNow, token: '' })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({
      id: 'github:ada-engineer',
      entityKind: 'person',
      displayName: 'Ada Engineer',
      organization: 'Example Cloud',
      location: 'Austin, TX',
    })
    expect(result.results[0].skills).toEqual(expect.arrayContaining(['Kubernetes', 'Terraform', 'Go', 'kubernetes', 'terraform']))
    expect(result.results[0].evidence[0].detail).toContain('12 reported contributions')
    expect(result.results[0].evidence[0].detail).toContain('example/platform-runtime')
    expect(result.results[0].evidence.some(item => item.detail.includes('verified employment'))).toBe(false)
    expect(result.diagnostics).toMatchObject({
      strategy: 'repository_contributors',
      health: 'healthy',
      repositoriesExamined: 1,
      contributorsExamined: 3,
      profilesHydrated: 1,
      personResults: 1,
      skippedBots: 1,
      partial: false,
      rateLimitRemaining: 47,
    })
  })

  it('keeps contributor evidence as a partial person result when profile hydration fails', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/search/repositories')) {
        return response({
          items: [{
            full_name: 'example/data-platform',
            html_url: 'https://github.com/example/data-platform',
            language: 'Python',
            topics: ['data-engineering'],
            stargazers_count: 20,
            contributors_url: 'https://api.github.com/repos/example/data-platform/contributors',
          }],
        })
      }
      if (url.includes('/contributors')) {
        return response([{ login: 'grace-dev', html_url: 'https://github.com/grace-dev', type: 'User', contributions: 7 }])
      }
      if (url.endsWith('/users/grace-dev')) {
        return response({ message: 'Service unavailable' }, 503)
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchGitHubPeople(
      { ...request, query: 'Python data engineering' },
      { fetchImpl, now: fixedNow, token: '' },
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({ id: 'github:grace-dev', entityKind: 'person', displayName: 'grace-dev' })
    expect(result.diagnostics.health).toBe('degraded')
    expect(result.diagnostics.partial).toBe(true)
    expect(result.diagnostics.profilesHydrated).toBe(0)
    expect(result.warnings.join(' ')).toContain('GitHub returned 503')
  })

  it('uses a clearly labelled user-search fallback when repository discovery returns no contributors', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/search/repositories')) return response({ items: [] })
      if (url.includes('/search/users')) {
        return response({ items: [{ login: 'lin-user', html_url: 'https://github.com/lin-user', type: 'User' }] })
      }
      if (url.endsWith('/users/lin-user')) {
        return response({
          login: 'lin-user',
          name: 'Lin User',
          html_url: 'https://github.com/lin-user',
          type: 'User',
          bio: 'Terraform and Kubernetes contributor',
          public_repos: 18,
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })

    const result = await searchGitHubPeople(request, { fetchImpl, now: fixedNow, token: '' })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].displayName).toBe('Lin User')
    expect(result.results[0].evidence[0].label).toBe('Public GitHub profile search match')
    expect(result.results[0].evidence[0].detail).toContain('discovery signal, not verified role fit')
    expect(result.diagnostics.strategy).toBe('user_search_fallback')
    expect(result.diagnostics.repositoriesExamined).toBe(0)
  })

  it('reports rate limiting explicitly and returns no fabricated candidate-shaped result', async () => {
    const fetchImpl = vi.fn(async () => response(
      { message: 'API rate limit exceeded' },
      403,
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1785358800' },
    ))

    const result = await searchGitHubPeople(request, { fetchImpl, now: fixedNow, token: '' })

    expect(result.results).toEqual([])
    expect(result.diagnostics.health).toBe('rate_limited')
    expect(result.diagnostics.rateLimitRemaining).toBe(0)
    expect(result.diagnostics.rateLimitResetAt).toBe(new Date(1785358800 * 1000).toISOString())
    expect(result.warnings.join(' ')).toContain('rate limit reached')
  })

  it('routes the public GitHub lane through the dependable person-discovery boundary', () => {
    const route = read('app/api/workbench/search-source/route.ts')

    expect(route).toContain("import { searchGitHubPeople")
    expect(route).toContain("if (body.source === 'github')")
    expect(route).toContain('diagnostics = githubDiagnostics(response.diagnostics, results)')
    expect(route).toContain('Bot and organization accounts do not enter the GitHub person result set.')
    expect(route).toContain('Repository contribution is a public technical signal, not verified employment or role fit.')
    expect(route).toContain('const connectorResponse = await searchSources')
  })
})
