import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { enrichWithPeopleDataLabs } from '@/lib/contact-enrichment/providers/people-data-labs'
import { canUseDataVertexLookupV36_8, enrichWithDataVertexV36_8 } from '@/lib/contact-enrichment/providers/data-vertex-v36-8'
import { assessEnrichmentIdentityV34 } from '@/lib/contact-enrichment/identity-readiness-v34'
import { runContactEnrichmentOrchestratorV35, type ContactProviderAdapterV35 } from '@/lib/contact-enrichment/orchestrator-v35'
import { ContactEnrichmentRequest, ContactSignal, type ContactEnrichmentProvider } from '@/lib/contact-enrichment/types'

export const dynamic = 'force-dynamic'

const PROVIDERS = new Set<ContactEnrichmentProvider>(['people_data_labs', 'data_vertex', 'pearch', 'coresignal', 'contactout', 'openweb_ninja', 'hunter', 'apollo', 'none'])

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rlMinute = await rateLimit(req, 'enrichment', gate.userId)
  if (!rlMinute.ok) return rlMinute.response
  const rlDaily = await rateLimit(req, 'enrichmentDaily', gate.userId)
  if (!rlDaily.ok) return rlDaily.response
  const ownerId: string | null = gate.preview ? null : gate.userId

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const providerRaw = str(body.providerName)
  const providerName = providerRaw && PROVIDERS.has(providerRaw as ContactEnrichmentProvider) ? providerRaw as ContactEnrichmentProvider : undefined

  const request: ContactEnrichmentRequest = {
    candidateId: str(body.candidateId),
    sourceProfileId: str(body.sourceProfileId),
    providerPersonId: str(body.providerPersonId),
    providerName,
    fullName: str(body.fullName),
    firstName: str(body.firstName),
    lastName: str(body.lastName),
    title: str(body.title) || str(body.headline),
    currentCompany: str(body.currentCompany) || str(body.organization),
    companyDomain: str(body.companyDomain),
    location: str(body.location),
    profileUrl: str(body.profileUrl),
    githubUrl: str(body.githubUrl),
    linkedinUrl: str(body.linkedinUrl),
    sourceContext: str(body.sourceContext),
  }

  const identity = assessEnrichmentIdentityV34(request)
  if (!identity.attemptProvider) {
    return NextResponse.json({
      ok: false,
      code: 'identity_insufficient',
      error: identity.message,
      identityStrength: identity.strength,
      anchors: identity.anchors,
      missing: identity.missing,
      nextStep: 'Resolve a real name, deterministic profile URL, or same-provider person id before contact enrichment.',
    }, { status: 422 })
  }

  const pdlConfigured = Boolean(process.env.PDL_API_KEY)
  const dataVertexConfigured = Boolean(process.env.DATAVERTEX_API_KEY)
  const adapters: ContactProviderAdapterV35[] = []

  const dataVertexAdapter: ContactProviderAdapterV35 = {
    id: 'data_vertex',
    purposes: ['identity_enrichment', 'work_email_finder', 'phone_enrichment'],
    estimatedCredits: 10,
    enrich: () => enrichWithDataVertexV36_8(request, 'identity_enrichment'),
  }
  const pdlAdapter: ContactProviderAdapterV35 = {
    id: 'people_data_labs',
    purposes: ['identity_enrichment'],
    estimatedCredits: 1,
    enrich: () => enrichWithPeopleDataLabs(request),
  }

  // Same-provider deterministic lookup gets first priority. Otherwise PDL can
  // resolve a grounded professional identity before a URL-keyed DataVertex pass.
  if (dataVertexConfigured && request.providerName === 'data_vertex' && canUseDataVertexLookupV36_8(request)) adapters.push(dataVertexAdapter)
  if (pdlConfigured) adapters.push(pdlAdapter)
  if (dataVertexConfigured && canUseDataVertexLookupV36_8(request) && !adapters.some(item => item.id === 'data_vertex')) adapters.push(dataVertexAdapter)

  if (!adapters.length) {
    return NextResponse.json({
      ok: false,
      code: 'provider_not_configured',
      error: 'No configured contact provider can use the available identity anchors.',
      providers: {
        peopleDataLabs: pdlConfigured ? 'configured' : 'missing_key',
        dataVertex: dataVertexConfigured ? (canUseDataVertexLookupV36_8(request) ? 'configured' : 'needs_linkedin_or_provider_id') : 'missing_key',
      },
    }, { status: 503 })
  }

  const orchestration = await runContactEnrichmentOrchestratorV35({
    request,
    purpose: 'identity_enrichment',
    adapters,
    maxPaidAttempts: Math.min(2, adapters.length),
    maxEstimatedCredits: 11,
  })
  const result = orchestration.result

  let persistenceMode: 'supabase' | 'preview' | 'not_persisted' = 'not_persisted'
  let persistedCount = 0

  // Rich V35 match/deliverability metadata is returned in shadow mode until a
  // replay-safe ledger write path exists. Only the longstanding normalized
  // contact fields are persisted here; provider match/ownership/deliverability
  // metadata remains response-only so a partial retry cannot create conflicting
  // identity state.
  if (result.signals.length > 0 && request.candidateId && isSupabaseConfigured() && ownerId) {
    const sb = createServerSupabaseClient()
    if (sb) {
      try {
        const { data: existing } = await sb
          .from('candidate_contacts')
          .select('type, value, source')
          .eq('candidate_id', request.candidateId)
          .eq('owner_id', ownerId)

        const existingKeys = new Set(
          (existing || []).map((c: { type: string; value: string; source: string }) => `${c.type}:${c.value.toLowerCase()}:${c.source}`),
        )

        const rows = result.signals
          .filter((s: ContactSignal) => !existingKeys.has(`${s.type}:${s.value.toLowerCase()}:${s.sourceProvider}`))
          .map((s: ContactSignal) => ({
            owner_id: ownerId,
            candidate_id: request.candidateId,
            source_profile_id: request.sourceProfileId || null,
            type: s.type,
            value: s.value,
            source: s.sourceProvider,
            confidence: s.confidence,
            verified: false,
            permission_status: 'unknown',
          }))

        if (rows.length > 0) {
          const { error } = await sb.from('candidate_contacts').insert(rows)
          if (!error) {
            persistedCount = rows.length
            persistenceMode = 'supabase'
          }
        } else persistenceMode = 'supabase'
      } catch {
        persistenceMode = 'not_persisted'
      }
    }
  } else if (result.signals.length > 0 && !isSupabaseConfigured()) {
    persistenceMode = 'preview'
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    message: result.message,
    signals: result.signals,
    providerMatch: result.match,
    identityStrength: identity.strength,
    identityAnchors: identity.anchors,
    orchestration: {
      purpose: orchestration.purpose,
      stopReason: orchestration.stopReason,
      maxPaidAttempts: orchestration.maxPaidAttempts,
      attempts: orchestration.attempts,
    },
    persistenceMode,
    persistedCount,
    warning: 'Contact ownership, deliverability, and permission are separate. No returned signal implies permission to contact.',
    log: {
      provider: result.log.provider,
      attemptedAt: result.log.attemptedAt,
      fieldsUsed: result.log.fieldsUsed,
      resultCount: result.log.resultCount,
      warnings: result.log.warnings,
      persistenceMode,
    },
  })
}
