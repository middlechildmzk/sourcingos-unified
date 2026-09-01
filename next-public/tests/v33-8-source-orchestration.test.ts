import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  connectorKeysForSurface,
  sourceDistribution,
  sourceDiverseResults,
  telemetryForSurface,
} from '@/lib/source-orchestration-v33-8'

const here = dirname(fileURLToPath(import.meta.url))

type Item = { sourceKey: string; id: string; rank: number }

function items(sourceKey: string, count: number): Item[] {
  return Array.from({ length: count }, (_, index) => ({
    sourceKey,
    id: `${sourceKey}-${index + 1}`,
    rank: index + 1,
  }))
}

describe('V33.8 source orchestration', () => {
  it('gives every contributing selected source a chance before the global cap', () => {
    const input = [
      ...items('github', 20),
      ...items('stackoverflow', 20),
      ...items('devto', 4),
      ...items('huggingface', 4),
    ]

    const results = sourceDiverseResults(input, 12, ['github', 'stackoverflow', 'devto', 'huggingface'])
    const distribution = sourceDistribution(results)

    expect(results).toHaveLength(12)
    expect(distribution.github).toBeGreaterThan(0)
    expect(distribution.stackoverflow).toBeGreaterThan(0)
    expect(distribution.devto).toBeGreaterThan(0)
    expect(distribution.huggingface).toBeGreaterThan(0)
  })

  it('preserves each connector ranking while interleaving sources', () => {
    const results = sourceDiverseResults([
      ...items('github', 5),
      ...items('devto', 3),
    ], 6, ['github', 'devto'])

    expect(results.map(result => result.id)).toEqual([
      'github-1', 'devto-1',
      'github-2', 'devto-2',
      'github-3', 'devto-3',
    ])
  })

  it('maps DEV and Hugging Face to their real connector keys for attempt telemetry', () => {
    expect(Array.from(connectorKeysForSurface('devto'))).toEqual(['devto'])
    expect(Array.from(connectorKeysForSurface('huggingface'))).toEqual(['huggingface'])
    expect(Array.from(connectorKeysForSurface('research_publications'))).toEqual(['orcid', 'openalex', 'pubmed', 'crossref'])
  })

  it('projects multi-source execution telemetry onto the correct search-memory surface', () => {
    const response = {
      sourceStatus: {
        github: { status: 'completed' as const, discovered: 18 },
        devto: { status: 'completed' as const, discovered: 7 },
        huggingface: { status: 'completed' as const, discovered: 5 },
      },
      sourceDistribution: { github: 10, devto: 4, huggingface: 3 },
      orchestration: {
        strategy: 'source_diverse_round_robin',
        requestedSources: ['github', 'devto', 'huggingface'] as const,
        contributingSources: ['github', 'devto', 'huggingface'] as const,
        globalLimit: 30,
      },
    }

    expect(telemetryForSurface('devto', response)).toEqual({
      discoveredBeforeCap: 7,
      returnedAfterCap: 4,
      requestedSources: ['devto'],
      contributingSources: ['devto'],
      sourceDistribution: { devto: 4 },
      globalLimit: 30,
      strategy: 'source_diverse_round_robin',
    })
    expect(telemetryForSurface('huggingface', response).returnedAfterCap).toBe(3)
  })

  it('uses the canonical surface mapping in both recruiter execution clients', () => {
    for (const file of ['RoleSourcingAgentV33_3.tsx', 'RoleAgenticSearchPanel.tsx']) {
      const source = readFileSync(join(here, `../components/${file}`), 'utf8')
      expect(source).toContain('connectorKeysForSurface')
      expect(source).toContain('telemetryForSurface')
      expect(source).toContain('discoveredBeforeCap')
      expect(source).not.toContain('function connectorsForSurface')
    }
  })

  it('applies the cap after connector execution rather than breaking on the first full source', () => {
    const source = readFileSync(join(here, '../app/api/agentic-search/route.ts'), 'utf8')
    expect(source).toContain('const allResults: ReturnType<typeof safeDiscovery>[] = []')
    expect(source).toContain('const results = sourceDiverseResults(allResults, body.limit, body.connectors)')
    expect(source).toContain('discoveredBeforeCap: allResults.length')
    expect(source).not.toContain('if (results.length >= body.limit) break')
  })
})
