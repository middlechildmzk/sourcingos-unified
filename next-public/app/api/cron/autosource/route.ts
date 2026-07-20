import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { processEnrichmentQueue, runCampaign } from '@/lib/acquisition-engine-v22'

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
  const { data: campaigns, error } = await sb.from('acquisition_campaigns').select('id,owner_id').eq('status', 'active').lte('next_run_at', new Date().toISOString()).order('next_run_at', { ascending: true }).limit(10)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const results = []
  const owners = new Set<string>()
  for (const campaign of campaigns || []) {
    owners.add(campaign.owner_id)
    try { results.push({ campaignId: campaign.id, ok: true, ...(await runCampaign(campaign.owner_id, campaign.id)) }) }
    catch (err) { results.push({ campaignId: campaign.id, ok: false, error: err instanceof Error ? err.message : 'Campaign failed' }) }
  }
  const enrichment = []
  for (const ownerId of owners) {
    try { enrichment.push({ ownerId, ok: true, ...(await processEnrichmentQueue(ownerId, 25)) }) }
    catch (err) { enrichment.push({ ownerId, ok: false, error: err instanceof Error ? err.message : 'Enrichment failed' }) }
  }
  return NextResponse.json({ ok: true, campaigns: results, enrichment })
}
