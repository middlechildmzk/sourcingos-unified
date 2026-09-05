import { describe, expect, it } from 'vitest'
import {
  FLEET_CAPABILITIES_V40_7,
  FLEET_IMPROVEMENT_AGENTS_V40_7,
  FLEET_IMPROVEMENT_PODS_V40_7,
  experimentalProviderFlagsV40_7,
  isProtectedFleetTargetV40_7,
} from '@/lib/fleet/governance-v40-7'
import { createImprovementFleetBatchV40_7 } from '@/lib/fleet/improvement-workflow-v40-7'

describe('V40.7 governed 50-agent capability fleet', () => {
  it('defines exactly five ten-seat pods and fifty unique improvement agents', () => {
    expect(FLEET_IMPROVEMENT_PODS_V40_7).toHaveLength(5)
    for (const pod of FLEET_IMPROVEMENT_PODS_V40_7) {
      expect(pod.seats).toBe(10)
      expect(pod.workstreams).toHaveLength(10)
    }

    expect(FLEET_IMPROVEMENT_AGENTS_V40_7).toHaveLength(50)
    expect(new Set(FLEET_IMPROVEMENT_AGENTS_V40_7.map(agent => agent.id)).size).toBe(50)
  })

  it('keeps experimental provider flags closed unless both global and provider flags are true', () => {
    expect(experimentalProviderFlagsV40_7({})).toEqual({
      firecrawl: false,
      parallel: false,
      tavily: false,
      apify: false,
    })

    expect(experimentalProviderFlagsV40_7({
      AGENT_FLEET_EXPERIMENTAL_PROVIDERS: 'true',
      AGENT_FLEET_PROVIDER_FIRECRAWL: 'true',
    })).toEqual({
      firecrawl: true,
      parallel: false,
      tavily: false,
      apify: false,
    })

    expect(experimentalProviderFlagsV40_7({
      AGENT_FLEET_PROVIDER_FIRECRAWL: 'true',
    }).firecrawl).toBe(false)
  })

  it('blocks Resume/CV production release targets from the improvement fleet', () => {
    expect(isProtectedFleetTargetV40_7('/api/cron/resume-sprint')).toBe(true)
    expect(isProtectedFleetTargetV40_7('claim_resume_sprint_tasks_v40_5_atomic')).toBe(true)
    expect(isProtectedFleetTargetV40_7('RESUME_SPRINT_RELEASE_MODE=scaled')).toBe(true)
    expect(isProtectedFleetTargetV40_7('/app/search')).toBe(false)

    expect(() => createImprovementFleetBatchV40_7({
      batchId: 'weekend-1',
      target: '/api/cron/resume-sprint',
    })).toThrow(/protected/)
  })

  it('creates fifty queue-ready work items with no production authority', () => {
    const batch = createImprovementFleetBatchV40_7({
      batchId: 'weekend-1',
      target: 'issue-172-v40-6-workbench',
      createdAt: '2026-09-05T17:00:00.000Z',
      contextRefs: ['issue:#171', 'issue:#172', 'issue:#173'],
    })

    expect(batch.items).toHaveLength(50)
    expect(batch.concurrency).toEqual({ total: 50, perPod: 10 })
    for (const item of batch.items) {
      expect(item.constraints.productionWriteAllowed).toBe(false)
      expect(item.constraints.resumeSprintQueueAccess).toBe(false)
      expect(item.constraints.autonomousOutreachAllowed).toBe(false)
      expect(item.constraints.silentIdentityMergeAllowed).toBe(false)
      expect(item.constraints.authenticatedScrapingAllowed).toBe(false)
      expect(item.constraints.paidProviderPurchaseAllowed).toBe(false)
    }
  })

  it('keeps LinkedIn/account-gated scraping blocked even when Apify is staged', () => {
    const apify = FLEET_CAPABILITIES_V40_7.find(item => item.id === 'apify')
    const linkedin = FLEET_CAPABILITIES_V40_7.find(item => item.id === 'linkedin_scraping')

    expect(apify?.publicOnly).toBe(true)
    expect(apify?.activation).toBe('preview_challenger')
    expect(linkedin?.activation).toBe('blocked')
  })
})
