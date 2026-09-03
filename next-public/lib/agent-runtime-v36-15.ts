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

function looseRefinementLocation(message: string): string | undefined {
  const match = message.match(/\b(?:closer\s+to|near|around|within\s+\d+\s+miles?\s+of)\s+([A-Za-z][A-Za-z .’'\-]{1,60}(?:,\s*[A-Z]{2})?)(?=\s+(?:and|with|but|while|who|that)\b|[.;]|$)/i)
  return clean(match?.[1], 120)
}

function requestedApprovalAction(message: string): AgentToolPlanV36_15 | undefined {
  const value = message.toLowerCase()
  if (/\b(?:send|email|message|outreach|sequence|campaign)\b/.test(value)) {
    return { tool: 'engage', rationale: 'Sending or preparing an outbound engagement workflow requires explicit recruiter approval and is outside the read-only demo.', costClass: 'consequential', freshnessClass: 'not_applicable', approvalRequired: true, executableNow: false }
  }
  if (/\b(?:sync|push)\b.*\b(?:ats|avature|greenhouse|lever|workday|icims)\b/.test(value)) {
    return { tool: 'sync_ats', rationale: 'ATS writes are consequential and require a separately approved integration workflow.', costClass: 'consequential', freshnessClass: 'not_applicable', approvalRequired: true, executableNow: false }
  }
  if (/\b(?:save|add)\b.*\b(?:candidate|role|project|sourcingos|shortlist)\b/.test(value)) {
    return { tool: 'save_candidate', rationale: 'Saving or changing recruiting workflow state requires an explicit recruiter action outside this read-only search turn.', costClass: 'consequential', freshnessClass: 'not_applicable', approvalRequired: true, executableNow: false }
  }
  if (/\b(?:find|reveal|get|enrich)\b.*\b(?:email|phone|contact|mobile)\b/.test(value)) {
    return { tool: 'find_contacts', rationale: 'Contact enrichment can consume paid credits and is intentionally opt-in after candidate review.', costClass: 'paid_enrichment', freshnessClass: 'live_or_paid', approvalRequired: true, executableNow: false }
  }
  return undefined
}

function deterministicPlan(message: string, previousPlan?: ConversationalSourcingPlanV36_15): UniversalPeopleProviderRequestV36_9 {
  const parsed = buildUniversalPeopleProviderRequestV36_9({ query: message, limit: previousPlan?.criteria.limit || 25 })
  if (!previousPlan || looksLikeNewSearch(message)) return parsed

  const previous = previousPlan.providerRequest
  const refinementLocation = looseRefinementLocation(message)
  return {
    query: `${previous.query} · Recruiter refinement: ${message}`.slice(0, 3000),
    requirements: unionRequirements(previous.requirements || [], parsed.requirements || []),
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
  return `You are the read-only recruiter search planner inside SourcingOS. Return one JSON object only.\n\nYour job is to translate the recruiter's CURRENT TURN into bounded professional people-search criteria. SourcingOS, not you, executes tools and determines evidence. Never invent candidate facts, qualifications, years, clearance, identity, contact information, or provider results.\n\nThis release may auto-run only search_people. If the recruiter requests saving, contact reveal/enrichment, outreach, ATS writes, or other consequential actions, set action to \"approval_required\".\n\nWhen this is a refinement, preserve useful prior criteria unless the recruiter explicitly changes them. Do not silently remove must-haves.\n\nReturn keys exactly like this shape:\n{\n  \"action\": \"search_people\" | \"approval_required\",\n  \"assistantSummary\": string,\n  \"query\": string,\n  \"titles\": string[],\n  \"skills\": string[],\n  \"companies\": string[],\n  \"locations\": string[],\n  \"requirements\": [{\"text\": string, \"mustHave\": boolean}],\n  \"limit\": number,\n  \"highFreshness\": false,\n  \"assumptions\": string[]\n}\n\nCURRENT TURN:\n${JSON.stringify(message)}\n\nDETERMINISTIC SourcingOS PARSE:\n${JSON.stringify(deterministic)}\n\nPREVIOUS PLAN (if any):\n${JSON.stringify(previousPlan ? previousPlan.providerRequest : null)}\n\nImportant: retrieval expansion is not qualification evidence. Keep highFreshness false in this read-only breadth-search release.`
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
  return `${isRefinement ? 'I refined the search' : 'I translated that into a read-only people search'}${parts.length ? ` for ${parts.join(' · ')}` : ''}. I can search configured professional sources, but I will not save, contact, merge, or advance anyone in this turn.`
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
    warnings.push('No reasoning-model credential is configured; SourcingOS used its deterministic people-search parser. Search execution is still real and provider-backed.')
  }

  const approvalTool = explicitApprovalAction || (action === 'approval_required'
    ? { tool: 'save_candidate' as const, rationale: 'The requested next action is outside the read-only auto-execution boundary.', costClass: 'consequential' as const, freshnessClass: 'not_applicable' as const, approvalRequired: true, executableNow: false }
    : undefined)

  const toolPlan = action === 'search_people' ? [searchToolPlan(request)] : [approvalTool!]
  if (action === 'approval_required') warnings.unshift('This turn requests a paid or consequential action. V36.15 will not auto-execute it.')

  return {
    version: 'v36.15',
    action,
    assistantSummary: modelSummary || defaultSummary(request, Boolean(input.previousPlan)),
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
