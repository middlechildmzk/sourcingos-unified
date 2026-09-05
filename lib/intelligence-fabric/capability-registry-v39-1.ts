import 'server-only'

import { candidateDataProviderStatusesV36_8 } from '@/lib/candidate-data/provider-registry-v36-8'
import type { CandidateDataCapabilityV36_8, CandidateDataProviderV36_8 } from '@/lib/candidate-data/types-v36-8'
import type { ProviderHealthCategoryV38 } from '@/lib/search-quality/provider-health-v38'

export type FabricOperationV39_1 =
  | 'people_search'
  | 'known_person_lookup'
  | 'candidate_dossier'
  | 'candidate_explain'
  | 'known_contacts'
  | 'profile_enrich'
  | 'contact_enrich'
  | 'freshness_refresh'
  | 'web_corroborate'
  | 'people_count'
  | 'company_search'
  | 'company_enrich'
  | 'research_search'
  | 'patent_search'
  | 'subscription_refresh'
  | 'graph_traversal'
  | 'vector_search'

export type FabricProviderIdV39_1 = 'sourcingos_owned_graph' | CandidateDataProviderV36_8
export type FabricOperationMaturityV39_1 = 'active' | 'wired_not_executable' | 'planned'
export type FabricCostClassV39_1 = 'none' | 'low' | 'medium' | 'high' | 'variable' | 'unknown'
export type FabricEntitlementV39_1 = 'entitled' | 'not_configured' | 'not_entitled' | 'credits_exhausted' | 'unknown'

export type FabricOperationCapabilityV39_1 = {
  operation: FabricOperationV39_1
  maturity: FabricOperationMaturityV39_1
  costClass: FabricCostClassV39_1
  approvalRequired: boolean
}

export type ProviderCapabilityRecordV39_1 = {
  provider: FabricProviderIdV39_1
  label: string
  owned: boolean
  configured: boolean
  adapterExecutable: boolean
  entitlement: FabricEntitlementV39_1
  runtimeHealth: ProviderHealthCategoryV38 | 'NOT_OBSERVED'
  operations: FabricOperationCapabilityV39_1[]
  rateLimit: {
    known: boolean
    requests?: number
    windowSeconds?: number
    note: string
  }
  rights: {
    status: 'canonical_owned_graph' | 'provider_terms_require_audit'
    normalizedStorage: 'allowed' | 'provider_terms'
    rawPayloadStorage: 'not_applicable' | 'disabled_by_default'
    searchUse: 'allowed' | 'provider_terms'
    retention: 'canonical' | 'provider_terms'
  }
  freshness: 'durable' | 'live' | 'mixed' | 'unknown'
  notes: string[]
}

const operationMap: Record<CandidateDataCapabilityV36_8, FabricOperationV39_1> = {
  candidate_search: 'people_search',
  profile_enrichment: 'profile_enrich',
  contact_enrichment: 'contact_enrich',
  freshness_refresh: 'freshness_refresh',
  public_web_corroboration: 'web_corroborate',
}

const plannedOperations: Partial<Record<CandidateDataProviderV36_8, FabricOperationV39_1[]>> = {
  coresignal: ['subscription_refresh'],
  contactout: ['people_count'],
  serper: ['research_search', 'patent_search'],
}

function entitlementFromRuntime(
  configured: boolean,
  runtime: ProviderHealthCategoryV38 | undefined,
): FabricEntitlementV39_1 {
  if (!configured) return 'not_configured'
  if (runtime === 'NOT_ENTITLED') return 'not_entitled'
  if (runtime === 'CREDITS_EXHAUSTED') return 'credits_exhausted'
  if (runtime === 'SUCCESS' || runtime === 'ZERO_RESULTS' || runtime === 'PARTIAL') return 'entitled'
  return 'unknown'
}

function costClass(operation: FabricOperationV39_1): FabricCostClassV39_1 {
  if (['known_person_lookup', 'candidate_dossier', 'candidate_explain', 'known_contacts', 'graph_traversal'].includes(operation)) return 'none'
  if (operation === 'contact_enrich') return 'variable'
  return 'unknown'
}

