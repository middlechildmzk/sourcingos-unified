// ─────────────────────────────────────────────────────────────────────────────
// lib/contact-enrichment/provider-status.ts — SERVER-ONLY provider status.
// Checks PDL_API_KEY without ever exposing it. Never import in client code.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { ProviderStatus } from './types'

export type ProviderState = 'configured' | 'missing_key' | 'unavailable' | 'disabled' | 'error'

export function getProviderStatus(): ProviderStatus & { state: ProviderState } {
  const key = process.env.PDL_API_KEY
  if (!key) {
    return {
      provider: 'people_data_labs',
      providerConfigured: false,
      state: 'missing_key',
      message: 'Contact enrichment provider not configured yet.',
    }
  }
  return {
    provider: 'people_data_labs',
    providerConfigured: true,
    state: 'configured',
    message: 'People Data Labs is configured.',
  }
}
