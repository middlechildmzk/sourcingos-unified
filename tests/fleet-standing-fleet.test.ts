import { describe, expect, it } from 'vitest'

import {
  evaluateLaneHealth,
  isDue,
  selectDueLanes,
  type StandingIntent,
} from '../lib/fleet/standing-intents'
import {
  createCrawl4AiFetcher,
  isFetchableUrl,
  readMarkdown,
} from '../lib/fleet/fetching/page-fetcher'
import {
  buildCrateOwnerDossier,
  buildNpmMaintainerDossier,
  isHumanCrateOwner,
} from '../lib/fleet/scouts/registry-scout'

const NOW = new Date('2026-09-04T12:00:00.000Z')

function lane(overrides: Partial<StandingIntent> = {}): StandingIntent {
  return {
    id: 'rust-platform',
    label: 'Rust platform engineers',
    hypothesis: 'rust platform engineer',
    capabilityTerms: ['rust', 'tokio'],
    sources: [],
    cadenceMinutes: 360,
    limit: 10,
    creditsPerRun: 10,
    enabled: true,
    lastRunAt: null,
    ...overrides,
  }
}

describe('standing intent scheduler', () => {
  it('treats a never-run lane as due', () => {
    expect(isDue(lane({ lastRunAt: null }), NOW)).toBe(true)
  })

  it('does not run a lane before its cadence has elapsed', () => {
    const recent = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
    expect(isDue(lane({ lastRunAt: recent, cadenceMinutes: 360 }), NOW)).toBe(false)
  })

  it('never runs a disabled or paused lane', () => {
    expect(isDue(lane({ enabled: false }), NOW)).toBe(false)
    expect(isDue(lane({ pausedReason: 'operator paused' }), NOW)).toBe(false)
  })

  it('orders by staleness so a repeatedly deferred lane eventually wins', () => {
    const decision = selectDueLanes({
      now: NOW,
      intents: [
        lane({ id: 'fresh', lastRunAt: new Date(NOW.getTime() - 7 * 60 * 60 * 1000).toISOString() }),
        lane({ id: 'stale', lastRunAt: new Date(NOW.getTime() - 96 * 60 * 60 * 1000).toISOString() }),
      ],
      availableCredits: 100,
      maxLanesPerTick: 1,
    })
    expect(decision.dispatched).toHaveLength(1)
    expect(decision.dispatched[0].intent.id).toBe('stale')
    expect(decision.deferred[0].intentId).toBe('fresh')
  })

  it('defers a lane it cannot fund rather than starting it and halting mid-run', () => {
    const decision = selectDueLanes({
      now: NOW,
      intents: [lane({ id: 'expensive', creditsPerRun: 50 })],
      availableCredits: 10,
      maxLanesPerTick: 5,
    })
    expect(decision.dispatched).toHaveLength(0)
    expect(decision.deferred[0].reason).toContain('50 credits')
    expect(decision.creditsCommitted).toBe(0)
  })

  it('caps fan-out per tick so one tick cannot stampede every source', () => {
    const intents = Array.from({ length: 10 }, (_, i) => lane({ id: `lane-${i}` }))
    const decision = selectDueLanes({
      now: NOW,
      intents,
      availableCredits: 1000,
      maxLanesPerTick: 3,
    })
    expect(decision.dispatched).toHaveLength(3)
    expect(decision.deferred).toHaveLength(7)
  })

  it('commits exactly the credits the dispatched lanes will use', () => {
    const decision = selectDueLanes({
      now: NOW,
      intents: [lane({ id: 'a', creditsPerRun: 10 }), lane({ id: 'b', creditsPerRun: 15 })],
      availableCredits: 100,
      maxLanesPerTick: 5,
    })
    expect(decision.creditsCommitted).toBe(25)
  })

  it('produces a dispatch intent carrying the lane terms', () => {
    const decision = selectDueLanes({
      now: NOW,
      intents: [lane()],
      availableCredits: 100,
      maxLanesPerTick: 1,
    })
    expect(decision.dispatched[0].dispatch.capabilityTerms).toContain('rust')
    expect(decision.dispatched[0].runId).toContain('rust-platform')
  })

  it('recommends pausing a lane that errors or finds nobody repeatedly', () => {
    expect(evaluateLaneHealth({ consecutiveEmptyRuns: 0, consecutiveErrorRuns: 5 })).toContain('source errors')
    expect(evaluateLaneHealth({ consecutiveEmptyRuns: 10, consecutiveErrorRuns: 0 })).toContain('nobody')
    expect(evaluateLaneHealth({ consecutiveEmptyRuns: 2, consecutiveErrorRuns: 1 })).toBeNull()
  })
})

