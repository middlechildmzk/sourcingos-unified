import 'server-only'
import { aiProviderStatus } from './ai/provider'
import {
  planConversationalSourcingTurnV36_15,
  type ConversationalSourcingPlanV36_15,
  type ConversationalSourcingTurnInputV36_15,
} from './agent-runtime-v36-15'

export type ConversationalWebPlanV36_16 = {
  version: 'v36.16'
  action: 'search_web'
  assistantSummary: string
  webRequest: { action: 'search_web'; query: string }
  toolPlan: Array<{
    tool: 'search_web'
    rationale: string
    costClass: 'live'
    freshnessClass: 'live_web'
    approvalRequired: false
    executableNow: true
  }>
  readOnly: true
  model: { configured: boolean; used: false; provider?: string; model?: string }
  assumptions: string[]
  warnings: string[]
}

export type ConversationalSourcingPlanV36_16 = ConversationalSourcingPlanV36_15 | ConversationalWebPlanV36_16

function clean(value: string, max = 500): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * V36.16 deliberately requires explicit web-research language. A normal sourcing
 * sentence like "find backend engineers" must continue through search_people and
 * must not silently trigger live-web/MCP spend or latency.
 */
export function explicitWebResearchQueryV36_16(message: string): string | undefined {
  const value = clean(message, 700)
  if (!value) return undefined

  const patterns = [
    /^(?:please\s+)?search\s+(?:the\s+)?(?:web|internet)\s+(?:for|about)\s+(.+)$/i,
    /^(?:please\s+)?(?:check|research|look\s+up)\s+(?:the\s+)?(?:web|internet)\s+(?:for|about)\s+(.+)$/i,
    /^(?:please\s+)?look\s+(?:on|across)\s+(?:the\s+)?(?:web|internet)\s+(?:for|about)\s+(.+)$/i,
    /^(?:please\s+)?web\s+search\s+(?:for|about)\s+(.+)$/i,
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    const query = match?.[1] ? clean(match[1]) : ''
    if (query.length >= 2) return query
  }
  return undefined
}

export async function planConversationalSourcingTurnV36_16(
  input: ConversationalSourcingTurnInputV36_15,
): Promise<ConversationalSourcingPlanV36_16> {
  const webQuery = explicitWebResearchQueryV36_16(input.message)
  if (!webQuery) return planConversationalSourcingTurnV36_15(input)

  const model = aiProviderStatus()
  return {
    version: 'v36.16',
    action: 'search_web',
    assistantSummary: `I’ll run a live web search for “${webQuery}” through SourcingOS’s allowlisted web-research tool.`,
    webRequest: { action: 'search_web', query: webQuery },
    toolPlan: [{
      tool: 'search_web',
      rationale: 'Run live public-web research through the SourcingOS Bright Data Rapid MCP adapter. Returned web text remains untrusted evidence input and is not promoted to candidate fact.',
      costClass: 'live',
      freshnessClass: 'live_web',
      approvalRequired: false,
      executableNow: true,
    }],
    readOnly: true,
    model: { configured: model.configured, used: false, provider: model.provider, model: model.model },
    assumptions: [],
    warnings: ['Live-web content is source material, not verified candidate evidence. SourcingOS will not silently merge identities or convert web claims into qualifications.'],
  }
}
