import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-gate'
import { agentFleetIntegrationStatusV40 } from '@/lib/agent-fleet-v40'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  return NextResponse.json({
    ok: true,
    version: 'v40.agent-fleet-50',
    integrations: agentFleetIntegrationStatusV40(process.env),
    safety: {
      mode: 'research_only',
      maxAgentsPerRun: 50,
      productionResumeQueueAllowed: false,
      v40_5iCanaryUnaffected: true,
      secretsReturned: false,
    },
  })
}
