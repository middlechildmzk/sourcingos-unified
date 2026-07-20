import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const ROLE_LAUNCH_STEPS = [
  { key: 'intake', agent: 'jd_analyst', approval: false },
  { key: 'strategy', agent: 'sourcing_strategist', approval: true },
  { key: 'campaigns', agent: 'discovery_orchestrator', approval: false },
  { key: 'review', agent: 'candidate_reviewer', approval: false },
  { key: 'calibration', agent: 'memory_analyst', approval: true },
  { key: 'handoff', agent: 'recruiter_copilot', approval: false },
] as const

export type RoleLaunchInput = {
  roleId?: string | null
  title: string
  intake: string
  skills?: string[]
  locations?: string[]
  targetCompanies?: string[]
}

type RoleLaunchStrategy = {
  roleSummary: string
  mustValidate: string[]
  searchQuery: string
  connectors: Array<'github' | 'openalex' | 'orcid'>
  targetCompanies: string[]
  locations: string[]
  guardrails: string[]
}

function now() { return new Date().toISOString() }

export async function createRoleLaunchWorkflow(ownerId: string, input: RoleLaunchInput) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')

  const { data: workflow, error } = await sb.from('agent_workflows').insert({
    owner_id: ownerId,
    role_id: input.roleId || null,
    workflow_type: 'role_launch',
    status: 'queued',
    current_step: ROLE_LAUNCH_STEPS[0].key,
    input,
    next_run_at: now(),
  }).select('*').single()
  if (error || !workflow) throw new Error(error?.message || 'Could not create workflow.')

  const steps = ROLE_LAUNCH_STEPS.map(step => ({
    owner_id: ownerId,
    workflow_id: workflow.id,
    step_key: step.key,
    agent_key: step.agent,
    status: 'queued',
    input: {},
  }))
  const { error: stepError } = await sb.from('agent_steps').insert(steps)
  if (stepError) throw new Error(stepError.message)
  return workflow
}

function strategyOutput(input: RoleLaunchInput): RoleLaunchStrategy {
  const skills = Array.from(new Set((input.skills || []).map(v => v.trim()).filter(Boolean))).slice(0, 20)
  const locations = (input.locations || []).slice(0, 10)
  const companies = (input.targetCompanies || []).slice(0, 30)
  const query = [input.title, ...skills.slice(0, 8), ...locations.slice(0, 2)].filter(Boolean).join(' ')
  return {
    roleSummary: input.intake.slice(0, 1500),
    mustValidate: skills,
    searchQuery: query,
    connectors: ['github','openalex','orcid'],
    targetCompanies: companies,
    locations,
    guardrails: ['Recruiter approval before strategy activation','No automatic outreach','Ambiguous identities require review'],
  }
}

