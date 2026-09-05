import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  experimentalProviderFlagsV40_7,
  isProtectedFleetTargetV40_7,
  type FleetImprovementPodIdV40_7,
} from './governance-v40-7'
import {
  createImprovementFleetBatchV40_7,
  type FleetWorkBatchV40_7,
  type FleetWorkItemV40_7,
} from './improvement-workflow-v40-7'

export type FleetRuntimeEventDataV40_7b = {
  ownerId: string
  item: FleetWorkItemV40_7
  dryRun?: boolean
}

export type FleetProviderReadinessV40_7b = {
  inngestEventKey: boolean
  inngestSigningKey: boolean
  anthropic: boolean
  exa: boolean
  vercelExa: boolean
  firecrawl: boolean
  parallel: boolean
}

export type FleetResearchArtifactV40_7b = {
  provider: 'exa' | 'vercel_exa' | 'firecrawl' | 'parallel' | 'github'
  title: string
  url?: string
  excerpt?: string
}

export type FleetAgentResultV40_7b = {
  summary: string
  findings: string[]
  recommendedNextActions: string[]
  sources: FleetResearchArtifactV40_7b[]
  model: string | null
  providerUsed: string | null
  dryRun: boolean
}

const POD_ORDER: readonly FleetImprovementPodIdV40_7[] = [
  'search_intelligence',
  'candidate_intelligence',
  'recruiter_ux',
  'product_engineering',
  'qa_red_team',
]

const REPO = 'middlechildmzk/sourcingos-unified'
const MAX_EXTERNAL_RESULTS = 4
const MAX_SOURCE_EXCERPT = 1500
const MAX_CONTEXT_CHARS = 12_000

function enabled(value: string | undefined): boolean {
  return String(value || '').trim().toLowerCase() === 'true'
}

function clean(value: unknown, max = 1200): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function fleetProviderReadinessV40_7b(
  env: Record<string, string | undefined> = process.env,
): FleetProviderReadinessV40_7b {
  return {
    inngestEventKey: Boolean(env.INNGEST_EVENT_KEY),
    inngestSigningKey: Boolean(env.INNGEST_SIGNING_KEY),
    anthropic: Boolean(env.ANTHROPIC_API_KEY || env.AI_PROVIDER_API_KEY),
    exa: Boolean(env.EXA_API_KEY),
    vercelExa: Boolean(env.VERCEL_EXA_EXA_API_KEY),
    firecrawl: Boolean(env.FIRECRAWL_API_KEY),
    parallel: Boolean(env.PARALLEL_API_KEY),
  }
}

export function selectFleetWorkItemsV40_7b(
  batch: FleetWorkBatchV40_7,
  requestedCount: number,
): FleetWorkItemV40_7[] {
  const count = Math.max(1, Math.min(50, Math.trunc(requestedCount || 1)))
  const byPod = new Map<FleetImprovementPodIdV40_7, FleetWorkItemV40_7[]>()
  for (const pod of POD_ORDER) byPod.set(pod, [])
  for (const item of batch.items) byPod.get(item.pod)?.push(item)

  const selected: FleetWorkItemV40_7[] = []
  for (let seatIndex = 0; seatIndex < 10 && selected.length < count; seatIndex += 1) {
    for (const pod of POD_ORDER) {
      const item = byPod.get(pod)?.[seatIndex]
      if (item) selected.push(item)
      if (selected.length >= count) break
    }
  }
  return selected
}

export function validateFleetDispatchV40_7b(input: {
  target: string
  count: number
  confirmFullFleet?: boolean
}) {
  const target = clean(input.target, 500)
  const count = Math.trunc(Number(input.count || 1))
  if (!target) throw new Error('Fleet dispatch requires a target.')
  if (isProtectedFleetTargetV40_7(target)) throw new Error('Fleet target is protected from V40.7b dispatch.')
  if (!Number.isFinite(count) || count < 1 || count > 50) throw new Error('Fleet dispatch count must be between 1 and 50.')
  if (count > 10 && input.confirmFullFleet !== true) {
    throw new Error('Fleet dispatch above 10 work items requires confirmFullFleet=true.')
  }
  return { target, count }
}

export function createFleetDispatchBatchV40_7b(input: {
  batchId: string
  target: string
  count: number
  confirmFullFleet?: boolean
  contextRefs?: readonly string[]
}) {
  const validated = validateFleetDispatchV40_7b(input)
  const batch = createImprovementFleetBatchV40_7({
    batchId: input.batchId,
    target: validated.target,
    contextRefs: input.contextRefs,
  })
  return {
    batch,
    selected: selectFleetWorkItemsV40_7b(batch, validated.count),
  }
}

