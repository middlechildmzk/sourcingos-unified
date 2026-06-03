import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { enrichWithPeopleDataLabs } from '@/lib/contact-enrichment/providers/people-data-labs'
import { getProviderStatus } from '@/lib/contact-enrichment/provider-status'
import { ContactEnrichmentRequest, ContactSignal } from '@/lib/contact-enrichment/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── 1. Auth gate (when Supabase configured) ────────────────────────────────
  let ownerId: string | null = null
  if (isSupabaseConfigured()) {
    const session = await getRouteSession()
    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, code: 'auth_required', error: 'Sign in to find contact info.' },
        { status: 401 }
      )
    }
    ownerId = session.userId
  }

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

  // ── 4. Call provider server-side ────────────────────────────────────────────
  const result = await enrichWithPeopleDataLabs(request)

  // ── 5. Persist to candidate_contacts (dedupe) if candidateId present ────────
  let persistenceMode: 'supabase' | 'preview' | 'not_persisted' = 'not_persisted'
  let persistedCount = 0

  if (result.signals.length > 0 && request.candidateId && isSupabaseConfigured() && ownerId) {
    const sb = createServerSupabaseClient()
    if (sb) {
      try {
        // Fetch existing contacts for dedupe by (type, value, source)
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
            source: s.sourceProvider,          // 'people_data_labs'
            confidence: s.confidence,
            verified: false,                    // DB also enforces this via CHECK
            permission_status: 'unknown',       // never imply permission
          }))

        if (rows.length > 0) {
          const { error } = await sb.from('candidate_contacts').insert(rows)
          if (!error) {
            persistedCount = rows.length
            persistenceMode = 'supabase'
          }
        } else {
          persistenceMode = 'supabase' // ran, but all were duplicates
        }
      } catch {
        persistenceMode = 'not_persisted'
      }
    }
  } else if (result.signals.length > 0 && !isSupabaseConfigured()) {
    persistenceMode = 'preview'
  }

  // ── 6. Return UI-safe result (no key, no raw payload) ───────────────────────
  return NextResponse.json({
    ok: true,
    provider: result.provider,
    message: result.message,
    signals: result.signals,        // already normalized + compliant
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
