import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const schema = z.object({
  query: z.string().trim().max(3000).optional(),
  titles: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  skills: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  companies: z.array(z.string().trim().min(1).max(180)).max(30).default([]),
  locations: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  clearances: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  certifications: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).max(100000).default(0),
}).strict().refine(value => Boolean(value.query?.trim()) || [value.titles, value.skills, value.companies, value.locations, value.clearances, value.certifications].some(items => items.length > 0), {
  message: 'At least one query or structured filter is required.',
})

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid owned-talent search request.', details: parsed.error.flatten() }, { status: 400 })
  }

  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      results: [],
      total: 0,
      warning: 'Owned Talent Graph search requires the durable candidate database.',
    })
  }

  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Candidate Graph unavailable.' }, { status: 503 })

  const input = parsed.data
  const { data: hits, error } = await sb.rpc('search_owned_talent_v39', {
    p_owner_id: gate.userId,
    p_query: input.query?.trim() || null,
    p_titles: input.titles,
    p_skills: input.skills,
    p_companies: input.companies,
    p_locations: input.locations,
    p_clearances: input.clearances,
    p_certifications: input.certifications,
    p_limit: input.limit,
    p_offset: input.offset,
  })

  if (error) {
    console.error('[owned-talent-v39] search RPC failed:', error.message)
    return NextResponse.json({ ok: false, error: 'Owned Talent Graph search failed.' }, { status: 500 })
  }

  const rows = Array.isArray(hits) ? hits : []
  const ids = rows.map((row: any) => String(row.candidate_id || '')).filter(Boolean)
  const rankById = new Map(rows.map((row: any) => [String(row.candidate_id), row]))

  const candidates = ids.length
    ? await sb
        .from('candidates')
        .select('id,canonical_name,headline,current_title,current_company,location,skills,merge_status,last_refreshed_at,updated_at')
        .eq('owner_id', gate.userId)
        .in('id', ids)
    : { data: [], error: null }

  if (candidates.error) {
    return NextResponse.json({ ok: false, error: 'Owned Talent Graph candidates could not be loaded.' }, { status: 500 })
  }

  const candidateById = new Map((candidates.data || []).map((candidate: any) => [String(candidate.id), candidate]))
  const results = ids.map(id => {
    const candidate: any = candidateById.get(id)
    const hit: any = rankById.get(id)
    if (!candidate || !hit) return null
    return {
      candidateId: id,
      name: candidate.canonical_name || 'Unconfirmed identity',
      headline: candidate.headline || undefined,
      currentTitle: candidate.current_title || undefined,
      currentCompany: candidate.current_company || undefined,
      location: candidate.location || undefined,
      skills: Array.isArray(candidate.skills) ? candidate.skills : [],
      mergeStatus: candidate.merge_status || 'pending',
      retrievalRank: Number(hit.rank || 0),
      sourceCount: Number(hit.source_count || 0),
      evidenceCount: Number(hit.evidence_count || 0),
      lastObservedAt: hit.last_observed_at || candidate.last_refreshed_at || candidate.updated_at || undefined,
    }
  }).filter(Boolean)

  return NextResponse.json({
    ok: true,
    mode: 'owned_candidate_graph_v39',
    results,
    total: rows.length ? Number((rows[0] as any).total_count || rows.length) : 0,
    offset: input.offset,
    limit: input.limit,
    retrieval: {
      lexical: true,
      structured: true,
      semanticVector: false,
      rightsAwareSourceFiltering: true,
      contactValuesIndexed: false,
    },
    trust: {
      retrievalRankIsQualificationScore: false,
      missingEvidenceIsRejectionEvidence: false,
      identityMergePerformed: false,
      sourceRetentionRightsApplied: true,
    },
  })
}
