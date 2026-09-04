import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { autoCaptureSearchObservationsV40, type AutoCaptureSummaryV40 } from '@/lib/candidate-data/auto-capture-v40'
import { executableCandidateSearchProvidersV36_8 } from '@/lib/candidate-data/provider-registry-v36-8'
import { runCandidateDataSearchV36_8, type CandidateDataOrchestrationV36_8 } from '@/lib/candidate-data/orchestrator-v36-8'
import { observationSigningConfiguredV36_12, signedProviderObservationV36_8 } from '@/lib/candidate-data/provider-observation-bridge-v36-8'
import { buildUnifiedCandidateSlateV38_2 } from '@/lib/candidate-data/unified-candidate-slate-v38-2'
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
import type { CandidateDataSearchAdapterV36_8, CandidateDataProviderV36_8, CandidateDataSearchRequestV36_8 } from '@/lib/candidate-data/types-v36-8'
import { buildSearchQualitySnapshotV36_12 } from '@/lib/search-quality-v36-12'
import { sourceHealthEventsForSearchV36_12 } from '@/lib/source-health-v36-12'

export const dynamic = 'force-dynamic'

const providerEnum = z.enum(['pearch', 'people_data_labs', 'coresignal', 'data_vertex', 'contactout', 'signalhire', 'linkup', 'exa', 'crustdata', 'apollo', 'serper'])
const bodySchema = z.object({
  query: z.string().trim().min(2).max(3000),
  requirements: z.array(z.object({ text: z.string().trim().min(1).max(300), mustHave: z.boolean() })).max(30).optional(),
  names: z.array(z.string().trim().min(1).max(180)).max(20).optional(),
  titles: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  skills: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  companies: z.array(z.string().trim().min(1).max(180)).max(30).optional(),
  locations: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(100000).default(0),
  providerPersonBlacklist: z.array(z.string().trim().min(1).max(200)).max(1000).optional(),
  providers: z.array(providerEnum).max(12).optional(),
  highFreshness: z.boolean().default(false),
}).strict()

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

function disabledCapture(): AutoCaptureSummaryV40 {
  return {
    enabled: false,
    attempted: 0,
    persisted: 0,
    created: 0,
    reused: 0,
    failed: 0,
    identityResolutionDeferred: true,
    contactValuesCaptured: false,
    results: [],
  }
}

