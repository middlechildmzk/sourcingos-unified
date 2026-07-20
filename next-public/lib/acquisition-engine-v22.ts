import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CampaignInput, connectorRunners, Discovery, scoreDiscovery } from '@/lib/acquisition-v22'

const safeText = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export async function promoteDiscovery(sb: NonNullable<ReturnType<typeof createServerSupabaseClient>>, ownerId: string, campaignId: string, discoveryId: string, d: Discovery, score: number, manual = false) {
  const { data: existingProfile } = await sb.from('source_profiles').select('id,candidate_id').eq('owner_id', ownerId).eq('source', d.sourceKey).eq('source_profile_id', d.sourceId).maybeSingle()
  if (existingProfile?.candidate_id) {
    await sb.from('acquisition_discoveries').update({ candidate_id: existingProfile.candidate_id, source_profile_id: existingProfile.id, disposition: 'duplicate', last_seen_at: new Date().toISOString() }).eq('id', discoveryId).eq('owner_id', ownerId)
    return { disposition: 'duplicate' as const, candidateId: existingProfile.candidate_id }
  }

  const { data: candidate, error: candidateError } = await sb.from('candidates').insert({
    owner_id: ownerId,
    canonical_name: d.displayName,
    headline: safeText(d.headline, 300) || null,
    location: safeText(d.location, 200) || null,
    current_company: safeText(d.organization, 200) || null,
    current_title: safeText(d.headline, 200) || null,
    summary: safeText(d.summary, 2000) || null,
    skills: d.skills.slice(0, 50),
    merge_status: manual ? 'pending' : d.identityConfidence >= 92 ? 'source_verified' : 'pending',
    last_refreshed_at: new Date().toISOString(),
  }).select('id').single()
  if (candidateError || !candidate) throw candidateError || new Error('Candidate creation failed')

  const { data: profile, error: profileError } = await sb.from('source_profiles').insert({
    owner_id: ownerId,
    candidate_id: candidate.id,
    source: d.sourceKey,
    source_profile_id: d.sourceId,
    profile_url: d.sourceUrl || null,
    display_name: d.displayName,
    headline: safeText(d.headline, 300) || null,
    location: safeText(d.location, 200) || null,
    organization: safeText(d.organization, 200) || null,
    raw_text: safeText(d.summary, 5000) || null,
    raw: d.raw,
    status: manual || d.identityConfidence >= 92 ? 'confirmed' : 'pending',
    match_score: d.identityConfidence,
    match_reasons: [manual ? 'Recruiter accepted discovery' : `Unique ${d.sourceKey} source identity`, `Campaign score ${score}`],
    last_seen_at: new Date().toISOString(),
  }).select('id').single()
  if (profileError || !profile) throw profileError || new Error('Source profile creation failed')

  if (d.evidence.length) {
    const evidenceRows = d.evidence.slice(0, 50).map(e => ({ owner_id: ownerId, candidate_id: candidate.id, source_profile_id: profile.id, source: d.sourceKey, label: safeText(e.label, 200) || e.kind, detail: safeText(e.value, 2000), confidence: manual || d.identityConfidence >= 90 ? 'high' : 'medium', url: safeText(e.url, 1000) || null }))
    await sb.from('evidence_items').insert(evidenceRows)
  }

  const disposition = manual ? 'accepted' : 'auto_promoted'
  await Promise.all([
    sb.from('acquisition_discoveries').update({ candidate_id: candidate.id, source_profile_id: profile.id, disposition, review_reason: manual ? 'Accepted by recruiter and promoted to Candidate Graph.' : null, last_seen_at: new Date().toISOString() }).eq('id', discoveryId).eq('owner_id', ownerId),
    sb.from('autosource_inbox').upsert({ owner_id: ownerId, campaign_id: campaignId, candidate_id: candidate.id, priority: score, reason: `${manual ? 'Recruiter-approved' : 'Auto-discovered'} from ${d.sourceKey}; identity ${d.identityConfidence}, campaign ${score}.`, status: 'unreviewed' }, { onConflict: 'owner_id,campaign_id,candidate_id' }),
  ])
  return { disposition, candidateId: candidate.id }
}