async function executeStep(ownerId: string, workflow: any, step: any) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const input = workflow.input as RoleLaunchInput
  let output: Record<string, unknown> = {}

  if (step.step_key === 'intake') {
    output = { title: input.title, intakeLength: input.intake.length, skills: input.skills || [], locations: input.locations || [], ready: input.title.length >= 3 && input.intake.length >= 20 }
  } else if (step.step_key === 'strategy') {
    output = strategyOutput(input)
  } else if (step.step_key === 'campaigns') {
    const strategy = strategyOutput(input)
    const { data: existingCampaign } = await sb.from('acquisition_campaigns').select('id,name').eq('owner_id', ownerId).eq('role_id', input.roleId || '').eq('name', `${input.title} AutoSource`).in('status', ['draft','active','paused']).maybeSingle()
    if (existingCampaign) {
      output = { campaignId: existingCampaign.id, campaignName: existingCampaign.name, activated: true, reused: true }
      await sb.from('acquisition_campaigns').update({ status: 'active', next_run_at: now(), updated_at: now() }).eq('id', existingCampaign.id).eq('owner_id', ownerId)
      await sb.from('agent_workflows').update({ campaign_id: existingCampaign.id }).eq('id', workflow.id).eq('owner_id', ownerId)
    } else {
      const { data: campaign, error } = await sb.from('acquisition_campaigns').insert({
        owner_id: ownerId,
        role_id: input.roleId || null,
        name: `${input.title} AutoSource`,
        query: strategy.searchQuery,
        connectors: strategy.connectors,
        target_companies: strategy.targetCompanies,
        locations: strategy.locations,
        skills: strategy.mustValidate,
        daily_limit: 250,
        auto_promote_threshold: 92,
        status: 'active',
        next_run_at: now(),
      }).select('id,name').single()
      if (error) throw new Error(error.message)
      output = { campaignId: campaign?.id, campaignName: campaign?.name, activated: true }
      await sb.from('agent_workflows').update({ campaign_id: campaign?.id }).eq('id', workflow.id).eq('owner_id', ownerId)
    }
  } else if (step.step_key === 'review') {
    const { count } = await sb.from('autosource_inbox').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('role_id', input.roleId || '').in('status', ['unreviewed','reviewing'])
    output = { queue: 'autosource_inbox', candidatesReady: count || 0, policy: 'Rank by role relevance, evidence quality, identity confidence, and recruiter memory. No automated rejection.' }
  } else if (step.step_key === 'calibration') {
    const { buildMemoryProposals } = await import('@/lib/agent-automation-v25-1')
    const proposals = await buildMemoryProposals(ownerId, input.roleId)
    output = { proposals, minimumReviewedCandidates: 3, reviewedEnough: proposals.length > 0, memoryPolicy: 'Only learn patterns supported by repeated recruiter decisions. All inferred signals remain inspectable and reversible.' }
  } else if (step.step_key === 'handoff') {
    output = { nextAction: 'Review the prioritized AutoSource inbox and approve candidate movement into the role pipeline.', outreachRequiresApproval: true }
  }

  const definition = ROLE_LAUNCH_STEPS.find(v => v.key === step.step_key)
  if (definition?.approval) {
    const { data: existingApproval } = await sb.from('agent_approvals').select('id').eq('owner_id', ownerId).eq('workflow_id', workflow.id).eq('step_id', step.id).eq('status', 'pending').maybeSingle()
    if (existingApproval) return { waitingApproval: true, approvalId: existingApproval.id, step: step.step_key }
    const { data: approval, error } = await sb.from('agent_approvals').insert({
      owner_id: ownerId,
      workflow_id: workflow.id,
      step_id: step.id,
      approval_type: step.step_key,
      title: step.step_key === 'strategy' ? `Approve sourcing strategy for ${input.title}` : `Approve calibration memory for ${input.title}`,
      summary: step.step_key === 'strategy' ? 'Review search intent, connectors, target companies, and guardrails before activation.' : output.proposals && Array.isArray(output.proposals) && output.proposals.length ? 'Review repeated recruiter patterns before future searches use them.' : 'Not enough repeated recruiter decisions to create memory yet. Approve to continue without new signals.',
      payload: output,
    }).select('id').single()
    if (error) throw new Error(error.message)
    await sb.from('agent_steps').update({ status: 'waiting_approval', output, completed_at: now(), updated_at: now() }).eq('id', step.id).eq('owner_id', ownerId)
    await sb.from('agent_workflows').update({ status: 'waiting_approval', current_step: step.step_key, output: { ...(workflow.output || {}), [step.step_key]: output }, updated_at: now() }).eq('id', workflow.id).eq('owner_id', ownerId)
    return { waitingApproval: true, approvalId: approval?.id, step: step.step_key }
  }

  await sb.from('agent_steps').update({ status: 'completed', output, completed_at: now(), updated_at: now() }).eq('id', step.id).eq('owner_id', ownerId)
  await sb.from('agent_workflows').update({ output: { ...(workflow.output || {}), [step.step_key]: output }, updated_at: now() }).eq('id', workflow.id).eq('owner_id', ownerId)
  return { waitingApproval: false, step: step.step_key, output }
}

