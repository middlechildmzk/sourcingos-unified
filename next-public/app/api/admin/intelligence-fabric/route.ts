import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth-gate'
import { aiGatewayStatusV39_1 } from '@/lib/ai/gateway-v39-1'
import { neo4jLiveStatusV39_1B } from '@/lib/intelligence-fabric/neo4j-query-v39-1b'
import { projectCandidatePageV39_1B } from '@/lib/intelligence-fabric/neo4j-worker-v39-1b'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const projectionSchema = z.object({
  action: z.literal('project_page'),
  limit: z.number().int().min(1).max(10).default(5),
  afterCandidateId: z.string().uuid().nullable().optional(),
}).strict()

async function ownedGraphStatus(ownerId: string) {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      sourceOfTruth: true,
      canonicalCandidates: null,
      searchDocuments: null,
      sourceObservations: null,
      evidenceItems: null,
    }
  }

  const sb = createServerSupabaseClient()
  if (!sb) {
    return {
      connected: false,
      sourceOfTruth: true,
      canonicalCandidates: null,
      searchDocuments: null,
      sourceObservations: null,
      evidenceItems: null,
    }
  }

  const [candidates, documents, sources, evidence] = await Promise.all([
    sb.from('candidates').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('candidate_search_documents_v39').select('candidate_id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('source_profiles').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
    sb.from('evidence_items').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId),
  ])

  const error = candidates.error || documents.error || sources.error || evidence.error
  return {
    connected: !error,
    sourceOfTruth: true,
    canonicalCandidates: error ? null : candidates.count ?? 0,
    searchDocuments: error ? null : documents.count ?? 0,
    sourceObservations: error ? null : sources.count ?? 0,
    evidenceItems: error ? null : evidence.count ?? 0,
  }
}

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const [supabase, neo4j] = await Promise.all([
    ownedGraphStatus(gate.userId),
    neo4jLiveStatusV39_1B(),
  ])
  const aiGateway = aiGatewayStatusV39_1()

  return NextResponse.json({
    ok: supabase.connected && (!neo4j.configured || neo4j.connected),
    release: 'V39.1B',
    supabase,
    neo4j,
    aiGateway,
    projection: {
      enabled: neo4j.connected && neo4j.networkWritesEnabled,
      mode: 'bounded_admin_page',
      maxCandidatesPerRequest: 10,
      durableQueueFanoutIntegrated: false,
    },
    trust: {
      supabaseRemainsCanonical: true,
      neo4jCanMergeIdentity: false,
      neo4jContainsContactValues: false,
      paidEnrichmentMayRunImplicitly: false,
      recruiterDecisionAutomated: false,
      secretsReturnedByStatus: false,
    },
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const parsed = projectionSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid Intelligence Fabric projection request.', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await projectCandidatePageV39_1B(gate.userId, {
    limit: parsed.data.limit,
    afterCandidateId: parsed.data.afterCandidateId || null,
  })

  const status = result.ok ? 200 : result.succeeded > 0 ? 207 : 503
  return NextResponse.json({
    ...result,
    release: 'V39.1B',
    trust: {
      supabaseRemainsCanonical: true,
      tenantScopedGraphKeys: true,
      contactValuesProjected: false,
      rawProviderPayloadProjected: false,
      identityMergePerformed: false,
    },
  }, { status })
}
