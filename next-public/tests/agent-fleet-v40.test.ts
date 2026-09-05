import { describe, expect, it } from 'vitest'
import {
  AGENT_FLEET_PODS_V40,
  AGENT_FLEET_SIZE_V40,
  agentFleetIntegrationStatusV40,
  buildAgentFleetPlanV40,
} from '../lib/agent-fleet-v40'

function plan() {
  return buildAgentFleetPlanV40({ runId: 'weekend-001', objective: 'Review SourcingOS and produce implementation-ready findings.' })
}

describe('V40 50-agent research fleet', () => {
  it('creates exactly 50 tasks, ten per pod', () => {
    const result = plan()
    expect(result.taskCount).toBe(AGENT_FLEET_SIZE_V40)
    expect(result.tasks).toHaveLength(50)
    for (const pod of AGENT_FLEET_PODS_V40) {
      expect(result.tasks.filter(task => task.pod === pod.id)).toHaveLength(10)
    }
    expect(new Set(result.tasks.map(task => task.id)).size).toBe(50)
  })

  it('hard-blocks the production Resume/CV queue', () => {
    expect(() => buildAgentFleetPlanV40({
      runId: 'bad-run',
      objective: 'Do not run',
      scope: 'production_resume_queue',
    })).toThrow('production_resume_queue_blocked_pending_v40_5i_canary')
    expect(plan().tasks.every(task => task.productionResumeQueueAllowed === false)).toBe(true)
  })

  it('keeps every agent read-only and public-evidence-only', () => {
    const result = plan()
    expect(result.tasks.every(task => task.readOnly && task.publicEvidenceOnly)).toBe(true)
    expect(result.guardrails.some(rule => rule.includes('Do not scrape LinkedIn'))).toBe(true)
    expect(result.guardrails.some(rule => rule.includes('Do not merge ambiguous identities'))).toBe(true)
  })

  it('reports integration availability without secret values', () => {
    const status = agentFleetIntegrationStatusV40({
      EXA_API_KEY: 'secret-exa',
      VERCEL_EXA_EXA_API_KEY: 'secret-vercel-exa',
      FIRECRAWL_API_KEY: 'secret-firecrawl',
      PARALLEL_API_KEY: 'secret-parallel',
      INNGEST_EVENT_KEY: 'secret-inngest',
      INNGEST_SIGNING_KEY: 'secret-signing',
      AGENT_FLEET_ENABLED: 'true',
      AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED: 'false',
    })
    expect(status.exaBaseline.configured).toBe(true)
    expect(status.exaVercel.configured).toBe(true)
    expect(status.firecrawl.configured).toBe(true)
    expect(status.parallel.configured).toBe(true)
    expect(status.inngest.eventKeyConfigured).toBe(true)
    expect(JSON.stringify(status)).not.toContain('secret-')
    expect(status.providerBenchmarkEnabled).toBe(false)
    expect(status.productionResumeQueueAllowed).toBe(false)
  })
})
