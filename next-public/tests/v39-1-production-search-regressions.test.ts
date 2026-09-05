import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCandidateDataSearchV36_8 } from '@/lib/candidate-data/orchestrator-v36-8'
import { classifyProviderHealthV38 } from '@/lib/search-quality/provider-health-v38'
import type { CandidateDataSearchAdapterV36_8 } from '@/lib/candidate-data/types-v36-8'

const rhelRequest = {
  query: 'RHEL administrator near Annapolis Junction with Secret clearance',
  requirements: [
    { text: 'RHEL', mustHave: true },
    { text: 'Secret clearance or higher — verification required', mustHave: true },
  ],
  titles: ['RHEL Administrator'],
  skills: ['RHEL'],
  locations: ['Annapolis Junction, MD'],
  limit: 10,
}

describe('V39.1 production search regressions', () => {
  it('terminalizes one stalled provider without holding the retained slate hostage', async () => {
    const adapters: CandidateDataSearchAdapterV36_8[] = [
      {
        provider: 'pearch',
        search: async () => new Promise<never>(() => {}),
      },
      {
        provider: 'exa',
        search: async () => ({
          observations: [{
            provider: 'exa' as const,
            providerPersonId: 'exa-rhel-1',
            displayName: 'RHEL Example',
            currentTitle: 'RHEL Administrator',
            skills: ['RHEL'],
            profileUrls: [],
            contactAvailability: { email: 'unknown' as const, phone: 'unknown' as const },
            observedAt: '2026-09-04T18:00:00.000Z',
          }],
          telemetry: { provider: 'exa' as const, status: 'completed' as const, discovered: 1, latencyMs: 2 },
          warnings: [],
        }),
      },
    ]

    const result = await runCandidateDataSearchV36_8(rhelRequest, adapters, 10, undefined, 15)

    expect(result.observations).toHaveLength(1)
    expect(result.observations[0]?.provider).toBe('exa')
    expect(result.telemetry.find(item => item.provider === 'pearch')).toMatchObject({
      status: 'failed',
      discovered: 0,
      latencyMs: 15,
    })
    expect(result.telemetry.find(item => item.provider === 'pearch')?.message).toContain('timed out')
    expect(result.warnings.some(item => item.includes('pearch timed out'))).toBe(true)
  })

  it('classifies a provider deadline as TIMEOUT rather than zero results or a generic failure', () => {
    expect(classifyProviderHealthV38({
      provider: 'pearch',
      status: 'failed',
      discovered: 0,
      latencyMs: 25_000,
      message: 'Provider timed out after 25000ms; other provider results were allowed to complete.',
    })).toBe('TIMEOUT')
  })

  it('keeps known-person lookup out of the role planner while exact identifiers fail closed', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/PersonLookupV38_4.tsx'), 'utf8')
    expect(source).toContain("fetch('/api/candidate-data/search'")
    expect(source).not.toContain("fetch('/api/agent-runtime/plan'")
    expect(source).toContain('liveKnownPersonSearchPayloadV41_1(value)')
    expect(source).toContain('/api/candidate-db/exact-identifier')
    expect(source).toContain('/api/candidate-db/list')
    expect(source).toContain('if (candidates.length === 0) await searchLiveForValue(value)')
    expect(source).toContain("'Refresh live sources'")
    expect(source).not.toContain('/confirm-merge')
  })
})
