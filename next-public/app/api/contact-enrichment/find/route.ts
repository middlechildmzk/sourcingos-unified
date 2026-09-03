import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { enrichWithPeopleDataLabs } from '@/lib/contact-enrichment/providers/people-data-labs'
import { canUseDataVertexLookupV36_8, enrichWithDataVertexV36_8 } from '@/lib/contact-enrichment/providers/data-vertex-v36-8'
import { canUseSignalHireLookupV36_8, enrichWithSignalHireV36_8 } from '@/lib/contact-enrichment/providers/signalhire-v36-8'
import { canUseAnyMailFinderV36_8, enrichWithAnyMailFinderV36_8 } from '@/lib/contact-enrichment/providers/anymail-finder-v36-8'
import { canUseTombaV36_8, enrichWithTombaV36_8 } from '@/lib/contact-enrichment/providers/tomba-v36-8'
import { canUseHunterV36_8, enrichWithHunterV36_8 } from '@/lib/contact-enrichment/providers/hunter-v36-8'
import { canUseApolloV36_16, enrichWithApolloV36_16 } from '@/lib/contact-enrichment/providers/apollo-v36-16'
import { assessEnrichmentIdentityV34 } from '@/lib/contact-enrichment/identity-readiness-v34'
import {
  contactGoalStateV36_12,
  runContactEnrichmentOrchestratorV35,
  type ContactProviderAdapterV35,
  type ContactResolutionGoalV36_12,
  type EnrichmentPurposeV35,
} from '@/lib/contact-enrichment/orchestrator-v35'
import { ContactEnrichmentRequest, ContactSignal, type ContactEnrichmentProvider } from '@/lib/contact-enrichment/types'
import { signedProviderObservationV36_8 } from '@/lib/candidate-data/provider-observation-bridge-v36-8'
import type { CandidateDataProviderV36_8, CandidateProviderObservationV36_8 } from '@/lib/candidate-data/types-v36-8'

export const dynamic = 'force-dynamic'

const PROVIDERS = new Set<ContactEnrichmentProvider>([
  'people_data_labs', 'data_vertex', 'pearch', 'coresignal', 'contactout', 'signalhire',
  'anymail_finder', 'tomba', 'openweb_ninja', 'hunter', 'apollo', 'none',
])
const PURPOSES = new Set<EnrichmentPurposeV35>(['identity_enrichment', 'work_email_finder', 'email_verification', 'phone_enrichment', 'contact_bundle'])
const CONTACT_GOALS = new Set<ContactResolutionGoalV36_12>(['work_email', 'personal_email', 'phone'])
const SIGNABLE_IDENTITY_PROVIDERS = new Set<CandidateDataProviderV36_8>(['people_data_labs', 'data_vertex', 'signalhire'])

function validEmail(value?: string): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
}

function signedResolvedPerson(
  provider: ContactEnrichmentProvider,
  result: Awaited<ReturnType<typeof runContactEnrichmentOrchestratorV35>>['result'],
) {
  const person = result.person
  const providerPersonId = result.match?.providerPersonId || person?.providerPersonId
  if (!person || !providerPersonId || !SIGNABLE_IDENTITY_PROVIDERS.has(provider as CandidateDataProviderV36_8)) return undefined
  const emailAvailable = result.signals.some(signal => signal.type === 'email')
  const phoneAvailable = result.signals.some(signal => signal.type === 'phone')
  const observation: CandidateProviderObservationV36_8 = {
    provider: provider as CandidateDataProviderV36_8,
    providerPersonId,
    displayName: person.displayName,
    headline: person.currentTitle,
    currentTitle: person.currentTitle,
    currentEmployer: person.currentEmployer,
    location: person.location,
    skills: person.skills,
    profileUrls: person.profileUrls,
    contactAvailability: { email: emailAvailable, phone: phoneAvailable },
    providerExplanation: `Resolved from an explicit identity-enrichment lookup using ${result.match?.matchedOn.join(', ') || 'provider-supported professional identity anchors'}. This remains a provider observation pending recruiter review.`,
    observedAt: new Date().toISOString(),
  }
  return signedProviderObservationV36_8(observation)
}

