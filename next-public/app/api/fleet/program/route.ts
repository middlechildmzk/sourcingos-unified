import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import {
  FLEET_CAPABILITIES_V40_7,
  FLEET_IMPROVEMENT_AGENTS_V40_7,
  FLEET_IMPROVEMENT_PODS_V40_7,
  experimentalProviderFlagsV40_7,
  fleetCapabilitySummaryV40_7,
} from '@/lib/fleet/governance-v40-7'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  return NextResponse.json({
    ok: true,
    preview: gate.preview,
    program: fleetCapabilitySummaryV40_7(),
    pods: FLEET_IMPROVEMENT_PODS_V40_7,
    agents: FLEET_IMPROVEMENT_AGENTS_V40_7,
    capabilities: FLEET_CAPABILITIES_V40_7,
    experimentalProviderFlags: experimentalProviderFlagsV40_7(),
    orchestration: {
      currentRuntime: 'supabase-durable-store-and-vercel-cron',
      eventContract: 'sourcingos/fleet.v40_7.work.requested',
      preferredThinAdapter: 'inngest',
      directAgentToAgentCalls: false,
      githubVercelFeedbackLoop: true,
      vercelWebhookMayReleaseResumeSprint: false,
    },
    trust: {
      publicProfessionalEvidenceOnly: true,
      linkedinOrAccountGatedScrapingAllowed: false,
      authPaywallCaptchaBypassAllowed: false,
      productionResumeSprintQueueAccess: false,
      autonomousContactHarvestingAllowed: false,
      silentIdentityMergeAllowed: false,
      autonomousOutreachAllowed: false,
      autonomousRecruitingDecisionsAllowed: false,
      paidProviderPurchaseAllowed: false,
    },
  })
}
