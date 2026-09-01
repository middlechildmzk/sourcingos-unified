import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { enrichWithPeopleDataLabs } from '@/lib/contact-enrichment/providers/people-data-labs'
import { getProviderStatus } from '@/lib/contact-enrichment/provider-status'
import { assessEnrichmentIdentityV34 } from '@/lib/contact-enrichment/identity-readiness-v34'
import { ContactEnrichmentRequest, ContactSignal } from '@/lib/contact-enrichment/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── 1. Auth gate — FAIL CLOSED. Enrichment is a paid, per-lookup provider. ──
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rlMinute = await rateLimit(req, 'enrichment', gate.userId)
  if (!rlMinute.ok) return rlMinute.response
  const rlDaily = await rateLimit(req, 'enrichmentDaily', gate.userId)
  if (!rlDaily.ok) return rlDaily.response
  const ownerId: string | null = gate.preview ? null : gate.userId

  // ── 2. Provider configured? ────────────────────────────────────────────────
  const status = getProviderStatus()
  if (!status.providerConfigured) {
    return NextResponse.json(
      { ok: false, code: 'provider_not_configured', error: 'Contact enrichment provider not configured yet.' },
      { status: 503 }
    )
  }

  // ── 3. Build request from body ──────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

  const request: ContactEnrichmentRequest = {
    candidateId: str(body.candidateId),
    sourceProfileId: str(body.sourceProfileId),
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

  // ── 4. Identity-readiness gate before spending a provider lookup ───────────
  const identity = assessEnrichmentIdentityV34(request)
  if (!identity.attemptProvider) {
    return NextResponse.json({
      ok: false,
      code: 'identity_insufficient',
      error: identity.message,
      identityStrength: identity.strength,
      anchors: identity.anchors,
      missing: identity.missing,
      nextStep: 'Resolve a real name or a deterministic GitHub/LinkedIn identity anchor before contact enrichment.',
    }, { status: 422 })
  }

  // ── 5. Call provider server-side ────────────────────────────────────────────
  const result = await enrichWithPeopleDataLabs(request)

  // ── 6. Persist to candidate_contacts (dedupe) if candidateId present ────────
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
          (existing || []).map((c: { type: string; value: string; source: string }) =>
            `${c.type}:${c.value.toLowerCase()}:${c.source}`
          )
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
        } else {
          persistenceMode = 'supabase'
        }
      } catch {
        persistenceMode = 'not_persisted'
      }
    }
  } else if (result.signals.length > 0 && !isSupabaseConfigured()) {
    persistenceMode = 'preview'
  }

  // ── 7. Return UI-safe result (no key, no raw payload) ───────────────────────
  return NextResponse.json({
    ok: true,
    provider: result.provider,
    message: result.message,
    signals: result.signals,
    identityStrength: identity.strength,
    identityAnchors: identity.anchors,
    persistenceMode,
    persistedCount,
    warning: 'Contact signals are unverified and do not imply permission to contact.',
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