function approvalRequired(operation: FabricOperationV39_1): boolean {
  return operation === 'contact_enrich'
}

/**
 * One conservative runtime registry for the Intelligence Fabric.
 *
 * Configuration is not treated as entitlement or health. Unknown commercial
 * limits/costs/retention rights stay unknown until they are explicitly audited;
 * the registry never manufactures plan terms from the presence of an API key.
 */
export function providerCapabilityRegistryV39_1(
  runtimeHealth: Partial<Record<CandidateDataProviderV36_8, ProviderHealthCategoryV38>> = {},
): ProviderCapabilityRecordV39_1[] {
  const owned: ProviderCapabilityRecordV39_1 = {
    provider: 'sourcingos_owned_graph',
    label: 'SourcingOS Candidate Graph',
    owned: true,
    configured: true,
    adapterExecutable: true,
    entitlement: 'entitled',
    runtimeHealth: 'SUCCESS',
    operations: [
      'people_search',
      'known_person_lookup',
      'candidate_dossier',
      'candidate_explain',
      'known_contacts',
      'graph_traversal',
    ].map(operation => ({
      operation: operation as FabricOperationV39_1,
      maturity: 'active' as const,
      costClass: 'none' as const,
      approvalRequired: false,
    })),
    rateLimit: { known: true, note: 'SourcingOS application rate limits apply; no external provider request is performed.' },
    rights: {
      status: 'canonical_owned_graph',
      normalizedStorage: 'allowed',
      rawPayloadStorage: 'not_applicable',
      searchUse: 'allowed',
      retention: 'canonical',
    },
    freshness: 'durable',
    notes: [
      'Supabase remains the canonical source of truth.',
      'Owned-graph retrieval is not candidate qualification and does not trigger paid enrichment.',
    ],
  }

  const external = candidateDataProviderStatusesV36_8().map<ProviderCapabilityRecordV39_1>(status => {
    const runtime = runtimeHealth[status.provider]
    const active = status.capabilities.map(capability => {
      const operation = operationMap[capability]
      return {
        operation,
        maturity: status.executable ? 'active' as const : 'wired_not_executable' as const,
        costClass: costClass(operation),
        approvalRequired: approvalRequired(operation),
      }
    })
    const planned = (plannedOperations[status.provider] || [])
      .filter(operation => !active.some(item => item.operation === operation))
      .map(operation => ({
        operation,
        maturity: 'planned' as const,
        costClass: costClass(operation),
        approvalRequired: approvalRequired(operation),
      }))

    return {
      provider: status.provider,
      label: status.label,
      owned: false,
      configured: status.state === 'configured',
      adapterExecutable: status.executable,
      entitlement: entitlementFromRuntime(status.state === 'configured', runtime),
      runtimeHealth: runtime || 'NOT_OBSERVED',
      operations: [...active, ...planned],
      rateLimit: {
        known: false,
        note: 'Provider plan/rate-limit terms are intentionally unknown until audited or observed at runtime.',
      },
      rights: {
        status: 'provider_terms_require_audit',
        normalizedStorage: 'provider_terms',
        rawPayloadStorage: 'disabled_by_default',
        searchUse: 'provider_terms',
        retention: 'provider_terms',
      },
      freshness: status.capabilities.includes('freshness_refresh') ? 'mixed' : 'live',
      notes: [
        status.message,
        'API key presence does not prove entitlement, remaining credits, runtime health, or storage rights.',
      ],
    }
  })

  return [owned, ...external]
}

export function providerCapabilityV39_1(
  provider: FabricProviderIdV39_1,
  runtimeHealth: Partial<Record<CandidateDataProviderV36_8, ProviderHealthCategoryV38>> = {},
) {
  return providerCapabilityRegistryV39_1(runtimeHealth).find(item => item.provider === provider)
}