export async function promoteStoredDiscovery(ownerId: string, discoveryId: string) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable')
  const { data: row, error } = await sb.from('acquisition_discoveries').select('*').eq('id', discoveryId).eq('owner_id', ownerId).eq('disposition', 'needs_review').single()
  if (error || !row) throw error || new Error('Discovery not found')
  const sourceKey = safeText(row.source_key) as Discovery['sourceKey']
  const skills = Array.isArray(row.skills) ? row.skills.filter((value: unknown): value is string => typeof value === 'string').slice(0, 50) : []
  const evidence = Array.isArray(row.evidence) ? row.evidence.map((value: any) => ({ kind: safeText(value?.kind, 100) || 'public_evidence', label: safeText(value?.label, 200) || 'Public evidence', value: safeText(value?.value, 2000), url: safeText(value?.url, 1000) || undefined, observedAt: safeText(value?.observedAt, 100) || undefined })).filter((value: { value: string }) => Boolean(value.value)) : []
  const discovery: Discovery = {
    sourceKey,
    sourceId: safeText(row.source_id, 500),
    sourceUrl: safeText(row.source_url, 1000),
    displayName: safeText(row.display_name, 300),
    headline: safeText(row.headline, 300) || undefined,
    organization: safeText(row.organization, 300) || undefined,
    location: safeText(row.location, 300) || undefined,
    summary: safeText(row.summary, 2000) || undefined,
    skills,
    evidence,
    identityConfidence: Number(row.identity_confidence || 0),
    profileQuality: Number(row.profile_quality || 0),
    raw: row.raw && typeof row.raw === 'object' ? row.raw : {},
  }
  return promoteDiscovery(sb, ownerId, row.campaign_id, row.id, discovery, Number(row.campaign_score || 0), true)
}

export async function runCampaign(ownerId: string, campaignId: string) {
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('Supabase client unavailable')
  const { data: campaign, error } = await sb.from('acquisition_campaigns').select('*').eq('id', campaignId).eq('owner_id', ownerId).single()
  if (error || !campaign) throw error || new Error('Campaign not found')
  const input: CampaignInput = { name: campaign.name, roleId: campaign.role_id, query: campaign.query, connectors: campaign.connectors, targetCompanies: campaign.target_companies || [], locations: campaign.locations || [], skills: campaign.skills || [], dailyLimit: campaign.daily_limit, autoPromoteThreshold: campaign.auto_promote_threshold }
  const { data: run, error: runError } = await sb.from('acquisition_runs').insert({ owner_id: ownerId, campaign_id: campaignId, status: 'running', started_at: new Date().toISOString() }).select('id').single()
  if (runError || !run) throw runError || new Error('Run creation failed')

  let discovered = 0, promoted = 0, review = 0, duplicates = 0, errors = 0
  const connectorStatus: Record<string, unknown> = {}
  for (const sourceKey of input.connectors) {
    const runner = connectorRunners[sourceKey]
    if (!runner) { connectorStatus[sourceKey] = { status: 'planned', message: 'Connector adapter not enabled yet.' }; continue }
    try {
      const { data: cursorRow } = await sb.from('acquisition_source_cursors').select('cursor').eq('owner_id', ownerId).eq('campaign_id', campaignId).eq('source_key', sourceKey).maybeSingle()
      const batch = await runner(input, cursorRow?.cursor)
      const limited = batch.discoveries.slice(0, Math.min(250, input.dailyLimit - discovered))
      for (const d of limited) {
        const campaignScore = scoreDiscovery(d, input)
        const disposition = d.identityConfidence >= input.autoPromoteThreshold && campaignScore >= input.autoPromoteThreshold ? 'new' : 'needs_review'
        const { data: row, error: upsertError } = await sb.from('acquisition_discoveries').upsert({ owner_id: ownerId, campaign_id: campaignId, run_id: run.id, source_key: d.sourceKey, source_id: d.sourceId, source_url: d.sourceUrl, display_name: d.displayName, headline: d.headline || null, organization: d.organization || null, location: d.location || null, summary: d.summary || null, skills: d.skills, evidence: d.evidence, identity_confidence: d.identityConfidence, profile_quality: d.profileQuality, campaign_score: campaignScore, disposition, raw: d.raw, last_seen_at: new Date().toISOString() }, { onConflict: 'owner_id,source_key,source_id' }).select('id,disposition,candidate_id').single()
        if (upsertError || !row) { errors++; continue }
        discovered++
        if (row.candidate_id) { duplicates++; continue }
        if (disposition === 'new') {
          const result = await promoteDiscovery(sb, ownerId, campaignId, row.id, d, campaignScore)
          if (result.disposition === 'auto_promoted') promoted++; else duplicates++
        } else review++
      }
      await sb.from('acquisition_source_cursors').upsert({ owner_id: ownerId, campaign_id: campaignId, source_key: sourceKey, cursor: batch.cursor, consecutive_errors: 0, last_error: null, last_run_at: new Date().toISOString() }, { onConflict: 'owner_id,campaign_id,source_key' })
      connectorStatus[sourceKey] = { status: 'completed', discovered: limited.length, nextCursor: batch.cursor }
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : 'Connector failed'
      connectorStatus[sourceKey] = { status: 'failed', message }
      await sb.from('acquisition_source_cursors').upsert({ owner_id: ownerId, campaign_id: campaignId, source_key: sourceKey, last_error: message, last_run_at: new Date().toISOString() }, { onConflict: 'owner_id,campaign_id,source_key' })
    }
    if (discovered >= input.dailyLimit) break
  }

  const status = errors && !discovered ? 'failed' : errors ? 'partial' : 'completed'
  await Promise.all([
    sb.from('acquisition_runs').update({ status, connector_status: connectorStatus, discovered_count: discovered, promoted_count: promoted, review_count: review, duplicate_count: duplicates, error_count: errors, completed_at: new Date().toISOString() }).eq('id', run.id).eq('owner_id', ownerId),
    sb.from('acquisition_campaigns').update({ last_run_at: new Date().toISOString(), next_run_at: new Date(Date.now() + 86400000).toISOString(), updated_at: new Date().toISOString() }).eq('id', campaignId).eq('owner_id', ownerId),
  ])
  return { runId: run.id, status, discovered, promoted, review, duplicates, errors, connectorStatus }
}

