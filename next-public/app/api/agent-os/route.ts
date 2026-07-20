import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { advanceWorkflow, createRoleLaunchWorkflow, decideApproval } from '@/lib/agent-os-v25'

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

export async function GET(req: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId); if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: true, mode: 'preview', workflows: [], approvals: [], memory: [], edges: [], briefs: [] })
  const sb = createServerSupabaseClient(); if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const [workflows, approvals, memory, edges, briefs] = await Promise.all([
    sb.from('agent_workflows').select('*').eq('owner_id', gate.userId).order('created_at', { ascending: false }).limit(50),
    sb.from('agent_approvals').select('*').eq('owner_id', gate.userId).eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    sb.from('recruiter_memory_signals').select('*').eq('owner_id', gate.userId).eq('active', true).order('confidence', { ascending: false }).limit(100),
    sb.from('talent_graph_edges').select('*').eq('owner_id', gate.userId).neq('review_status', 'rejected').order('created_at', { ascending: false }).limit(100),
    sb.from('recruiter_daily_briefs').select('*').eq('owner_id', gate.userId).order('brief_date', { ascending: false }).limit(14),
  ])
  const error = workflows.error || approvals.error || memory.error || edges.error || briefs.error
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode: 'supabase', workflows: workflows.data || [], approvals: approvals.data || [], memory: memory.data || [], edges: edges.data || [], briefs: briefs.data || [] })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId); if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: false, error: 'Durable storage required.' }, { status: 503 })
  const body = await req.json().catch(() => ({})) as any
  try {
    if (body.action === 'create_role_launch') {
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid workflow.' }, { status: 400 })
      const workflow = await createRoleLaunchWorkflow(gate.userId, parsed.data.input)
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
    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Agent workflow failed.' }, { status: 500 })
  }
}
