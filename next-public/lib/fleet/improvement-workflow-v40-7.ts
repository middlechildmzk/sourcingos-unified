import {
  FLEET_IMPROVEMENT_AGENTS_V40_7,
  isProtectedFleetTargetV40_7,
  type FleetImprovementAgentV40_7,
  type FleetImprovementPodIdV40_7,
} from './governance-v40-7'

export type FleetWorkModeV40_7 = 'research' | 'review' | 'implementation' | 'qa'

export type FleetWorkItemV40_7 = {
  id: string
  program: 'v40.7-governed-50-agent-fleet'
  agentId: string
  pod: FleetImprovementPodIdV40_7
  seat: number
  workstream: string
  mode: FleetWorkModeV40_7
  target: string
  contextRefs: readonly string[]
  constraints: {
    productionWriteAllowed: false
    resumeSprintQueueAccess: false
    autonomousOutreachAllowed: false
    silentIdentityMergeAllowed: false
    authenticatedScrapingAllowed: false
    paidProviderPurchaseAllowed: false
  }
}

export type FleetWorkBatchV40_7 = {
  batchId: string
  createdAt: string
  items: readonly FleetWorkItemV40_7[]
  concurrency: {
    total: 50
    perPod: 10
  }
}

function modeFor(agent: FleetImprovementAgentV40_7): FleetWorkModeV40_7 {
  if (agent.pod === 'product_engineering') return 'implementation'
  if (agent.pod === 'qa_red_team') return 'qa'
  if (agent.pod === 'recruiter_ux') return 'review'
  return 'research'
}

export function createImprovementFleetBatchV40_7(input: {
  batchId: string
  target: string
  createdAt?: string
  contextRefs?: readonly string[]
}): FleetWorkBatchV40_7 {
  const batchId = String(input.batchId || '').trim()
  const target = String(input.target || '').trim()
  if (!batchId) throw new Error('V40.7 fleet batch requires a batchId.')
  if (!target) throw new Error('V40.7 fleet batch requires a target.')
  if (isProtectedFleetTargetV40_7(target)) {
    throw new Error(`V40.7 fleet target is protected from the 50-agent improvement fleet: ${target}`)
  }

  const createdAt = input.createdAt || new Date().toISOString()
  const contextRefs = [...(input.contextRefs || [])]

  const items = FLEET_IMPROVEMENT_AGENTS_V40_7.map(agent => ({
    id: `${batchId}:${agent.id}`,
    program: 'v40.7-governed-50-agent-fleet' as const,
    agentId: agent.id,
    pod: agent.pod,
    seat: agent.seat,
    workstream: agent.workstream,
    mode: modeFor(agent),
    target,
    contextRefs,
    constraints: {
      productionWriteAllowed: false as const,
      resumeSprintQueueAccess: false as const,
      autonomousOutreachAllowed: false as const,
      silentIdentityMergeAllowed: false as const,
      authenticatedScrapingAllowed: false as const,
      paidProviderPurchaseAllowed: false as const,
    },
  }))

  return {
    batchId,
    createdAt,
    items,
    concurrency: {
      total: 50,
      perPod: 10,
    },
  }
}

/**
 * Framework-neutral event envelope. Inngest, QStash, or another durable adapter
 * may transport this object later without changing the core fleet contract.
 */
export function fleetWorkEventV40_7(item: FleetWorkItemV40_7) {
  return {
    name: 'sourcingos/fleet.v40_7.work.requested' as const,
    data: item,
  }
}

export function fleetWorkCompletionEventV40_7(input: {
  item: FleetWorkItemV40_7
  status: 'completed' | 'blocked' | 'failed'
  summary: string
  findings?: readonly string[]
  artifactRefs?: readonly string[]
}) {
  return {
    name: 'sourcingos/fleet.v40_7.work.completed' as const,
    data: {
      itemId: input.item.id,
      batchId: input.item.id.split(':')[0],
      agentId: input.item.agentId,
      pod: input.item.pod,
      status: input.status,
      summary: input.summary,
      findings: [...(input.findings || [])],
      artifactRefs: [...(input.artifactRefs || [])],
    },
  }
}
