import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { buildUniversalPeopleProviderRequestV36_9 } from '@/lib/universal-people-search-v36-9'
import { CANONICAL_SEARCH_ROLES_V36_12, buildSearchQualitySnapshotV36_12 } from '@/lib/search-quality-v36-12'
import { executableCandidateSearchProvidersV36_8 } from '@/lib/candidate-data/provider-registry-v36-8'
import { runCandidateDataSearchV36_8 } from '@/lib/candidate-data/orchestrator-v36-8'
import type { CandidateDataSearchAdapterV36_8, CandidateDataProviderV36_8 } from '@/lib/candidate-data/types-v36-8'
import { searchPearchV36_8 } from '@/lib/candidate-data/providers/pearch-v36-8'
import { searchPeopleDataLabsV36_8 } from '@/lib/candidate-data/providers/people-data-labs-search-v36-8'
import { searchCoresignalV36_8 } from '@/lib/candidate-data/providers/coresignal-v36-8'
import { searchDataVertexV36_8 } from '@/lib/candidate-data/providers/data-vertex-v36-8'
import { searchContactOutV36_8 } from '@/lib/candidate-data/providers/contactout-v36-8'
import { searchSignalHireV36_8 } from '@/lib/candidate-data/providers/signalhire-v36-8'
import { searchLinkUpV36_8 } from '@/lib/candidate-data/providers/linkup-v36-8'
import { searchExaPeopleV36_8 } from '@/lib/candidate-data/providers/exa-v36-8'
import { searchCrustdataV36_16 } from '@/lib/candidate-data/providers/crustdata-v36-16'
import { searchApolloPeopleV36_16 } from '@/lib/candidate-data/providers/apollo-v36-16'
import { searchSerperXrayV36_16 } from '@/lib/candidate-data/providers/serper-xray-v36-16'

export const dynamic = 'force-dynamic'

function adapter(provider: CandidateDataProviderV36_8): CandidateDataSearchAdapterV36_8 | undefined {
  if (provider === 'pearch') return { provider, search: searchPearchV36_8 }
  if (provider === 'people_data_labs') return { provider, search: searchPeopleDataLabsV36_8 }
  if (provider === 'coresignal') return { provider, search: searchCoresignalV36_8 }
  if (provider === 'data_vertex') return { provider, search: searchDataVertexV36_8 }
  if (provider === 'contactout') return { provider, search: searchContactOutV36_8 }
  if (provider === 'signalhire') return { provider, search: searchSignalHireV36_8 }
  if (provider === 'linkup') return { provider, search: searchLinkUpV36_8 }
  if (provider === 'exa') return { provider, search: searchExaPeopleV36_8 }
  if (provider === 'crustdata') return { provider, search: searchCrustdataV36_16 }
  if (provider === 'apollo') return { provider, search: searchApolloPeopleV36_16 }
  if (provider === 'serper') return { provider, search: searchSerperXrayV36_16 }
  return undefined
}

function safeObservation(item: Awaited<ReturnType<typeof runCandidateDataSearchV36_8>>['observations'][number]) {
  return {
    provider: item.provider,
    displayName: item.displayName,
    currentTitle: item.currentTitle,
    currentEmployer: item.currentEmployer,
    location: item.location,
    skills: item.skills.slice(0, 12),
    profileUrls: item.profileUrls.slice(0, 5),
    contactAvailability: item.contactAvailability,
    providerRetrievalScore: item.providerRetrievalScore,
    providerExplanation: item.providerExplanation,
  }
}

/**
 * Temporary V37.2 diagnostic endpoint. It is deliberately unavailable outside
 * Vercel Preview, performs only read-only breadth search, never reveals contact
 * values, never persists observations, and runs only one fixed canonical role.
 * Remove this route before the V37.2 branch is merged.
 */
export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') return new NextResponse(null, { status: 404 })

  const key = req.nextUrl.searchParams.get('role') || 'cleared-rhel-annapolis'
  const role = CANONICAL_SEARCH_ROLES_V36_12.find(item => item.key === key)
  if (!role) return NextResponse.json({ ok: false, error: 'Unknown canonical role.' }, { status: 400 })

  const parsed = buildUniversalPeopleProviderRequestV36_9({ query: role.query, limit: 10 })
  const configured = executableCandidateSearchProvidersV36_8()
  const adapters = configured.map(item => adapter(item.provider)).filter(Boolean) as CandidateDataSearchAdapterV36_8[]
  if (!adapters.length) return NextResponse.json({ ok: false, error: 'No executable candidate-search providers configured in Preview.' }, { status: 503 })

  const request = {
    ...parsed,
    offset: 0,
    revealContact: false as const,
  }
  const result = await runCandidateDataSearchV36_8(request, adapters, 10)
  const quality = buildSearchQualitySnapshotV36_12(request, result)

  return NextResponse.json({
    ok: true,
    role,
    structuredRequest: parsed,
    configuredProviders: configured.map(item => ({ provider: item.provider, label: item.label, capabilities: item.capabilities })),
    telemetry: result.telemetry,
    providerMix: result.providerMix,
    retainedProviderMix: result.retainedProviderMix,
    discoveredBeforeCap: result.discoveredBeforeCap,
    returnedAfterCap: result.returnedAfterCap,
    relevanceRejected: result.relevanceRejected,
    quality,
    observations: result.observations.map(safeObservation),
    warnings: result.warnings,
    trust: {
      previewOnly: true,
      readOnlyBreadthSearch: true,
      contactValuesRevealed: false,
      persisted: false,
      providerObservationsAreVerifiedFacts: false,
    },
  })
}
