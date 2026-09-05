import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  fleetProviderReadinessV40_7b,
  listRecentFleetWorkItemsV40_7b,
} from '@/lib/fleet/runtime-v40-7b'
import { experimentalProviderFlagsV40_7 } from '@/lib/fleet/governance-v40-7'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response

  const readiness = fleetProviderReadinessV40_7b()
  const sb = createServerSupabaseClient()
  let recent: unknown[] = []
  let persistence: 'ready' | 'unavailable' | 'migration_missing' = sb ? 'ready' : 'unavailable'
  let persistenceWarning: string | null = null

  if (sb) {
    try {
      recent = await listRecentFleetWorkItemsV40_7b({ sb, ownerId: gate.userId, limit: 30 })
    } catch (error) {
      persistence = 'migration_missing'
      persistenceWarning = error instanceof Error ? error.message : 'Fleet runtime table is unavailable.'
    }
  }

  const counts = recent.reduce<Record<string, number>>((acc, value) => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const status = String(row.status || 'unknown')
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    ok: true,
    preview: gate.preview,
    runtime: {
      version: 'V40.7b',
      transport: 'inngest',
      logicalSeats: 50,
      executionConcurrency: 4,
      rollout: '1 -> 5 -> 10 -> 50 logical work items',
      persistence,
      persistenceWarning,
      readiness,
      experimentalProviderFlags: {
        ...experimentalProviderFlagsV40_7(),
        vercelExa: String(process.env.AGENT_FLEET_EXPERIMENTAL_PROVIDERS || '').toLowerCase() === 'true'
          && String(process.env.AGENT_FLEET_PROVIDER_VERCEL_EXA || '').toLowerCase() === 'true',
      },
      recentCounts: counts,
      recent,
    },
    trust: {
      resumeSprintQueueAccess: false,
      resumeSprintClaimFunctionImported: false,
      linkedinOrAccountGatedScrapingAllowed: false,
      authPaywallCaptchaBypassAllowed: false,
      autonomousContactHarvestingAllowed: false,
      silentIdentityMergeAllowed: false,
      autonomousOutreachAllowed: false,
      autonomousRecruitingDecisionsAllowed: false,
      providerPurchaseAllowed: false,
    },
  })
}
