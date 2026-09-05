// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/providers/people-data-labs.stub.ts
//
// STUB ONLY — Sprint 2.7 prep. This file does NOT call People Data Labs.
// It documents the future provider mapping and returns providerConfigured: false
// until Sprint 2.8 adds the live adapter (people-data-labs.ts).
//
// Sprint 2.8 will replace this with a server-only adapter that:
//   - reads PDL_API_KEY from process.env (NEVER NEXT_PUBLIC_)
//   - builds a conservative enrichment request (professional data only)
//   - maps PDL response → ContactSignal[] (verified=false, permission unknown)
//   - redacts the API key from all logs
//   - never throws raw provider errors to the client
//   - never requests or stores protected/sensitive attributes
// ─────────────────────────────────────────────────────────────────────────────
import {
  ContactEnrichmentRequest,
  ContactEnrichmentResult,
  ProviderStatus,
  enrichmentFieldsUsed,
} from '../types'

const PROVIDER = 'people_data_labs' as const

/**
 * Returns provider configuration status.
 * In this stub, ALWAYS returns providerConfigured: false — no key check,
 * no network. Sprint 2.8 will check process.env.PDL_API_KEY here (server-only).
 */
export function getPeopleDataLabsStatus(): ProviderStatus {
  return {
    provider: PROVIDER,
    providerConfigured: false,
    message:
      'Contact enrichment provider not configured yet. This will support approved ' +
      'providers such as People Data Labs in a future release.',
  }
}

/**
 * STUB enrichment entry point. Does not call PDL. Always returns an empty,
 * not-configured result. Sprint 2.8 replaces this with the live adapter.
 *
 * FUTURE MAPPING (documented for Sprint 2.8, not executed here):
 *   PDL field            → ContactSignal
 *   ------------------------------------------------------------------
 *   emails[].address     → { type: 'email', confidence by emails[].type }
 *   phone_numbers[]      → { type: 'phone', confidence: 'low' }
 *   linkedin_url         → { type: 'social_url' }
 *   github_url           → { type: 'profile_url' }
 *   job_company_website  → { type: 'company_domain' }
 *
 *   PDL request built ONLY from:
 *     first_name, last_name, company, location, profile (professional fields)
 *   NEVER from protected attributes.
 *   API key redacted from all logs.
 */
export async function enrichWithPeopleDataLabsStub(
  request: ContactEnrichmentRequest
): Promise<ContactEnrichmentResult> {
  // No network call. No key read. Documented placeholder only.
  return {
    provider: PROVIDER,
    providerConfigured: false,
    message:
      'Contact enrichment provider not configured yet. People Data Labs integration ' +
      'will be added in a future release. No lookup was performed.',
    signals: [],
    log: {
      provider: PROVIDER,
      attemptedAt: new Date().toISOString(),
      fieldsUsed: enrichmentFieldsUsed(request),
      resultCount: 0,
      warnings: ['Provider stub — no live enrichment performed.'],
      persistenceMode: 'none',
    },
  }
}