describe('page fetcher', () => {
  it('rejects non-http schemes and credential-bearing URLs', () => {
    expect(isFetchableUrl('https://example.dev/jane')).toBe(true)
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false)
    expect(isFetchableUrl('https://user:secret@example.com')).toBe(false)
    expect(isFetchableUrl('not a url')).toBe(false)
  })

  it('prefers filtered markdown over raw', () => {
    expect(readMarkdown({ markdown: { raw_markdown: 'raw', fit_markdown: 'fit' } })).toBe('fit')
    expect(readMarkdown({ markdown: { raw_markdown: 'raw' } })).toBe('raw')
    expect(readMarkdown({ markdown: 'plain' })).toBe('plain')
  })

  it('reports a robots.txt disallow rather than returning content', async () => {
    const fetcher = createCrawl4AiFetcher({
      baseUrl: 'http://crawler.internal:11235',
      fetchImpl: (async () =>
        new Response(JSON.stringify({ results: [{ status_code: 403, error_message: 'blocked by robots' }] }), {
          status: 200,
        })) as unknown as typeof fetch,
    })
    const outcome = await fetcher.fetch('https://example.dev/jane')
    expect(outcome.kind).toBe('robots_disallowed')
  })

  it('fails closed when robots.txt cannot be read', async () => {
    const fetcher = createCrawl4AiFetcher({
      baseUrl: 'http://crawler.internal:11235',
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ results: [{ success: false, error_message: 'robots.txt fetch timed out' }] }),
          { status: 200 },
        )) as unknown as typeof fetch,
    })
    const outcome = await fetcher.fetch('https://example.dev/jane')
    // The underlying library permits the crawl in this case. The wrapper does not.
    expect(outcome.kind).toBe('robots_unreadable')
  })

  it('sends robots checking on and never sends a proxy or stealth option', async () => {
    let sentBody = ''
    const fetcher = createCrawl4AiFetcher({
      baseUrl: 'http://crawler.internal:11235',
      fetchImpl: (async (_url: string, init: RequestInit) => {
        sentBody = String(init.body)
        return new Response(JSON.stringify({ results: [{ success: true, markdown: '# Jane' }] }), {
          status: 200,
        })
      }) as unknown as typeof fetch,
    })
    const outcome = await fetcher.fetch('https://example.dev/jane')
    expect(outcome.kind).toBe('ok')
    expect(sentBody).toContain('"check_robots_txt":true')
    expect(sentBody).not.toContain('proxy')
    expect(sentBody).not.toContain('undetected')
    expect(sentBody).not.toContain('user_data_dir')
  })
})

describe('registry scout evidence rules', () => {
  it('does not treat a crates.io team owner as a person', () => {
    expect(isHumanCrateOwner({ login: 'github:rust-lang:core', kind: 'team' })).toBe(false)
    expect(isHumanCrateOwner({ login: 'jane', kind: 'user' })).toBe(true)
  })

  it('records download count as a metric and never as a seniority claim', () => {
    const dossier = buildCrateOwnerDossier({
      owner: { login: 'jane', name: 'Jane Okafor', url: 'https://github.com/jane', kind: 'user' },
      crates: [{ name: 'tokio-helper', downloads: 900_000, keywords: ['async'], updated_at: '2026-01-01' }],
      observedAt: NOW.toISOString(),
    })
    expect(dossier).not.toBeNull()
    const metrics = dossier!.artifacts[0].metrics.map(m => m.key)
    expect(metrics).toContain('crate_downloads_total')

    // No seniority claim may appear in any evidence-bearing field. The word is
    // allowed in `limits`, where the point is to say the source cannot support it.
    const evidenceSurface = JSON.stringify({
      person: dossier!.person,
      technologies: dossier!.technologies,
      artifacts: dossier!.artifacts,
    })
    expect(evidenceSurface).not.toMatch(/staff|senior|principal|lead engineer/i)
    expect(dossier!.limits.some(limit => limit.topic === 'Seniority')).toBe(true)
  })

  it('reads Rust from the registry itself, with provenance', () => {
    const dossier = buildCrateOwnerDossier({
      owner: { login: 'jane', url: 'https://github.com/jane', kind: 'user' },
      crates: [{ name: 'tokio-helper', downloads: 10 }],
      observedAt: NOW.toISOString(),
    })
    const rust = dossier!.technologies.find(tech => tech.value === 'Rust')
    expect(rust?.provenance.sourceField).toBe('registry.language')
    expect(rust?.provenance.basis).toBe('observed_artifact')
  })

  it('promotes a registry-published GitHub owner URL to a deterministic anchor', () => {
    const dossier = buildCrateOwnerDossier({
      owner: { login: 'jane', url: 'https://github.com/jane', kind: 'user' },
      crates: [{ name: 'tokio-helper' }],
      observedAt: NOW.toISOString(),
    })
    const anchor = dossier!.anchors.find(item => item.kind === 'github_login')
    expect(anchor?.strength).toBe('deterministic')
    expect(anchor?.normalized).toBe('jane')
  })

  it('uses a published npm maintainer email as an identity anchor', () => {
    const dossier = buildNpmMaintainerDossier({
      maintainer: { username: 'jane', email: 'Jane@Example.com' },
      packages: [{ package: { name: 'left-pad-2', keywords: ['string'] } }],
      observedAt: NOW.toISOString(),
    })
    const anchor = dossier!.anchors.find(item => item.kind === 'public_email')
    expect(anchor?.normalized).toBe('jane@example.com')
    expect(anchor?.strength).toBe('deterministic')
  })

  it('states what the registry could not establish instead of leaving it silent', () => {
    const dossier = buildNpmMaintainerDossier({
      maintainer: { username: 'jane' },
      packages: [{ package: { name: 'left-pad-2' } }],
      observedAt: NOW.toISOString(),
    })
    const topics = dossier!.limits.map(limit => limit.topic)
    expect(topics).toContain('Seniority and employer')
  })
})
