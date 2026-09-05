import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { campaignInputSchema } from '@/lib/acquisition-v22'
import { promoteStoredDiscovery, runCampaign } from '@/lib/acquisition-engine-v22'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId); if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: true, mode: 'preview', campaigns: [], runs: [], inbox: [], review: [] })
  const sb = createServerSupabaseClient(); if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const [campaigns, runs, inbox, review, roles] = await Promise.all([
    sb.from('acquisition_campaigns').select('*').eq('owner_id', gate.userId).order('created_at', { ascending: false }),
    sb.from('acquisition_runs').select('*').eq('owner_id', gate.userId).order('created_at', { ascending: false }).limit(50),
    sb.from('autosource_inbox').select('*,candidates(canonical_name,headline,current_company,location,skills)').eq('owner_id', gate.userId).order('priority', { ascending: false }).limit(100),
    sb.from('acquisition_discoveries').select('*').eq('owner_id', gate.userId).eq('disposition', 'needs_review').order('campaign_score', { ascending: false }).limit(100),
    sb.from('role_workspaces').select('id,title,status').eq('owner_id', gate.userId).in('status', ['calibrating','active','paused']).order('updated_at', { ascending: false }).limit(100),
  ])
  const error = campaigns.error || runs.error || inbox.error || review.error || roles.error
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode: 'supabase', campaigns: campaigns.data || [], runs: runs.data || [], inbox: inbox.data || [], review: review.data || [], roles: roles.data || [] })
}

export async function POST(req: NextRequest) {
  const gate = await requireSession(); if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId); if (!rl.ok) return rl.response
  if (!isSupabaseConfigured() || gate.preview) return NextResponse.json({ ok: false, error: 'Durable storage required.' }, { status: 503 })
  const sb = createServerSupabaseClient(); if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })
  const body = await req.json().catch(() => ({})) as any

  if (body.action === 'create') {
    const parsed = campaignInputSchema.safeParse(body.campaign)
    if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid campaign.' }, { status: 400 })
    const c = parsed.data
    const { data, error } = await sb.from('acquisition_campaigns').insert({ owner_id: gate.userId, role_id: c.roleId || null, name: c.name, query: c.query, connectors: c.connectors, target_companies: c.targetCompanies, locations: c.locations, skills: c.skills, daily_limit: c.dailyLimit, auto_promote_threshold: c.autoPromoteThreshold, status: 'active', next_run_at: new Date().toISOString() }).select('*').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, campaign: data })
  }

  if (body.action === 'run') {
    const campaignId = String(body.campaignId || '')
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return NextResponse.json({ ok: false, error: 'Invalid campaign id.' }, { status: 400 })
    try { return NextResponse.json({ ok: true, result: await runCampaign(gate.userId, campaignId) }) }
    catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Campaign failed.' }, { status: 500 }) }
  }

  if (body.action === 'status') {
    const campaignId = String(body.campaignId || '')
    const status = ['active','paused','completed','archived'].includes(body.status) ? body.status : 'paused'
    const { error } = await sb.from('acquisition_campaigns').update({ status, updated_at: new Date().toISOString(), next_run_at: status === 'active' ? new Date().toISOString() : null }).eq('id', campaignId).eq('owner_id', gate.userId)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'review') {
    const discoveryId = String(body.discoveryId || '')
    if (!/^[0-9a-f-]{36}$/i.test(discoveryId)) return NextResponse.json({ ok: false, error: 'Invalid discovery id.' }, { status: 400 })
    try {
      if (body.decision === 'accepted') return NextResponse.json({ ok: true, result: await promoteStoredDiscovery(gate.userId, discoveryId) })
      const { error } = await sb.from('acquisition_discoveries').update({ disposition: 'rejected', review_reason: String(body.reason || '').slice(0, 500) }).eq('id', discoveryId).eq('owner_id', gate.userId).eq('disposition', 'needs_review')
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not review discovery.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 })
}