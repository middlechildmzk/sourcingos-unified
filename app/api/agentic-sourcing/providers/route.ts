import 'server-only'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { agentProviderStatusesV36_16 } from '@/lib/agent-data/provider-registry-v36-16'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  const providers = agentProviderStatusesV36_16()
  return NextResponse.json({
    ok: true,
    providers,
    connected: providers.filter(item => item.configured).length,
    executableNow: providers.filter(item => item.executableNow).length,
    trust: {
      secretsExposed: false,
      configuredMeansVerifiedEntitlement: false,
      providerOutputBecomesCandidateFact: false,
      paidActionsAutoExecute: false,
    },
  })
}
