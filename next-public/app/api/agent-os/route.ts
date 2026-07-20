import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { advanceWorkflow, createRoleLaunchWorkflow, decideApproval } from '@/lib/agent-os-v25'
import { extractCandidateGraph, generateDailyBrief, sendInboxCandidateToRole, updateInboxCandidate } from '@/lib/agent-automation-v25-1'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  action: z.literal('create_role_launch'),
  input: z.object({
    roleId: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(3).max(160),
    intake: z.string().trim().min(20).max(30000),
    skills: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    locations: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
    targetCompanies: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  }),
})

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []
}

export async function GET(req: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId); if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: true, mode: 'preview', workflows: [], approvals: [], memory: [], edges: [], briefs: [], roles: [], inbox: [], steps: [] })
  const sb = createServerSupabaseClient(); if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const [workflows, approvals, memory, edges, briefs, roles, inbox, steps] = await Promise.all([
    sb.from('agent_workflows').select('*').eq('owner_id', gate.userId).order('created_at', { ascending: false }).limit(50),
    sb.from('agent_approvals').select('*').eq('owner_id', gate.userId).eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    sb.from('recruiter_memory_signals').select('*').eq('owner_id', gate.userId).eq('active', true).order('confidence', { ascending: false }).limit(100),
    sb.from('talent_graph_edges').select('*').eq('owner_id', gate.userId).neq('review_status', 'rejected').order('created_at', { ascending: false }).limit(100),
    sb.from('recruiter_daily_briefs').select('*').eq('owner_id', gate.userId).order('brief_date', { ascending: false }).limit(14),
    sb.from('role_workspaces').select('id,title,status,location,work_mode,intake,updated_at').eq('owner_id', gate.userId).in('status', ['draft','calibrating','active','paused']).order('updated_at', { ascending: false }).limit(100),
    sb.from('autosource_inbox').select('*,candidates(id,canonical_name,headline,current_company,location,skills,merge_status)').eq('owner_id', gate.userId).in('status', ['unreviewed','reviewing','hold']).order('priority', { ascending: false }).limit(100),
    sb.from('agent_steps').select('id,workflow_id,step_key,agent_key,status,attempt,updated_at').eq('owner_id', gate.userId).order('created_at', { ascending: false }).limit(300),
  ])
  const error = workflows.error || approvals.error || memory.error || edges.error || briefs.error || roles.error || inbox.error || steps.error
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode: 'supabase', workflows: workflows.data || [], approvals: approvals.data || [], memory: memory.data || [], edges: edges.data || [], briefs: briefs.data || [], roles: roles.data || [], inbox: inbox.data || [], steps: steps.data || [] })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId); if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: false, error: 'Durable storage required.' }, { status: 503 })
  const sb = createServerSupabaseClient(); if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const body = await req.json().catch(() => ({})) as any
  try {
    if (body.action === 'create_role_launch') {
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid workflow.' }, { status: 400 })
      const workflow = await createRoleLaunchWorkflow(gate.userId, parsed.data.input)
      return NextResponse.json({ ok: true, workflow })
    }
    if (body.action === 'create_from_role') {
      const roleId = String(body.roleId || '')
      if (!z.string().uuid().safeParse(roleId).success) return NextResponse.json({ ok: false, error: 'Invalid role id.' }, { status: 400 })
      const { data: role, error } = await sb.from('role_workspaces').select('*').eq('id', roleId).eq('owner_id', gate.userId).single()
      if (error || !role) throw new Error(error?.message || 'Role not found.')
      const intake = role.intake && typeof role.intake === 'object' ? role.intake : {}
      const rawDescription = typeof intake.rawDescription === 'string' ? intake.rawDescription : typeof intake.raw_description === 'string' ? intake.raw_description : JSON.stringify(intake)
      const skills = list(intake.mustHaves || intake.must_haves)
      const locations = [role.location, typeof intake.location === 'string' ? intake.location : ''].filter(Boolean)
      const targetCompanies = list(intake.targetCompanies || intake.target_companies)
      const workflow = await createRoleLaunchWorkflow(gate.userId, { roleId, title: role.title, intake: rawDescription.length >= 20 ? rawDescription : `${role.title} in ${role.location}. Recruiter-calibrated role workspace.`, skills, locations, targetCompanies })
      return NextResponse.json({ ok: true, workflow })
    }
    if (body.action === 'advance') {
      const workflowId = String(body.workflowId || '')
      if (!z.string().uuid().safeParse(workflowId).success) return NextResponse.json({ ok: false, error: 'Invalid workflow id.' }, { status: 400 })
      return NextResponse.json({ ok: true, result: await advanceWorkflow(gate.userId, workflowId) })
    }
    if (body.action === 'approval') {
      const approvalId = String(body.approvalId || '')
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null
      if (!z.string().uuid().safeParse(approvalId).success || !decision) return NextResponse.json({ ok: false, error: 'Invalid approval decision.' }, { status: 400 })
      return NextResponse.json({ ok: true, result: await decideApproval(gate.userId, approvalId, decision, String(body.note || '')) })
    }
    if (body.action === 'inbox_to_role') {
      const inboxId = String(body.inboxId || ''), roleId = String(body.roleId || '')
      if (!z.string().uuid().safeParse(inboxId).success || !z.string().uuid().safeParse(roleId).success) return NextResponse.json({ ok: false, error: 'Invalid inbox or role id.' }, { status: 400 })
      return NextResponse.json({ ok: true, result: await sendInboxCandidateToRole(gate.userId, inboxId, roleId) })
    }
    if (body.action === 'inbox_action') {
      const inboxId = String(body.inboxId || '')
      const inboxAction = body.inboxAction === 'enrich' ? 'enrich' : body.inboxAction === 'hold' ? 'hold' : body.inboxAction === 'dismiss' ? 'dismiss' : null
      if (!z.string().uuid().safeParse(inboxId).success || !inboxAction) return NextResponse.json({ ok: false, error: 'Invalid inbox action.' }, { status: 400 })
      return NextResponse.json({ ok: true, result: await updateInboxCandidate(gate.userId, inboxId, inboxAction) })
    }
    if (body.action === 'extract_graph') {
      const candidateId = String(body.candidateId || '')
      if (!z.string().uuid().safeParse(candidateId).success) return NextResponse.json({ ok: false, error: 'Invalid candidate id.' }, { status: 400 })
      return NextResponse.json({ ok: true, result: await extractCandidateGraph(gate.userId, candidateId) })
    }
    if (body.action === 'daily_brief') return NextResponse.json({ ok: true, brief: await generateDailyBrief(gate.userId) })
    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Agent workflow failed.' }, { status: 500 })
  }
}