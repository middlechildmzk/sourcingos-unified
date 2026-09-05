import 'server-only'
import type { AgentFleetPlanV40 } from './agent-fleet-v40'

const INNGEST_EVENT_ENDPOINT = 'https://inn.gs/e'

export type InngestFleetDispatchV40 = {
  status: 'sent' | 'disabled' | 'unavailable' | 'failed'
  eventCount: number
  ids: string[]
  error?: string
}

export async function dispatchAgentFleetPlanToInngestV40(plan: AgentFleetPlanV40): Promise<InngestFleetDispatchV40> {
  if (process.env.AGENT_FLEET_ENABLED !== 'true') return { status: 'disabled', eventCount: 0, ids: [] }
  if (plan.scope !== 'research_only' || plan.tasks.some(task => task.productionResumeQueueAllowed !== false)) {
    return { status: 'failed', eventCount: 0, ids: [], error: 'production_resume_queue_blocked_pending_v40_5i_canary' }
  }

  const eventKey = process.env.INNGEST_EVENT_KEY?.trim()
  if (!eventKey) return { status: 'unavailable', eventCount: 0, ids: [], error: 'inngest_event_key_missing' }

  const events = plan.tasks.map(task => ({
    id: task.id,
    name: 'sourcingos/agent-fleet.task.requested',
    data: {
      version: plan.version,
      runId: plan.runId,
      taskId: task.id,
      ordinal: task.ordinal,
      pod: task.pod,
      podLabel: task.podLabel,
      agentNumber: task.agentNumber,
      objective: task.objective,
      prompt: task.prompt,
      readOnly: true,
      publicEvidenceOnly: true,
      productionResumeQueueAllowed: false,
    },
  }))

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim()
    if (branch && branch !== 'main') headers['x-inngest-env'] = branch
    const response = await fetch(`${INNGEST_EVENT_ENDPOINT}/${encodeURIComponent(eventKey)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(events),
      cache: 'no-store',
    })
    if (!response.ok) return { status: 'failed', eventCount: 0, ids: [], error: `inngest_http_${response.status}` }
    const json = await response.json() as { ids?: unknown }
    const ids = Array.isArray(json.ids) ? json.ids.filter((value): value is string => typeof value === 'string') : []
    return { status: 'sent', eventCount: events.length, ids }
  } catch {
    return { status: 'failed', eventCount: 0, ids: [], error: 'inngest_request_failed' }
  }
}