async function finalizeCandidateSearchPayloadV38_2({
  ownerId,
  preview,
  searchRequest,
  result,
  requestedProviders,
}: {
  ownerId: string
  preview: boolean
  searchRequest: CandidateDataSearchRequestV36_8
  result: CandidateDataOrchestrationV36_8
  requestedProviders: CandidateDataProviderV36_8[]
}) {
  const signingConfigured = observationSigningConfiguredV36_12()
  // Sign the raw provider observations. The unified display slate is derived on
  // the server, but durable recruiter actions continue to trust only signed
  // source-native observations. Automatic V40 capture is system memory, not a
  // recruiter disposition or identity merge.
  const reviewObservations = signingConfigured ? result.observations.map(signedProviderObservationV36_8).filter(Boolean) : []
  const unifiedSlate = buildUnifiedCandidateSlateV38_2(result.observations)
  const searchQuality = buildSearchQualitySnapshotV36_12(searchRequest, result)
  const sourceHealthEvents = sourceHealthEventsForSearchV36_12(result.telemetry, result.retainedProviderMix)
  let autoCapture = disabledCapture()

  if (!preview && isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      try {
        const { data: run } = await sb.from('search_quality_runs').insert({
          owner_id: ownerId,
          canonical_role_key: searchQuality.canonicalRoleKey || null,
          query: searchRequest.query,
          requirements: searchRequest.requirements || [],
          structured_request: {
            names: searchRequest.names || [],
            titles: searchRequest.titles || [],
            skills: searchRequest.skills || [],
            companies: searchRequest.companies || [],
            locations: searchRequest.locations || [],
            providers: requestedProviders,
          },
          metrics: {
            ...searchQuality,
            identityFusionV38_2: {
              rawObservationCount: unifiedSlate.rawObservationCount,
              unifiedCandidateCount: unifiedSlate.unifiedCandidateCount,
              groupedObservationCount: unifiedSlate.groupedObservationCount,
            },
          },
          provider_telemetry: result.telemetry,
        }).select('id').single()

        await sb.from('source_health_events').insert(sourceHealthEvents.map(event => ({
          owner_id: ownerId,
          search_quality_run_id: run?.id || null,
          canonical_role_key: searchQuality.canonicalRoleKey || null,
          provider: event.provider,
          status: event.status,
          outcome: event.outcome,
          discovered: event.discovered,
          retained: event.retained,
          latency_ms: event.latencyMs,
          estimated_credits: event.estimatedCredits,
          message: event.message || null,
        })))
      } catch {
        // Search success must never depend on analytics/health persistence.
      }

      try {
        autoCapture = await autoCaptureSearchObservationsV40(sb, ownerId, result.observations)
      } catch {
        // Search success must never depend on background-memory persistence.
        autoCapture = {
          ...disabledCapture(),
          enabled: true,
          attempted: result.observations.length,
          failed: result.observations.length,
        }
      }
    }
  }

  const warnings = [...result.warnings]
  if (unifiedSlate.groupedObservationCount > 0) {
    warnings.push(`${unifiedSlate.groupedObservationCount} duplicate source observation${unifiedSlate.groupedObservationCount === 1 ? '' : 's'} grouped into ${unifiedSlate.unifiedCandidateCount} unified review candidate${unifiedSlate.unifiedCandidateCount === 1 ? '' : 's'} using deterministic public-professional identity anchors. Durable identity remains recruiter-reviewed.`)
  }
  if (autoCapture.enabled && autoCapture.failed > 0) {
    warnings.push(`${autoCapture.failed} retained observation${autoCapture.failed === 1 ? '' : 's'} could not be captured into durable SourcingOS memory. Search results remain reviewable.`)
  }
  if (!signingConfigured) warnings.unshift('Provider review observations cannot be saved until OBSERVATION_SIGNING_SECRET is configured for this environment.')

  return {
    ok: true,
    observations: unifiedSlate.observations,
    reviewObservations,
    autoCapture,
    identityFusion: {
      version: 'v38.2',
      rawObservationCount: unifiedSlate.rawObservationCount,
      unifiedCandidateCount: unifiedSlate.unifiedCandidateCount,
      groupedObservationCount: unifiedSlate.groupedObservationCount,
      clusters: unifiedSlate.clusters,
      linkedinOverlapIsDeterministicAuthority: false,
      persistentMergePerformed: false,
    },
    telemetry: result.telemetry,
    sourceHealth: sourceHealthEvents,
    providerMix: result.providerMix,
    retainedProviderMix: result.retainedProviderMix,
    discoveredBeforeCap: result.discoveredBeforeCap,
    returnedAfterCap: result.returnedAfterCap,
    contributingProviders: result.contributingProviders,
    relevanceRejected: result.relevanceRejected,
    searchQuality,
    warnings,
    trust: {
      providerObservationsAreCandidateFacts: false,
      providerScoresAreQualificationScores: false,
      contactRevealDuringSearch: false,
      contactValuesCapturedAutomatically: false,
      retainedObservationsPersistedAutomatically: autoCapture.enabled,
      identityMergePerformed: false,
      automaticIdentityResolutionDeferred: true,
      provisionalDisplayGroupingPerformed: unifiedSlate.groupedObservationCount > 0,
      recruiterDecisionPerformed: false,
      providerReviewObservationsSignedServerSide: signingConfigured,
      providerDatabaseCountsAreNotUniquePeopleCounts: true,
    },
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid candidate-data search request.', details: parsed.error.flatten() }, { status: 400 })

  const configured = executableCandidateSearchProvidersV36_8()
  const requested = new Set(parsed.data.providers || configured.map(item => item.provider))
  const adapters = configured.filter(item => requested.has(item.provider)).map(item => adapter(item.provider)).filter(Boolean) as CandidateDataSearchAdapterV36_8[]

  if (!adapters.length) {
    return NextResponse.json({ ok: false, code: 'candidate_provider_not_configured', error: 'No implemented candidate-search provider is configured for this request.', providerStatus: configured }, { status: 503 })
  }

  const searchRequest: CandidateDataSearchRequestV36_8 = {
    query: parsed.data.query,
    requirements: parsed.data.requirements,
    names: parsed.data.names,
    titles: parsed.data.titles,
    skills: parsed.data.skills,
    companies: parsed.data.companies,
    locations: parsed.data.locations,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    providerPersonBlacklist: parsed.data.providerPersonBlacklist,
    highFreshness: parsed.data.highFreshness,
    revealContact: false,
  }
  const requestedProviders = Array.from(requested) as CandidateDataProviderV36_8[]

  if (req.nextUrl.searchParams.get('stream') === '1') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (event: unknown) => {
          try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)) } catch { /* client disconnected */ }
        }
        write({ type: 'start', providers: adapters.map(item => item.provider) })
        void (async () => {
          try {
            const result = await runCandidateDataSearchV36_8(searchRequest, adapters, parsed.data.limit, providerResult => {
              write({ type: 'provider', telemetry: providerResult.telemetry })
            })
            const payload = await finalizeCandidateSearchPayloadV38_2({ ownerId: gate.userId, preview: gate.preview, searchRequest, result, requestedProviders })
            write({ type: 'final', payload })
          } catch {
            write({ type: 'error', error: 'Candidate search failed before a final retained slate was produced.' })
          } finally {
            try { controller.close() } catch { /* client disconnected */ }
          }
        })()
      },
    })
    return new Response(stream, {
      status: 200,
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-cache, no-store, no-transform',
        'x-accel-buffering': 'no',
      },
    })
  }

  const result = await runCandidateDataSearchV36_8(searchRequest, adapters, parsed.data.limit)
  const payload = await finalizeCandidateSearchPayloadV38_2({ ownerId: gate.userId, preview: gate.preview, searchRequest, result, requestedProviders })
  return NextResponse.json(payload)
}