function dedupeSignals(signals: ContactSignal[]): ContactSignal[] {
  const seen = new Set<string>()
  return signals.filter(signal => {
    const key = `${signal.type}:${signal.value.toLowerCase()}:${signal.sourceProvider}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

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
  const purposeRaw = str(body.purpose)
  const purpose: EnrichmentPurposeV35 = purposeRaw && PURPOSES.has(purposeRaw as EnrichmentPurposeV35) ? purposeRaw as EnrichmentPurposeV35 : 'identity_enrichment'
  const requestedGoals = Array.isArray(body.goals)
    ? Array.from(new Set(body.goals.filter(item => typeof item === 'string' && CONTACT_GOALS.has(item as ContactResolutionGoalV36_12)) as ContactResolutionGoalV36_12[]))
    : purpose === 'contact_bundle'
      ? ['work_email', 'personal_email', 'phone'] as ContactResolutionGoalV36_12[]
      : purpose === 'work_email_finder'
        ? ['work_email'] as ContactResolutionGoalV36_12[]
        : purpose === 'phone_enrichment'
          ? ['phone'] as ContactResolutionGoalV36_12[]
          : []

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
    email: str(body.email),
    phone: str(body.phone),
    sourceContext: str(body.sourceContext),
  }

  const identity = assessEnrichmentIdentityV34(request)
  const verificationOnly = purpose === 'email_verification' && validEmail(request.email)
  if (!identity.attemptProvider && !verificationOnly) {
    return NextResponse.json({
      ok: false,
      code: 'identity_insufficient',
      error: identity.message,
      identityStrength: identity.strength,
      anchors: identity.anchors,
      missing: identity.missing,
      nextStep: 'Resolve a real name, deterministic profile URL, same-provider person id, or exact provider-supported email/phone identifier before contact enrichment.',
    }, { status: 422 })
  }

  const pdlConfigured = Boolean(process.env.PDL_API_KEY)
  const dataVertexConfigured = Boolean(process.env.DATAVERTEX_API_KEY)
  const signalHireConfigured = Boolean(process.env.SIGNALHIRE_API_KEY)
  const anyMailConfigured = Boolean(process.env.ANYMAILFINDER_API_KEY)
  const tombaConfigured = Boolean(process.env.TOMBA_API_KEY && process.env.TOMBA_SECRET_KEY)
  const hunterConfigured = Boolean(process.env.HUNTER_API_KEY)
  const apolloConfigured = Boolean(process.env.APOLLO_API_KEY)

  function adaptersFor(lane: Exclude<EnrichmentPurposeV35, 'contact_bundle'>): ContactProviderAdapterV35[] {
    const adapters: ContactProviderAdapterV35[] = []
    const dataVertexAdapter: ContactProviderAdapterV35 = {
      id: 'data_vertex', purposes: ['identity_enrichment', 'work_email_finder', 'phone_enrichment'], estimatedCredits: 10,
      enrich: () => enrichWithDataVertexV36_8(request, lane === 'phone_enrichment' ? 'phone_enrichment' : lane === 'work_email_finder' ? 'work_email_finder' : 'identity_enrichment'),
    }
    const pdlAdapter: ContactProviderAdapterV35 = {
      id: 'people_data_labs', purposes: ['identity_enrichment', 'work_email_finder', 'phone_enrichment'], estimatedCredits: 1,
      enrich: () => enrichWithPeopleDataLabs(request),
    }
    const signalHireAdapter: ContactProviderAdapterV35 = {
      id: 'signalhire', purposes: ['identity_enrichment', 'work_email_finder', 'phone_enrichment'], estimatedCredits: 1,
      enrich: () => enrichWithSignalHireV36_8(request),
    }
    const anyMailAdapter: ContactProviderAdapterV35 = {
      id: 'anymail_finder', purposes: ['work_email_finder'], estimatedCredits: 1,
      enrich: () => enrichWithAnyMailFinderV36_8(request),
    }
    const tombaAdapter: ContactProviderAdapterV35 = {
      id: 'tomba', purposes: ['identity_enrichment', 'work_email_finder', 'email_verification'], estimatedCredits: 1,
      enrich: () => enrichWithTombaV36_8(request, lane),
    }
    const hunterAdapter: ContactProviderAdapterV35 = {
      id: 'hunter', purposes: ['identity_enrichment', 'work_email_finder', 'email_verification'], estimatedCredits: 1,
      enrich: () => enrichWithHunterV36_8(request, lane),
    }
    const apolloAdapter: ContactProviderAdapterV35 = {
      id: 'apollo', purposes: ['work_email_finder'], estimatedCredits: requestedGoals.includes('personal_email') ? 2 : 1,
      enrich: () => enrichWithApolloV36_16(request, { revealPersonalEmail: requestedGoals.includes('personal_email') }),
    }

    if (signalHireConfigured && request.providerName === 'signalhire' && canUseSignalHireLookupV36_8(request)) adapters.push(signalHireAdapter)
    if (dataVertexConfigured && request.providerName === 'data_vertex' && canUseDataVertexLookupV36_8(request)) adapters.push(dataVertexAdapter)
    if (lane === 'work_email_finder' && apolloConfigured && request.providerName === 'apollo' && canUseApolloV36_16(request)) adapters.push(apolloAdapter)

    if (lane === 'identity_enrichment') {
      const exactIdentifierOnly = Boolean(request.email || request.phone) && !request.fullName && !request.firstName && !request.lastName && !request.profileUrl && !request.linkedinUrl && !request.githubUrl && !request.providerPersonId
      if (pdlConfigured && !exactIdentifierOnly) adapters.push(pdlAdapter)
      if (signalHireConfigured && canUseSignalHireLookupV36_8(request) && !adapters.some(item => item.id === 'signalhire')) adapters.push(signalHireAdapter)
      if (dataVertexConfigured && canUseDataVertexLookupV36_8(request) && !adapters.some(item => item.id === 'data_vertex')) adapters.push(dataVertexAdapter)
    } else if (lane === 'work_email_finder') {
      if (anyMailConfigured && canUseAnyMailFinderV36_8(request)) adapters.push(anyMailAdapter)
      if (hunterConfigured && canUseHunterV36_8(request, lane)) adapters.push(hunterAdapter)
      if (tombaConfigured && canUseTombaV36_8(request, lane)) adapters.push(tombaAdapter)
      if (apolloConfigured && canUseApolloV36_16(request) && !adapters.some(item => item.id === 'apollo')) adapters.push(apolloAdapter)
      if (pdlConfigured) adapters.push(pdlAdapter)
      if (signalHireConfigured && canUseSignalHireLookupV36_8(request) && !adapters.some(item => item.id === 'signalhire')) adapters.push(signalHireAdapter)
      if (dataVertexConfigured && canUseDataVertexLookupV36_8(request) && !adapters.some(item => item.id === 'data_vertex')) adapters.push(dataVertexAdapter)
    } else if (lane === 'email_verification') {
      if (hunterConfigured && canUseHunterV36_8(request, lane)) adapters.push(hunterAdapter)
      if (tombaConfigured && canUseTombaV36_8(request, lane)) adapters.push(tombaAdapter)
    } else if (lane === 'phone_enrichment') {
      if (signalHireConfigured && canUseSignalHireLookupV36_8(request) && !adapters.some(item => item.id === 'signalhire')) adapters.push(signalHireAdapter)
      if (pdlConfigured) adapters.push(pdlAdapter)
      if (dataVertexConfigured && canUseDataVertexLookupV36_8(request) && !adapters.some(item => item.id === 'data_vertex')) adapters.push(dataVertexAdapter)
    }
    return adapters
  }

  // Candidate Graph cache is the first provider: $0 and no network call.
  let cachedSignals: ContactSignal[] = []
  if (request.candidateId && ownerId && isSupabaseConfigured()) {
    const sb = createServerSupabaseClient()
    if (sb) {
      try {
        const { data } = await sb.from('candidate_contacts')
          .select('type,value,source,confidence,permission_status,contact_kind,ownership_confidence,deliverability,provider_status_raw,observed_at,created_at')
          .eq('candidate_id', request.candidateId)
          .eq('owner_id', ownerId)
        cachedSignals = (data || []).map((row: any) => ({
          type: row.type,
          channelKind: row.contact_kind || undefined,
          value: row.value,
          sourceProvider: PROVIDERS.has(row.source as ContactEnrichmentProvider) ? row.source as ContactEnrichmentProvider : 'none',
          confidence: row.confidence || 'medium',
          verified: false,
          permissionStatus: row.permission_status || 'unknown',
          ownershipConfidence: row.ownership_confidence || undefined,
          deliverability: row.deliverability || undefined,
          providerStatusRaw: row.provider_status_raw || undefined,
          discoveredAt: row.observed_at || row.created_at || new Date().toISOString(),
          rawSource: 'candidate_graph_cache',
          notes: 'Existing Candidate Graph contact observation reused before paid enrichment.',
        })) as ContactSignal[]
      } catch { cachedSignals = [] }
    }
  }

  let result: Awaited<ReturnType<typeof runContactEnrichmentOrchestratorV35>>['result']
  let orchestration: {
    purpose: EnrichmentPurposeV35
    stopReason: string
    maxPaidAttempts: number
    attempts: Array<{ provider: ContactEnrichmentProvider; purpose: EnrichmentPurposeV35; configured: boolean; resultCount: number; latencyMs: number; estimatedCredits?: number; warnings: string[] }>
    requestedGoals?: ContactResolutionGoalV36_12[]
    satisfiedGoals?: ContactResolutionGoalV36_12[]
    missingGoals?: ContactResolutionGoalV36_12[]
  }

  if (purpose === 'contact_bundle') {
    let combined = dedupeSignals(cachedSignals)
    const attempts: typeof orchestration.attempts = []
    let maxPaidAttempts = 0

    const emailGoals = requestedGoals.filter(goal => goal === 'work_email' || goal === 'personal_email')
    if (emailGoals.length && contactGoalStateV36_12(combined, emailGoals).missing.length) {
      const laneAdapters = adaptersFor('work_email_finder')
      const emailRun = await runContactEnrichmentOrchestratorV35({
        request, purpose: 'work_email_finder', adapters: laneAdapters,
        goals: emailGoals, initialSignals: combined,
        maxPaidAttempts: Math.min(6, Math.max(1, laneAdapters.length)), maxEstimatedCredits: 15,
      })
      combined = dedupeSignals(emailRun.result.signals)
      attempts.push(...emailRun.attempts)
      maxPaidAttempts += emailRun.maxPaidAttempts
    }

    if (requestedGoals.includes('phone') && contactGoalStateV36_12(combined, ['phone']).missing.length) {
      const laneAdapters = adaptersFor('phone_enrichment')
      const phoneRun = await runContactEnrichmentOrchestratorV35({
        request, purpose: 'phone_enrichment', adapters: laneAdapters,
        goals: ['phone'], initialSignals: combined,
        maxPaidAttempts: Math.min(4, Math.max(1, laneAdapters.length)), maxEstimatedCredits: 12,
      })
      combined = dedupeSignals(phoneRun.result.signals)
      attempts.push(...phoneRun.attempts)
      maxPaidAttempts += phoneRun.maxPaidAttempts
      result = phoneRun.result
    } else {
      const state = contactGoalStateV36_12(combined, requestedGoals)
      result = {
        provider: 'none', providerConfigured: false,
        message: combined.length ? `Resolved ${combined.length} cached/provider contact signal${combined.length === 1 ? '' : 's'}.` : 'No contact signal found.',
        signals: combined,
        log: { provider: 'none', attemptedAt: new Date().toISOString(), fieldsUsed: Object.keys(request).filter(key => (request as any)[key]), resultCount: combined.length, warnings: [], persistenceMode: 'none' },
      }
      if (!state.missing.length && !attempts.length) result.message = 'Requested contact goals were already satisfied by Candidate Graph cache.'
    }

    result = { ...result, signals: combined }
    const state = contactGoalStateV36_12(combined, requestedGoals)
    orchestration = {
      purpose,
      stopReason: !state.missing.length ? (attempts.length ? 'goal_met' : 'cache_hit') : attempts.length ? 'providers_exhausted' : 'no_provider',
      maxPaidAttempts,
      attempts,
      requestedGoals: state.requested,
      satisfiedGoals: state.satisfied,
      missingGoals: state.missing,
    }
  } else {
    const laneAdapters = adaptersFor(purpose)
    if (!laneAdapters.length && !cachedSignals.length) {
      return NextResponse.json({
        ok: false,
        code: 'provider_not_configured',
        error: `No configured contact provider can run the ${purpose.replace(/_/g, ' ')} lane with the available identity anchors.`,
      }, { status: 503 })
    }
    const single = await runContactEnrichmentOrchestratorV35({
      request,
      purpose,
      adapters: laneAdapters,
      ...(requestedGoals.length ? { goals: requestedGoals, initialSignals: cachedSignals } : {}),
      maxPaidAttempts: Math.min(6, Math.max(1, laneAdapters.length)),
      maxEstimatedCredits: purpose === 'work_email_finder' ? 15 : purpose === 'phone_enrichment' ? 12 : 4,
    })
    result = single.result
    orchestration = single
  }

  let persistenceMode: 'supabase' | 'preview' | 'not_persisted' = 'not_persisted'
  let persistedCount = 0

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
          .filter((s: ContactSignal) => s.sourceProvider !== 'none')
          .filter((s: ContactSignal) => !existingKeys.has(`${s.type}:${s.value.toLowerCase()}:${s.sourceProvider}`))
          .map((s: ContactSignal) => ({
            owner_id: ownerId,
            candidate_id: request.candidateId,
            source_profile_id: request.sourceProfileId || null,
            type: s.type,
            contact_kind: s.channelKind || null,
            value: s.value,
            source: s.sourceProvider,
            confidence: s.confidence,
            verified: false,
            permission_status: 'unknown',
            ownership_confidence: s.ownershipConfidence || null,
            deliverability: s.deliverability || null,
            provider_status_raw: s.providerStatusRaw || null,
            observed_at: s.discoveredAt || null,
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

  const reviewObservation = purpose === 'identity_enrichment'
    ? signedResolvedPerson(result.provider, result)
    : undefined

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    purpose,
    message: result.message,
    signals: result.signals,
    person: result.person,
    reviewObservation,
    providerMatch: result.match,
    identityStrength: verificationOnly ? 'email_verification_input' : identity.strength,
    identityAnchors: verificationOnly ? ['email supplied for explicit verification'] : identity.anchors,
    orchestration: {
      purpose: orchestration.purpose,
      stopReason: orchestration.stopReason,
      maxPaidAttempts: orchestration.maxPaidAttempts,
      attempts: orchestration.attempts,
      requestedGoals: orchestration.requestedGoals,
      satisfiedGoals: orchestration.satisfiedGoals,
      missingGoals: orchestration.missingGoals,
      cacheSignalsConsidered: cachedSignals.length,
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
