export const AGENT_FLEET_SIZE_V40 = 50 as const
export const AGENTS_PER_POD_V40 = 10 as const

export const AGENT_FLEET_PODS_V40 = [
  {
    id: 'search-intelligence',
    label: 'Search Intelligence',
    mission: 'Benchmark public-web discovery quality, query strategy, provider yield, duplicate patterns, and weak-result failure modes.',
  },
  {
    id: 'candidate-intelligence',
    label: 'Candidate Intelligence',
    mission: 'Audit public professional evidence, Resume/CV identity precision, requirement coverage, match explanations, and evidence gaps.',
  },
  {
    id: 'recruiter-ux',
    label: 'Recruiter UX',
    mission: 'Convert recruiter workflows and competitive evidence into concrete V40.6 list/detail workbench recommendations.',
  },
  {
    id: 'product-engineering',
    label: 'Product & Engineering',
    mission: 'Map findings to existing SourcingOS components, reuse opportunities, technical debt, responsive behavior, accessibility, and build sequence.',
  },
  {
    id: 'qa-red-team',
    label: 'QA & Red Team',
    mission: 'Try to break search interpretation, identity, evidence claims, provider behavior, contacts, mobile review, and release gates.',
  },
] as const

export type AgentFleetPodIdV40 = typeof AGENT_FLEET_PODS_V40[number]['id']
export type AgentFleetScopeV40 = 'research_only' | 'production_resume_queue'

export type AgentFleetTaskV40 = {
  id: string
  runId: string
  ordinal: number
  pod: AgentFleetPodIdV40
  podLabel: string
  agentNumber: number
  objective: string
  prompt: string
  readOnly: true
  publicEvidenceOnly: true
  productionResumeQueueAllowed: false
}

export type AgentFleetPlanV40 = {
  version: 'v40.agent-fleet-50'
  runId: string
  scope: 'research_only'
  taskCount: 50
  agentsPerPod: 10
  tasks: AgentFleetTaskV40[]
  guardrails: string[]
}

export type AgentFleetIntegrationStatusV40 = {
  exaBaseline: { configured: boolean; env: 'EXA_API_KEY' }
  exaVercel: { configured: boolean; env: 'VERCEL_EXA_EXA_API_KEY' }
  firecrawl: { configured: boolean; env: 'FIRECRAWL_API_KEY' }
  parallel: { configured: boolean; env: 'PARALLEL_API_KEY' }
  inngest: {
    eventKeyConfigured: boolean
    signingKeyConfigured: boolean
    eventEnv: 'INNGEST_EVENT_KEY'
    signingEnv: 'INNGEST_SIGNING_KEY'
  }
  fleetEnabled: boolean
  providerBenchmarkEnabled: boolean
  productionResumeQueueAllowed: false
}

const SHARED_GUARDRAILS = [
  'Use public professional evidence only.',
  'Do not scrape LinkedIn, authenticated pages, paywalls, CAPTCHAs, private clouds, or access-controlled sources.',
  'Search/discovery terms are not candidate evidence.',
  'Missing evidence means unknown, not disqualified.',
  'Do not guess contact data, clearance, identity, employment, or qualifications.',
  'Do not merge ambiguous identities.',
  'Do not send outreach, reject candidates, hire candidates, or make consequential recruiting decisions.',
  'Keep provider provenance attached to every web-derived claim.',
  'Do not mutate the V40.5i production Resume/CV queue.',
] as const

function cleanId(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._:-]/g, '-').replace(/-+/g, '-').slice(0, 96)
  if (!cleaned) throw new Error('run_id_required')
  return cleaned
}

export function buildAgentFleetPlanV40(input: {
  runId: string
  objective: string
  scope?: AgentFleetScopeV40
  sharedContext?: string
}): AgentFleetPlanV40 {
  if ((input.scope || 'research_only') !== 'research_only') {
    throw new Error('production_resume_queue_blocked_pending_v40_5i_canary')
  }

  const runId = cleanId(input.runId)
  const objective = input.objective.trim().slice(0, 4000)
  if (!objective) throw new Error('objective_required')
  const sharedContext = input.sharedContext?.trim().slice(0, 12000) || ''
  const tasks: AgentFleetTaskV40[] = []

  for (const pod of AGENT_FLEET_PODS_V40) {
    for (let index = 1; index <= AGENTS_PER_POD_V40; index += 1) {
      const ordinal = tasks.length + 1
      const taskId = `${runId}:${pod.id}:${String(index).padStart(2, '0')}`
      tasks.push({
        id: taskId,
        runId,
        ordinal,
        pod: pod.id,
        podLabel: pod.label,
        agentNumber: index,
        objective,
        prompt: [
          `You are SourcingOS Agent ${ordinal}/50 in the ${pod.label} pod (${index}/10).`,
          `POD MISSION: ${pod.mission}`,
          `RUN OBJECTIVE: ${objective}`,
          sharedContext ? `SHARED CONTEXT:\n${sharedContext}` : '',
          `GUARDRAILS:\n- ${SHARED_GUARDRAILS.join('\n- ')}`,
          'Return a concise JSON object with: findings[], evidence[], risks[], recommendations[], nextActions[]. Separate observed evidence from inference. Do not fabricate provider results.',
        ].filter(Boolean).join('\n\n'),
        readOnly: true,
        publicEvidenceOnly: true,
        productionResumeQueueAllowed: false,
      })
    }
  }

  if (tasks.length !== AGENT_FLEET_SIZE_V40) throw new Error('fleet_plan_size_invariant_failed')

  return {
    version: 'v40.agent-fleet-50',
    runId,
    scope: 'research_only',
    taskCount: AGENT_FLEET_SIZE_V40,
    agentsPerPod: AGENTS_PER_POD_V40,
    tasks,
    guardrails: [...SHARED_GUARDRAILS],
  }
}

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

export function agentFleetIntegrationStatusV40(env: Record<string, string | undefined>): AgentFleetIntegrationStatusV40 {
  return {
    exaBaseline: { configured: configured(env.EXA_API_KEY), env: 'EXA_API_KEY' },
    exaVercel: { configured: configured(env.VERCEL_EXA_EXA_API_KEY), env: 'VERCEL_EXA_EXA_API_KEY' },
    firecrawl: { configured: configured(env.FIRECRAWL_API_KEY), env: 'FIRECRAWL_API_KEY' },
    parallel: { configured: configured(env.PARALLEL_API_KEY), env: 'PARALLEL_API_KEY' },
    inngest: {
      eventKeyConfigured: configured(env.INNGEST_EVENT_KEY),
      signingKeyConfigured: configured(env.INNGEST_SIGNING_KEY),
      eventEnv: 'INNGEST_EVENT_KEY',
      signingEnv: 'INNGEST_SIGNING_KEY',
    },
    fleetEnabled: env.AGENT_FLEET_ENABLED === 'true',
    providerBenchmarkEnabled: env.AGENT_FLEET_PROVIDER_BENCHMARK_ENABLED === 'true',
    productionResumeQueueAllowed: false,
  }
}
