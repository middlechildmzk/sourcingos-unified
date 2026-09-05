import { describe, expect, it, vi } from 'vitest'
import {
  planGeographyExecutionV35,
  runBoundedGeographyFanoutV35,
} from '@/lib/entity-intelligence/geography-execution-v35'

describe('V35.4 source-aware geography execution', () => {
  it('keeps recruiter anchor first and bounds GitHub market fan-out', () => {
    const plan = planGeographyExecutionV35(
      'github',
      ['Annapolis Junction, MD', 'Fort Meade, MD', 'Columbia, MD', 'Fort Meade, MD'],
      30,
    )

    expect(plan.mode).toBe('bounded_fanout')
    expect(plan.executedLocations).toEqual(['Annapolis Junction, MD', 'Fort Meade, MD'])
    expect(plan.omittedLocations).toEqual(['Columbia, MD'])
    expect(plan.perLocationLimit).toBe(6)
  })

  it('allows a slightly wider bounded ordinary Stack Overflow fan-out', () => {
    const plan = planGeographyExecutionV35(
      'stackoverflow',
      ['Annapolis Junction, MD', 'Fort Meade, MD', 'Columbia, MD', 'Hanover, MD'],
      18,
    )

    expect(plan.executedLocations).toHaveLength(3)
    expect(plan.executedLocations[0]).toBe('Annapolis Junction, MD')
    expect(plan.omittedLocations).toEqual(['Hanover, MD'])
    expect(plan.perLocationLimit).toBe(6)
  })

  it('does not multiply source-agnostic DEV, Hugging Face, or infrastructure Stack Exchange calls', () => {
    for (const source of ['devto', 'huggingface', 'stackexchange_infrastructure'] as const) {
      const plan = planGeographyExecutionV35(source, ['Annapolis Junction, MD', 'Fort Meade, MD'], 20)
      expect(plan.mode).toBe('source_agnostic')
      expect(plan.executedLocations).toEqual([])
      expect(plan.requestedLocations).toHaveLength(2)
    }
  })

  it('passes the full bounded location list once to array-native sources', () => {
    const plan = planGeographyExecutionV35('npi', ['Baltimore, MD', 'Washington, DC'], 20)
    expect(plan.mode).toBe('array_native')
    expect(plan.executedLocations).toEqual(['Baltimore, MD', 'Washington, DC'])
    expect(plan.omittedLocations).toEqual([])
  })

  it('deduplicates people across location executions while preserving anchor-first order', async () => {
    const plan = planGeographyExecutionV35('github', ['Annapolis Junction, MD', 'Fort Meade, MD'], 12)
    const run = vi.fn(async (location: string) => location.startsWith('Annapolis')
      ? [{ id: 'alice' }, { id: 'shared' }]
      : [{ id: 'shared' }, { id: 'bob' }])

    const result = await runBoundedGeographyFanoutV35(plan, run, item => item.id)

    expect(run).toHaveBeenCalledTimes(2)
    expect(result.items.map(item => item.id)).toEqual(['alice', 'shared', 'bob'])
    expect(result.discoveredByLocation).toEqual({
      'Annapolis Junction, MD': 2,
      'Fort Meade, MD': 1,
    })
  })

  it('treats geography as retrieval execution metadata only', () => {
    const plan = planGeographyExecutionV35('github', ['Fort Meade, MD'], 10)
    expect(plan.explanation).toMatch(/recruiter-approved markets|location per technical search/i)
    expect(JSON.stringify(plan)).not.toMatch(/candidate.*residen|verified candidate/i)
  })
})
