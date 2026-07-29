import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  diagnosticsHealthLabel,
  diagnosticsStrategyLabel,
  publishSourceDiagnostics,
  subscribeSourceDiagnostics,
  type SourceExecutionDiagnostics,
} from '../lib/search/source-diagnostics'
import { fetchWithTimeout } from '../lib/search/source-timeout'

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

const diagnostics: SourceExecutionDiagnostics = {
  source: 'github',
  strategy: 'repository_contributors',
  health: 'degraded',
  effectiveQuery: 'kubernetes terraform in:name,description,readme',
  durationMs: 1450,
  resultCount: 3,
  personCount: 3,
  nonPersonCount: 0,
  partial: true,
  repositoriesExamined: 2,
  contributorsExamined: 11,
  profilesHydrated: 2,
  skippedBots: 1,
  rateLimitRemaining: 42,
  warnings: ['One profile request failed.'],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('V29.2 source execution diagnostics', () => {
  it('publishes only valid typed source diagnostics and supports unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSourceDiagnostics(listener)

    publishSourceDiagnostics({ source: 'github' })
    expect(listener).not.toHaveBeenCalled()

    publishSourceDiagnostics(diagnostics)
    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith(diagnostics)

    unsubscribe()
    publishSourceDiagnostics({ ...diagnostics, health: 'healthy' })
    expect(listener).toHaveBeenCalledOnce()
  })

  it('uses recruiter-readable strategy and health labels', () => {
    expect(diagnosticsStrategyLabel('repository_contributors')).toBe('Repository contributors')
    expect(diagnosticsStrategyLabel('user_search_fallback')).toBe('User-search fallback')
    expect(diagnosticsStrategyLabel('source_connector')).toBe('Source connector')
    expect(diagnosticsHealthLabel('rate_limited')).toBe('Rate limited')
    expect(diagnosticsHealthLabel('degraded')).toBe('Degraded')
  })

  it('publishes API diagnostics and warnings after a successful source request', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSourceDiagnostics(listener)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      source: 'github',
      diagnostics: { ...diagnostics, warnings: undefined },
      warnings: ['Profile hydration was partial.'],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })))

    const result = await fetchWithTimeout(
      '/api/workbench/search-source',
      { source: 'github', query: 'kubernetes' },
      1000,
    )

    expect(result.timedOut).toBe(false)
    expect(result.cancelled).toBe(false)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      source: 'github',
      strategy: 'repository_contributors',
      warnings: ['Profile hydration was partial.'],
    }))
    unsubscribe()
  })

  it('keeps source details collapsed and secondary to candidate results', () => {
    const component = read('components/SourceLaneStatus.tsx')
    const workbench = read('components/WorkbenchClient.tsx')

    expect(component).toContain('<details className="lane-status-disclosure">')
    expect(component).not.toContain('<details className="lane-status-disclosure" open')
    expect(component).toContain('Source details')
    expect(component).toContain('Repository contributors')
    expect(component).toContain('non-person subjects excluded from candidate counts')
    expect(component).toContain('Partial source execution. Review warnings before relying on coverage.')
    expect(workbench.indexOf('<WorkbenchResults')).toBeLessThan(workbench.indexOf('<SourceLaneStatus'))
  })
})
