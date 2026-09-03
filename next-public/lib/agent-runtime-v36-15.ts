import 'server-only'
import { aiProviderStatus, callModelJson } from './ai/provider'
import {
  buildUniversalPeopleProviderRequestV36_9,
  type UniversalPeopleProviderRequestV36_9,
} from './universal-people-search-v36-9'

export type AgentActionV36_15 = 'search_people' | 'approval_required'

export type AgentToolPlanV36_15 = {
  tool: 'search_people' | 'enrich_person' | 'find_contacts' | 'save_candidate' | 'engage' | 'sync_ats'
  rationale: string
  costClass: 'breadth' | 'paid_enrichment' | 'consequential'
  freshnessClass: 'provider_index' | 'live_or_paid' | 'not_applicable'
  approvalRequired: boolean
  executableNow: boolean
  targetCount?: number
}

export type ConversationalSourcingPlanV36_15 = {
  version: 'v36.15'
  action: AgentActionV36_15
  assistantSummary: string
  providerRequest: UniversalPeopleProviderRequestV36_9
  criteria: {
    titles: string[]
    skills: string[]
    companies: string[]
    locations: string[]
    requirements: Array<{ text: string; mustHave: boolean }>
    limit: number
  }
  toolPlan: AgentToolPlanV36_15[]
  readOnly: true
  model: {
    configured: boolean
    used: boolean
    provider?: string
    model?: string
  }
  assumptions: string[]
  warnings: string[]
}

export type ConversationalSourcingTurnInputV36_15 = {
  message: string
  previousPlan?: ConversationalSourcingPlanV36_15
}

type ModelPlan = {
  action?: string
  assistantSummary?: string
  query?: string
  titles?: unknown
  skills?: unknown
  companies?: unknown
  locations?: unknown
  requirements?: unknown
  limit?: unknown
  highFreshness?: unknown
  assumptions?: unknown
}

function clean(value: unknown, max = 240): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, max) : undefined
}

function list(value: unknown, maxItems: number, maxLength = 160): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => clean(item, maxLength)).filter(Boolean) as string[])).slice(0, maxItems)
}

function requirements(value: unknown): Array<{ text: string; mustHave: boolean }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ text: string; mustHave: boolean }> = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const text = clean(record.text, 300)
    if (!text) continue
    out.push({ text, mustHave: record.mustHave !== false })
    if (out.length >= 30) break
  }
  return out
}

function boundedLimit(value: unknown, fallback = 25): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(50, Math.trunc(parsed))) : fallback
}

function union(valuesA: string[] = [], valuesB: string[] = [], max = 50): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of [...valuesA, ...valuesB]) {
    const normalized = value.trim()
    const key = normalized.toLowerCase()
    if (!normalized || seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= max) break
  }
  return out
}

function unionRequirements(
  valuesA: Array<{ text: string; mustHave: boolean }> = [],
  valuesB: Array<{ text: string; mustHave: boolean }> = [],
): Array<{ text: string; mustHave: boolean }> {
  const byText = new Map<string, { text: string; mustHave: boolean }>()
  for (const item of [...valuesA, ...valuesB]) {
    const key = item.text.trim().toLowerCase()
    if (!key) continue
    const existing = byText.get(key)
    byText.set(key, { text: existing?.text || item.text.trim(), mustHave: Boolean(existing?.mustHave || item.mustHave) })
    if (byText.size >= 30) break
  }
  return [...byText.values()]
}

function looksLikeNewSearch(message: string): boolean {
  return /^(?:please\s+)?(?:find|search|source|show|look\s+for|looking\s+for|i\s+need|need)\b/i.test(message.trim())
}

const CONVERSATIONAL_ROLE_HINT = /^(?:administrators?|admins?|engineers?|developers?|architects?|managers?|directors?|recruiters?|sourcers?|analysts?|specialists?|technicians?|consultants?|scientists?|researchers?|designers?|nurses?|physicians?|doctors?|attorneys?|accountants?)$/i

/**
 * Universal People Search intentionally keeps its deterministic parser small.
 * The chat surface additionally understands counted/plural prompts as a fallback.
 * This only extracts a title phrase; it does not invent synonyms or evidence.
 */