export async function advanceWorkflow(ownerId: string, workflowId: string) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const { data: workflow, error } = await sb.from('agent_workflows').select('*').eq('id', workflowId).eq('owner_id', ownerId).single()
  if (error || !workflow) throw new Error(error?.message || 'Workflow not found.')
  if (['completed','cancelled','paused'].includes(workflow.status)) return { workflow, advanced: false }

  const { data: steps, error: stepsError } = await sb.from('agent_steps').select('*').eq('workflow_id', workflowId).eq('owner_id', ownerId).order('created_at')
  if (stepsError) throw new Error(stepsError.message)
  const pendingApproval = await sb.from('agent_approvals').select('id').eq('workflow_id', workflowId).eq('owner_id', ownerId).eq('status', 'pending').limit(1)
  if ((pendingApproval.data || []).length) return { workflow, advanced: false, waitingApproval: true }

  const next = (steps || []).find(step => !['completed','skipped'].includes(step.status))
  if (!next) {
    const { data } = await sb.from('agent_workflows').update({ status: 'completed', current_step: 'complete', completed_at: now(), next_run_at: null, updated_at: now() }).eq('id', workflowId).eq('owner_id', ownerId).select('*').single()
    return { workflow: data, advanced: true, completed: true }
  }

  await sb.from('agent_workflows').update({ status: 'running', current_step: next.step_key, started_at: workflow.started_at || now(), updated_at: now() }).eq('id', workflowId).eq('owner_id', ownerId)
  await sb.from('agent_steps').update({ status: 'running', attempt: Number(next.attempt || 0) + 1, started_at: now(), updated_at: now() }).eq('id', next.id).eq('owner_id', ownerId)
  const result = await executeStep(ownerId, workflow, next)
  if (!result.waitingApproval) {
    const nextIndex = ROLE_LAUNCH_STEPS.findIndex(v => v.key === next.step_key) + 1
    const nextKey = ROLE_LAUNCH_STEPS[nextIndex]?.key || 'complete'
    await sb.from('agent_workflows').update({ status: nextKey === 'complete' ? 'completed' : 'queued', current_step: nextKey, completed_at: nextKey === 'complete' ? now() : null, next_run_at: nextKey === 'complete' ? null : now(), updated_at: now() }).eq('id', workflowId).eq('owner_id', ownerId)
  }
  return { workflowId, advanced: true, ...result }
}

export async function decideApproval(ownerId: string, approvalId: string, decision: 'approved' | 'rejected', note = '') {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable.')
  const { data: approval, error } = await sb.from('agent_approvals').select('*,agent_workflows(role_id)').eq('id', approvalId).eq('owner_id', ownerId).eq('status', 'pending').single()
  if (error || !approval) throw new Error(error?.message || 'Approval not found.')
  if (decision === 'approved' && approval.approval_type === 'calibration') {
    const relation = Array.isArray(approval.agent_workflows) ? approval.agent_workflows[0] : approval.agent_workflows
    const roleId = relation?.role_id as string | null | undefined
    const proposals = approval.payload && typeof approval.payload === 'object' && Array.isArray(approval.payload.proposals) ? approval.payload.proposals : []
    const { applyMemoryProposals } = await import('@/lib/agent-automation-v25-1')
    await applyMemoryProposals(ownerId, roleId, proposals)
  }
  await sb.from('agent_approvals').update({ status: decision, decision_note: note.slice(0, 1000), decided_at: now(), updated_at: now() }).eq('id', approvalId).eq('owner_id', ownerId)
  await sb.from('agent_steps').update({ status: decision === 'approved' ? 'completed' : 'failed', completed_at: now(), updated_at: now() }).eq('id', approval.step_id).eq('owner_id', ownerId)
  await sb.from('agent_workflows').update({ status: decision === 'approved' ? 'queued' : 'paused', error: decision === 'rejected' ? note || 'Recruiter rejected approval.' : null, next_run_at: decision === 'approved' ? now() : null, updated_at: now() }).eq('id', approval.workflow_id).eq('owner_id', ownerId)
  return { workflowId: approval.workflow_id, decision }
}