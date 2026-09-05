import { describe, expect, it } from 'vitest'
import { createImprovementFleetBatchV40_7 } from '@/lib/fleet/improvement-workflow-v40-7'

describe('V40.7c staged fleet activation invariants', () => {
  it('has ten Search Intelligence seats available for provider rotation', () => {
    const batch = createImprovementFleetBatchV40_7({
      batchId: 'test-v40-7c',
      target: 'Validate governed fleet activation.',
      contextRefs: ['#171', '#172'],
    })
    const searchSeats = batch.items.filter(item => item.pod === 'search_intelligence')
    expect(searchSeats).toHaveLength(10)
    expect(searchSeats.map(item => item.seat)).toEqual([1,2,3,4,5,6,7,8,9,10])
    expect(batch.items).toHaveLength(50)
  })
})
