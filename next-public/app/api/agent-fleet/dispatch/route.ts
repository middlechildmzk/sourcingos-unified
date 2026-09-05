import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-gate'
import { buildAgentFleetPlanV40 } from '@/lib/agent-fleet-v40'
import { dispatchAgentFleetPlanToInngestV40 } from '@/lib/inngest-agent-fleet-bridge-v40'

export const dynamic = 'force-dynamic'

type Body = {
  runId?: unknown
  objective?: unknown
  sharedContext?: unknown
  scope?: unknown
}

function value(input: unknown, max: number): string {
  return typeof input === 'string' ? input.trim().slice(0, max) : ''
}

export async function POST(request: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  if (process.env.AGENT_FLEET_ENABLED !== 'true') {
    return NextResponse.json({ ok: false, code: 'fleet_disabled', error: 'Set AGENT_FLEET_ENABLED=true only for a controlled research run.' }, { status: 409 })
  }

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json' }, { status: 400 })
  }

  if (body.scope === 'production_resume_queue' || process.env.AGENT_FLEET_ALLOW_PRODUCTION_RESUME_QUEUE === 'true') {
    return NextResponse.json({
      ok: false,
      code: 'production_resume_queue_blocked_pending_v40_5i_canary',
      error: 'The 50-agent fleet cannot touch the V40.5i production Resume/CV queue in this release.',
    }, { status: 403 })
  }

  try {
    const plan = buildAgentFleetPlanV40({
      runId: value(body.runId, 96) || `fleet-${Date.now()}`,
      objective: value(body.objective, 4000),
      sharedContext: value(body.sharedContext, 12000),
      scope: 'research_only',
    })
    const dispatch = await dispatchAgentFleetPlanToInngestV40(plan)
    const ok = dispatch.status === 'sent'
    return NextResponse.json({
      ok,
      version: plan.version,
      runId: plan.runId,
      taskCount: plan.taskCount,
      pods: 5,
      agentsPerPod: plan.agentsPerPod,
      dispatch,
      note: 'This control-plane release sends the 50 bounded research tasks to the connected Inngest environment. Provider tournament calls remain disabled unless AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED=true. The V40.5i production Resume/CV queue is not touched.',
    }, { status: ok ? 202 : 503 })
  } catch (error) {
    return NextResponse.json({ ok: false, code: error instanceof Error ? error.message : 'fleet_plan_failed' }, { status: 400 })
  }
}
