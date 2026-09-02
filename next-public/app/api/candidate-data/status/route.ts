import 'server-only'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { candidateDataProviderStatusesV36_8 } from '@/lib/candidate-data/provider-registry-v36-8'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const providers = candidateDataProviderStatusesV36_8()
  return NextResponse.json({
    ok: true,
    providers,
    executableSearchProviders: providers.filter(item => item.executable && item.capabilities.includes('candidate_search')).map(item => item.provider),
    trust: {
      configuredDoesNotMeanWired: true,
      missingCredentialsAreVisible: true,
      secretsReturned: false,
    },
  })
}