export async function persistFleetWorkItemsV40_7b(input: {
  sb: SupabaseClient
  ownerId: string
  batchId: string
  items: readonly FleetWorkItemV40_7[]
}) {
  const rows = input.items.map(item => ({
    id: item.id,
    owner_id: input.ownerId,
    batch_id: input.batchId,
    agent_id: item.agentId,
    pod: item.pod,
    seat: item.seat,
    workstream: item.workstream,
    mode: item.mode,
    target: item.target,
    context_refs: item.contextRefs,
    constraints: item.constraints,
    status: 'queued',
    requested_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await input.sb.from('fleet_improvement_work_items').upsert(rows, {
    onConflict: 'id',
    ignoreDuplicates: true,
  })
  if (error) throw new Error(`Fleet work-item persistence failed: ${error.message}`)
}

export async function claimFleetWorkItemV40_7b(input: {
  sb: SupabaseClient
  itemId: string
  eventId?: string | null
}) {
  const { data, error } = await input.sb.rpc('claim_fleet_improvement_work_item_v40_7b', {
    p_id: input.itemId,
    p_event_id: input.eventId || '',
    p_stale_after_minutes: 30,
  })
  if (error) throw new Error(`Fleet work-item claim failed: ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  return {
    claimed: Boolean(row?.claimed),
    status: clean(row?.item_status, 80) || 'unknown',
    attempts: Number(row?.attempts || 0),
  }
}

export async function finishFleetWorkItemV40_7b(input: {
  sb: SupabaseClient
  itemId: string
  status: 'completed' | 'blocked' | 'failed'
  result?: FleetAgentResultV40_7b | null
  error?: string | null
}) {
  const { error } = await input.sb.from('fleet_improvement_work_items').update({
    status: input.status,
    result: input.result || null,
    error: input.error ? clean(input.error, 2000) : null,
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', input.itemId)
  if (error) throw new Error(`Fleet work-item finish failed: ${error.message}`)
}

export async function listRecentFleetWorkItemsV40_7b(input: {
  sb: SupabaseClient
  ownerId: string
  limit?: number
}) {
  const limit = Math.max(1, Math.min(100, Math.trunc(input.limit || 25)))
  const { data, error } = await input.sb.from('fleet_improvement_work_items')
    .select('id,batch_id,agent_id,pod,seat,workstream,mode,target,status,attempt_count,result,error,requested_at,started_at,finished_at,updated_at')
    .eq('owner_id', input.ownerId)
    .order('requested_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Fleet runtime status query failed: ${error.message}`)
  return Array.isArray(data) ? data : []
}

function issueNumber(ref: string): number | null {
  const match = ref.match(/(?:issue:)?#(\d+)/i)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

async function githubIssueArtifacts(item: FleetWorkItemV40_7): Promise<FleetResearchArtifactV40_7b[]> {
  const numbers = Array.from(new Set(item.contextRefs.map(issueNumber).filter((value): value is number => value !== null))).slice(0, 3)
  if (!numbers.length) return []

  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'SourcingOS-V40.7b',
  }
  if (process.env.GITHUB_API_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_API_TOKEN}`

  const artifacts: FleetResearchArtifactV40_7b[] = []
  for (const number of numbers) {
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}/issues/${number}`, {
        headers,
        cache: 'no-store',
      })
      if (!response.ok) continue
      const row = await response.json() as Record<string, unknown>
      artifacts.push({
        provider: 'github',
        title: clean(row.title, 300) || `Issue #${number}`,
        url: isHttpUrl(row.html_url) ? row.html_url : undefined,
        excerpt: clean(row.body, MAX_SOURCE_EXCERPT),
      })
    } catch {
      // One missing public issue must never fail the entire agent job.
    }
  }
  return artifacts
}

function researchQuery(item: FleetWorkItemV40_7): string {
  return clean(`${item.target}. ${item.workstream}. Find current, concrete evidence or implementation patterns relevant to this SourcingOS workstream. Prefer primary documentation and attributable sources.`, 500)
}

async function exaSearch(key: string, query: string, provider: 'exa' | 'vercel_exa'): Promise<FleetResearchArtifactV40_7b[]> {
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({
      query,
      type: 'auto',
      numResults: MAX_EXTERNAL_RESULTS,
      contents: { highlights: true },
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Exa research returned HTTP ${response.status}.`)
  const payload = await response.json() as Record<string, unknown>
  const results = Array.isArray(payload.results) ? payload.results : []
  return results.slice(0, MAX_EXTERNAL_RESULTS).map(value => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const highlights = Array.isArray(row.highlights) ? row.highlights.map(value => clean(value, 600)).filter(Boolean).join(' ') : ''
    return {
      provider,
      title: clean(row.title, 300) || 'Exa result',
      url: isHttpUrl(row.url) ? row.url : undefined,
      excerpt: clean(highlights || row.text, MAX_SOURCE_EXCERPT),
    }
  })
}

async function firecrawlSearch(key: string, query: string): Promise<FleetResearchArtifactV40_7b[]> {
  const response = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, limit: MAX_EXTERNAL_RESULTS, sources: ['web'] }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Firecrawl research returned HTTP ${response.status}.`)
  const payload = await response.json() as Record<string, unknown>
  const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {}
  const results = Array.isArray(data.web) ? data.web : []
  return results.slice(0, MAX_EXTERNAL_RESULTS).map(value => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return {
      provider: 'firecrawl' as const,
      title: clean(row.title, 300) || 'Firecrawl result',
      url: isHttpUrl(row.url) ? row.url : undefined,
      excerpt: clean(row.description || row.markdown, MAX_SOURCE_EXCERPT),
    }
  })
}

async function parallelSearch(key: string, query: string): Promise<FleetResearchArtifactV40_7b[]> {
  const compactQuery = clean(query, 200)
  const response = await fetch('https://api.parallel.ai/v1/search', {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      objective: query,
      search_queries: [compactQuery],
      max_results: MAX_EXTERNAL_RESULTS,
      max_chars_total: 6000,
      mode: 'one-shot',
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Parallel research returned HTTP ${response.status}.`)
  const payload = await response.json() as Record<string, unknown>
  const results = Array.isArray(payload.results) ? payload.results : []
  return results.slice(0, MAX_EXTERNAL_RESULTS).map(value => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const excerpts = Array.isArray(row.excerpts) ? row.excerpts.map(value => clean(value, 600)).filter(Boolean).join(' ') : ''
    return {
      provider: 'parallel' as const,
      title: clean(row.title, 300) || 'Parallel result',
      url: isHttpUrl(row.url) ? row.url : undefined,
      excerpt: clean(excerpts || row.content, MAX_SOURCE_EXCERPT),
    }
  })
}

export async function providerResearchForWorkItemV40_7b(item: FleetWorkItemV40_7): Promise<{
  providerUsed: string | null
  artifacts: FleetResearchArtifactV40_7b[]
  warning?: string
}> {
  if (item.pod !== 'search_intelligence') return { providerUsed: null, artifacts: [] }

  const flags = experimentalProviderFlagsV40_7()
  const globalExperimental = enabled(process.env.AGENT_FLEET_EXPERIMENTAL_PROVIDERS)
  const candidates: Array<{ id: string; run: () => Promise<FleetResearchArtifactV40_7b[]> }> = []
  const query = researchQuery(item)

  if (process.env.EXA_API_KEY) candidates.push({ id: 'exa', run: () => exaSearch(process.env.EXA_API_KEY!, query, 'exa') })
  if (globalExperimental && enabled(process.env.AGENT_FLEET_PROVIDER_VERCEL_EXA) && process.env.VERCEL_EXA_EXA_API_KEY) {
    candidates.push({ id: 'vercel_exa', run: () => exaSearch(process.env.VERCEL_EXA_EXA_API_KEY!, query, 'vercel_exa') })
  }
  if (flags.firecrawl && process.env.FIRECRAWL_API_KEY) candidates.push({ id: 'firecrawl', run: () => firecrawlSearch(process.env.FIRECRAWL_API_KEY!, query) })
  if (flags.parallel && process.env.PARALLEL_API_KEY) candidates.push({ id: 'parallel', run: () => parallelSearch(process.env.PARALLEL_API_KEY!, query) })

  if (!candidates.length) return { providerUsed: null, artifacts: [], warning: 'No enabled web-research provider is configured for this work item.' }

  // One provider call per agent keeps spend bounded. Seat rotation gives the
  // benchmark attributable coverage when multiple challengers are enabled.
  const selected = candidates[(Math.max(1, item.seat) - 1) % candidates.length]
  try {
    return { providerUsed: selected.id, artifacts: await selected.run() }
  } catch (error) {
    return {
      providerUsed: selected.id,
      artifacts: [],
      warning: error instanceof Error ? clean(error.message, 500) : 'Provider research failed.',
    }
  }
}

function sourceContext(artifacts: readonly FleetResearchArtifactV40_7b[]): string {
  return artifacts.map((source, index) => {
    const parts = [`[${index + 1}] ${source.provider}: ${source.title}`]
    if (source.url) parts.push(source.url)
    if (source.excerpt) parts.push(source.excerpt)
    return parts.join('\n')
  }).join('\n\n').slice(0, MAX_CONTEXT_CHARS)
}

function parseAgentJson(text: string): { summary: string; findings: string[]; recommendedNextActions: string[] } {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(stripped) as Record<string, unknown>
  } catch {
    return { summary: clean(stripped, 1500) || 'Agent completed without structured output.', findings: [], recommendedNextActions: [] }
  }
  const stringList = (value: unknown) => Array.isArray(value) ? value.map(item => clean(item, 700)).filter(Boolean).slice(0, 12) : []
  return {
    summary: clean(parsed.summary, 1500) || 'Agent completed.',
    findings: stringList(parsed.findings),
    recommendedNextActions: stringList(parsed.recommended_next_actions ?? parsed.recommendedNextActions),
  }
}

async function runAnthropicWorkV40_7b(input: {
  item: FleetWorkItemV40_7
  artifacts: FleetResearchArtifactV40_7b[]
  providerWarning?: string
}): Promise<{ model: string; output: ReturnType<typeof parseAgentJson> }> {
  const key = process.env.ANTHROPIC_API_KEY || process.env.AI_PROVIDER_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not configured for the improvement fleet.')
  const model = process.env.AGENT_FLEET_MODEL || process.env.AI_PROVIDER_MODEL || 'claude-sonnet-4-6'
  const prompt = [
    'You are one bounded SourcingOS improvement-fleet worker. Return only JSON with keys summary, findings, recommended_next_actions.',
    `Pod: ${input.item.pod}`,
    `Seat: ${input.item.seat}`,
    `Mode: ${input.item.mode}`,
    `Workstream: ${input.item.workstream}`,
    `Target: ${input.item.target}`,
    `Context refs: ${input.item.contextRefs.join(', ') || 'none'}`,
    '',
    'Binding constraints:',
    '- public professional evidence and primary documentation only',
    '- never scrape LinkedIn or account-gated pages',
    '- never bypass authentication, paywalls, CAPTCHA, robots/access controls, or private storage',
    '- never harvest contacts unattended',
    '- never silently merge identities',
    '- never send outreach or make a hiring/rejection decision',
    '- never claim, requeue, release, or modify Resume/CV sprint work',
    '- do not purchase or upgrade providers',
    '- treat missing evidence as unknown, not failure',
    '- distinguish search/discovery terms from actual candidate evidence',
    '- recommendations may propose branch-scoped engineering work, but this worker has no production-write authority',
    '',
    input.providerWarning ? `Provider warning: ${input.providerWarning}` : '',
    input.artifacts.length ? `Available attributable context:\n${sourceContext(input.artifacts)}` : 'No additional source context was retrieved. Work from the task definition and clearly mark any uncertainty.',
    '',
    'Produce concrete, deduplicated findings and next actions that another orchestrator can rank. Avoid generic advice.',
  ].filter(Boolean).join('\n')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Anthropic fleet worker returned HTTP ${response.status}.`)
  const payload = await response.json() as Record<string, unknown>
  const blocks = Array.isArray(payload.content) ? payload.content : []
  const text = blocks.map(value => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return row.type === 'text' ? clean(row.text, 8000) : ''
  }).filter(Boolean).join('\n')
  return { model, output: parseAgentJson(text) }
}

export async function executeFleetWorkItemV40_7b(input: {
  item: FleetWorkItemV40_7
  dryRun?: boolean
}): Promise<FleetAgentResultV40_7b> {
  if (isProtectedFleetTargetV40_7(input.item.target)) throw new Error('Protected Resume/CV target rejected at execution time.')

  const githubArtifacts = await githubIssueArtifacts(input.item)
  const provider = input.dryRun
    ? { providerUsed: null, artifacts: [] as FleetResearchArtifactV40_7b[], warning: 'Dry run: external search provider call skipped.' }
    : await providerResearchForWorkItemV40_7b(input.item)
  const sources = [...githubArtifacts, ...provider.artifacts].slice(0, 10)

  if (input.dryRun) {
    return {
      summary: `Dry-run validated ${input.item.agentId} for ${input.item.target}.`,
      findings: [
        `Pod ${input.item.pod} / seat ${input.item.seat} is dispatchable.`,
        'Resume/CV production queue authority is false.',
        provider.warning || 'No provider warning.',
      ],
      recommendedNextActions: ['Send the same bounded item with dryRun=false after runtime credentials and migration are validated.'],
      sources,
      model: null,
      providerUsed: provider.providerUsed,
      dryRun: true,
    }
  }

  const agent = await runAnthropicWorkV40_7b({
    item: input.item,
    artifacts: sources,
    providerWarning: provider.warning,
  })

  return {
    summary: agent.output.summary,
    findings: agent.output.findings,
    recommendedNextActions: agent.output.recommendedNextActions,
    sources,
    model: agent.model,
    providerUsed: provider.providerUsed,
    dryRun: false,
  }
}
