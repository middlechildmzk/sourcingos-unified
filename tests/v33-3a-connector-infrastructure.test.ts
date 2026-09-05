import { describe, expect, it } from 'vitest'

import { newRunReport, discoveryIntent } from '../lib/connectors/contract-v33-3'
import {
  ConnectorRequestLedger,
  SourceRequestError,
  mapWithConcurrency,
} from '../lib/connectors/request-ledger-v33-3'
import { buildGitHubDossier, buildGitHubRepositorySearch, fetchGitHubDossier, isPersonalDomain } from '../lib/connectors/github-v2'
import { buildStackOverflowDossier } from '../lib/connectors/stackoverflow-v2'
import { summarizeSourceQuality, uniqueContributionBySource } from '../lib/connectors/source-quality-v33-3'
import { caseAGitHub, caseAStackOverflow, caseCGitHub } from './fixtures/v33-3a-technical-talent-graph'

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('V33.3A request ledger', () => {
  it('serves repeat requests from cache instead of the network', async () => {
    let calls = 0
    const report = newRunReport('github')
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'github',
      report,
      fetchImpl: async () => {
        calls += 1
        return jsonResponse({ ok: true }, { 'x-ratelimit-remaining': '4321' })
      },
    })

    await ledger.json('key', 'https://api.github.com/users/a')
    await ledger.json('key', 'https://api.github.com/users/a')

    expect(calls).toBe(1)
    expect(report.requestsAttempted).toBe(1)
    expect(report.requestsServedFromCache).toBe(1)
  })

  it('deduplicates concurrent requests for the same key', async () => {
    let calls = 0
    const report = newRunReport('github')
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'github',
      report,
      fetchImpl: async () => {
        calls += 1
        await new Promise(resolve => setTimeout(resolve, 5))
        return jsonResponse({ ok: true })
      },
    })

    await Promise.all([
      ledger.json('same', 'https://api.github.com/users/a'),
      ledger.json('same', 'https://api.github.com/users/a'),
      ledger.json('same', 'https://api.github.com/users/a'),
    ])

    expect(calls).toBe(1)
    expect(report.requestsDeduplicated).toBe(2)
  })

  it('stops at the run request budget and marks the run partial', async () => {
    const report = newRunReport('stackoverflow')
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'stackoverflow',
      report,
      maxRequests: 2,
      fetchImpl: async () => jsonResponse({ ok: true }),
    })

    await ledger.json('a', 'https://api.stackexchange.com/2.3/a')
    await ledger.json('b', 'https://api.stackexchange.com/2.3/b')
    await expect(ledger.json('c', 'https://api.stackexchange.com/2.3/c')).rejects.toBeInstanceOf(SourceRequestError)
    expect(report.partial).toBe(true)
  })

  it('records the lowest observed quota and any requested backoff', async () => {
    const report = newRunReport('stackoverflow')
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'stackoverflow',
      report,
      fetchImpl: async () => jsonResponse({ quota_remaining: 120, backoff: 8, items: [] }),
    })

    await ledger.json('q', 'https://api.stackexchange.com/2.3/x', {
      inspect: payload => {
        const envelope = payload as { quota_remaining?: number; backoff?: number }
        ledger.noteQuota(envelope.quota_remaining ?? null)
        if (envelope.backoff) ledger.noteBackoff(envelope.backoff)
      },
    })

    expect(report.quotaRemaining).toBe(120)
    expect(report.backoffSeconds).toBe(8)
    expect(report.partial).toBe(true)
  })

  it('counts API errors without throwing away the rest of the run', async () => {
    const report = newRunReport('github')
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'github',
      report,
      fetchImpl: async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
    })

    await expect(ledger.json('x', 'https://api.github.com/x')).rejects.toBeInstanceOf(SourceRequestError)
    expect(report.apiErrors).toBe(1)
  })

  it('bounds concurrency while preserving result order', async () => {
    let inFlight = 0
    let peak = 0
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async value => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise(resolve => setTimeout(resolve, 3))
      inFlight -= 1
      return value * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50, 60])
    expect(peak).toBeLessThanOrEqual(2)
  })
})