export async function processEnrichmentQueue(ownerId: string, limit = 25) {
  const sb = createServerSupabaseClient(); if (!sb) throw new Error('Supabase client unavailable')
  const { data: jobs, error } = await sb.from('candidate_enrichment_queue').select('id,candidate_id,requested_sources,attempts').eq('owner_id', ownerId).eq('status', 'queued').order('priority', { ascending: false }).limit(Math.min(100, limit))
  if (error) throw error
  let completed = 0, needsReview = 0, failed = 0
  for (const job of jobs || []) {
    await sb.from('candidate_enrichment_queue').update({ status: 'running', attempts: (job.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq('id', job.id).eq('owner_id', ownerId)
    try {
      const { data: candidate } = await sb.from('candidates').select('*').eq('id', job.candidate_id).eq('owner_id', ownerId).single()
      if (!candidate) throw new Error('Candidate not found')
      const { count: evidenceCount } = await sb.from('evidence_items').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('candidate_id', candidate.id)
      const { count: sourceCount } = await sb.from('source_profiles').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('candidate_id', candidate.id)
      const missing = ['headline','location','current_company','summary'].filter(k => !candidate[k])
      const completeness = Math.min(100, 25 + (candidate.canonical_name ? 15 : 0) + (candidate.headline ? 10 : 0) + (candidate.location ? 10 : 0) + (candidate.current_company ? 10 : 0) + (candidate.summary ? 10 : 0) + Math.min(10, (candidate.skills || []).length * 2) + Math.min(10, evidenceCount || 0))
      await sb.from('candidate_quality_snapshots').insert({ owner_id: ownerId, candidate_id: candidate.id, completeness, identity_confidence: sourceCount && sourceCount > 1 ? 92 : 76, evidence_count: evidenceCount || 0, source_count: sourceCount || 0, freshness_days: candidate.last_refreshed_at ? Math.floor((Date.now() - new Date(candidate.last_refreshed_at).getTime()) / 86400000) : null, missing_fields: missing })
      const state = missing.length > 2 ? 'needs_review' : 'completed'
      await sb.from('candidate_enrichment_queue').update({ status: state, last_error: null, updated_at: new Date().toISOString() }).eq('id', job.id).eq('owner_id', ownerId)
      state === 'completed' ? completed++ : needsReview++
    } catch (err) {
      failed++
      await sb.from('candidate_enrichment_queue').update({ status: 'failed', last_error: err instanceof Error ? err.message : 'Enrichment failed', updated_at: new Date().toISOString() }).eq('id', job.id).eq('owner_id', ownerId)
    }
  }
  return { processed: (jobs || []).length, completed, needsReview, failed }
}