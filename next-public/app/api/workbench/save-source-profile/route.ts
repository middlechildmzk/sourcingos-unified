import 'server-only'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { NextRequest, NextResponse } from 'next/server'
import { getRouteSession } from '@/lib/supabase/route-session'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getCandidateDb, nowIso, uid } from '@/lib/candidate-db-v18'
import { persistCandidateGraphSnapshot } from '@/lib/supabase-candidate-graph'

// ─────────────────────────────────────────────────────────────────────────────
// Save a source profile (from workbench search results) to the Candidate Graph.
//
// Guardrails:
//   - Contact signals always stored as verified=false (enforced at DB level too)
//   - No auto-merge — candidate stays in pending state until recruiter confirms
//   - Fit score is null — project_candidates row created with stage=sourced only
//
// NOTE: open_to_work_signals are NOT persisted here because SourceResult does
// not include OTW signals. OTW signals are added during candidate normalization
// from profile/resume content analysis, not raw source connector results.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const session = await getRouteSession()

  try {
    const body = await req.json()
    const { sourceResult, projectId } = body

    if (!sourceResult?.id || !sourceResult?.displayName) {
      return NextResponse.json({ ok: false, error: 'sourceResult.id and displayName are required.' }, { status: 400 })
    }

    // ── Preview mode ──────────────────────────────────────────────────────────
    if (!isSupabaseConfigured()) {
      // Write to in-memory store + return preview response
      const db = getCandidateDb()
      const candidateId = uid('cand')
      const spId = uid('sp')

      db.sourceProfiles.unshift({
        id: spId,
        source: sourceResult.source,
        sourceProfileId: sourceResult.sourceProfileId,
        displayName: sourceResult.displayName,
        headline: sourceResult.headline || '',
        location: sourceResult.location || '',
        organization: sourceResult.organization || '',
        rawText: JSON.stringify(sourceResult),
        status: 'pending',
        matchScore: 0,
        matchReasons: [],
        candidateId,
        lastSeenAt: nowIso(),
        createdAt: nowIso(),
      })
      db.candidates.unshift({
        id: candidateId,
        canonicalName: sourceResult.displayName,
        headline: sourceResult.headline || '',
        location: sourceResult.location || '',
        currentCompany: sourceResult.organization || '',
        skills: sourceResult.skills || [],
        summary: `Source profile from ${sourceResult.source}. Pending recruiter review.`,
        mergeStatus: 'pending',
        sourceProfileIds: [spId],
        evidenceItemIds: (sourceResult.evidence || []).map((e: { id: string }) => e.id),
        contactSignalIds: [],
        openToWorkSignalIds: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })

      return NextResponse.json({
        ok: true,
        mode: 'preview',
        candidateId,
        sourceProfileId: spId,
        note: 'Preview mode — data is in-memory only. Configure Supabase for persistence.',
      })
    }

    // ── Supabase mode ─────────────────────────────────────────────────────────
    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
    }

    const sb = createServerSupabaseClient()
    if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

    const ownerId = session.userId!

    // 1. Upsert source_profile (unique on owner_id + source + source_profile_id)
    const { data: spData, error: spError } = await sb.from('source_profiles').upsert({
      owner_id: ownerId,
      source: sourceResult.source,
      source_profile_id: sourceResult.sourceProfileId,
      profile_url: sourceResult.profileUrl || null,
      display_name: sourceResult.displayName,
      headline: sourceResult.headline || null,
      location: sourceResult.location || null,
      organization: sourceResult.organization || null,
      raw: sourceResult,
      status: 'pending',
      match_score: 0,
      match_reasons: [],
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,source,source_profile_id' }).select('id').single()

    if (spError) return NextResponse.json({ ok: false, error: `source_profiles: ${spError.message}` }, { status: 500 })
    const sourceProfileId = spData.id

    // 2. Create a pending candidate record
    const { data: candData, error: candError } = await sb.from('candidates').insert({
      owner_id: ownerId,
      canonical_name: sourceResult.displayName,
      headline: sourceResult.headline || null,
      location: sourceResult.location || null,
      current_company: sourceResult.organization || null,
      skills: sourceResult.skills || [],
      summary: `Source profile from ${sourceResult.source}. Pending recruiter review. Not verified.`,
      merge_status: 'pending',
    }).select('id').single()

    if (candError) return NextResponse.json({ ok: false, error: `candidates: ${candError.message}` }, { status: 500 })
    const candidateId = candData.id

    // 3. Link source_profile to candidate
    await sb.from('source_profiles').update({ candidate_id: candidateId }).eq('id', sourceProfileId)

    // 4. Persist evidence items
    if (Array.isArray(sourceResult.evidence) && sourceResult.evidence.length > 0) {
      await sb.from('evidence_items').insert(
        sourceResult.evidence.map((e: { label: string; detail: string; source: string; confidence?: string; url?: string }) => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          source: e.source || sourceResult.source,
          label: e.label,
          detail: e.detail,
          confidence: e.confidence || 'medium',
          url: e.url || null,
        }))
      )
    }

    // 5. Persist contact signals — ALWAYS verified=false
    if (Array.isArray(sourceResult.contactSignals) && sourceResult.contactSignals.length > 0) {
      await sb.from('candidate_contacts').insert(
        sourceResult.contactSignals.map((c: { type: string; value: string; source: string }) => ({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_profile_id: sourceProfileId,
          type: c.type,
          value: c.value,
          source: c.source || sourceResult.source,
          confidence: 'medium',
          verified: false,   // enforced — never set to true from source scrape
          permission_status: 'unknown',
        }))
      )
    }

    // 6. If projectId supplied, create project_candidates row
    let projectCandidateId: string | null = null
    if (projectId) {
      const { data: pcData } = await sb.from('project_candidates').upsert({
        project_id: projectId,
        candidate_id: candidateId,
        owner_id: ownerId,
        stage: 'sourced',
        fit_score: null,      // no auto-scoring — recruiter reviews
        fit_evidence: [],
        fit_missing: [],
        fit_confidence: 'low',
      }, { onConflict: 'project_id,candidate_id' }).select('id').single()
      projectCandidateId = pcData?.id ?? null
    }

    return NextResponse.json({
      ok: true,
      mode: 'supabase',
      candidateId,
      sourceProfileId,
      projectCandidateId,
      candidateUrl: `/app/candidate/${candidateId}`,
      note: 'Source profile saved. Candidate is pending — recruiter must confirm identity before merge.',
    })

  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Save failed.' }, { status: 500 })
  }
}
