import 'server-only'

import {
  explainCandidateV38_5,
  getCandidateV38_5,
  getKnownContactsV38_5,
  lookupPersonV38_5,
  searchOwnedPeopleV38_5,
} from '@/lib/mcp/sourcingos-mcp-v38-5'

export type SourcingOsToolAuthorityV39_1 = 'owned_graph_read'

export type SourcingOsToolContractV39_1 = {
  name: 'search_people' | 'lookup_person' | 'get_candidate' | 'explain_candidate' | 'get_known_contacts'
  description: string
  inputSchema: Record<string, unknown>
  authority: SourcingOsToolAuthorityV39_1
  externalProviderFanout: false
  paidEnrichment: false
  recruiterApprovalRequired: false
  mcpExposed: true
  embeddedAiExposed: true
}

/**
 * Canonical read-heavy tool contracts for both MCP and the embedded AI core.
 * Future tools that can spend money, reveal sensitive contact data, mutate
 * recruiter state, or write to an ATS must use a different authority class and
 * retain explicit approval gates; they must not be smuggled into this list.
 */
export const SOURCINGOS_TOOL_CONTRACTS_V39_1: SourcingOsToolContractV39_1[] = [
  {
    name: 'search_people',
    description: 'Search the recruiter-owned durable SourcingOS Candidate Graph. This does not trigger live provider fan-out or paid enrichment.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, title, company, location, or other canonical candidate text.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    authority: 'owned_graph_read',
    externalProviderFanout: false,
    paidEnrichment: false,
    recruiterApprovalRequired: false,
    mcpExposed: true,
    embeddedAiExposed: true,
  },
  {
    name: 'lookup_person',
    description: 'Resolve a known person already present in the Candidate Graph by name, professional URL, email, or phone. It never silently merges identities.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Person name, professional profile URL, observed email, or observed phone.' },
        company: { type: 'string', description: 'Optional company disambiguator for name lookup.' },
      },
      required: ['identifier'],
      additionalProperties: false,
    },
    authority: 'owned_graph_read',
    externalProviderFanout: false,
    paidEnrichment: false,
    recruiterApprovalRequired: false,
    mcpExposed: true,
    embeddedAiExposed: true,
  },
  {
    name: 'get_candidate',
    description: 'Load a canonical Candidate Graph dossier with source profiles, evidence, known contacts, and role membership.',
    inputSchema: {
      type: 'object',
      properties: { candidateId: { type: 'string' } },
      required: ['candidateId'],
      additionalProperties: false,
    },
    authority: 'owned_graph_read',
    externalProviderFanout: false,
    paidEnrichment: false,
    recruiterApprovalRequired: false,
    mcpExposed: true,
    embeddedAiExposed: true,
  },
  {
    name: 'explain_candidate',
    description: 'Return the evidence and provenance behind a candidate without turning missing evidence into a rejection or provider scores into hiring decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        candidateId: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['candidateId'],
      additionalProperties: false,
    },
    authority: 'owned_graph_read',
    externalProviderFanout: false,
    paidEnrichment: false,
    recruiterApprovalRequired: false,
    mcpExposed: true,
    embeddedAiExposed: true,
  },
  {
    name: 'get_known_contacts',
    description: 'Read already-observed contact signals for a candidate. This tool never triggers paid contact enrichment and never sends outreach.',
    inputSchema: {
      type: 'object',
      properties: { candidateId: { type: 'string' } },
      required: ['candidateId'],
      additionalProperties: false,
    },
    authority: 'owned_graph_read',
    externalProviderFanout: false,
    paidEnrichment: false,
    recruiterApprovalRequired: false,
    mcpExposed: true,
    embeddedAiExposed: true,
  },
]

export function mcpToolSpecsV39_1() {
  return SOURCINGOS_TOOL_CONTRACTS_V39_1
    .filter(tool => tool.mcpExposed)
    .map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
}

export function embeddedAiToolSpecsV39_1() {
  return SOURCINGOS_TOOL_CONTRACTS_V39_1
    .filter(tool => tool.embeddedAiExposed)
    .map(tool => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
}

export async function executeSourcingOsToolV39_1(
  userId: string,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === 'search_people') return searchOwnedPeopleV38_5(userId, args)
  if (name === 'lookup_person') return lookupPersonV38_5(userId, args)
  if (name === 'get_candidate') return getCandidateV38_5(userId, args)
  if (name === 'explain_candidate') return explainCandidateV38_5(userId, args)
  if (name === 'get_known_contacts') return getKnownContactsV38_5(userId, args)
  throw new Error(`Unknown or unauthorized SourcingOS tool: ${name}`)
}
