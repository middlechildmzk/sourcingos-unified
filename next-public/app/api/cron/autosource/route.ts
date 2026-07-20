import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { processEnrichmentQueue, runCampaign } from '@/lib/acquisition-engine-v22'
import { generateDailyBrief, runDueAgentWorkflows } from '@/lib/agent-automation-v25-1'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 503 })
  const sb = createServerSupabaseClient(); if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 500 })
  const [campaignResult, workflowOwnersResult] = await Promise.all([
    sb.from('acquisition_campaigns').select('id,owner_id').eq('status', 'active').lte('next_run_at', new Date().toISOString()).order('next_run_at', { ascending: true }).limit(10),
    sb.from('agent_workflows').select('owner_id').in('status', ['queued','running','waiting_approval']).limit(100),
  ])
  if (campaignResult.error) return NextResponse.json({ ok: false, error: campaignResult.error.message }, { status: 500 })

  const campaigns = []
  const owners = new Set<string>((workflowOwnersResult.data || []).map(row => row.owner_id))
  for (const campaign of campaignResult.data || []) {
    owners.add(campaign.owner_id)
    try { campaigns.push({ campaignId: campaign.id, ok: true, ...(await runCampaign(campaign.owner_id, campaign.id)) }) }
    catch (error) { campaigns.push({ campaignId: campaign.id, ok: false, error: error instanceof Error ? error.message : 'Campaign failed' }) }
  }

  const workflows = await runDueAgentWorkflows(20)
  const enrichment = []
  const briefs = []
  for (const ownerId of owners) {
    try { enrichment.push({ ownerId, ok: true, ...(await processEnrichmentQueue(ownerId, 25)) }) }
    catch (error) { enrichment.push({ ownerId, ok: false, error: error instanceof Error ? error.message : 'Enrichment failed' }) }
    try { briefs.push({ ownerId, ok: true, brief: await generateDailyBrief(ownerId) }) }
    catch (error) { briefs.push({ ownerId, ok: false, error: error instanceof Error ? error.message : 'Brief failed' }) }
  }
  return NextResponse.json({ ok: true, campaigns, workflows, enrichment, briefs })
}