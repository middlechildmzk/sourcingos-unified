import 'server-only'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { resolveCanonicalCandidateIdV36_10 } from '@/lib/candidate-identity-redirects-v36-10'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const { id: requestedCandidateId } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, preview: true, candidateId: requestedCandidateId, facts: [], documents: [], tasks: [] })
  }

  const session = await getRouteSession()
  if (!session.authenticated || !session.userId) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
  const sb = createServerSupabaseClient()
  if (!sb) return NextResponse.json({ ok: false, error: 'Supabase unavailable.' }, { status: 503 })

  const canonical = await resolveCanonicalCandidateIdV36_10({ sb, ownerId: session.userId, candidateId: requestedCandidateId })
  const candidateId = canonical.candidateId
  const [factsResult, documentsResult, tasksResult] = await Promise.all([
    sb.from('candidate_profile_facts')
      .select('id,fact_type,fact_key,value,confidence,verification_status,source,source_url,observed_at,artifact_id')
      .eq('owner_id', session.userId).eq('candidate_id', candidateId)
      .order('observed_at', { ascending: false }).limit(250),
    sb.from('public_document_leads')
      .select('id,url,host,document_kind,title,status,identity_confidence,identity_reason,restricted_reason,artifact_id,discovered_at,last_checked_at')
      .eq('owner_id', session.userId).eq('candidate_id', candidateId)
      .order('discovered_at', { ascending: false }).limit(50),
    sb.from('candidate_enrichment_tasks')
      .select('id,task_kind,agent_id,priority,status,attempts,max_attempts,last_error,result_summary,created_at,completed_at')
      .eq('owner_id', session.userId).eq('candidate_id', candidateId)
      .order('created_at', { ascending: false }).limit(50),
  ])

  const missingTable = [factsResult.error, documentsResult.error, tasksResult.error].find(error => error?.code === '42P01')
  if (missingTable) {
    return NextResponse.json({ ok: true, migrationPending: true, candidateId, facts: [], documents: [], tasks: [], note: 'V40.4 enrichment storage is not applied in this environment yet.' })
  }
  const error = factsResult.error || documentsResult.error || tasksResult.error
  if (error) return NextResponse.json({ ok: false, error: `Candidate enrichment could not be loaded: ${error.message}` }, { status: 502 })

  return NextResponse.json({
    ok: true,
    candidateId,
    requestedCandidateId,
    facts: factsResult.data || [],
    documents: documentsResult.data || [],
    tasks: tasksResult.data || [],
    trust: { contactValuesCaptured: false, identityMergeAuthorized: false, recruiterDecisionAutomated: false },
  })
}
