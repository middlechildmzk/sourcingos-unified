import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { candidateIdentityFamiliesV36_10, resolveCanonicalCandidateIdV36_10 } from '@/lib/candidate-identity-redirects-v36-10'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

function missingArtifactTable(error: any) {
  return error?.code === '42P01' || /candidate_artifacts|relation .* does not exist/i.test(String(error?.message || ''))
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response
  const { id: requestedCandidateId } = await params

  if (gate.preview || !isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: 'preview', artifacts: [], migrationPending: false, note: 'Preview mode does not persist candidate artifacts yet.' })
  }

  const session = await getRouteSession()
  if (!session.authenticated) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase client unavailable.' }, { status: 500 })

  const ownerId = session.userId!
  const canonical = await resolveCanonicalCandidateIdV36_10({ sb, ownerId, candidateId: requestedCandidateId })
  const candidateId = canonical.candidateId
  const identityFamilies = await candidateIdentityFamiliesV36_10({ sb, ownerId, candidateIds: [candidateId] })
  const familyCandidateIds = identityFamilies.canonicalToFamily.get(candidateId) || [candidateId]

  const { data, error } = await sb
    .from('candidate_artifacts')
    .select('*')
    .eq('owner_id', ownerId)
    .in('candidate_id', familyCandidateIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    if (missingArtifactTable(error)) {
      return NextResponse.json({ ok: true, mode: 'supabase', artifacts: [], migrationPending: true, note: 'Candidate artifact migration has not been applied in this environment yet.' })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const artifacts = (data || []).map((row: any) => ({
    id: row.id,
    candidateId,
    historicalCandidateId: row.candidate_id !== candidateId ? row.candidate_id : undefined,
    sourceProfileId: row.source_profile_id || undefined,
    artifactType: row.artifact_type,
    dataOrigin: row.data_origin,
    fileName: row.file_name || undefined,
    mimeType: row.mime_type || undefined,
    sourceUrl: row.source_url || undefined,
    contentSha256: row.content_sha256,
    extractionVersion: row.extraction_version,
    rawTextLength: row.raw_text_length || 0,
    identityAnchors: row.identity_anchors || {},
    metadata: row.metadata || {},
    observedAt: row.observed_at,
    createdAt: row.created_at,
  }))

  return NextResponse.json({
    ok: true,
    mode: 'supabase',
    artifacts,
    migrationPending: false,
    identity: {
      canonicalCandidateId: candidateId,
      familyCandidateIds,
      absorbedCandidateIds: familyCandidateIds.filter(id => id !== candidateId),
      migrationReady: canonical.migrationReady && identityFamilies.migrationReady,
    },
  })
}
