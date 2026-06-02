// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/index.ts — Barrel + provider status resolver.
//
// FOUNDATION ONLY (Sprint 2.7 prep). Returns providerConfigured: false until
// Sprint 2.8 wires the live People Data Labs adapter.
// ─────────────────────────────────────────────────────────────────────────────
export * from './types'
export * from './build-request'
export { getPeopleDataLabsStatus, enrichWithPeopleDataLabsStub } from './providers/people-data-labs.stub'

import { ProviderStatus } from './types'
import { getPeopleDataLabsStatus } from './providers/people-data-labs.stub'

/**
 * Resolve the active contact-enrichment provider status.
 * In this sprint, always the stub → providerConfigured: false.
 * Sprint 2.8 will switch this to check PDL_API_KEY server-side.
 */
export function getActiveProviderStatus(): ProviderStatus {
  return getPeopleDataLabsStatus()
}