describe('V33.3A GitHub fetch orchestration', () => {
  it('falls back to REST without a token and states that contributions are unknown', async () => {
    const report = newRunReport('github')
    const urls: string[] = []
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'github',
      report,
      fetchImpl: async input => {
        const url = String(input)
        urls.push(url)
        if (url.includes('/users/janesmith/repos')) return jsonResponse(caseAGitHub.repositories)
        if (url.includes('/users/janesmith')) return jsonResponse(caseAGitHub.user)
        return jsonResponse({})
      },
    })

    const dossier = await fetchGitHubDossier('janesmith', { ledger, observedAt: '2026-08-31T12:00:00.000Z' })

    expect(dossier).not.toBeNull()
    expect(urls.every(url => !url.includes('/graphql'))).toBe(true)
    const contributionLimit = dossier!.limits.find(limit => limit.topic === 'contribution history')
    expect(contributionLimit?.explanation).toContain('Treat contribution volume as unknown, not as zero.')
  })

  it('uses a single GraphQL request when a token is present', async () => {
    const report = newRunReport('github')
    let graphqlCalls = 0
    const ledger = new ConnectorRequestLedger({
      sourceKey: 'github',
      report,
      fetchImpl: async input => {
        if (String(input).includes('/graphql')) {
          graphqlCalls += 1
          return jsonResponse({
            data: {
              user: {
                login: 'janesmith',
                name: 'Jane Smith',
                websiteUrl: 'https://jane.dev',
                url: 'https://github.com/janesmith',
                createdAt: '2016-02-01T00:00:00Z',
                socialAccounts: { nodes: [] },
                organizations: { nodes: [] },
                repositories: {
                  nodes: [
                    {
                      databaseId: 11,
                      name: 'helm-operator',
                      nameWithOwner: 'janesmith/helm-operator',
                      url: 'https://github.com/janesmith/helm-operator',
                      description: 'A Kubernetes operator packaged with Helm.',
                      isFork: false,
                      isArchived: false,
                      stargazerCount: 240,
                      forkCount: 12,
                      pushedAt: '2026-06-01T00:00:00Z',
                      primaryLanguage: { name: 'Go' },
                      languages: { edges: [{ size: 90000, node: { name: 'Go' } }] },
                      repositoryTopics: { nodes: [{ topic: { name: 'kubernetes' } }] },
                      owner: { login: 'janesmith' },
                    },
                  ],
                },
                contributionsCollection: {
                  contributionYears: [2025, 2026],
                  totalCommitContributions: 400,
                  commitContributionsByRepository: [],
                },
              },
            },
          })
        }
        throw new Error(`unexpected REST call to ${String(input)}`)
      },
    })

    const dossier = await fetchGitHubDossier('janesmith', { ledger, token: 'test-token' })

    expect(graphqlCalls).toBe(1)
    expect(report.requestsAttempted).toBe(1)
    expect(dossier!.technologies.map(item => item.value)).toEqual(expect.arrayContaining(['Go', 'kubernetes']))
    expect(dossier!.activity.activeYears).toContain(2026)
  })

  it('builds a repository search string without leaking role noise into it', () => {
    const query = buildGitHubRepositorySearch(
      discoveryIntent({
        hypothesis: 'Senior staff platform engineer',
        capabilityTerms: ['kubernetes', 'terraform'],
        limit: 5,
      }),
    )
    expect(query).toContain('kubernetes')
    expect(query).toContain('fork:false')
    expect(query).not.toContain('senior')
    expect(query).not.toContain('engineer')
  })

  it('excludes shared code hosts from personal-domain classification', () => {
    expect(isPersonalDomain('jane.dev')).toBe(true)
    expect(isPersonalDomain('github.com')).toBe(false)
    expect(isPersonalDomain('jane.github.io')).toBe(false)
    expect(isPersonalDomain('linkedin.com')).toBe(false)
  })
})

describe('V33.3A source quality telemetry', () => {
  it('measures coverage and cost without inventing recruiter labels', () => {
    const report = newRunReport('github')
    report.requestsAttempted = 12
    report.requestsServedFromCache = 4
    report.durationMs = 950

    const metrics = summarizeSourceQuality({
      report,
      dossiers: [buildGitHubDossier(caseAGitHub)!, buildGitHubDossier(caseCGitHub)!],
    })

    expect(metrics.peopleDiscovered).toBe(2)
    expect(metrics.duplicateRate).toBe(0)
    expect(metrics.evidenceCoverage).toBe(1)
    expect(metrics.unsupportedClaimCount).toBe(0)
    expect(metrics.cacheHitRate).toBe(0.25)
    expect(metrics.apiCallsPerUsefulCandidate).toBe(6)

    // No labels means no acceptance rate. Unreviewed is not rejected.
    expect(metrics.recruiterReviewed).toBeNull()
    expect(metrics.recruiterAccepted).toBeNull()
    expect(metrics.recruiterAcceptanceRate).toBeNull()
  })

  it('reports a real acceptance rate once labels exist', () => {
    const metrics = summarizeSourceQuality({
      report: newRunReport('stackoverflow'),
      dossiers: [buildStackOverflowDossier(caseAStackOverflow)!],
      labels: { reviewed: 8, accepted: 3 },
    })
    expect(metrics.recruiterAcceptanceRate).toBe(0.375)
  })

  it('credits unique contribution only through deterministic anchors', () => {
    const contribution = uniqueContributionBySource([
      buildGitHubDossier(caseAGitHub)!,
      buildStackOverflowDossier(caseAStackOverflow)!,
      buildGitHubDossier(caseCGitHub)!,
    ])

    // Jane appears on both sources and shares the jane.dev anchor, so neither
    // source gets to claim her as a unique contribution.
    expect(contribution.github.discovered).toBe(2)
    expect(contribution.github.uniqueByAnchor).toBe(1)
    expect(contribution.stackoverflow.uniqueByAnchor).toBe(0)
  })
})