function fallbackConversationalTitle(message: string): string | undefined {
  const stripped = message
    .replace(/^(?:please\s+)?(?:find(?:\s+me)?|show(?:\s+me)?|source|search\s+for|look\s+for|looking\s+for|i\s+need|need)\s+/i, '')
    .replace(/^\d{1,3}\s+/, '')
    .replace(/^(?:an?|the)\s+/i, '')
    .trim()
  if (!stripped) return undefined
  const locationBoundary = stripped.search(/\b(?:in\s+or\s+near|in\s+or\s+around|located\s+in|based\s+in|near|around|in)\s+[A-Za-z][A-Za-z .’'\-]{1,60},\s*[A-Z]{2}\b/i)
  const semanticBoundary = stripped.search(/\b(?:with|who|that|at)\b/i)
  const boundaries = [locationBoundary, semanticBoundary].filter(index => index >= 0)
  const boundary = boundaries.length ? Math.min(...boundaries) : -1
  const candidate = clean(boundary > 0 ? stripped.slice(0, boundary) : stripped, 100)
  if (!candidate) return undefined
  const tokens = candidate.split(/\s+/).map(token => token.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean)
  return tokens.some(token => CONVERSATIONAL_ROLE_HINT.test(token)) ? candidate : undefined
}

function looseRefinementLocation(message: string): string | undefined {
  const match = message.match(/\b(?:closer\s+to|near|around|within\s+\d+\s+miles?\s+of)\s+([A-Za-z][A-Za-z .’'\-]{1,60}(?:,\s*[A-Z]{2})?)(?=\s+(?:and|with|but|while|who|that)\b|[.;]|$)/i)
  return clean(match?.[1], 120)
}

function refinementPreference(message: string): { text: string; mustHave: boolean } | undefined {
  const match = message.match(/\b(?:prioritize|prefer|favor|favour|weight)\s+(?:people\s+)?(?:with|who\s+have|for)?\s*([^.;]{3,140}?)(?=\s+(?:and\s+(?:move|search|look|find|stay|keep)|but\b)|[.;]|$)/i)
  const value = clean(match?.[1], 180)
  if (!value) return undefined
  return { text: `Preference: ${value.replace(/^(?:people\s+)?with\s+/i, '')}`, mustHave: false }
}

function requestedTargetCount(message: string, fallback = 1): number {
  const top = message.match(/\btop\s+(\d{1,2})\b/i)
  if (top?.[1]) return Math.max(1, Math.min(25, Number(top[1])))
  const count = message.match(/\b(?:these|the)\s+(\d{1,2})\b/i)
  if (count?.[1]) return Math.max(1, Math.min(25, Number(count[1])))
  return fallback
}

function requestedApprovalAction(message: string): AgentToolPlanV36_15 | undefined {
  const value = message.toLowerCase()
  if (/\b(?:send|email|message|outreach|sequence|campaign)\b/.test(value)) {
    return { tool: 'engage', rationale: 'Outbound engagement changes external state. SourcingOS will prepare the action but requires explicit recruiter approval before execution.', costClass: 'consequential', freshnessClass: 'not_applicable', approvalRequired: true, executableNow: false }
  }
  if (/\b(?:sync|push)\b.*\b(?:ats|avature|greenhouse|lever|workday|icims)\b/.test(value)) {
    return { tool: 'sync_ats', rationale: 'ATS writes are consequential. SourcingOS will require an explicit recruiter approval checkpoint before any write.', costClass: 'consequential', freshnessClass: 'not_applicable', approvalRequired: true, executableNow: false }
  }
  if (/\b(?:save|add)\b.*\b(?:candidate|role|project|sourcingos|shortlist)\b/.test(value)) {
    return { tool: 'save_candidate', rationale: 'Saving candidates changes recruiting workflow state and therefore requires explicit recruiter approval.', costClass: 'consequential', freshnessClass: 'not_applicable', approvalRequired: true, executableNow: false }
  }
  if (/\b(?:find|reveal|get|enrich)\b.*\b(?:email|phone|contact|mobile)\b/.test(value)) {
    const targetCount = requestedTargetCount(message)
    return { tool: 'find_contacts', rationale: `Run the SourcingOS contact waterfall for ${targetCount} selected candidate${targetCount === 1 ? '' : 's'}. This can consume paid provider credits, so execution requires recruiter approval.`, costClass: 'paid_enrichment', freshnessClass: 'live_or_paid', approvalRequired: true, executableNow: false, targetCount }
  }
  return undefined
}

function deterministicPlan(message: string, previousPlan?: ConversationalSourcingPlanV36_15): UniversalPeopleProviderRequestV36_9 {
  const baseParsed = buildUniversalPeopleProviderRequestV36_9({ query: message, limit: previousPlan?.criteria.limit || 25 })
  const fallbackTitle = !baseParsed.titles?.length ? fallbackConversationalTitle(message) : undefined
  const parsed: UniversalPeopleProviderRequestV36_9 = fallbackTitle
    ? {
        ...baseParsed,
        titles: [fallbackTitle],
        requirements: unionRequirements(baseParsed.requirements || [], [{ text: `Current or relevant title: ${fallbackTitle}`, mustHave: false }]),
      }
    : baseParsed
  if (!previousPlan || looksLikeNewSearch(message)) return parsed

  const previous = previousPlan.providerRequest
  const refinementLocation = looseRefinementLocation(message)
  const preference = refinementPreference(message)
  return {
    query: `${previous.query} · Recruiter refinement: ${message}`.slice(0, 3000),
    requirements: unionRequirements(previous.requirements || [], [
      ...(parsed.requirements || []),
      ...(preference ? [preference] : []),
    ]),
    names: parsed.names?.length ? parsed.names : previous.names,
    titles: union(previous.titles || [], parsed.titles || [], 20),
    skills: union(previous.skills || [], parsed.skills || [], 40),
    companies: union(previous.companies || [], parsed.companies || [], 30),
    locations: refinementLocation ? [refinementLocation] : (parsed.locations?.length ? parsed.locations : previous.locations),
    limit: parsed.limit || previous.limit || 25,
    highFreshness: false,
  }
}

function modelPrompt(message: string, deterministic: UniversalPeopleProviderRequestV36_9, previousPlan?: ConversationalSourcingPlanV36_15): string {
  return `You are the recruiter search planner inside SourcingOS. Return one JSON object only.\n\nYour job is to translate the recruiter's CURRENT TURN into bounded professional people-search criteria. SourcingOS, not you, executes tools and determines evidence. Never invent candidate facts, qualifications, years, clearance, identity, contact information, or provider results.\n\nSearch_people may auto-run. Paid reads such as contact enrichment and consequential writes require explicit recruiter approval before SourcingOS executes them. If the recruiter requests one of those actions, set action to \"approval_required\".\n\nWhen this is a refinement, preserve useful prior criteria unless the recruiter explicitly changes them. Do not silently remove must-haves. Distinguish a preference such as \"prioritize production Kubernetes\" from a mandatory requirement.\n\nReturn keys exactly like this shape:\n{\n  \"action\": \"search_people\" | \"approval_required\",\n  \"assistantSummary\": string,\n  \"query\": string,\n  \"titles\": string[],\n  \"skills\": string[],\n  \"companies\": string[],\n  \"locations\": string[],\n  \"requirements\": [{\"text\": string, \"mustHave\": boolean}],\n  \"limit\": number,\n  \"highFreshness\": false,\n  \"assumptions\": string[]\n}\n\nCURRENT TURN:\n${JSON.stringify(message)}\n\nDETERMINISTIC SourcingOS PARSE:\n${JSON.stringify(deterministic)}\n\nPREVIOUS PLAN (if any):\n${JSON.stringify(previousPlan ? previousPlan.providerRequest : null)}\n\nImportant: retrieval expansion is not qualification evidence. Keep highFreshness false in this breadth-search release.`
}

function sanitizeModelPlan(model: ModelPlan, fallback: UniversalPeopleProviderRequestV36_9): UniversalPeopleProviderRequestV36_9 {
  const query = clean(model.query, 3000) || fallback.query
  return {
    query,
    requirements: requirements(model.requirements).length ? requirements(model.requirements) : fallback.requirements,
    names: fallback.names,
    titles: list(model.titles, 20).length ? list(model.titles, 20) : fallback.titles,
    skills: list(model.skills, 40).length ? list(model.skills, 40) : fallback.skills,
    companies: list(model.companies, 30, 180).length ? list(model.companies, 30, 180) : fallback.companies,
    locations: list(model.locations, 20, 120).length ? list(model.locations, 20, 120) : fallback.locations,
    limit: boundedLimit(model.limit, fallback.limit || 25),
    highFreshness: false,
  }
}

function criteria(request: UniversalPeopleProviderRequestV36_9) {
  return {
    titles: request.titles || [],
    skills: request.skills || [],
    companies: request.companies || [],
    locations: request.locations || [],
    requirements: request.requirements || [],
    limit: request.limit,
  }
}

function searchToolPlan(request: UniversalPeopleProviderRequestV36_9): AgentToolPlanV36_15 {
  const dimensions = [request.titles?.length, request.skills?.length, request.locations?.length, request.companies?.length].filter(Boolean).length
  return {
    tool: 'search_people',
    rationale: `Run the existing SourcingOS universal people-search orchestration across configured eligible providers using ${dimensions || 1} structured search dimension${dimensions === 1 ? '' : 's'}.`,
    costClass: 'breadth',
    freshnessClass: 'provider_index',
    approvalRequired: false,
    executableNow: true,
  }
}

function defaultSummary(request: UniversalPeopleProviderRequestV36_9, isRefinement: boolean): string {
  const parts = [
    request.titles?.[0] ? `role ${request.titles[0]}` : '',
    request.skills?.length ? `${request.skills.slice(0, 4).join(', ')}` : '',
    request.locations?.length ? `near ${request.locations.join(' / ')}` : '',
  ].filter(Boolean)
  return `${isRefinement ? 'I refined the search' : 'I translated that into a people search'}${parts.length ? ` for ${parts.join(' · ')}` : ''}. Search can run automatically; paid enrichment and external writes remain recruiter-controlled.`
}

function approvalSummary(tool: AgentToolPlanV36_15): string {
  if (tool.tool === 'find_contacts') {
    const count = tool.targetCount || 1
    return `I can run contact enrichment for the top ${count} candidate${count === 1 ? '' : 's'}. Because that can consume paid provider credits, I prepared the action and am waiting for your approval before running it.`
  }
  if (tool.tool === 'save_candidate') return 'I prepared the save action. It changes SourcingOS recruiting state, so I am waiting for your approval before executing it.'
  if (tool.tool === 'engage') return 'I prepared the engagement action. Nothing will be sent until you explicitly approve it.'
  if (tool.tool === 'sync_ats') return 'I prepared the ATS action. No external recruiting record will be changed until you explicitly approve it.'
  return 'I prepared the requested action and am waiting for recruiter approval before execution.'
}

export async function planConversationalSourcingTurnV36_15(
  input: ConversationalSourcingTurnInputV36_15,
): Promise<ConversationalSourcingPlanV36_15> {
  const message = clean(input.message, 3000) || ''
  const deterministic = deterministicPlan(message, input.previousPlan)
  const configured = aiProviderStatus()
  const explicitApprovalAction = requestedApprovalAction(message)

  let request = deterministic
  let modelUsed = false
  let modelSummary: string | undefined
  let assumptions: string[] = []
  let action: AgentActionV36_15 = explicitApprovalAction ? 'approval_required' : 'search_people'
  const warnings: string[] = []

  if (configured.configured) {
    const result = await callModelJson<ModelPlan>(modelPrompt(message, deterministic, input.previousPlan), 1200)
    if (result.ok && result.data) {
      request = sanitizeModelPlan(result.data, deterministic)
      modelUsed = true
      modelSummary = clean(result.data.assistantSummary, 600)
      assumptions = list(result.data.assumptions, 12, 240)
      if (result.data.action === 'approval_required') action = 'approval_required'
    } else {
      warnings.push('The configured reasoning model was unavailable for this turn; SourcingOS used its deterministic people-search parser instead.')
    }
  } else {
    warnings.push('No reasoning-model credential is configured; SourcingOS used its deterministic people-search parser. Provider-backed tool execution remains real.')
  }

  const approvalTool = explicitApprovalAction || (action === 'approval_required'
    ? { tool: 'save_candidate' as const, rationale: 'The requested next action sits outside automatic execution and requires recruiter approval.', costClass: 'consequential' as const, freshnessClass: 'not_applicable' as const, approvalRequired: true, executableNow: false }
    : undefined)

  const toolPlan = action === 'search_people' ? [searchToolPlan(request)] : [approvalTool!]
  if (action === 'approval_required') warnings.unshift('This action will not execute until the recruiter explicitly approves it.')

  return {
    version: 'v36.15',
    action,
    assistantSummary: action === 'approval_required' && approvalTool
      ? approvalSummary(approvalTool)
      : modelSummary || defaultSummary(request, Boolean(input.previousPlan)),
    providerRequest: request,
    criteria: criteria(request),
    toolPlan,
    readOnly: true,
    model: {
      configured: configured.configured,
      used: modelUsed,
      provider: configured.provider,
      model: configured.model,
    },
    assumptions,
    warnings,
  }
}